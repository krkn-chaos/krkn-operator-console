import { useState, useMemo } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Button,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  DataListToggle,
  DataListContent,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  Flex,
  FlexItem,
  Label,
  Modal,
  ModalVariant,
  DatePicker,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleAction,
  Alert,
  AlertActionLink,
  Tooltip,
  Dropdown,
  DropdownList,
  DropdownItem,
} from '@patternfly/react-core';
import {
  HourglassHalfIcon,
  SyncAltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  LockIcon,
  TopologyIcon,
  FileIcon,
} from '@patternfly/react-icons';
import { HiOutlineRocketLaunch } from 'react-icons/hi2';
import { LogViewer } from './LogViewer';
import { ActiveRunsSummary } from './ActiveRunsSummary';
import { GraphRunDetail } from './GraphRunDetail';
import { FileManagementModal } from './FileManagement';
import { useRole } from '../hooks/useRole';
import { useActiveRunsPoller } from '../hooks/useActiveRunsPoller';

import type { ScenarioRunState, ScenarioRunPhase, ClusterJobPhase, GraphRunState, GraphRunSummary, ResiliencyScoreResponse } from '../types/api';

// Unified run item type - can be either a GraphRun or a standalone ScenarioRun
type UnifiedRunItem =
  | {
      type: 'graph';
      graphRunName: string;
      nodes: ScenarioRunState[];
      phase: ScenarioRunPhase;
      createdAt: string;
      ownerUserId?: string;
      summary: GraphRunSummary;
      // Resiliency score fields
      resiliencyScoreEnabled?: boolean;
      resiliencyScoreBaseline?: number;
      resiliencyScore?: ResiliencyScoreResponse;
    }
  | { type: 'scenario'; run: ScenarioRunState };

// Job phases in which the pod has finished. A failed run that exhausts retries
// ends as 'MaxRetriesExceeded' (not 'Failed'), so it must be included here or its
// logs and terminal treatment get lost.
const TERMINAL_JOB_PHASES: ClusterJobPhase[] = ['Succeeded', 'Failed', 'MaxRetriesExceeded', 'Cancelled', 'Stopped'];

interface JobsListProps {
  scenarioRuns: ScenarioRunState[];
  expandedRunIds: Set<string>;
  expandedJobIds: Set<string>;
  pausedPollingRunIds: Set<string>;
  onToggleRunAccordion: (scenarioRunName: string) => void;
  onToggleJobAccordion: (jobId: string) => void;
  onDeleteScenarioRun: (scenarioRunName: string) => Promise<void>;
  onDeleteJob: (jobId: string) => Promise<void>;
  onCreateJob: () => void;
  onRefreshScenarioRun: (scenarioRunName: string) => void;
  onNavigateToStudio: () => void;
  // GraphRuns props
  graphRuns: GraphRunState[];
  expandedGraphRunIds: Set<string>;
  pausedGraphPollingIds: Set<string>;
  onToggleGraphRunAccordion: (graphRunName: string) => void;
  onDeleteGraphRun: (graphRunName: string) => Promise<void>;
}

