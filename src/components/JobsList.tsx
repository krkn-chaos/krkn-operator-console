import { useState } from 'react';
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
} from '@patternfly/react-core';
import {
  HourglassHalfIcon,
  SyncAltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  CubesIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import type { ScenarioRunState, ScenarioRunPhase, ClusterJobPhase } from '../types/api';
import { LogViewer } from './LogViewer';

interface JobsListProps {
  scenarioRuns: ScenarioRunState[];
  expandedRunIds: Set<string>;
  expandedJobIds: Set<string>;
  onToggleRunAccordion: (scenarioRunName: string) => void;
  onToggleJobAccordion: (jobId: string) => void;
  onDeleteScenarioRun: (scenarioRunName: string) => Promise<void>;
  onDeleteJob: (jobId: string) => Promise<void>;
  onCreateJob: () => void;
}

export function JobsList({
  scenarioRuns,
  expandedRunIds,
  expandedJobIds,
  onToggleRunAccordion,
  onToggleJobAccordion,
  onDeleteScenarioRun,
  onDeleteJob,
  onCreateJob,
}: JobsListProps) {
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const [deletingJob, setDeletingJob] = useState<string | null>(null);
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<string | null>(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<{ jobId: string; jobName: string } | null>(null);

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
      default:
        return { icon: <ExclamationCircleIcon />, color: 'grey' as const, label: phase };
    }
  };

  const handleConfirmDeleteRun = async () => {
    if (!confirmDeleteRun) return;

    setDeletingRun(confirmDeleteRun);
    setConfirmDeleteRun(null);

    try {
      await onDeleteScenarioRun(confirmDeleteRun);
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
            <Button variant="primary" onClick={onCreateJob} size="lg">
              Run Scenarios
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        {scenarioRuns.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={CubesIcon} />
            <Title headingLevel="h2" size="lg">
              No Scenario Runs
            </Title>
            <EmptyStateBody>Click "Run Scenarios" to start a new execution.</EmptyStateBody>
          </EmptyState>
        ) : (
          <DataList aria-label="Scenario runs list" isCompact>
            {scenarioRuns.map((run) => {
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
                        <DataListCell key="status" width={2}>
                          <div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Status:</strong>
                            </div>
                            <Label color={runPhaseDisplay.color} icon={runPhaseDisplay.icon}>
                              {runPhaseDisplay.label}
                            </Label>
                          </div>
                        </DataListCell>,
                        <DataListCell key="scenario" width={3}>
                          <div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Scenario:</strong>
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
                              {run.scenarioName}
                            </code>
                          </div>
                        </DataListCell>,
                        <DataListCell key="run-name" width={3}>
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
                            <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                              {formatTimestamp(run.createdAt)}
                            </div>
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

                                    {/* Logs for running jobs */}
                                    {job.phase === 'Running' && (
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
                                    {!['Succeeded', 'Failed'].includes(job.phase) && (
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
                  </DataListContent>
                </DataListItem>
              );
            })}
          </DataList>
        )}
      </CardBody>

      {/* Confirmation Modal for Scenario Run Deletion */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Scenario Run"
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
        Are you sure you want to delete <strong>{confirmDeleteRun}</strong> scenario run?
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
