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

// Helper function to interpret WebSocket close codes
function getCloseCodeMeaning(code: number): string {
  switch (code) {
    case 1000: return 'Normal closure';
    case 1001: return 'Going away (server shutdown or browser navigation)';
    case 1002: return 'Protocol error (likely auth/subprotocol issue)';
    case 1003: return 'Unsupported data';
    case 1006: return 'Abnormal closure (connection dropped, no close frame)';
    case 1007: return 'Invalid frame payload data';
    case 1008: return 'Policy violation (likely authentication failure)';
    case 1009: return 'Message too big';
    case 1010: return 'Missing extension';
    case 1011: return 'Internal server error';
    case 1015: return 'TLS handshake failure';
    default: return `Unknown code (${code})`;
  }
}

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
      console.log('Job is pending, waiting for it to start before streaming logs');
      setLogs(['Waiting for pod to start...']);
      return;
    }

    // StrictMode guard: check global connection map
    // This persists across StrictMode's double-mount, preventing duplicates
    const existingConnection = activeConnections.get(jobId);
    if (existingConnection && (existingConnection.readyState === WebSocket.CONNECTING || existingConnection.readyState === WebSocket.OPEN)) {
      console.log(`[LogViewer ${jobId}] WebSocket already active (global guard), skipping duplicate connection`);
      // Reuse existing connection
      wsRef.current = existingConnection;
      return;
    }

    // If job is in terminal state, don't follow (get static logs)
    const isTerminal = status === 'Succeeded' || status === 'Failed' || status === 'Stopped';

    console.log(`[LogViewer ${jobId}] Starting WebSocket log stream for run:`, scenarioRunName, 'cluster:', clusterName, 'status:', status);

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
        console.log('Terminal job - skipping reconnect');
        return;
      }

      console.log(`Attempting to connect to WebSocket (attempt ${reconnectAttemptsRef.current + 1})`);

      // Build WebSocket URL - NEW: uses scenarioRunName + clusterName
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const follow = !isTerminal;

      // Get JWT token for authentication
      const token = authService.getToken();
      if (!token) {
        console.error('No authentication token available for WebSocket connection');
        setLogs(['⚠️  Authentication required. Please login again.']);
        return;
      }

      // NEW URL structure: /scenarios/run/{scenarioRunName}/jobs/{jobId}/logs
      const wsUrl = `${protocol}//${host}/api/v1/scenarios/run/${encodeURIComponent(scenarioRunName)}/jobs/${encodeURIComponent(jobId)}/logs?follow=${follow}`;

      console.log('=== WebSocket Connection Attempt ===');
      console.log('URL:', wsUrl);
      console.log('Token available:', !!token);
      console.log('Token length:', token.length);
      console.log('Token preview (first 30 chars):', token.substring(0, 30) + '...');

      try {
        // Use WebSocket subprotocol to pass JWT token securely
        // Protocol format: "access_token.{token}"
        // Backend will receive this in Sec-WebSocket-Protocol header and must:
        // 1. Split on first '.' to separate prefix from token
        // 2. Validate the token part
        // 3. Accept connection with Sec-WebSocket-Protocol: access_token
        const wsProtocol = `access_token.${token}`;
        console.log('Full protocol length:', wsProtocol.length);
        console.log('Protocol format check:', wsProtocol.substring(0, 13), '(should be "access_token.")');
        console.log('Creating WebSocket with subprotocol...');

        const ws = new WebSocket(wsUrl, wsProtocol);
        wsRef.current = ws;
        // Register in global map to prevent StrictMode duplicates
        activeConnections.set(jobId, ws);
        console.log(`[LogViewer ${jobId}] WebSocket created and registered. ReadyState:`, ws.readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)');

        ws.onopen = () => {
          console.log('=== WebSocket Connection Established ===');
          console.log('✅ Connected successfully!');
          console.log('Accepted protocol:', ws.protocol);
          console.log('Expected protocol: "access_token"');
          console.log('Protocol match:', ws.protocol === 'access_token' ? '✅ YES' : '❌ NO');
          console.log('ReadyState:', ws.readyState, '(should be 1=OPEN)');
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
          console.error('=== WebSocket Error Event ===');
          console.error('Error object:', error);
          console.error('ReadyState at error:', ws.readyState);
          console.error('Error type:', error.type);
          // Error handling is done in onclose
        };

        ws.onclose = (event) => {
          console.log(`[LogViewer ${jobId}] === WebSocket Close Event ===`);
          console.log('Close code:', event.code);
          console.log('Close reason:', event.reason || '(no reason provided)');
          console.log('Was clean:', event.wasClean);
          console.log('Terminal state:', isTerminal);
          console.log('Cleaned up:', isCleanedUpRef.current);
          console.log('ReadyState:', ws.readyState);

          // Remove from global map only if this is still the active connection
          // This prevents removing a newer connection if StrictMode created one
          if (activeConnections.get(jobId) === ws) {
            activeConnections.delete(jobId);
            console.log(`[LogViewer ${jobId}] WebSocket removed from global map (onclose)`);
          }

          // Common close codes reference:
          // 1000: Normal closure
          // 1001: Going away
          // 1002: Protocol error
          // 1006: Abnormal closure (no close frame received)
          // 1008: Policy violation
          // 1009: Message too big
          // 1011: Server error
          console.log('Close code meaning:', getCloseCodeMeaning(event.code));

          // Authentication failure (code 1002 = protocol error, 1008 = policy violation)
          if (event.code === 1002 || event.code === 1008) {
            console.error('WebSocket authentication failed. Backend may not support subprotocol auth.');
            setLogs(prev => [...prev, '', '⚠️  Authentication failed. Please check backend WebSocket implementation.']);
            return;
          }

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
      console.log(`[LogViewer ${jobId}] Cleaning up WebSocket`);
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
