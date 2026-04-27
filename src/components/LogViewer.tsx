import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Card, CardTitle, CardBody, Button, Alert, AlertGroup, AlertActionCloseButton, Flex, FlexItem, Checkbox } from '@patternfly/react-core';
import { CopyIcon } from '@patternfly/react-icons';
import Anser from 'anser';
import { authService } from '../services/authService';

interface LogViewerProps {
  scenarioRunName: string; // ScenarioRun name
  jobId: string;           // Job ID - required for WebSocket path
  clusterName: string;     // Cluster name - for display only
  podName: string;
  status: string;
  compact?: boolean;
}

// Global connection tracking to prevent StrictMode duplicates
// Maps jobId -> WebSocket instance
const activeConnections = new Map<string, WebSocket>();

export function LogViewer({ scenarioRunName, jobId, clusterName, podName, status, compact = false }: LogViewerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
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
      // Silent failure
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

  // Auto-scroll to bottom when new logs arrive (only if following)
  // useLayoutEffect runs synchronously after DOM mutations but before paint
  useLayoutEffect(() => {
    if (isFollowing && logsContainerRef.current && logs.length > 0) {
      // Scroll to bottom immediately after DOM update
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, isFollowing]);

  // Handle follow toggle
  const handleFollowToggle = (checked: boolean) => {
    setIsFollowing(checked);

    // If enabling follow, scroll to bottom immediately
    if (checked && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  };

  // WebSocket connection management
  useEffect(() => {
    // Don't start streaming if job hasn't started yet
    if (status === 'Pending') {
      setLogs(['Waiting for pod to start...']);
      return;
    }

    // StrictMode guard: check global connection map
    // This persists across StrictMode's double-mount, preventing duplicates
    const existingConnection = activeConnections.get(jobId);
    if (existingConnection && (existingConnection.readyState === WebSocket.CONNECTING || existingConnection.readyState === WebSocket.OPEN)) {
      // Reuse existing connection
      wsRef.current = existingConnection;
      return;
    }

    // If job is in terminal state, don't follow (get static logs)
    const isTerminal = status === 'Succeeded' || status === 'Failed' || status === 'Stopped';

    if (!isTerminal) {
      setLogs(['Connecting to log stream...']);
    }

    isCleanedUpRef.current = false;
    isFirstMessageRef.current = true;

    const connectWebSocket = () => {
      // Don't reconnect if component is unmounted
      if (isCleanedUpRef.current) {
        return;
      }

      // Don't reconnect terminal jobs (but allow initial connection)
      if (isTerminal && reconnectAttemptsRef.current > 0) {
        return;
      }

      // Build WebSocket URL - NEW: uses scenarioRunName + clusterName
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const follow = !isTerminal;

      // Get JWT token for authentication
      const token = authService.getToken();
      if (!token) {
        setLogs(['⚠️  Authentication required. Please login again.']);
        return;
      }

      // NEW URL structure: /scenarios/run/{scenarioRunName}/jobs/{jobId}/logs
      const wsUrl = `${protocol}//${host}/api/v1/scenarios/run/${encodeURIComponent(scenarioRunName)}/jobs/${encodeURIComponent(jobId)}/logs?follow=${follow}`;

      try {
        // Use WebSocket subprotocol to pass JWT token securely
        // Protocol format: "access_token.{token}"
        // Backend will receive this in Sec-WebSocket-Protocol header and must:
        // 1. Split on first '.' to separate prefix from token
        // 2. Validate the token part
        // 3. Accept connection with Sec-WebSocket-Protocol: access_token
        const wsProtocol = `access_token.${token}`;

        const ws = new WebSocket(wsUrl, wsProtocol);
        wsRef.current = ws;
        // Register in global map to prevent StrictMode duplicates
        activeConnections.set(jobId, ws);

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
          const message = event.data;

          // Check if it's an error message
          if (message.startsWith('ERROR:')) {
            setLogs(prev => [...prev, `⚠️  ${message}`]);
            return;
          }

          // Regular log line
          setLogs(prev => {
            // Replace "Connecting..." message on first data
            if (isFirstMessageRef.current && prev[0] === 'Connecting to log stream...') {
              isFirstMessageRef.current = false;
              return [message];
            }
            return [...prev, message];
          });
        };

        ws.onerror = () => {
          // Error handling is done in onclose
        };

        ws.onclose = (event) => {
          // Remove from global map only if this is still the active connection
          // This prevents removing a newer connection if StrictMode created one
          if (activeConnections.get(jobId) === ws) {
            activeConnections.delete(jobId);
          }

          // Authentication failure (code 1002 = protocol error, 1008 = policy violation)
          if (event.code === 1002 || event.code === 1008) {
            setLogs(prev => [...prev, '', '⚠️  Authentication failed. Please check backend WebSocket implementation.']);
            return;
          }

          // Normal closure (code 1000)
          if (event.code === 1000) {
            return;
          }

          // Unexpected closure - attempt reconnect if not terminal and not cleaned up
          if (!isTerminal && !isCleanedUpRef.current) {
            scheduleReconnect(2000);
          }
        };
      } catch (error) {
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
        setLogs(prev => [...prev, '', '⚠️  Max reconnection attempts reached. Please refresh the page.']);
        return;
      }

      // Exponential backoff: delay * 1.5^(attempts-1), capped at 30 seconds
      const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttemptsRef.current - 1), 30000);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, delay);
    };

    // Start initial connection
    connectWebSocket();

    // Cleanup on unmount or when dependencies change
    return () => {
      isCleanedUpRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        // Note: removal from Map happens in ws.onclose to handle async close timing
        wsRef.current = null;
      }
    };
  }, [scenarioRunName, jobId, clusterName, status]);

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
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
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
            ref={logsContainerRef}
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
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Checkbox
              id={`follow-logs-${jobId}`}
              label="Follow"
              isChecked={isFollowing}
              onChange={(_event, checked) => handleFollowToggle(checked)}
              description="Auto-scroll to latest logs"
            />
          </div>
        </CardBody>
      </Card>
    </>
  );
}
