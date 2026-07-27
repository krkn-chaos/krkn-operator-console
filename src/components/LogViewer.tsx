import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Card, CardTitle, CardBody, Button, Alert, AlertGroup, AlertActionCloseButton, Flex, FlexItem, Checkbox } from '@patternfly/react-core';
import { CopyIcon } from '@patternfly/react-icons';
import Anser from 'anser';
import { useWebSocket } from '../hooks/useWebSocket';
import { websocketService } from '../services/websocketService';
import type { RawMessageHandler } from '../types/websocket';

interface LogViewerProps {
  scenarioRunName: string;
  jobId: string;
  clusterName: string;
  podName: string;
  status: string;
  compact?: boolean;
}

export function LogViewer({ scenarioRunName, jobId, clusterName: _clusterName, podName, status, compact = false }: LogViewerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const isFirstMessageRef = useRef<boolean>(true);

  const isPending = status === 'Pending';
  const isTerminal = status === 'Succeeded' || status === 'Failed' || status === 'Stopped';
  const follow = !isTerminal;

  const connectionId = `logs-${jobId}`;
  const wsUrl = websocketService.buildJobLogsUrl(scenarioRunName, jobId, follow);

  // Set initial status message
  useEffect(() => {
    if (isPending) {
      setLogs(['Waiting for pod to start...']);
    } else if (!isTerminal) {
      isFirstMessageRef.current = true;
      setLogs(['Connecting to log stream...']);
    }
  }, [isPending, isTerminal]);

  const handleRawMessage: RawMessageHandler = useCallback((data: string) => {
    if (data.startsWith('ERROR:')) {
      setLogs(prev => [...prev, `⚠️  ${data}`]);
      return;
    }

    setLogs(prev => {
      if (isFirstMessageRef.current && prev[0] === 'Connecting to log stream...') {
        isFirstMessageRef.current = false;
        return [data];
      }
      return [...prev, data];
    });
  }, []);

  useWebSocket(connectionId, wsUrl, handleRawMessage, {
    disabled: isPending,
    subscriptionMode: false,
  });

  const handleCopyLogs = async () => {
    try {
      const plainText = logs.map(log => Anser.ansiToText(log)).join('\n');
      await navigator.clipboard.writeText(plainText);
      setShowCopyAlert(true);
      setTimeout(() => setShowCopyAlert(false), 3000);
    } catch {
      // Silent failure
    }
  };

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

  useLayoutEffect(() => {
    if (isFollowing && logsContainerRef.current && logs.length > 0) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, isFollowing]);

  const handleFollowToggle = (checked: boolean) => {
    setIsFollowing(checked);
    if (checked && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  };

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
