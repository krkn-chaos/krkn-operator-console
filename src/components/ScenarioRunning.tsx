import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardTitle,
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

export function ScenarioRunning() {
  const { state, dispatch } = useAppContext();
  const { currentJob } = state;
  const [logs, setLogs] = useState<string[]>([]);
  const [isCancelling, setIsCancelling] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Scroll to bottom of logs when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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

  // Stream logs using fetch with ReadableStream
  useEffect(() => {
    if (!currentJob) {
      console.log('No current job, skipping log streaming');
      return;
    }

    // Don't start streaming if job hasn't started yet
    if (currentJob.status === 'Pending') {
      console.log('Job is pending, waiting for it to start before streaming logs');
      setLogs(['Waiting for pod to start...']);
      return;
    }

    console.log('Starting log stream for job:', currentJob.jobId);
    const logsUrl = operatorApi.getJobLogsUrl(currentJob.jobId, true);
    console.log('Log stream URL:', logsUrl);

    setLogs([`Connecting to log stream...`]);

    const abortController = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let buffer = '';

    // Use fetch with ReadableStream for log streaming
    const streamLogs = async () => {
      try {
        const response = await fetch(logsUrl, {
          signal: abortController.signal,
          headers: {
            'Accept': 'text/plain',
          },
        });

        console.log('Log stream response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          console.error('Failed to fetch logs:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('Error response body:', errorText);

          if (response.status === 501) {
            setLogs([
              '⚠️  Log streaming endpoint not yet implemented in the backend.',
              '',
              'Job is running. Use kubectl to view logs:',
              `kubectl logs ${currentJob.podName} -f`,
              '',
              'Or check the pod status:',
              `kubectl get pod ${currentJob.podName}`,
            ]);
          } else {
            setLogs(prev => [...prev, `Error fetching logs: ${response.status} ${response.statusText}`]);
          }
          return;
        }

        if (!response.body) {
          console.error('No response body for logs');
          setLogs(prev => [...prev, 'Error: No response body for logs']);
          return;
        }

        reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        console.log('Started reading log stream');

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('Log stream ended');
              // Process any remaining buffer
              if (buffer.trim()) {
                setLogs(prev => [...prev, buffer]);
              }
              break;
            }

            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            console.log('Received log chunk, length:', chunk.length, 'first 200 chars:', chunk.substring(0, 200));

            // Add to buffer
            buffer += chunk;

            // Split by newlines and process complete lines
            const lines = buffer.split('\n');

            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';

            // Add complete lines to logs
            if (lines.length > 0) {
              const nonEmptyLines = lines.filter(line => line.trim());
              if (nonEmptyLines.length > 0) {
                console.log('Adding', nonEmptyLines.length, 'lines to logs');
                setLogs(prev => [...prev, ...nonEmptyLines]);
              }
            }
          }
        } catch (readError) {
          if (readError instanceof Error && readError.name !== 'AbortError') {
            console.error('Error reading stream:', readError);
            throw readError;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Log stream aborted');
        } else {
          console.error('Error streaming logs:', error);
          setLogs(prev => [...prev, `Error streaming logs: ${error instanceof Error ? error.message : String(error)}`]);
        }
      }
    };

    streamLogs();

    return () => {
      console.log('Cleaning up log stream');
      abortController.abort();
      if (reader) {
        reader.cancel().catch(err => console.log('Error cancelling reader:', err));
      }
    };
  }, [currentJob?.jobId, currentJob?.status]);

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

      {/* Logs Console */}
      <Card>
        <CardTitle>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Job Logs</span>
            {!isTerminal && (
              <Button
                variant="danger"
                onClick={handleCancel}
                isLoading={isCancelling}
                isDisabled={isCancelling}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Scenario'}
              </Button>
            )}
          </div>
        </CardTitle>
        <CardBody>
          <div style={{
            backgroundColor: 'var(--pf-v5-global--BackgroundColor--dark-100)',
            color: 'var(--pf-v5-global--Color--light-100)',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            padding: '1rem',
            borderRadius: '4px',
            maxHeight: '500px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--pf-v5-global--Color--200)' }}>
                {currentJob.status === 'Pending' ? 'Waiting for pod to start...' : 'No logs available yet...'}
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
