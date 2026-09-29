import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Spinner,
  EmptyStateBody,
  Title,
  Flex,
  FlexItem,
  Label,
  Modal,
  ModalVariant,
  DatePicker,
  InputGroup,
  InputGroupItem,
  isValidDate,
  yyyyMMddFormat,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  Tooltip,
  TextInput,
  Pagination,
  PaginationVariant,
  Alert,
  AlertActionCloseButton,
} from '@patternfly/react-core';
import {
  HourglassHalfIcon,
  SyncAltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  RedoIcon,
  LockIcon,
  TopologyIcon,
} from '@patternfly/react-icons';
import { HiOutlineRocketLaunch } from 'react-icons/hi2';
import { LogViewer } from './LogViewer';
import { ActiveRunsSummary } from './ActiveRunsSummary';
import { GraphRunDetail } from './GraphRunDetail';
import { JobStatsSummary } from './JobStatsSummary';
import { ReportDownloadButton } from './ReportDownloadButton';
import { useRole } from '../hooks/useRole';
import { useActiveRunsPoller } from '../hooks/useActiveRunsPoller';
import { useJobs } from '../hooks/useJobs';
import { ResiliencyScoreTooltip } from './ResiliencyScoreTooltip';
import { ScenarioConfigDisplay } from './ScenarioConfigDisplay';
import { RunCategoryActions, RunCategoryStripe } from './RunCategoryActions';
import { operatorApi } from '../services/operatorApi';

import type { CategoryResponse, ScenarioRunState, ScenarioRunPhase, ClusterJobPhase, GraphRunSummary, GraphClusterScore, UnifiedJobItem, StudioWorkflow } from '../types/api';

export type UnifiedRunItem =
  | {
      type: 'graph';
      categories: string[];
      graphRunName: string;
      nodes: ScenarioRunState[];
      phase: ScenarioRunPhase;
      createdAt: string;
      ownerUserId?: string;
      summary: GraphRunSummary;
      resiliencyScoreEnabled?: boolean;
      resiliencyScoreBaseline?: number;
      resiliencyScores?: GraphClusterScore[];
    }
  | { type: 'scenario'; run: ScenarioRunState; categories: string[] };

