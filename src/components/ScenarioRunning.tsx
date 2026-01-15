import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardBody,
  Title,
  Button,
  Spinner,
  Alert,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InProgressIcon,
  PendingIcon,
  BanIcon,
} from '@patternfly/react-icons';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import type { JobStatus } from '../types/api';
import { LogViewer } from './LogViewer';

export function ScenarioRunning() {
  const { state, dispatch } = useAppContext();
  const { currentJob } = state;
  const [isCancelling, setIsCancelling] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);

  // Poll job status every 2 seconds
  useEffect(() => {
    if (!currentJob) return;

    const pollStatus = async () => {
      try {
        const status = await operatorApi.getJobStatus(currentJob.jobId);
        dispatch({
          type: 'JOB_STATUS_UPDATE',
          payload: { job: status },
        });

        // Stop polling if job is terminal
        if (status.status === 'Succeeded' || status.status === 'Failed' || status.status === 'Stopped') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    };

    // Initial poll
    pollStatus();

    // Setup interval
    pollIntervalRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [currentJob?.jobId, dispatch]);


  const handleCancel = async () => {
    if (!currentJob || isCancelling) return;

    setIsCancelling(true);

    try {
      await operatorApi.cancelJob(currentJob.jobId);
      dispatch({ type: 'JOB_CANCELLED' });
    } catch (error) {
      console.error('Error cancelling job:', error);
      setIsCancelling(false);
    }
  };

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'Pending':
        return <PendingIcon style={{ color: 'var(--pf-v5-global--palette--gold-400)' }} />;
      case 'Running':
        return <InProgressIcon className="pf-v5-u-animation-spin" style={{ color: 'var(--pf-v5-global--palette--blue-300)' }} />;
      case 'Succeeded':
        return <CheckCircleIcon style={{ color: 'var(--pf-v5-global--palette--green-500)' }} />;
      case 'Failed':
        return <ExclamationCircleIcon style={{ color: 'var(--pf-v5-global--palette--red-200)' }} />;
      case 'Stopped':
        return <BanIcon style={{ color: 'var(--pf-v5-global--palette--black-600)' }} />;
      default:
        return <Spinner size="md" />;
    }
  };

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'Pending':
        return 'var(--pf-v5-global--palette--gold-400)';
      case 'Running':
        return 'var(--pf-v5-global--palette--blue-300)';
      case 'Succeeded':
        return 'var(--pf-v5-global--palette--green-500)';
      case 'Failed':
        return 'var(--pf-v5-global--palette--red-200)';
      case 'Stopped':
        return 'var(--pf-v5-global--palette--black-600)';
      default:
        return 'var(--pf-v5-global--Color--100)';
    }
  };

  if (!currentJob) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Alert variant="warning" title="No running job found" />
      </div>
    );
  }

  const isTerminal = currentJob.status === 'Succeeded' || currentJob.status === 'Failed' || currentJob.status === 'Stopped';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back Button */}
      <div style={{ marginBottom: '1rem' }}>
        <Button variant="link" onClick={handleBack}>
          ← Back to Configuration
        </Button>
      </div>

      {/* Job Status Header */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title headingLevel="h2" size="xl">
                Scenario Execution
              </Title>
              <div style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
                {currentJob.scenarioName} on {currentJob.clusterName}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                <strong>Job ID:</strong> {currentJob.jobId}
              </div>
              <div style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                <strong>Pod:</strong> {currentJob.podName}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem' }}>
                {getStatusIcon(currentJob.status)}
              </div>
              <div style={{
                marginTop: '0.5rem',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: getStatusColor(currentJob.status)
              }}>
                {currentJob.status}
              </div>
              {currentJob.startTime && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
                  Started: {new Date(currentJob.startTime).toLocaleString()}
                </div>
              )}
              {currentJob.completionTime && (
                <div style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
                  Completed: {new Date(currentJob.completionTime).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {currentJob.message && (
            <Alert
              variant={currentJob.status === 'Failed' ? 'danger' : 'info'}
              title={currentJob.message}
              style={{ marginTop: '1rem' }}
              isInline
            />
          )}
        </CardBody>
      </Card>

      {/* Cancel Button */}
      {!isTerminal && (
        <div style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
          <Button
            variant="danger"
            onClick={handleCancel}
            isLoading={isCancelling}
            isDisabled={isCancelling}
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Scenario'}
          </Button>
        </div>
      )}

      {/* Logs Viewer */}
      <LogViewer
        jobId={currentJob.jobId}
        podName={currentJob.podName}
        status={currentJob.status}
      />
    </div>
  );
}