export function JobsList({
  scenarioRuns,
  expandedRunIds,
  expandedJobIds,
  pausedPollingRunIds,
  onToggleRunAccordion,
  onToggleJobAccordion,
  onDeleteScenarioRun,
  onDeleteJob,
  onCreateJob,
  onRefreshScenarioRun,
  onNavigateToStudio,
  graphRuns: _graphRuns, // Not used - GraphRuns are derived from scenarioRuns
  expandedGraphRunIds,
  pausedGraphPollingIds: _pausedGraphPollingIds, // Not used yet - polling via useGraphRunsPoller
  onToggleGraphRunAccordion,
  onDeleteGraphRun,
}: JobsListProps) {
  const { isAdmin } = useRole();
  const { activeRuns, loading: activeRunsLoading, error: activeRunsError } = useActiveRunsPoller();
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const [deletingJob, setDeletingJob] = useState<string | null>(null);
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<string | null>(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<{ jobId: string; jobName: string } | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isOwnerSelectOpen, setIsOwnerSelectOpen] = useState(false);
  const [isRunDropdownOpen, setIsRunDropdownOpen] = useState(false);
  const [isFileManagementOpen, setIsFileManagementOpen] = useState(false);

  // Format timestamp for display
  const formatTimestamp = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Get scenario run phase display
  const getRunPhaseDisplay = (phase: ScenarioRunPhase) => {
    switch (phase) {
      case 'Pending':
        return { icon: <HourglassHalfIcon />, color: 'orange' as const, label: 'Pending' };
      case 'Running':
        return { icon: <SyncAltIcon className="pf-m-spin" />, color: 'blue' as const, label: 'Running' };
      case 'Succeeded':
        return { icon: <CheckCircleIcon />, color: 'green' as const, label: 'Succeeded' };
      case 'PartiallyFailed':
        return { icon: <ExclamationTriangleIcon />, color: 'orange' as const, label: 'Partially Failed' };
      case 'Failed':
        return { icon: <ExclamationCircleIcon />, color: 'red' as const, label: 'Failed' };
      default:
        return { icon: <ExclamationCircleIcon />, color: 'grey' as const, label: phase };
    }
  };

  // Get job phase display
  const getJobPhaseDisplay = (phase: ClusterJobPhase) => {
    switch (phase) {
      case 'Pending':
        return { icon: <HourglassHalfIcon />, color: 'orange' as const, label: 'Pending' };
      case 'Running':
        return { icon: <SyncAltIcon className="pf-m-spin" />, color: 'blue' as const, label: 'Running' };
      case 'Retrying':
        return { icon: <SyncAltIcon className="pf-m-spin" />, color: 'blue' as const, label: 'Retrying' };
      case 'Succeeded':
        return { icon: <CheckCircleIcon />, color: 'green' as const, label: 'Succeeded' };
      case 'Failed':
        return { icon: <ExclamationCircleIcon />, color: 'red' as const, label: 'Failed' };
      case 'MaxRetriesExceeded':
        // Terminal failure after all retries were exhausted - present it as a failure.
        return { icon: <ExclamationCircleIcon />, color: 'red' as const, label: 'Failed (retries exhausted)' };
      case 'Cancelled':
        return { icon: <ExclamationTriangleIcon />, color: 'orange' as const, label: 'Cancelled' };
      case 'Stopped':
        return { icon: <ExclamationTriangleIcon />, color: 'grey' as const, label: 'Stopped' };
      default:
        return { icon: <ExclamationCircleIcon />, color: 'grey' as const, label: phase };
    }
  };

  // Get resiliency score display with color based on ratio
  const getResiliencyScoreDisplay = (score: number, baseline: number) => {
    const ratio = score / baseline;

    if (ratio >= 1.0) {
      return { color: 'green' as const, label: score.toFixed(1), icon: <CheckCircleIcon /> };
    }
    if (ratio >= 0.95) {
      return { color: 'green' as const, label: score.toFixed(1), icon: <CheckCircleIcon /> };
    }
    if (ratio >= 0.9) {
      return { color: 'orange' as const, label: score.toFixed(1), icon: <ExclamationTriangleIcon /> };
    }
    if (ratio >= 0.8) {
      return { color: 'orange' as const, label: score.toFixed(1), icon: <ExclamationTriangleIcon /> };
    }
    return { color: 'red' as const, label: score.toFixed(1), icon: <ExclamationCircleIcon /> };
  };

  const handleConfirmDeleteRun = async () => {
    if (!confirmDeleteRun) return;

    setDeletingRun(confirmDeleteRun);
    setConfirmDeleteRun(null);

    try {
      // Determine if this is a GraphRun or ScenarioRun
      const isGraphRun = unifiedRuns.some(
        (item) => item.type === 'graph' && item.graphRunName === confirmDeleteRun
      );

      if (isGraphRun) {
        await onDeleteGraphRun(confirmDeleteRun);
      } else {
        await onDeleteScenarioRun(confirmDeleteRun);
      }
    } finally {
      setDeletingRun(null);
    }
  };

  const handleConfirmDeleteJob = async () => {
    if (!confirmDeleteJob) return;

    setDeletingJob(confirmDeleteJob.jobId);
    setConfirmDeleteJob(null);

    try {
      await onDeleteJob(confirmDeleteJob.jobId);
    } finally {
      setDeletingJob(null);
    }
  };

  // Get unique owner user IDs for autocomplete
  const uniqueOwners = Array.from(
    new Set(scenarioRuns.map((run) => run.ownerUserId).filter((id): id is string => !!id))
  ).sort();

  // Filter scenario runs by owner and date range
  const filteredScenarioRuns = scenarioRuns.filter((run) => {
    // Owner filter (exact match)
    if (ownerFilter && run.ownerUserId !== ownerFilter) {
      return false;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const runDate = new Date(run.createdAt);

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (runDate < fromDate) return false;
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (runDate > toDate) return false;
      }
    }

    return true;
  });

  // Group scenario runs into unified items (GraphRuns + standalone ScenarioRuns)
  const unifiedRuns = useMemo((): UnifiedRunItem[] => {
    const graphRunsMap = new Map<string, ScenarioRunState[]>();
    const standaloneRuns: ScenarioRunState[] = [];

    // Group by graphRunName
    filteredScenarioRuns.forEach((run) => {
      if (run.graphRunName) {
        const nodes = graphRunsMap.get(run.graphRunName) || [];
        nodes.push(run);
        graphRunsMap.set(run.graphRunName, nodes);
      } else {
        standaloneRuns.push(run);
      }
    });

    // Build unified items
    const items: UnifiedRunItem[] = [];

    // Add GraphRuns (join with graphRuns state to get summary)
    graphRunsMap.forEach((nodes, graphRunName) => {
      // Find matching GraphRunState to get summary
      const graphRunState = _graphRuns.find(gr => gr.name === graphRunName);

      // Use phase from GraphRunState if available, otherwise calculate from nodes
      // Map GraphRun phase ('Completed') to ScenarioRun phase ('Succeeded')
      let phase: ScenarioRunPhase = 'Pending';
      if (graphRunState) {
        // Map GraphRun phases to ScenarioRun phases
        if (graphRunState.phase === 'Completed') {
          phase = 'Succeeded';
        } else if (graphRunState.phase === 'Pending' || graphRunState.phase === 'Running' ||
                   graphRunState.phase === 'Failed' || graphRunState.phase === 'PartiallyFailed') {
          phase = graphRunState.phase;
        }
      } else {
        const hasFailed = nodes.some((n) => n.phase === 'Failed');
        const hasPartiallyFailed = nodes.some((n) => n.phase === 'PartiallyFailed');
        const hasRunning = nodes.some((n) => n.phase === 'Running');
        const allSucceeded = nodes.every((n) => n.phase === 'Succeeded');

        if (hasFailed || hasPartiallyFailed) {
          phase = 'Failed';
        } else if (allSucceeded) {
          phase = 'Succeeded';
        } else if (hasRunning) {
          phase = 'Running';
        }
      }

      // Use GraphRunState data if available
      const createdAt = graphRunState?.creationTimestamp || nodes.reduce((earliest, node) =>
        node.createdAt < earliest ? node.createdAt : earliest
      , nodes[0].createdAt);

      const ownerUserId = graphRunState?.ownerUserId || nodes[0].ownerUserId;

      // Use summary from GraphRunState (has correct totalNodes)
      const summary = graphRunState?.summary || {
        totalNodes: nodes.length,
        completedNodes: nodes.filter(n => n.phase === 'Succeeded').length,
        runningNodes: nodes.filter(n => n.phase === 'Running').length,
        failedNodes: nodes.filter(n => n.phase === 'Failed').length,
        pendingNodes: nodes.filter(n => n.phase === 'Pending').length,
      };

      // Get resiliency score fields from GraphRunState
      const resiliencyScoreEnabled = graphRunState?.resiliencyScoreEnabled;
      const resiliencyScoreBaseline = graphRunState?.resiliencyScoreBaseline;
      const resiliencyScore = graphRunState?.resiliencyScore;

      items.push({
        type: 'graph',
        graphRunName,
        nodes,
        phase,
        createdAt,
        ownerUserId,
        summary,
        resiliencyScoreEnabled,
        resiliencyScoreBaseline,
        resiliencyScore,
      });
    });

    // Add standalone ScenarioRuns
    standaloneRuns.forEach((run) => {
      items.push({ type: 'scenario', run });
    });

    // Sort by createdAt descending (most recent first)
    return items.sort((a, b) => {
      const aDate = a.type === 'graph' ? a.createdAt : a.run.createdAt;
      const bDate = b.type === 'graph' ? b.createdAt : b.run.createdAt;
      return bDate.localeCompare(aDate); // Reversed for descending
    });
  }, [filteredScenarioRuns, _graphRuns]);

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="lg">
              Scenario Runs
            </Title>
          </FlexItem>
          <FlexItem>
            {/* Split button dropdown - GitHub style */}
            <Dropdown
              isOpen={isRunDropdownOpen}
              onOpenChange={(isOpen) => setIsRunDropdownOpen(isOpen)}
              popperProps={{ position: 'right' }}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  splitButtonOptions={{
                    variant: 'action',
                    items: [
                      <MenuToggleAction
                        key="default-action"
                        onClick={onCreateJob}
                        aria-label="Run single scenario"
                      >
                        Run Scenarios
                      </MenuToggleAction>,
                    ],
                  }}
                  variant="primary"
                  onClick={() => setIsRunDropdownOpen(!isRunDropdownOpen)}
                  isExpanded={isRunDropdownOpen}
                  aria-label="Run scenarios options"
                />
              )}
            >
              <DropdownList>
                <DropdownItem
                  onClick={() => {
                    setIsRunDropdownOpen(false);
                    onCreateJob();
                  }}
                  description="Run a single chaos scenario on selected clusters"
                  icon={<HiOutlineRocketLaunch />}
                >
                  Single Scenario Run
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setIsRunDropdownOpen(false);
                    onNavigateToStudio();
                  }}
                  description="Design and run complex chaos scenario workflows"
                  icon={<TopologyIcon />}
                >
                  Chaos Studio
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setIsRunDropdownOpen(false);
                    setIsFileManagementOpen(true);
                  }}
                  description="Manage ConfigMap-based files for scenarios"
                  icon={<FileIcon />}
                >
                  Manage Files
                </DropdownItem>
              </DropdownList>
            </Dropdown>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        {/* Active Runs Summary */}
        <ActiveRunsSummary
          activeRuns={activeRuns}
          loading={activeRunsLoading}
          error={activeRunsError}
        />

        {/* Filters Box (Admin Only) */}
        {isAdmin && (uniqueOwners.length > 0 || scenarioRuns.length > 0) && (
          <Card
            isCompact
            style={{
              marginBottom: '1.5rem',
              backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
              border: '1px solid var(--pf-v5-global--BorderColor--100)',
            }}
          >
            <CardTitle>
              <Title headingLevel="h3" size="md">
                Filters
              </Title>
            </CardTitle>
            <CardBody>
              <style>{`
                .custom-select-toggle {
                  background-color: var(--pf-v5-global--BackgroundColor--100) !important;
                }
              `}</style>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {/* Owner Filter - Search with Autocomplete */}
                {uniqueOwners.length > 0 && (
                  <div>
                    <div style={{ marginBottom: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', fontWeight: 'bold' }}>
                      Filter by User:
                    </div>

                    {/* Show selected user as Label */}
                    {ownerFilter ? (
                      <Label
                        color="blue"
                        onClose={() => setOwnerFilter('')}
                        closeBtnAriaLabel="Remove user filter"
                      >
                        {ownerFilter}
                      </Label>
                    ) : (
                      <Select
                        isOpen={isOwnerSelectOpen}
                        onOpenChange={(isOpen) => setIsOwnerSelectOpen(isOpen)}
                        onSelect={(_event, value) => {
                          setOwnerFilter(value as string);
                          setIsOwnerSelectOpen(false);
                        }}
                        toggle={(toggleRef) => (
                          <MenuToggle
                            ref={toggleRef}
                            onClick={() => setIsOwnerSelectOpen(!isOwnerSelectOpen)}
                            isExpanded={isOwnerSelectOpen}
                            style={{ width: '222px' }}
                            className="custom-select-toggle"
                          >
                            {ownerFilter || 'Select user...'}
                          </MenuToggle>
                        )}
                      >
                        <SelectList>
                          {uniqueOwners.map(owner => (
                            <SelectOption key={owner} value={owner}>
                              {owner}
                            </SelectOption>
                          ))}
                        </SelectList>
                      </Select>
                    )}
                  </div>
                )}

                {/* Date From Filter */}
                {scenarioRuns.length > 0 && (
                  <div>
                    <div style={{ marginBottom: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', fontWeight: 'bold' }}>
                      From Date:
                    </div>
                    <DatePicker
                      value={dateFrom}
                      onChange={(_event, value) => setDateFrom(value)}
                      placeholder="Select start date"
                      aria-label="From date"
                      dateParse={(date) => {
                        const parsed = new Date(date);
                        return isNaN(parsed.getTime()) ? new Date() : parsed;
                      }}
                    />
                  </div>
                )}

                {/* Date To Filter */}
                {scenarioRuns.length > 0 && (
                  <div>
                    <div style={{ marginBottom: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', fontWeight: 'bold' }}>
                      To Date:
                    </div>
                    <DatePicker
                      value={dateTo}
                      onChange={(_event, value) => setDateTo(value)}
                      placeholder="Select end date"
                      aria-label="To date"
                      dateParse={(date) => {
                        const parsed = new Date(date);
                        return isNaN(parsed.getTime()) ? new Date() : parsed;
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Clear filters button */}
              {(ownerFilter || dateFrom || dateTo) && (
                <div style={{ marginTop: '1rem' }}>
                  <Button
                    variant="link"
                    isInline
                    onClick={() => {
                      setOwnerFilter('');
                      setDateFrom('');
                      setDateTo('');
                    }}
                  >
                    Clear all filters
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {unifiedRuns.length === 0 && scenarioRuns.length > 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={HiOutlineRocketLaunch} />
            <Title headingLevel="h2" size="lg">
              No Matching Runs
            </Title>
            <EmptyStateBody>
              No scenario runs match the current filter. Try clearing the filter.
            </EmptyStateBody>
          </EmptyState>
        ) : scenarioRuns.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={HiOutlineRocketLaunch} />
            <Title headingLevel="h2" size="lg">
              No Scenario Runs
            </Title>
            <EmptyStateBody>Click "Run Scenarios" to start a new execution.</EmptyStateBody>
          </EmptyState>
        ) : (
          <DataList aria-label="Scenario runs list" isCompact>
            {unifiedRuns.map((item) => {
              // Handle GraphRun
              if (item.type === 'graph') {
                const isGraphExpanded = expandedGraphRunIds.has(item.graphRunName);
                const phaseDisplay = getRunPhaseDisplay(item.phase);

                return (
                  <DataListItem key={item.graphRunName} isExpanded={isGraphExpanded}>
                    {/* GraphRun Summary Row */}
                    <DataListItemRow>
                      <DataListToggle
                        onClick={() => onToggleGraphRunAccordion(item.graphRunName)}
                        isExpanded={isGraphExpanded}
                        id={`toggle-graph-${item.graphRunName}`}
                        aria-controls={`expand-graph-${item.graphRunName}`}
                        style={{ display: 'flex', alignItems: 'center' }}
                      />
                      <DataListItemCells
                        dataListCells={[
                          <DataListCell key="status" width={1}>
                            <div>
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>Status:</strong>
                              </div>
                              <Label color={phaseDisplay.color} icon={phaseDisplay.icon}>
                                {phaseDisplay.label}
                              </Label>
                            </div>
                          </DataListCell>,
                          <DataListCell key="workflow" width={2}>
                            <div>
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>
                                  <TopologyIcon style={{ marginRight: '0.25rem' }} />
                                  Workflow:
                                </strong>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <code
                                  style={{
                                    fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                    fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                    backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                                    display: 'inline-block',
                                    border: '1px solid var(--pf-v5-global--BorderColor--100)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.graphRunName}
                                </code>
                              </div>
                            </div>
                          </DataListCell>,
                          <DataListCell key="owner" width={2}>
                            <div>
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>User:</strong>
                              </div>
                              <code
                                style={{
                                  fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                  fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                  backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                                  display: 'inline-block',
                                  border: '1px solid var(--pf-v5-global--BorderColor--100)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.ownerUserId || 'Unknown'}
                              </code>
                            </div>
                          </DataListCell>,
                          <DataListCell key="total-nodes" width={2}>
                            <div>
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>Graph Nodes:</strong>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Label color="blue" icon={<TopologyIcon />}>
                                  {item.summary.completedNodes} / {item.summary.totalNodes}
                                </Label>
                              </div>
                            </div>
                          </DataListCell>,
                          <DataListCell key="resiliency-score" width={2}>
                            <div>
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>Resiliency Score:</strong>
                              </div>
                              {item.resiliencyScoreEnabled ? (
                                item.resiliencyScore && item.resiliencyScoreBaseline !== undefined ? (
                                  <Tooltip
                                    content={`Score: ${item.resiliencyScore.calculated.toFixed(1)} / Baseline: ${item.resiliencyScoreBaseline.toFixed(1)} (${item.resiliencyScore.status})`}
                                  >
                                    <Label
                                      color={getResiliencyScoreDisplay(item.resiliencyScore.calculated, item.resiliencyScoreBaseline).color}
                                      icon={getResiliencyScoreDisplay(item.resiliencyScore.calculated, item.resiliencyScoreBaseline).icon}
                                    >
                                      {getResiliencyScoreDisplay(item.resiliencyScore.calculated, item.resiliencyScoreBaseline).label}
                                    </Label>
                                  </Tooltip>
                                ) : (
                                  <Tooltip content="Score calculation in progress...">
                                    <Label color="grey" icon={<SyncAltIcon className="pf-m-spin" />}>
                                      Calculating...
                                    </Label>
                                  </Tooltip>
                                )
                              ) : (
                                <Tooltip content="Resiliency score not enabled for this run">
                                  <Label color="grey">N/A</Label>
                                </Tooltip>
                              )}
                            </div>
                          </DataListCell>,
                          <DataListCell key="created" width={2}>
                            <div>
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>Created:</strong>
                              </div>
                              <code
                                style={{
                                  fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                  fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                  backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                                  display: 'inline-block',
                                  border: '1px solid var(--pf-v5-global--BorderColor--100)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatTimestamp(item.createdAt)}
                              </code>
                            </div>
                          </DataListCell>,
                          <DataListCell key="actions" width={1}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              <Button
                                variant="plain"
                                aria-label="Delete graph run"
                                onClick={() => setConfirmDeleteRun(item.graphRunName)}
                                isDisabled={deletingRun === item.graphRunName}
                                icon={<TrashIcon style={{ fontSize: '1.2rem' }} />}
                                style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
                              />
                            </div>
                          </DataListCell>,
                        ]}
                      />
                    </DataListItemRow>

                    {/* GraphRun Expanded Content - Show DAG visualization */}
                    <DataListContent
                      aria-label={`Graph run ${item.graphRunName} details`}
                      id={`expand-graph-${item.graphRunName}`}
                      isHidden={!isGraphExpanded}
                    >
                      {isGraphExpanded && (
                        <GraphRunDetail graphRunName={item.graphRunName} />
                      )}
                    </DataListContent>
                  </DataListItem>
                );
              }

              // Handle standalone ScenarioRun
              const run = item.run;
              const isRunExpanded = expandedRunIds.has(run.scenarioRunName);
              const runPhaseDisplay = getRunPhaseDisplay(run.phase);

              return (
                <DataListItem key={run.scenarioRunName} isExpanded={isRunExpanded}>
                  {/* Scenario Run Summary Row */}
                  <DataListItemRow>
                    <DataListToggle
                      onClick={() => onToggleRunAccordion(run.scenarioRunName)}
                      isExpanded={isRunExpanded}
                      id={`toggle-run-${run.scenarioRunName}`}
                      aria-controls={`expand-run-${run.scenarioRunName}`}
                      style={{ display: 'flex', alignItems: 'center' }}
                    />
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="status" width={1}>
                          <div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Status:</strong>
                            </div>
                            <Label color={runPhaseDisplay.color} icon={runPhaseDisplay.icon}>
                              {runPhaseDisplay.label}
                            </Label>
                          </div>
                        </DataListCell>,
                        <DataListCell key="scenario" width={2}>
                          <div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>
                                <HiOutlineRocketLaunch style={{ marginRight: '0.25rem' }} />
                                Scenario:
                              </strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <code
                                style={{
                                  fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                  fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                  backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                                  display: 'inline-block',
                                  border: '1px solid var(--pf-v5-global--BorderColor--100)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {run.scenarioName}
                              </code>
                              {run.registryName && (
                                <Tooltip content={<>Scenario running on <strong><em>{run.registryName}</em></strong> private registry</>}>
                                  <LockIcon
                                    style={{ color: 'var(--pf-v5-global--palette--gold-400)', fontSize: '1rem' }}
                                  />
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </DataListCell>,
                        <DataListCell key="owner" width={2}>
                          <div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>User:</strong>
                            </div>
                            <code
                              style={{
                                fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                                padding: '0.125rem 0.5rem',
                                borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                                display: 'inline-block',
                                border: '1px solid var(--pf-v5-global--BorderColor--100)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {run.ownerUserId || 'Unknown'}
                            </code>
                          </div>
                        </DataListCell>,
                        <DataListCell key="run-name" width={2}>
                          <div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Run Name:</strong>
                            </div>
                            <code
                              style={{
                                fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                                padding: '0.125rem 0.5rem',
                                borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                                display: 'inline-block',
                                border: '1px solid var(--pf-v5-global--BorderColor--100)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {run.scenarioRunName}
                            </code>
                          </div>
                        </DataListCell>,
                        <DataListCell key="jobs-summary" width={2}>
                          <div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Jobs:</strong>
                            </div>
                            <div style={{ fontSize: 'var(--pf-v5-global--FontSize--lg)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <span style={{ color: 'var(--pf-v5-global--success-color--100)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>✓</span> {run.successfulJobs}
                              </span>
                              <span style={{ color: 'var(--pf-v5-global--danger-color--100)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>✗</span> {run.failedJobs}
                              </span>
                              <span style={{ color: 'var(--pf-v5-global--info-color--100)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>⟳</span> {run.runningJobs}
                              </span>
                            </div>
                          </div>
                        </DataListCell>,
                        <DataListCell key="created" width={2}>
                          <div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Created:</strong>
                            </div>
                            <code
                              style={{
                                fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                                padding: '0.125rem 0.5rem',
                                borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                                display: 'inline-block',
                                border: '1px solid var(--pf-v5-global--BorderColor--100)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatTimestamp(run.createdAt)}
                            </code>
                          </div>
                        </DataListCell>,
                        <DataListCell key="actions" width={1}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Button
                              variant="plain"
                              aria-label="Delete scenario run"
                              onClick={() => setConfirmDeleteRun(run.scenarioRunName)}
                              isDisabled={deletingRun === run.scenarioRunName}
                              icon={<TrashIcon style={{ fontSize: '1.2rem' }} />}
                              style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
                            />
                          </div>
                        </DataListCell>,
                      ]}
                    />
                  </DataListItemRow>

                  {/* Scenario Run Details - Jobs List (expanded) */}
                  <DataListContent
                    aria-label={`Jobs for scenario run ${run.scenarioRunName}`}
                    id={`expand-run-${run.scenarioRunName}`}
                    isHidden={!isRunExpanded}
                  >
                    {isRunExpanded && (
                      <>
                        {/* Show banner when polling is paused for this run */}
                        {pausedPollingRunIds.has(run.scenarioRunName) && (
                          <Alert
                            variant="info"
                            isInline
                            title={['Succeeded', 'PartiallyFailed', 'Failed'].includes(run.phase)
                              ? "View mode"
                              : "Live updates paused"}
                            actionLinks={
                              !['Succeeded', 'PartiallyFailed', 'Failed'].includes(run.phase) && (
                                <AlertActionLink onClick={() => onRefreshScenarioRun(run.scenarioRunName)}>
                                  Refresh now
                                </AlertActionLink>
                              )
                            }
                            style={{ marginBottom: '1rem' }}
                          >
                            <p>
                              {['Succeeded', 'PartiallyFailed', 'Failed'].includes(run.phase)
                                ? "This run has completed. Close this view to resume monitoring active runs."
                                : "Automatic updates are paused while viewing this run to prevent log interruptions. Close this view to resume automatic updates, or click \"Refresh now\" for a manual update."}
                            </p>
                          </Alert>
                        )}

                        {run.clusterJobs && run.clusterJobs.length > 0 ? (
                          <div style={{ paddingLeft: '2rem' }}>
                            <DataList aria-label="Cluster jobs list" isCompact>
                              {run.clusterJobs.map((job) => {
                                const isJobExpanded = expandedJobIds.has(job.jobId);
                                const jobPhaseDisplay = getJobPhaseDisplay(job.phase);
                                const isDeleting = deletingJob === job.jobId;

                                return (
                                  <DataListItem key={job.jobId} isExpanded={isJobExpanded}>
                                    {/* Job Summary Row */}
                                    <DataListItemRow>
                                      <DataListToggle
                                        onClick={() => onToggleJobAccordion(job.jobId)}
                                        isExpanded={isJobExpanded}
                                        id={`toggle-job-${job.jobId}`}
                                        aria-controls={`expand-job-${job.jobId}`}
                                        style={{ display: 'flex', alignItems: 'center' }}
                                      />
                                      <DataListItemCells
                                        dataListCells={[
                                          <DataListCell key="status" width={2}>
                                            <div>
                                              <div style={{ marginBottom: '0.25rem' }}>
                                                <strong>Status:</strong>
                                              </div>
                                              <Label color={jobPhaseDisplay.color} icon={jobPhaseDisplay.icon}>
                                                {jobPhaseDisplay.label}
                                              </Label>
                                            </div>
                                          </DataListCell>,
                                          <DataListCell key="cluster" width={3}>
                                            <div>
                                              <div style={{ marginBottom: '0.25rem' }}>
                                                <strong>Cluster:</strong>
                                              </div>
                                              <code
                                                style={{
                                                  fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                                  fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                                  backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                                                  padding: '0.125rem 0.5rem',
                                                  borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                                                  display: 'inline-block',
                                                  border: '1px solid var(--pf-v5-global--BorderColor--100)',
                                                }}
                                              >
                                                {job.providerName}/{job.clusterName}
                                              </code>
                                            </div>
                                          </DataListCell>,
                                          <DataListCell key="times" width={4}>
                                            <div style={{ display: 'flex', gap: '2rem' }}>
                                              {job.startTime && (
                                                <div>
                                                  <div style={{ marginBottom: '0.25rem' }}>
                                                    <strong>Started:</strong>
                                                  </div>
                                                  <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                                    {formatTimestamp(job.startTime)}
                                                  </div>
                                                </div>
                                              )}
                                              {job.completionTime && (
                                                <div>
                                                  <div style={{ marginBottom: '0.25rem' }}>
                                                    <strong>Completed:</strong>
                                                  </div>
                                                  <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                                    {formatTimestamp(job.completionTime)}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </DataListCell>,
                                          <DataListCell key="actions" width={1}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                              {job.phase === 'Running' && (
                                                <Button
                                                  variant="plain"
                                                  aria-label="Delete job"
                                                  onClick={() => setConfirmDeleteJob({ jobId: job.jobId, jobName: `${run.scenarioRunName} - ${job.providerName}/${job.clusterName}` })}
                                                  isDisabled={deletingJob === job.jobId}
                                                  icon={<TrashIcon style={{ fontSize: '1.2rem' }} />}
                                                  style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
                                                />
                                              )}
                                            </div>
                                          </DataListCell>,
                                        ]}
                                      />
                                    </DataListItemRow>

                                    {/* Job Details (expanded) */}
                                    <DataListContent
                                      aria-label={`Details for job ${job.jobId}`}
                                      id={`expand-job-${job.jobId}`}
                                      isHidden={!isJobExpanded}
                                    >
                                      {isJobExpanded && (
                                        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                                          {/* Job Details */}
                                          <FlexItem>
                                            <div style={{ padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: '4px' }}>
                                              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', margin: 0 }}>
                                                <dt style={{ fontWeight: 'bold' }}>Provider:</dt>
                                                <dd style={{ margin: 0, fontFamily: 'monospace' }}>{job.providerName}</dd>

                                                <dt style={{ fontWeight: 'bold' }}>Cluster:</dt>
                                                <dd style={{ margin: 0, fontFamily: 'monospace' }}>{job.clusterName}</dd>

                                                <dt style={{ fontWeight: 'bold' }}>Pod Name:</dt>
                                                <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>{job.podName}</dd>

                                                {job.containerImage && (
                                                  <>
                                                    <dt style={{ fontWeight: 'bold' }}>Container Image:</dt>
                                                    <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)', wordBreak: 'break-all' }}>{job.containerImage}</dd>
                                                  </>
                                                )}

                                                <dt style={{ fontWeight: 'bold' }}>Job ID:</dt>
                                                <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>{job.jobId}</dd>

                                                <dt style={{ fontWeight: 'bold' }}>Phase:</dt>
                                                <dd style={{ margin: 0 }}>{job.phase}</dd>

                                                {job.startTime && (
                                                  <>
                                                    <dt style={{ fontWeight: 'bold' }}>Start Time:</dt>
                                                    <dd style={{ margin: 0 }}>{formatTimestamp(job.startTime)}</dd>
                                                  </>
                                                )}

                                                {job.completionTime && (
                                                  <>
                                                    <dt style={{ fontWeight: 'bold' }}>Completion Time:</dt>
                                                    <dd style={{ margin: 0 }}>{formatTimestamp(job.completionTime)}</dd>
                                                  </>
                                                )}

                                                {job.message && (
                                                  <>
                                                    <dt style={{ fontWeight: 'bold' }}>Message:</dt>
                                                    <dd style={{ margin: 0, color: 'var(--pf-v5-global--danger-color--100)' }}>{job.message}</dd>
                                                  </>
                                                )}
                                              </dl>
                                            </div>
                                          </FlexItem>

                                          {/* Logs for any job whose pod has started - running, retrying, or
                                              terminal (incl. failed/MaxRetriesExceeded/cancelled/stopped).
                                              'Pending' is the only phase with no pod yet, so it's the sole
                                              phase without a log viewer. */}
                                          {(job.phase === 'Running' || job.phase === 'Retrying' || TERMINAL_JOB_PHASES.includes(job.phase)) && (
                                            <FlexItem>
                                              <LogViewer
                                                scenarioRunName={run.scenarioRunName}
                                                jobId={job.jobId}
                                                clusterName={job.clusterName}
                                                podName={job.podName}
                                                status={job.phase}
                                                compact={true}
                                              />
                                            </FlexItem>
                                          )}

                                          {/* Delete button for non-terminal jobs */}
                                          {!TERMINAL_JOB_PHASES.includes(job.phase) && (
                                            <FlexItem>
                                              <Button
                                                variant="danger"
                                                onClick={() => setConfirmDeleteJob({ jobId: job.jobId, jobName: `${run.scenarioRunName} - ${job.providerName}/${job.clusterName}` })}
                                                isDisabled={isDeleting}
                                                isLoading={isDeleting}
                                              >
                                                {isDeleting ? 'Deleting...' : 'Delete Job'}
                                              </Button>
                                            </FlexItem>
                                          )}
                                        </Flex>
                                      )}
                                    </DataListContent>
                                  </DataListItem>
                                );
                              })}
                            </DataList>
                          </div>
                        ) : (
                          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
                            No jobs available for this scenario run
                          </div>
                        )}
                      </>
                    )}
                  </DataListContent>
                </DataListItem>
              );
            })}
          </DataList>
        )}
      </CardBody>

      {/* Confirmation Modal for Run Deletion (Scenario or Graph) */}
      <Modal
        variant={ModalVariant.small}
        title={
          confirmDeleteRun &&
          unifiedRuns.some((item) => item.type === 'graph' && item.graphRunName === confirmDeleteRun)
            ? 'Delete Graph Run'
            : 'Delete Scenario Run'
        }
        isOpen={confirmDeleteRun !== null}
        onClose={() => setConfirmDeleteRun(null)}
        actions={[
          <Button
            key="confirm"
            variant="danger"
            onClick={handleConfirmDeleteRun}
            isLoading={deletingRun !== null}
            isDisabled={deletingRun !== null}
          >
            {deletingRun !== null ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setConfirmDeleteRun(null)}>
            Cancel
          </Button>,
        ]}
      >
        {confirmDeleteRun &&
        unifiedRuns.some((item) => item.type === 'graph' && item.graphRunName === confirmDeleteRun) ? (
          <>
            Are you sure you want to delete graph run <strong>{confirmDeleteRun}</strong>?
            <br />
            <br />
            This will delete all associated scenario runs in the workflow.
          </>
        ) : (
          <>
            Are you sure you want to delete scenario run <strong>{confirmDeleteRun}</strong>?
          </>
        )}
      </Modal>

      {/* Confirmation Modal for Job Deletion */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Job"
        isOpen={confirmDeleteJob !== null}
        onClose={() => setConfirmDeleteJob(null)}
        actions={[
          <Button
            key="confirm"
            variant="danger"
            onClick={handleConfirmDeleteJob}
            isLoading={deletingJob !== null}
            isDisabled={deletingJob !== null}
          >
            {deletingJob !== null ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setConfirmDeleteJob(null)}>
            Cancel
          </Button>,
        ]}
      >
        Are you sure you want to delete job <strong>{confirmDeleteJob?.jobName}</strong>?
      </Modal>

      {/* File Management Modal */}
      <FileManagementModal
        isOpen={isFileManagementOpen}
        onClose={() => setIsFileManagementOpen(false)}
      />
    </Card>
  );
}