function toUnifiedRunItem(item: UnifiedJobItem): UnifiedRunItem {
  if (item.type === 'graphRun') {
    const gr = item.graphRun;
    if (gr) {
      let phase: ScenarioRunPhase = 'Pending';
      if (gr.phase === 'Completed') phase = 'Succeeded';
      else if (gr.phase === 'Running' || gr.phase === 'Failed' || gr.phase === 'PartiallyFailed' || gr.phase === 'Pending') {
        phase = gr.phase;
      }
      return {
        type: 'graph',
        categories: item.categories || [],
        graphRunName: item.name,
        nodes: [],
        phase,
        createdAt: item.createdAt,
        ownerUserId: gr.ownerUserId,
        summary: gr.summary,
        resiliencyScoreEnabled: gr.resiliencyScoreEnabled,
        resiliencyScoreBaseline: gr.resiliencyScoreBaseline,
        resiliencyScores: gr.resiliencyScores,
      };
    }
    return {
      type: 'graph',
      categories: item.categories || [],
      graphRunName: item.name,
      nodes: [],
      phase: 'Pending',
      createdAt: item.createdAt,
      summary: { totalNodes: 0, completedNodes: 0, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
    };
  }
  const sr = item.scenarioRun;
  if (sr) {
    return {
      type: 'scenario',
      categories: item.categories || [],
      run: {
        scenarioRunName: sr.scenarioRunName,
        scenarioName: sr.scenarioName || '',
        phase: sr.phase,
        totalTargets: sr.totalTargets,
        successfulJobs: sr.successfulJobs,
        failedJobs: sr.failedJobs,
        runningJobs: sr.runningJobs,
        clusterJobs: sr.clusterJobs,
        createdAt: item.createdAt,
        ownerUserId: sr.ownerUserId,
        registryName: sr.registryName,
        graphRunName: sr.graphRunName,
        customRunName: sr.customRunName,
      },
    };
  }
  return {
    type: 'scenario',
    categories: item.categories || [],
    run: {
      scenarioRunName: item.name,
      scenarioName: '',
      phase: 'Pending',
      totalTargets: 0,
      successfulJobs: 0,
      failedJobs: 0,
      runningJobs: 0,
      clusterJobs: [],
      createdAt: item.createdAt,
    },
  };
}

interface JobsListProps {
  expandedRunIds: Set<string>;
  expandedJobIds: Set<string>;
  onToggleRunAccordion: (scenarioRunName: string) => void;
  onToggleJobAccordion: (jobId: string) => void;
  onDeleteScenarioRun: (scenarioRunName: string) => Promise<void>;
  onDeleteJob: (jobId: string) => Promise<void>;
  onRerunScenario: (run: ScenarioRunState, jobId: string) => void;
  expandedGraphRunIds: Set<string>;
  onToggleGraphRunAccordion: (graphRunName: string) => void;
  onDeleteGraphRun: (graphRunName: string) => Promise<void>;
  onReplayWorkflow?: (workflow: StudioWorkflow, categories: string[]) => void;
  loadingRunDetails: Set<string>;
}

export function JobsList({
  expandedRunIds,
  expandedJobIds,
  onToggleRunAccordion,
  onToggleJobAccordion,
  onDeleteScenarioRun,
  onDeleteJob,
  onRerunScenario,
  expandedGraphRunIds,
  onToggleGraphRunAccordion,
  onDeleteGraphRun,
  onReplayWorkflow,
  loadingRunDetails,
}: JobsListProps) {
  const { isAdmin } = useRole();
  const { activeRuns, loading: activeRunsLoading, error: activeRunsError } = useActiveRunsPoller();
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false);
  const {
    jobs,
    pagination,
    stats,
    hasReceivedStats,
    page,
    setPage,
    limit,
    setLimit,
    isLoading,
    snapshotVersion,
    refresh: refreshJobs,
  } = useJobs(categoryFilters);
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const [deletingJob, setDeletingJob] = useState<string | null>(null);
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<string | null>(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<{ jobId: string; jobName: string } | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [dateTimeFrom, setDateTimeFrom] = useState<Date | undefined>();
  const [dateTimeTo, setDateTimeTo] = useState<Date | undefined>();
  const [timeRangeError, setTimeRangeError] = useState('');
  const [customRunNameFilter, setCustomRunNameFilter] = useState<string>('');
  const [isOwnerSelectOpen, setIsOwnerSelectOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string[]>>({});
  const [categoryOverrideSnapshotVersions, setCategoryOverrideSnapshotVersions] = useState<Record<string, number>>({});
  const [categoryUpdateKeys, setCategoryUpdateKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const reconciledKeys = Object.entries(categoryOverrideSnapshotVersions)
      .filter(([, version]) => snapshotVersion > version)
      .map(([key]) => key);
    if (reconciledKeys.length === 0) return;

    setCategoryOverrides((current) => {
      const next = { ...current };
      reconciledKeys.forEach((key) => delete next[key]);
      return next;
    });
    setCategoryOverrideSnapshotVersions((current) => {
      const next = { ...current };
      reconciledKeys.forEach((key) => delete next[key]);
      return next;
    });
  }, [categoryOverrideSnapshotVersions, snapshotVersion]);

  const loadCategories = useCallback(async () => {
    setIsCategoriesLoading(true);
    setCategoryError(null);
    try {
      const response = await operatorApi.getCategories();
      setCategories(response.categories || []);
    } catch (error) {
      setCategories([]);
      setCategoryError(error instanceof Error ? error.message : 'Failed to load categories');
    } finally {
      setIsCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

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
      case 'Succeeded':
        return { icon: <CheckCircleIcon />, color: 'green' as const, label: 'Succeeded' };
      case 'Failed':
        return { icon: <ExclamationCircleIcon />, color: 'red' as const, label: 'Failed' };
      case 'MaxRetriesExceeded':
        return { icon: <ExclamationCircleIcon />, color: 'red' as const, label: 'Max retries exceeded' };
      default:
        return { icon: <ExclamationCircleIcon />, color: 'grey' as const, label: phase };
    }
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

  const runCategoryKey = (runType: 'scenario-runs' | 'graph-runs', runName: string) => `${runType}/${runName}`;

  const handleToggleRunCategory = async (
    runType: 'scenario-runs' | 'graph-runs',
    runName: string,
    currentCategoryNames: string[],
    category: CategoryResponse,
  ) => {
    const key = runCategoryKey(runType, runName);
    if (categoryUpdateKeys.has(key)) return;

    const isCurrentlyAssigned = currentCategoryNames.includes(category.name);
    const nextCategoryNames = isCurrentlyAssigned
      ? currentCategoryNames.filter((name) => name !== category.name)
      : [...currentCategoryNames, category.name].sort();

    setCategoryUpdateKeys((current) => new Set(current).add(key));
    setCategoryError(null);
    setCategoryOverrides((current) => ({ ...current, [key]: nextCategoryNames }));
    try {
      await operatorApi.updateCategoryAssociation(category.name, runType, runName, !isCurrentlyAssigned);
      setCategoryOverrideSnapshotVersions((current) => ({ ...current, [key]: snapshotVersion }));
      refreshJobs();
    } catch (error) {
      setCategoryOverrides((current) => ({ ...current, [key]: currentCategoryNames }));
      setCategoryError(error instanceof Error ? error.message : 'Failed to update category assignment');
    } finally {
      setCategoryUpdateKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const getRunCategories = (runType: 'scenario-runs' | 'graph-runs', runName: string, names: string[]) => {
    const assignedNames = categoryOverrides[runCategoryKey(runType, runName)] ?? names;
    return categories.filter((category) => assignedNames.includes(category.name));
  };

  const toTimeValue = (date: Date | undefined): string => {
    if (!isValidDate(date)) return '';
    const d = date!;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const onFromDateChange = (_event: React.FormEvent, inputDate: string, newFromDate?: Date) => {
    if (!newFromDate) return;
    if (isValidDate(newFromDate) && inputDate === yyyyMMddFormat(newFromDate)) {
      newFromDate.setHours(0, 0, 0, 0);
      setDateTimeFrom(new Date(newFromDate));
    }
    setTimeRangeError('');
  };

  const onFromTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;
    const [h, m, s] = value.split(':').map(Number);
    if (isNaN(h)) return;
    setDateTimeFrom(prev => {
      if (!isValidDate(prev)) return prev;
      const updated = new Date(prev!);
      updated.setHours(h, m ?? 0, s ?? 0, 0);
      return updated;
    });
    if (isValidDate(dateTimeFrom) && isValidDate(dateTimeTo) &&
        yyyyMMddFormat(dateTimeFrom!) === yyyyMMddFormat(dateTimeTo!)) {
      const fromWithTime = new Date(dateTimeFrom!);
      fromWithTime.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
      setTimeRangeError(fromWithTime >= dateTimeTo! ? 'Start time must be before end time' : '');
    } else {
      setTimeRangeError('');
    }
  };

  const fromValidator = (date: Date) => {
    if (!isValidDate(dateTimeTo)) return '';
    const dayStr = yyyyMMddFormat(date);
    const toStr = yyyyMMddFormat(dateTimeTo!);
    if (dayStr > toStr) return 'Start date must be before end date';
    if (dayStr === toStr && isValidDate(dateTimeFrom)) {
      const fromWithTime = new Date(date);
      fromWithTime.setHours(dateTimeFrom!.getHours(), dateTimeFrom!.getMinutes(), dateTimeFrom!.getSeconds(), 0);
      if (fromWithTime >= dateTimeTo!) return 'Start time must be before end time';
    }
    return '';
  };

  const toValidator = (date: Date) => {
    if (!isValidDate(dateTimeFrom)) return '';
    const dayStr = yyyyMMddFormat(date);
    const fromStr = yyyyMMddFormat(dateTimeFrom!);
    if (dayStr < fromStr) return 'End date must be after start date';
    if (dayStr === fromStr && isValidDate(dateTimeTo)) {
      const toWithTime = new Date(date);
      toWithTime.setHours(dateTimeTo!.getHours(), dateTimeTo!.getMinutes(), dateTimeTo!.getSeconds(), 0);
      if (toWithTime <= dateTimeFrom!) return 'End time must be after start time';
    }
    return '';
  };

  const onToDateChange = (_event: React.FormEvent, inputDate: string, newToDate?: Date) => {
    if (!newToDate) return;
    if (isValidDate(newToDate) && inputDate === yyyyMMddFormat(newToDate)) {
      newToDate.setHours(23, 59, 59, 0);
      setDateTimeTo(new Date(newToDate));
    }
    setTimeRangeError('');
  };

  const onToTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;
    const [h, m, s] = value.split(':').map(Number);
    if (isNaN(h)) return;
    setDateTimeTo(prev => {
      if (!isValidDate(prev)) return prev;
      const updated = new Date(prev!);
      updated.setHours(h, m ?? 0, s ?? 0, 0);
      return updated;
    });
    if (isValidDate(dateTimeFrom) && isValidDate(dateTimeTo) &&
        yyyyMMddFormat(dateTimeFrom!) === yyyyMMddFormat(dateTimeTo!)) {
      const toWithTime = new Date(dateTimeTo!);
      toWithTime.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
      setTimeRangeError(toWithTime <= dateTimeFrom! ? 'End time must be after start time' : '');
    } else {
      setTimeRangeError('');
    }
  };

  // Map API items → internal rendering items (server handles merging/sorting/pagination)
  const unifiedRuns = useMemo((): UnifiedRunItem[] => {
    return jobs.map(toUnifiedRunItem);
  }, [jobs]);

  // Get unique owner user IDs from current page for autocomplete
  const uniqueOwners = useMemo(() => {
    return Array.from(
      new Set(
        unifiedRuns.map((item) =>
          item.type === 'graph' ? item.ownerUserId : item.run.ownerUserId
        ).filter((id): id is string => !!id)
      )
    ).sort();
  }, [unifiedRuns]);

  // Client-side filtering on current page
  const filteredUnifiedRuns = useMemo((): UnifiedRunItem[] => {
    return unifiedRuns.filter((item) => {
      const owner = item.type === 'graph' ? item.ownerUserId : item.run.ownerUserId;
      if (ownerFilter && owner !== ownerFilter) return false;

      if (isValidDate(dateTimeFrom) || isValidDate(dateTimeTo)) {
        const dateStr = item.type === 'graph' ? item.createdAt : item.run.createdAt;
        const runDate = new Date(dateStr);
        if (isNaN(runDate.getTime())) return false;
        if (isValidDate(dateTimeFrom) && runDate < dateTimeFrom!) return false;
        if (isValidDate(dateTimeTo) && runDate > dateTimeTo!) return false;
      }

      const runName = item.type === 'graph' ? item.graphRunName : item.run.scenarioRunName;
      const runType = item.type === 'graph' ? 'graph-runs' : 'scenario-runs';
      const assignedCategories = categoryOverrides[runCategoryKey(runType, runName)] ?? item.categories;
      if (categoryFilters.length > 0 && !categoryFilters.some((name) => assignedCategories.includes(name))) return false;

      if (customRunNameFilter) {
        const needle = customRunNameFilter.toLowerCase();
        const haystacks = item.type === 'graph'
          ? [item.graphRunName.toLowerCase()]
          : [item.run.scenarioRunName.toLowerCase(), ...(item.run.customRunName ? [item.run.customRunName.toLowerCase()] : [])];
        if (!haystacks.some((h) => h.includes(needle))) return false;
      }

      return true;
    });
  }, [unifiedRuns, ownerFilter, dateTimeFrom, dateTimeTo, customRunNameFilter, categoryFilters, categoryOverrides]);

  const hasActiveFilters = Boolean(ownerFilter || isValidDate(dateTimeFrom) || isValidDate(dateTimeTo) || customRunNameFilter || categoryFilters.length > 0);

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="lg">
              Scenario Runs
            </Title>
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
        {categoryError && (
          <Alert
            variant="danger"
            title="Category action failed"
            isInline
            style={{ marginTop: '1rem' }}
            actionClose={<AlertActionCloseButton onClose={() => setCategoryError(null)} />}
          >
            {categoryError}
          </Alert>
        )}

        {/* Filters Box */}
        {(jobs.length > 0 || categoryFilters.length > 0) && (
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
                {/* Category Filter */}
                <div>
                  <div style={{ marginBottom: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', fontWeight: 'bold' }}>
                    Filter by Category:
                  </div>
                  <Select
                    isOpen={isCategorySelectOpen}
                    onOpenChange={setIsCategorySelectOpen}
                    onSelect={(_event, value) => {
                      const categoryName = value as string;
                      setCategoryFilters((current) => current.includes(categoryName)
                        ? current.filter((name) => name !== categoryName)
                        : [...current, categoryName].sort());
                      setPage(1);
                    }}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsCategorySelectOpen((open) => !open)}
                        isExpanded={isCategorySelectOpen}
                        style={{ width: '222px' }}
                        className="custom-select-toggle"
                        aria-label="Filter by category"
                      >
                        {categoryFilters.length === 0
                          ? 'All categories'
                          : `${categoryFilters.length} ${categoryFilters.length === 1 ? 'category' : 'categories'} selected`}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      {categories.map((category) => (
                        <SelectOption
                          key={category.name}
                          value={category.name}
                          hasCheckbox
                          isSelected={categoryFilters.includes(category.name)}
                          icon={<span aria-hidden="true" style={{ display: 'inline-block', width: '0.75rem', height: '0.75rem', borderRadius: '50%', backgroundColor: category.color }} />}
                        >
                          {category.name}
                        </SelectOption>
                      ))}
                      {categories.length === 0 && (
                        <SelectOption value="no-categories" isDisabled>{isCategoriesLoading ? 'Loading categories…' : 'No categories available'}</SelectOption>
                      )}
                    </SelectList>
                  </Select>
                </div>

                {/* Run Name Filter */}
                <div>
                  <div style={{ marginBottom: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', fontWeight: 'bold' }}>
                    Filter by Run Name:
                  </div>
                  <TextInput
                    type="text"
                    value={customRunNameFilter}
                    onChange={(_event, value) => setCustomRunNameFilter(value)}
                    placeholder="Search by run name…"
                    aria-label="Filter by run name"
                    style={{ width: '222px' }}
                  />
                </div>

                {/* Owner Filter - Search with Autocomplete (Admin Only) */}
                {isAdmin && uniqueOwners.length > 0 && (
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
                {jobs.length > 0 && (
                  <div>
                    <div style={{ marginBottom: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', fontWeight: 'bold' }}>
                      From:
                    </div>
                    <InputGroup>
                      <InputGroupItem>
                        <DatePicker
                          value={isValidDate(dateTimeFrom) ? yyyyMMddFormat(dateTimeFrom!) : ''}
                          onChange={onFromDateChange}
                          validators={[fromValidator]}
                          aria-label="Start date"
                          placeholder="Start date"
                        />
                      </InputGroupItem>
                      <InputGroupItem>
                        <input
                          key={isValidDate(dateTimeFrom) ? yyyyMMddFormat(dateTimeFrom!) : 'no-from-date'}
                          type="time"
                          step="1"
                          aria-label="Start time"
                          defaultValue={toTimeValue(dateTimeFrom)}
                          onChange={onFromTimeChange}
                          disabled={!isValidDate(dateTimeFrom)}
                          style={{ height: '36px', padding: '0 0.5rem', border: '1px solid var(--pf-v5-global--BorderColor--100)', borderRadius: 'var(--pf-v5-global--BorderRadius--sm)', background: 'var(--pf-v5-global--BackgroundColor--100)', color: 'var(--pf-v5-global--Color--100)' }}
                        />
                      </InputGroupItem>
                    </InputGroup>
                  </div>
                )}

                {/* Date To Filter */}
                {jobs.length > 0 && (
                  <div>
                    <div style={{ marginBottom: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', fontWeight: 'bold' }}>
                      To:
                    </div>
                    <InputGroup>
                      <InputGroupItem>
                        <DatePicker
                          value={isValidDate(dateTimeTo) ? yyyyMMddFormat(dateTimeTo!) : ''}
                          onChange={onToDateChange}
                          isDisabled={!isValidDate(dateTimeFrom)}
                          rangeStart={dateTimeFrom}
                          validators={[toValidator]}
                          aria-label="End date"
                          placeholder="End date"
                        />
                      </InputGroupItem>
                      <InputGroupItem>
                        <input
                          key={isValidDate(dateTimeTo) ? yyyyMMddFormat(dateTimeTo!) : 'no-to-date'}
                          type="time"
                          step="1"
                          aria-label="End time"
                          defaultValue={toTimeValue(dateTimeTo)}
                          onChange={onToTimeChange}
                          disabled={!isValidDate(dateTimeTo)}
                          style={{ height: '36px', padding: '0 0.5rem', border: '1px solid var(--pf-v5-global--BorderColor--100)', borderRadius: 'var(--pf-v5-global--BorderRadius--sm)', background: 'var(--pf-v5-global--BackgroundColor--100)', color: 'var(--pf-v5-global--Color--100)' }}
                        />
                      </InputGroupItem>
                    </InputGroup>
                  </div>
                )}
              </div>

              {/* Time range validation error */}
              {timeRangeError && (
                <div style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--danger-color--100)', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                  {timeRangeError}
                </div>
              )}

              {/* Clear filters button */}
              {hasActiveFilters && (
                <div style={{ marginTop: '1rem' }}>
                  <Button
                    variant="link"
                    isInline
                    onClick={() => {
                      setOwnerFilter('');
                      setDateTimeFrom(undefined);
                      setDateTimeTo(undefined);
                      setCustomRunNameFilter('');
                      setCategoryFilters([]);
                      setPage(1);
                      setTimeRangeError('');
                    }}
                  >
                    Clear all filters
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {isLoading && jobs.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={Spinner} />
            <Title headingLevel="h2" size="lg">
              Loading Jobs
            </Title>
            <EmptyStateBody>Fetching scenario runs...</EmptyStateBody>
          </EmptyState>
        ) : filteredUnifiedRuns.length === 0 && (jobs.length > 0 || hasActiveFilters) ? (
          <EmptyState>
            <EmptyStateIcon icon={HiOutlineRocketLaunch} />
            <Title headingLevel="h2" size="lg">
              No Matching Runs
            </Title>
            <EmptyStateBody>
              No scenario runs match the current filter. Try clearing the filter.
            </EmptyStateBody>
          </EmptyState>
        ) : jobs.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={HiOutlineRocketLaunch} />
            <Title headingLevel="h2" size="lg">
              No Scenario Runs
            </Title>
            <EmptyStateBody>Use "Run Scenario" in the sidebar to start a new execution.</EmptyStateBody>
          </EmptyState>
        ) : (
          <>
          {hasReceivedStats && <JobStatsSummary stats={stats} />}
          <DataList aria-label="Scenario runs list" isCompact>
            {filteredUnifiedRuns.map((item) => {
              // Handle GraphRun
              if (item.type === 'graph') {
                const isGraphExpanded = expandedGraphRunIds.has(item.graphRunName);
                const phaseDisplay = getRunPhaseDisplay(item.phase);
                const graphCategoryKey = runCategoryKey('graph-runs', item.graphRunName);
                const graphCategoryNames = categoryOverrides[graphCategoryKey] ?? item.categories;
                const graphCategories = getRunCategories('graph-runs', item.graphRunName, item.categories);

                return (
                  <DataListItem key={item.graphRunName} isExpanded={isGraphExpanded}>
                    {/* GraphRun Summary Row */}
                    <DataListItemRow style={{ position: 'relative' }}>
                      <RunCategoryStripe categories={graphCategories} />
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
                              <ResiliencyScoreTooltip
                                scores={item.resiliencyScores}
                                baseline={item.resiliencyScoreBaseline}
                              />
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
                              <RunCategoryActions
                                runName={item.graphRunName}
                categories={categories}
                assignedCategoryNames={graphCategoryNames}
                isCategoriesLoading={isCategoriesLoading}
                categoriesError={categoryError}
                isCategoryUpdating={categoryUpdateKeys.has(graphCategoryKey)}
                isDeleting={deletingRun === item.graphRunName}
                onOpenCategories={() => { void loadCategories(); }}
                onToggleCategory={(category) => {
                                  void handleToggleRunCategory('graph-runs', item.graphRunName, graphCategoryNames, category);
                                }}
                                onDelete={() => setConfirmDeleteRun(item.graphRunName)}
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
                        <GraphRunDetail graphRunName={item.graphRunName} onReplayWorkflow={onReplayWorkflow} />
                      )}
                    </DataListContent>
                  </DataListItem>
                );
              }

              // Handle standalone ScenarioRun
              const run = item.run;
              const isRunExpanded = expandedRunIds.has(run.scenarioRunName);
              const runPhaseDisplay = getRunPhaseDisplay(run.phase);
              const scenarioCategoryKey = runCategoryKey('scenario-runs', run.scenarioRunName);
              const scenarioCategoryNames = categoryOverrides[scenarioCategoryKey] ?? item.categories;
              const scenarioCategories = getRunCategories('scenario-runs', run.scenarioRunName, item.categories);

              return (
                <DataListItem key={run.scenarioRunName} isExpanded={isRunExpanded}>
                  {/* Scenario Run Summary Row */}
                  <DataListItemRow style={{ position: 'relative' }}>
                    <RunCategoryStripe categories={scenarioCategories} />
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
                            {run.customRunName ? (
                              <>
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
                                    marginBottom: '0.25rem',
                                  }}
                                >
                                  {run.customRunName}
                                </code>
                                <div>
                                  <code
                                    style={{
                                      fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                      fontSize: 'var(--pf-v5-global--FontSize--xs)',
                                      color: 'var(--pf-v5-global--Color--200)',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {run.scenarioRunName}
                                  </code>
                                </div>
                              </>
                            ) : (
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
                            )}
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
                        <DataListCell key="reports" width={3}>
                          <ReportDownloadButton
                            runId={run.scenarioRunName}
                            runName={run.scenarioRunName}
                            runPhase={run.phase}
                          />
                        </DataListCell>,
                        <DataListCell key="actions" width={1}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <RunCategoryActions
                              runName={run.scenarioRunName}
                              categories={categories}
                              assignedCategoryNames={scenarioCategoryNames}
                              isCategoriesLoading={isCategoriesLoading}
                              categoriesError={categoryError}
                              isCategoryUpdating={categoryUpdateKeys.has(scenarioCategoryKey)}
                              isDeleting={deletingRun === run.scenarioRunName}
                              onOpenCategories={() => { void loadCategories(); }}
                              onToggleCategory={(category) => {
                                void handleToggleRunCategory('scenario-runs', run.scenarioRunName, scenarioCategoryNames, category);
                              }}
                              onDelete={() => setConfirmDeleteRun(run.scenarioRunName)}
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
                        <div style={{ paddingLeft: '2rem', marginBottom: '1rem' }}>
                          <ScenarioConfigDisplay scenarioRunName={run.scenarioRunName} />
                        </div>

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
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.25rem' }}>
                                              {job.completionTime && (
                                                <Button
                                                  variant="plain"
                                                  aria-label="Re-run scenario"
                                                  onClick={() => onRerunScenario(run, job.jobId)}
                                                  icon={<RedoIcon style={{ fontSize: '1.2rem' }} />}
                                                  style={{ color: 'var(--pf-v5-global--link--Color)' }}
                                                />
                                              )}
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

                                          {/* Logs for running, succeeded, and failed jobs */}
                                          {['Running', 'Succeeded', 'Failed', 'MaxRetriesExceeded'].includes(job.phase) && job.jobId && (
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
                                          {!['Succeeded', 'Failed', 'MaxRetriesExceeded'].includes(job.phase) && (
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
                            {loadingRunDetails.has(run.scenarioRunName) ? (
                              <Spinner size="lg" aria-label="Loading run details" />
                            ) : (
                              'No jobs available for this scenario run'
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </DataListContent>
                </DataListItem>
              );
            })}
          </DataList>
          {pagination.totalPages > 1 && (
            <Pagination
              itemCount={pagination.total}
              perPage={limit}
              page={page}
              onSetPage={(_evt, newPage) => setPage(newPage)}
              onPerPageSelect={(_evt, newPerPage) => { setLimit(newPerPage); setPage(1); }}
              variant={PaginationVariant.bottom}
              perPageOptions={[
                { title: '10', value: 10 },
                { title: '20', value: 20 },
                { title: '50', value: 50 },
              ]}
              style={{ marginTop: '1rem' }}
            />
          )}
          </>
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

    </Card>
  );
}
