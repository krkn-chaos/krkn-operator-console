/**
 * ScenarioRunDetailModal - Modal showing complete scenario run details
 *
 * Displays the same information as the JobsList accordion, including:
 * - Run metadata (status, scenario, user, etc.)
 * - Cluster jobs with expandable details
 * - Job logs via LogViewer
 *
 * Reuses logic from JobsList to maintain consistency.
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalVariant,
  Spinner,
  Alert,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListToggle,
  DataListItemCells,
  DataListCell,
  DataListContent,
  Label,
  Flex,
  FlexItem,
  Tooltip,
} from '@patternfly/react-core';
import {
  HourglassHalfIcon,
  SyncAltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  LockIcon,
} from '@patternfly/react-icons';
import { HiOutlineRocketLaunch } from 'react-icons/hi2';
import { LogViewer } from './LogViewer';
import { operatorApi } from '../services/operatorApi';
import type { ScenarioRunStatusResponse, ClusterJobPhase } from '../types/api';

interface ScenarioRunDetailModalProps {
  /** ScenarioRun name (from NodeStatus.scenarioRunRef) */
  scenarioRunName: string | null;
  /** Whether modal is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
}

export function ScenarioRunDetailModal({ scenarioRunName, isOpen, onClose }: ScenarioRunDetailModalProps) {
  const [run, setRun] = useState<ScenarioRunStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());

  // Fetch run details when modal opens
  useEffect(() => {
    if (!isOpen || !scenarioRunName) {
      setRun(null);
      setError(null);
      setExpandedJobIds(new Set());
      return;
    }

    let mounted = true;

    const fetchRunDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const details = await operatorApi.getScenarioRunStatus(scenarioRunName);

        if (mounted) {
          setRun(details);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load scenario run details');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchRunDetails();

    return () => {
      mounted = false;
    };
  }, [isOpen, scenarioRunName]);

  // Toggle job accordion
  const handleToggleJob = (jobId: string) => {
    const newExpanded = new Set(expandedJobIds);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobIds(newExpanded);
  };

  // Format timestamp
  const formatTimestamp = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Get phase display
  const getRunPhaseDisplay = (phase: string) => {
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

  // Extract scenarioName from scenarioRunName
  const scenarioName = run?.scenarioName || scenarioRunName?.replace(/-[a-f0-9]{8}$/, '') || 'Unknown';

  return (
    <Modal
      variant={ModalVariant.large}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HiOutlineRocketLaunch />
          <span>Scenario Run Details</span>
          {run && (
            <Label color={getRunPhaseDisplay(run.phase).color} icon={getRunPhaseDisplay(run.phase).icon} isCompact>
              {getRunPhaseDisplay(run.phase).label}
            </Label>
          )}
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="lg" aria-label="Loading scenario run details" />
        </div>
      )}

      {error && (
        <Alert variant="danger" isInline title="Failed to load scenario run">
          {error}
        </Alert>
      )}

      {run && !loading && (
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
          {/* Run Metadata */}
          <FlexItem>
            <div style={{ padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: '4px' }}>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', margin: 0 }}>
                <dt style={{ fontWeight: 'bold' }}>Scenario:</dt>
                <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <code
                    style={{
                      fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                      fontSize: 'var(--pf-v5-global--FontSize--sm)',
                      backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)',
                      padding: '0.125rem 0.5rem',
                      borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                      border: '1px solid var(--pf-v5-global--BorderColor--100)',
                    }}
                  >
                    {scenarioName}
                  </code>
                  {run.registryName && (
                    <Tooltip content={<>Running on <strong><em>{run.registryName}</em></strong> private registry</>}>
                      <LockIcon style={{ color: 'var(--pf-v5-global--palette--gold-400)', fontSize: '1rem' }} />
                    </Tooltip>
                  )}
                </dd>

                <dt style={{ fontWeight: 'bold' }}>Run Name:</dt>
                <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                  {run.scenarioRunName}
                </dd>

                {run.ownerUserId && (
                  <>
                    <dt style={{ fontWeight: 'bold' }}>User:</dt>
                    <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                      {run.ownerUserId}
                    </dd>
                  </>
                )}

                <dt style={{ fontWeight: 'bold' }}>Jobs:</dt>
                <dd style={{ margin: 0, display: 'flex', gap: '1rem', fontSize: 'var(--pf-v5-global--FontSize--lg)' }}>
                  <span style={{ color: 'var(--pf-v5-global--success-color--100)' }}>
                    ✓ {run.successfulJobs}
                  </span>
                  <span style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>
                    ✗ {run.failedJobs}
                  </span>
                  <span style={{ color: 'var(--pf-v5-global--info-color--100)' }}>
                    ⟳ {run.runningJobs}
                  </span>
                </dd>
              </dl>
            </div>
          </FlexItem>

          {/* Cluster Jobs */}
          {run.clusterJobs && run.clusterJobs.length > 0 ? (
            <FlexItem>
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: 'var(--pf-v5-global--FontSize--lg)' }}>Cluster Jobs</h3>
                <DataList aria-label="Cluster jobs list" isCompact>
                  {run.clusterJobs.map((job) => {
                    const isJobExpanded = expandedJobIds.has(job.jobId);
                    const jobPhaseDisplay = getJobPhaseDisplay(job.phase);

                    return (
                      <DataListItem key={job.jobId} isExpanded={isJobExpanded}>
                        {/* Job Summary Row */}
                        <DataListItemRow>
                          <DataListToggle
                            onClick={() => handleToggleJob(job.jobId)}
                            isExpanded={isJobExpanded}
                            id={`toggle-job-${job.jobId}`}
                            aria-controls={`expand-job-${job.jobId}`}
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
                              {/* Job Metadata */}
                              <FlexItem>
                                <div style={{ padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: '4px' }}>
                                  <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', margin: 0 }}>
                                    <dt style={{ fontWeight: 'bold' }}>Provider:</dt>
                                    <dd style={{ margin: 0, fontFamily: 'monospace' }}>{job.providerName}</dd>

                                    <dt style={{ fontWeight: 'bold' }}>Cluster:</dt>
                                    <dd style={{ margin: 0, fontFamily: 'monospace' }}>{job.clusterName}</dd>

                                    <dt style={{ fontWeight: 'bold' }}>Pod Name:</dt>
                                    <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                      {job.podName}
                                    </dd>

                                    {job.containerImage && (
                                      <>
                                        <dt style={{ fontWeight: 'bold' }}>Container Image:</dt>
                                        <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)', wordBreak: 'break-all' }}>
                                          {job.containerImage}
                                        </dd>
                                      </>
                                    )}

                                    <dt style={{ fontWeight: 'bold' }}>Job ID:</dt>
                                    <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                      {job.jobId}
                                    </dd>
                                  </dl>
                                </div>
                              </FlexItem>

                              {/* Logs */}
                              <FlexItem>
                                <LogViewer
                                  scenarioRunName={run.scenarioRunName}
                                  jobId={job.jobId}
                                  clusterName={job.clusterName}
                                  podName={job.podName}
                                  status={job.phase}
                                />
                              </FlexItem>
                            </Flex>
                          )}
                        </DataListContent>
                      </DataListItem>
                    );
                  })}
                </DataList>
              </div>
            </FlexItem>
          ) : (
            <FlexItem>
              <Alert variant="info" isInline title="No jobs yet">
                This scenario run has not created any cluster jobs yet.
              </Alert>
            </FlexItem>
          )}
        </Flex>
      )}
    </Modal>
  );
}
