/**
 * NodeDetailModal Component
 *
 * Modal that displays detailed information about a GraphRun node.
 * Shows the associated ScenarioRun details and cluster jobs with logs.
 * Reuses existing LogViewer component for consistency.
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Alert,
  Spinner,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Label,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  DataListToggle,
  DataListContent,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import {
  HourglassHalfIcon,
  SyncAltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@patternfly/react-icons';
import type { NodeStatus, ScenarioRunStatusResponse, ClusterJobPhase } from '../types/api';
import { operatorApi } from '../services';
import { LogViewer } from './LogViewer';

interface NodeDetailModalProps {
  /** Node status from GraphRun */
  nodeStatus: NodeStatus | null;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
}

/**
 * Get job phase display properties
 */
function getJobPhaseDisplay(phase: ClusterJobPhase) {
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
}

export function NodeDetailModal({ nodeStatus, onClose }: NodeDetailModalProps) {
  const [scenarioRun, setScenarioRun] = useState<ScenarioRunStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());

  // Fetch scenario run details when nodeStatus changes
  useEffect(() => {
    if (!nodeStatus?.scenarioRunRef) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchScenarioRun = async () => {
      try {
        setLoading(true);
        setError(null);

        const run = await operatorApi.getScenarioRunStatus(nodeStatus.scenarioRunRef!);

        if (mounted) {
          setScenarioRun(run);
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

    fetchScenarioRun();

    return () => {
      mounted = false;
    };
  }, [nodeStatus]);

  // Toggle job accordion
  const handleToggleJob = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  if (!nodeStatus) {
    return null;
  }

  return (
    <Modal
      variant={ModalVariant.large}
      title={`Node: ${nodeStatus.nodeName}`}
      isOpen={!!nodeStatus}
      onClose={onClose}
      actions={[
        <Button key="close" variant="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      {/* Node Information */}
      <DescriptionList isCompact isHorizontal>
        <DescriptionListGroup>
          <DescriptionListTerm>Node ID</DescriptionListTerm>
          <DescriptionListDescription>
            <code
              style={{
                fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                fontSize: 'var(--pf-v5-global--FontSize--sm)',
                backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                padding: '0.125rem 0.5rem',
                borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
              }}
            >
              {nodeStatus.nodeId}
            </code>
          </DescriptionListDescription>
        </DescriptionListGroup>

        <DescriptionListGroup>
          <DescriptionListTerm>Phase</DescriptionListTerm>
          <DescriptionListDescription>
            <Label color={getJobPhaseDisplay(nodeStatus.phase as ClusterJobPhase).color}>
              {nodeStatus.phase}
            </Label>
          </DescriptionListDescription>
        </DescriptionListGroup>

        {nodeStatus.startTime && (
          <DescriptionListGroup>
            <DescriptionListTerm>Start Time</DescriptionListTerm>
            <DescriptionListDescription>
              {formatTimestamp(nodeStatus.startTime)}
            </DescriptionListDescription>
          </DescriptionListGroup>
        )}

        {nodeStatus.completionTime && (
          <DescriptionListGroup>
            <DescriptionListTerm>Completion Time</DescriptionListTerm>
            <DescriptionListDescription>
              {formatTimestamp(nodeStatus.completionTime)}
            </DescriptionListDescription>
          </DescriptionListGroup>
        )}

        {nodeStatus.dependsOn && nodeStatus.dependsOn.length > 0 && (
          <DescriptionListGroup>
            <DescriptionListTerm>Dependencies</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                {nodeStatus.dependsOn.map((depId) => (
                  <FlexItem key={depId}>
                    <code
                      style={{
                        fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                        fontSize: 'var(--pf-v5-global--FontSize--sm)',
                        backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                        padding: '0.125rem 0.5rem',
                        borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                      }}
                    >
                      {depId}
                    </code>
                  </FlexItem>
                ))}
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>
        )}

        {nodeStatus.message && (
          <DescriptionListGroup>
            <DescriptionListTerm>Message</DescriptionListTerm>
            <DescriptionListDescription>{nodeStatus.message}</DescriptionListDescription>
          </DescriptionListGroup>
        )}
      </DescriptionList>

      <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--pf-v5-global--BorderColor--100)' }} />

      {/* ScenarioRun Details */}
      <h3 style={{ marginBottom: '1rem' }}>ScenarioRun: {nodeStatus.scenarioRunRef || 'Not created yet'}</h3>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="lg" aria-label="Loading scenario run details" />
        </div>
      )}

      {error && (
        <Alert variant="danger" isInline title="Failed to load scenario run details">
          {error}
        </Alert>
      )}

      {!loading && !error && !scenarioRun && nodeStatus.scenarioRunRef && (
        <Alert variant="info" isInline title="No scenario run data available" />
      )}

      {!loading && !error && !nodeStatus.scenarioRunRef && (
        <Alert variant="info" isInline title="Scenario run not started yet">
          This node is waiting for dependencies to complete.
        </Alert>
      )}

      {!loading && !error && scenarioRun && (
        <>
          {/* ScenarioRun Summary */}
          <DescriptionList isCompact isHorizontal style={{ marginBottom: '1rem' }}>
            <DescriptionListGroup>
              <DescriptionListTerm>Phase</DescriptionListTerm>
              <DescriptionListDescription>
                <Label color={scenarioRun.phase === 'Succeeded' ? 'green' : scenarioRun.phase === 'Failed' ? 'red' : 'blue'}>
                  {scenarioRun.phase}
                </Label>
              </DescriptionListDescription>
            </DescriptionListGroup>

            <DescriptionListGroup>
              <DescriptionListTerm>Total Targets</DescriptionListTerm>
              <DescriptionListDescription>{scenarioRun.totalTargets}</DescriptionListDescription>
            </DescriptionListGroup>

            <DescriptionListGroup>
              <DescriptionListTerm>Jobs</DescriptionListTerm>
              <DescriptionListDescription>
                <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>
                    <span style={{ color: 'var(--pf-v5-global--success-color--100)' }}>
                      ✓ {scenarioRun.successfulJobs}
                    </span>
                  </FlexItem>
                  <FlexItem>
                    <span style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>
                      ✗ {scenarioRun.failedJobs}
                    </span>
                  </FlexItem>
                  <FlexItem>
                    <span style={{ color: 'var(--pf-v5-global--info-color--100)' }}>
                      ⟳ {scenarioRun.runningJobs}
                    </span>
                  </FlexItem>
                </Flex>
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>

          {/* Cluster Jobs */}
          {scenarioRun.clusterJobs && scenarioRun.clusterJobs.length > 0 && (
            <>
              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Cluster Jobs</h4>
              <DataList aria-label="Cluster jobs list" isCompact>
                {scenarioRun.clusterJobs.map((job) => {
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
                                  }}
                                >
                                  {job.providerName}/{job.clusterName}
                                </code>
                              </div>
                            </DataListCell>,
                            <DataListCell key="pod" width={3}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>Pod:</strong>
                                </div>
                                <code
                                  style={{
                                    fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                                    fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                  }}
                                >
                                  {job.podName || '-'}
                                </code>
                              </div>
                            </DataListCell>,
                          ]}
                        />
                      </DataListItemRow>

                      {/* Job Logs (expanded) */}
                      <DataListContent
                        aria-label={`Logs for job ${job.jobId}`}
                        id={`expand-job-${job.jobId}`}
                        isHidden={!isJobExpanded}
                      >
                        {isJobExpanded && job.podName && (
                          <div style={{ paddingLeft: '2rem' }}>
                            <LogViewer
                              scenarioRunName={scenarioRun.scenarioRunName}
                              jobId={job.jobId}
                              clusterName={job.clusterName}
                              podName={job.podName}
                              status={job.phase}
                              compact
                            />
                          </div>
                        )}
                      </DataListContent>
                    </DataListItem>
                  );
                })}
              </DataList>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
