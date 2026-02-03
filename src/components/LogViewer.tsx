import { useState, useEffect, useRef } from 'react';
import { Card, CardTitle, CardBody, Button, Alert, AlertGroup, AlertActionCloseButton, Flex, FlexItem } from '@patternfly/react-core';
import { CopyIcon } from '@patternfly/react-icons';
import Anser from 'anser';

interface LogViewerProps {
  scenarioRunName: string; // ScenarioRun name
  jobId: string;           // Job ID - required for WebSocket path
  clusterName: string;     // Cluster name - for display only
  podName: string;
  status: string;
  compact?: boolean;
}

export function LogViewer({ scenarioRunName, jobId, clusterName, podName, status, compact = false }: LogViewerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isCleanedUpRef = useRef<boolean>(false);
  const isFirstMessageRef = useRef<boolean>(true);

  const maxReconnectAttempts = 3; // Ridotto per fallire prima e provare HTTP

  // Copy logs to clipboard
  const handleCopyLogs = async () => {
    try {
      // Strip ANSI codes for clipboard
      const plainText = logs.map(log => Anser.ansiToText(log)).join('\n');
      await navigator.clipboard.writeText(plainText);
      setShowCopyAlert(true);
      setTimeout(() => setShowCopyAlert(false), 3000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  // Convert ANSI codes to HTML
  const renderAnsiLog = (log: string, index: number) => {
    const ansiParsed = Anser.ansiToJson(log, { use_classes: false });
    return (
      <div key={index} style={{ margin: 0 }}>
        {ansiParsed.map((chunk, chunkIndex) => {
          const style: React.CSSProperties = {
            color: chunk.fg ? `rgb(${chunk.fg})` : undefined,
            backgroundColor: chunk.bg ? `rgb(${chunk.bg})` : undefined,
            fontWeight: chunk.decoration && chunk.decoration.includes('bold') ? 'bold' : undefined,
            textDecoration: chunk.decoration && chunk.decoration.includes('underline') ? 'underline' : undefined,
          };
          return (
            <span key={chunkIndex} style={style}>
              {chunk.content}
            </span>
          );
        })}
      </div>
    );
  };

  // Scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // WebSocket connection management
  useEffect(() => {
    // Don't start streaming if job hasn't started yet
    if (status === 'Pending') {
      console.log('Job is pending, waiting for it to start before streaming logs');
      setLogs(['Waiting for pod to start...']);
      return;
    }

    // If job is in terminal state, don't follow (get static logs)
    const isTerminal = status === 'Succeeded' || status === 'Failed' || status === 'Stopped';

    console.log('Starting WebSocket log stream for run:', scenarioRunName, 'cluster:', clusterName, 'status:', status);

    if (!isTerminal) {
      setLogs(['Connecting to log stream...']);
    }

    isCleanedUpRef.current = false;
    isFirstMessageRef.current = true;

    const connectWebSocket = () => {
      // Don't reconnect if job is terminal or component is unmounted
      if (isCleanedUpRef.current || isTerminal) {
        return;
      }

      console.log(`Attempting to connect to WebSocket (attempt ${reconnectAttemptsRef.current + 1})`);

      // Build WebSocket URL - NEW: uses scenarioRunName + clusterName
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const follow = !isTerminal;

      // NEW URL structure: /scenarios/run/{scenarioRunName}/jobs/{jobId}/logs
      const wsUrl = `${protocol}//${host}/api/v1/scenarios/run/${encodeURIComponent(scenarioRunName)}/jobs/${encodeURIComponent(jobId)}/logs?follow=${follow}`;

      console.log('WebSocket URL:', wsUrl);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          reconnectAttemptsRef.current = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
          const message = event.data;

          // Check if it's an error message
          if (message.startsWith('ERROR:')) {
            console.error('WebSocket error message:', message);
            setLogs(prev => [...prev, `⚠️  ${message}`]);
            return;
          }

          // Regular log line
          console.log('Received log line, length:', message.length);
          setLogs(prev => {
            // Replace "Connecting..." message on first data
            if (isFirstMessageRef.current && prev[0] === 'Connecting to log stream...') {
              isFirstMessageRef.current = false;
              return [message];
            }
            return [...prev, message];
          });
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Error handling is done in onclose
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);

          // Normal closure (code 1000)
          if (event.code === 1000) {
            console.log('WebSocket closed normally');
            return;
          }

          // Unexpected closure - attempt reconnect if not terminal and not cleaned up
          if (!isTerminal && !isCleanedUpRef.current) {
            console.log('WebSocket closed unexpectedly, attempting to reconnect...');
            scheduleReconnect(2000);
          }
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        if (!isTerminal && !isCleanedUpRef.current) {
          scheduleReconnect(2000);
        }
      }
    };

    const scheduleReconnect = (baseDelay: number) => {
      if (isCleanedUpRef.current || isTerminal) {
        return;
      }

      reconnectAttemptsRef.current++;

      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log('Max reconnection attempts reached');
        setLogs(prev => [...prev, '', '⚠️  Max reconnection attempts reached. Please refresh the page.']);
        return;
      }

      // Exponential backoff: delay * 1.5^(attempts-1), capped at 30 seconds
      const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttemptsRef.current - 1), 30000);
      console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, delay);
    };

    // Start initial connection
    connectWebSocket();

    // Cleanup on unmount or when dependencies change
    return () => {
      console.log('Cleaning up WebSocket');
      isCleanedUpRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [scenarioRunName, jobId, status]); // Dependencies: jobId instead of clusterName

  return (
    <>
      <AlertGroup isToast isLiveRegion>
        {showCopyAlert && (
          <Alert
            variant="success"
            title="Logs copied to clipboard"
            actionClose={<AlertActionCloseButton onClose={() => setShowCopyAlert(false)} />}
          />
        )}
      </AlertGroup>
      <Card>
        <CardTitle>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem>
              <b>Scenario Logs</b> - {podName}
            </FlexItem>
            <FlexItem>
              <Button variant="secondary" icon={<CopyIcon />} onClick={handleCopyLogs} size="sm">
                Copy Logs
              </Button>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          <div
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              fontFamily: 'monospace',
              fontSize: compact ? '11px' : '12px',
              padding: compact ? '12px' : '16px',
              borderRadius: '4px',
              maxHeight: compact ? '300px' : '500px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {logs.map((log, index) => renderAnsiLog(log, index))}
            <div ref={logsEndRef} />
          </div>
        </CardBody>
      </Card>
    </>
  );
}
