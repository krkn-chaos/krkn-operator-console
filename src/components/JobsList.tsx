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
  Badge,
  Flex,
  FlexItem,
  Label,
  Alert,
  AlertGroup,
  AlertActionCloseButton,
} from '@patternfly/react-core';
import {
  HourglassHalfIcon,
  SyncAltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BanIcon,
  PlusCircleIcon,
  CubesIcon,
} from '@patternfly/react-icons';
import type { JobStatusResponse } from '../types/api';
import { LogViewer } from './LogViewer';

interface JobsListProps {
  jobs: JobStatusResponse[];
  expandedJobIds: Set<string>;
  onToggleAccordion: (jobId: string) => void;
  onCancelJob: (jobId: string) => Promise<void>;
  onCreateJob: () => void;
}

export function JobsList({
  jobs,
  expandedJobIds,
  onToggleAccordion,
  onCancelJob,
  onCreateJob,
}: JobsListProps) {
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Truncate long strings
  const truncate = (str: string, maxLength: number): string => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  };

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'Pending':
        return {
          icon: <HourglassHalfIcon />,
          color: 'orange' as const,
          label: 'Pending',
        };
      case 'Running':
        return {
          icon: <SyncAltIcon className="pf-m-spin" />,
          color: 'blue' as const,
          label: 'Running',
        };
      case 'Succeeded':
        return {
          icon: <CheckCircleIcon />,
          color: 'green' as const,
          label: 'Succeeded',
        };
      case 'Failed':
        return {
          icon: <ExclamationCircleIcon />,
          color: 'red' as const,
          label: 'Failed',
        };
      case 'Stopped':
        return {
          icon: <BanIcon />,
          color: 'orange' as const,
          label: 'Stopped',
        };
      default:
        return {
          icon: <ExclamationCircleIcon />,
          color: 'grey' as const,
          label: status,
        };
    }
  };

  // Check if job is in terminal state
  const isTerminal = (status: string): boolean => {
    return ['Succeeded', 'Failed', 'Stopped'].includes(status);
  };

  // Handle cancel job
  const handleCancel = async (jobId: string) => {
    setCancellingJobId(jobId);
    setCancelError(null);
    try {
      await onCancelJob(jobId);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Failed to cancel job');
    } finally {
      setCancellingJobId(null);
    }
  };

  // Empty state
  if (jobs.length === 0) {
    return (
      <Card>
        <CardTitle>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem>
              <Title headingLevel="h1" size="2xl">
                Scenario Jobs
              </Title>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={onCreateJob} size="lg">
                Create Job
              </Button>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          <EmptyState>
            <EmptyStateIcon icon={CubesIcon} />
            <Title headingLevel="h4" size="lg">
              No jobs found
            </Title>
            <EmptyStateBody>
              Click "Create Job" to start a new chaos scenario execution.
            </EmptyStateBody>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={onCreateJob}>
              Create Job
            </Button>
          </EmptyState>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <AlertGroup isToast isLiveRegion>
        {cancelError && (
          <Alert
            variant="danger"
            title="Failed to cancel job"
            actionClose={<AlertActionCloseButton onClose={() => setCancelError(null)} />}
          >
            {cancelError}
          </Alert>
        )}
      </AlertGroup>

      <Card>
        <CardTitle>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem>
              <Title headingLevel="h1" size="2xl">
                Scenario Jobs
              </Title>
              <Badge isRead>{jobs.length} total</Badge>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={onCreateJob} size="lg">
                Create Job
              </Button>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          <DataList aria-label="Jobs list" isCompact>
            {jobs.map((job) => {
              const isExpanded = expandedJobIds.has(job.jobId);
              const statusDisplay = getStatusDisplay(job.status);

              return (
                <DataListItem key={job.jobId} isExpanded={isExpanded}>
                  <DataListItemRow>
                    <DataListToggle
                      onClick={() => onToggleAccordion(job.jobId)}
                      isExpanded={isExpanded}
                      id={`toggle-${job.jobId}`}
                      aria-controls={`expand-${job.jobId}`}
                    />
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="status" width={1}>
                          <Label color={statusDisplay.color} icon={statusDisplay.icon}>
                            {statusDisplay.label}
                          </Label>
                        </DataListCell>,
                        <DataListCell key="scenario" width={2}>
                          <strong>Scenario:</strong> {job.scenarioName}
                        </DataListCell>,
                        <DataListCell key="jobId" width={2}>
                          <strong>Job ID:</strong>{' '}
                          <span style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                            {truncate(job.jobId, 16)}
                          </span>
                        </DataListCell>,
                        <DataListCell key="target" width={2}>
                          <strong>Target:</strong>{' '}
                          <span style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                            {truncate(job.targetUUID, 12)}
                          </span>
                        </DataListCell>,
                        <DataListCell key="startTime" width={2}>
                          <strong>Started:</strong> {formatDate(job.startTime)}
                        </DataListCell>,
                      ]}
                    />
                  </DataListItemRow>
                  <DataListContent
                    aria-label="Job details"
                    id={`expand-${job.jobId}`}
                    isHidden={!isExpanded}
                  >
                    <Card isCompact>
                      <CardBody>
                        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                          {/* Job Details */}
                          <FlexItem>
                            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem' }}>
                              <dt><strong>Job ID:</strong></dt>
                              <dd style={{ fontFamily: 'monospace' }}>{job.jobId}</dd>

                              <dt><strong>Target UUID:</strong></dt>
                              <dd style={{ fontFamily: 'monospace' }}>{job.targetUUID}</dd>

                              <dt><strong>Pod Name:</strong></dt>
                              <dd style={{ fontFamily: 'monospace' }}>{job.podName}</dd>

                              <dt><strong>Status:</strong></dt>
                              <dd>
                                <Label color={statusDisplay.color} icon={statusDisplay.icon}>
                                  {statusDisplay.label}
                                </Label>
                              </dd>

                              <dt><strong>Start Time:</strong></dt>
                              <dd>{formatDate(job.startTime)}</dd>

                              {job.completionTime && (
                                <>
                                  <dt><strong>Completion Time:</strong></dt>
                                  <dd>{formatDate(job.completionTime)}</dd>
                                </>
                              )}

                              {job.message && (
                                <>
                                  <dt><strong>Message:</strong></dt>
                                  <dd>{job.message}</dd>
                                </>
                              )}
                            </dl>
                          </FlexItem>

                          {/* Log Viewer */}
                          <FlexItem>
                            <LogViewer
                              jobId={job.jobId}
                              podName={job.podName}
                              status={job.status}
                              compact={true}
                            />
                          </FlexItem>

                          {/* Cancel Button */}
                          {!isTerminal(job.status) && (
                            <FlexItem>
                              <Button
                                variant="danger"
                                onClick={() => handleCancel(job.jobId)}
                                isLoading={cancellingJobId === job.jobId}
                                isDisabled={cancellingJobId !== null}
                              >
                                {cancellingJobId === job.jobId ? 'Cancelling...' : 'Cancel Job'}
                              </Button>
                            </FlexItem>
                          )}
                        </Flex>
                      </CardBody>
                    </Card>
                  </DataListContent>
                </DataListItem>
              );
            })}
          </DataList>
        </CardBody>
      </Card>
    </>
  );
}
