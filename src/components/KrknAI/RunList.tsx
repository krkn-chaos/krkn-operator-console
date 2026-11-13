import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Dropdown,
  DropdownItem,
  DropdownList,
  Label,
  Modal,
  ModalVariant,
  MenuToggle,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { BanIcon, DownloadIcon, EllipsisVIcon, EyeIcon, TopologyIcon, TrashIcon } from '@patternfly/react-icons';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { KrknAIRunResource, KrknAIRunSummary } from '../../services/krknAiApi';
import { formatDateTime } from '../../utils/dateTime';
import { FitnessValue } from './FitnessValue';
import { useKrknAIResultsDownload } from '../../hooks/useKrknAIResultsDownload';
import { canCancelAIRunPhase, isActiveAIRunPhase } from '../../utils/krknAIPhases';

export interface KrknAIRunListEntry {
  resource: KrknAIRunResource;
  summary: KrknAIRunSummary | null;
  summaryError?: string;
  updating: boolean;
}

interface RunListProps {
  runs: KrknAIRunListEntry[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onCreate: () => void;
  onRefresh: () => void;
  onSelect: (run: KrknAIRunResource) => void;
  onDelete: (runName: string) => Promise<void>;
  onCancel?: (runName: string) => Promise<void>;
}

function phaseColor(phase: string): 'blue' | 'cyan' | 'green' | 'grey' | 'orange' | 'red' {
  switch (phase) {
    case 'Provisioning': return 'cyan';
    case 'Running': return 'blue';
    case 'Cancelling': return 'orange';
    case 'Succeeded': return 'green';
    case 'Failed': return 'red';
    default: return 'grey';
  }
}

function getClusterName(resource: KrknAIRunResource, summary: KrknAIRunSummary | null): string {
  if (summary?.cluster) return summary.cluster;
  return Object.values(resource.spec.targetClusters ?? {})[0]?.[0] ?? 'Not available';
}

function RunActionsMenu({
  run,
  summary,
  busy,
  onView,
  onCancel,
  onDelete,
}: {
  run: KrknAIRunResource;
  summary: KrknAIRunSummary | null;
  busy: boolean;
  onView: () => void;
  onCancel?: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const name = run.metadata.name;
  const phase = run.status?.phase ?? 'Pending';
  const { download, downloading, error, isActive, isDisabled } = useKrknAIResultsDownload({ runName: name, runPhase: phase, summary });
  const canCancel = !!onCancel && !run.spec.cancelRequested && canCancelAIRunPhase(phase);

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Dropdown
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSelect={() => setIsOpen(false)}
        shouldFocusToggleOnSelect={false}
        popperProps={{ position: 'right', appendTo: () => document.body }}
        toggle={(toggleRef) => (
          <MenuToggle
            ref={toggleRef}
            variant="plain"
            aria-label={`Actions for run ${name}`}
            isExpanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
          >
            <EllipsisVIcon aria-hidden="true" />
          </MenuToggle>
        )}
      >
        <DropdownList>
          <DropdownItem icon={<EyeIcon />} isDisabled={busy} onClick={onView}>
            View
          </DropdownItem>
          {!isActive && (
            <DropdownItem
              icon={downloading ? <Spinner size="sm" aria-label="Preparing results ZIP" /> : <DownloadIcon />}
              isDisabled={busy || isDisabled}
              onClick={() => void download()}
            >
              Download
            </DropdownItem>
          )}
          <DropdownItem icon={<BanIcon />} isDisabled={busy || downloading || !canCancel} onClick={onCancel}>
            Cancel
          </DropdownItem>
          <DropdownItem icon={<TrashIcon />} isDanger isDisabled={busy || downloading} onClick={onDelete}>
            Delete
          </DropdownItem>
        </DropdownList>
      </Dropdown>
      {error && <Alert variant="danger" title="Results download failed" isInline>{error}</Alert>}
    </div>
  );
}

export function RunList({
  runs,
  loading,
  refreshing,
  error,
  onCreate,
  onRefresh,
  onSelect,
  onDelete,
  onCancel,
}: RunListProps) {
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingCancelName, setPendingCancelName] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const closeDeleteDialog = () => {
    if (deleting) return;
    setPendingDeleteName(null);
    setDeleteError(null);
  };
  const confirmDelete = async () => {
    if (!pendingDeleteName || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(pendingDeleteName);
      setPendingDeleteName(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete Krkn-AI run.');
    } finally {
      setDeleting(false);
    }
  };
  const closeCancelDialog = () => {
    if (cancelling) return;
    setPendingCancelName(null);
    setCancelError(null);
  };
  const confirmCancel = async () => {
    if (!pendingCancelName || !onCancel || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await onCancel(pendingCancelName);
      setPendingCancelName(null);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Unable to cancel Krkn-AI run.');
    } finally {
      setCancelling(false);
    }
  };
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    run: KrknAIRunResource,
  ) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(run);
    }
  };

  return (
    <Card className="krkn-ai-run-list">
      <CardTitle>
        <div className="krkn-ai-run-list__heading">
          <div className="krkn-ai-run-list__heading-copy">
            <Title headingLevel="h1" size="lg">AI runs</Title>
            <p className="krkn-ai-run-list__description">
              Krkn-AI explores chaos experiments guided by your SLOs and health checks to evaluate system resilience.
            </p>
          </div>
          <div className="krkn-ai-run-list__toolbar">
            <Button variant="secondary" onClick={onRefresh} isDisabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="primary" onClick={onCreate}>
              Create run
            </Button>
          </div>
        </div>
      </CardTitle>
      <CardBody>
        {error && <Alert variant="danger" title="Unable to load Krkn-AI runs" isInline>{error}</Alert>}
        <div className="krkn-ai-run-list__table-wrap" style={{ overflowX: 'auto' }}>
          <table className="krkn-ai-run-list__table" aria-label="Krkn-AI runs">
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Cluster</th>
                <th scope="col">Phase</th>
                <th scope="col">Started</th>
                <th scope="col">Best fitness (0–100)</th>
                <th scope="col">Generations</th>
                <th scope="col">Scenarios completed</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="krkn-ai-run-list__empty-cell">
                    <EmptyState variant="sm">
                      <EmptyStateIcon icon={Spinner} />
                      <Title headingLevel="h3" size="md">Loading Krkn-AI runs</Title>
                    </EmptyState>
                  </td>
                </tr>
              ) : error && runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="krkn-ai-run-list__empty-cell">
                    <EmptyState variant="sm">
                      <EmptyStateIcon icon={TopologyIcon} />
                      <Title headingLevel="h3" size="md">Krkn-AI runs unavailable</Title>
                      <EmptyStateBody>Use Refresh above to try again.</EmptyStateBody>
                    </EmptyState>
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="krkn-ai-run-list__empty-cell">
                    <EmptyState variant="sm">
                      <EmptyStateIcon icon={TopologyIcon} />
                      <Title headingLevel="h3" size="md">No Krkn-AI runs yet</Title>
                      <EmptyStateBody>Use Create run above to explore a cluster.</EmptyStateBody>
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                runs.map(({ resource, summary, summaryError, updating }) => {
                  const name = resource.metadata.name;
                  const phase = resource.status?.phase ?? 'Pending';
                  const createdAt = summary?.createdAt || resource.metadata.creationTimestamp;
                  const completed = summary?.completedGenerations;
                  const configured = summary?.configuredGenerations;
                  const currentGeneration = summary?.currentGeneration;
                  const calculatingGeneration = isActiveAIRunPhase(phase)
                    && currentGeneration != null && (completed == null || currentGeneration >= completed)
                    ? currentGeneration : null;
                  const generations = completed !== null && completed !== undefined
                    && configured !== null && configured !== undefined
                    ? `${completed} / ${configured}`
                    : 'Not available yet';

                  return (
                    <tr
                      key={name}
                      className="krkn-ai-run-list__row"
                      tabIndex={0}
                      aria-label={`Open run ${name}, ${phase}, cluster ${getClusterName(resource, summary)}`}
                      onClick={() => onSelect(resource)}
                      onKeyDown={(event) => handleRowKeyDown(event, resource)}
                    >
                      <th scope="row" className="krkn-ai-run-list__name-cell">
                        <span className="krkn-ai-run-list__run-name">{name}</span>
                        {updating && <span className="krkn-ai-run-list__updating" role="status">Updating committed results…</span>}
                        {summaryError && <span className="krkn-ai-run-list__error">{summaryError}</span>}
                      </th>
                      <td>{getClusterName(resource, summary)}</td>
                      <td>
                        <Label color={phaseColor(phase)} icon={phase === 'Cancelled' ? <BanIcon /> : undefined}>{phase}</Label>
                        {resource.spec.cancelRequested && !['Cancelling', 'Cancelled'].includes(phase) && <span className="krkn-ai-cancel-requested" role="status"><BanIcon aria-hidden="true" /> Cancellation requested</span>}
                      </td>
                      <td>{createdAt ? <time dateTime={createdAt}>{formatDateTime(createdAt)}</time> : 'Not available'}</td>
                      <td><FitnessValue value={summary?.bestFitness} calculatingGeneration={calculatingGeneration} /></td>
                      <td>{generations}</td>
                      <td>{summary?.completedScenarios ?? 'Not available yet'}</td>
                      <td>
                        <RunActionsMenu
                          run={resource}
                          summary={summary}
                          busy={deleting || cancelling}
                          onView={() => onSelect(resource)}
                          onCancel={onCancel ? () => {
                            setPendingCancelName(name);
                            setCancelError(null);
                          } : undefined}
                          onDelete={() => {
                            setPendingDeleteName(name);
                            setDeleteError(null);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
      <Modal
        variant={ModalVariant.small}
        title="Delete Krkn-AI run?"
        isOpen={pendingDeleteName !== null}
        onClose={closeDeleteDialog}
        actions={[
          <Button key="delete" variant="danger" onClick={() => void confirmDelete()} isLoading={deleting} isDisabled={deleting}>
            Delete run
          </Button>,
          <Button key="cancel" variant="link" onClick={closeDeleteDialog} isDisabled={deleting}>
            Cancel
          </Button>,
        ]}
      >
        <p>
          Deleting Krkn-AI run <strong>{pendingDeleteName}</strong> also deletes its scenario executions. This action cannot be undone.
        </p>
        <p>Download the results ZIP first if you may need its artifacts for later analysis.</p>
        {deleteError && <Alert variant="danger" title="Unable to delete Krkn-AI run" isInline>{deleteError}</Alert>}
      </Modal>
      <Modal
        variant={ModalVariant.small}
        title="Cancel Krkn-AI run?"
        isOpen={pendingCancelName !== null}
        onClose={closeCancelDialog}
        actions={[
          <Button key="cancel-run" variant="danger" onClick={() => void confirmCancel()} isLoading={cancelling} isDisabled={cancelling}>
            Cancel run
          </Button>,
          <Button key="keep-running" variant="link" onClick={closeCancelDialog} isDisabled={cancelling}>
            Keep running
          </Button>,
        ]}
      >
        <p>Cancel Krkn-AI run <strong>{pendingCancelName}</strong>? Its stopped execution and collected results will be retained.</p>
        {cancelError && <Alert variant="danger" title="Unable to cancel Krkn-AI run" isInline>{cancelError}</Alert>}
      </Modal>
    </Card>
  );
}
