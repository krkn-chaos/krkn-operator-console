import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Card, CardTitle, CardBody, Button, Alert, AlertGroup, AlertActionCloseButton, Flex, FlexItem, Checkbox, Dropdown, DropdownList, DropdownItem, MenuToggle, MenuToggleElement } from '@patternfly/react-core';
import { CopyIcon, DownloadIcon } from '@patternfly/react-icons';
import Anser from 'anser';
import { useWebSocket } from '../hooks/useWebSocket';
import { websocketService } from '../services/websocketService';
import { LogTerminal } from './LogTerminal';
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
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const isFirstMessageRef = useRef<boolean>(true);
  const hasConnectedRef = useRef(false);

  const isPending = status === 'Pending';
  const isTerminal = status === 'Succeeded' || status === 'Failed' || status === 'MaxRetriesExceeded' || status === 'Stopped';
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

  const { connectionState } = useWebSocket(connectionId, wsUrl, handleRawMessage, {
    disabled: isPending,
    subscriptionMode: false,
  });

  useEffect(() => {
    if (connectionState === 'reconnecting' ||
      (connectionState === 'connecting' && hasConnectedRef.current)) {
      isFirstMessageRef.current = true;
      setLogs(['Reconnecting to log stream...']);
      return;
    }
    if (connectionState === 'connected') {
      if (hasConnectedRef.current) {
        isFirstMessageRef.current = true;
        setLogs([]);
      }
      hasConnectedRef.current = true;
    }
  }, [connectionState]);


  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateStyledHtml = (fontSize: string = '12px', forPrint: boolean = false): string => {
    const htmlLines = logs.map(log => Anser.ansiToHtml(log, { use_classes: false }));
    const printStyles = forPrint ? `
    body {
      background-color: #ffffff !important;
      color: #000000 !important;
    }
    span[style] {
      color: #000000 !important;
    }` : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logs - ${podName}</title>
  <style>
    body {
      background-color: #000000;
      color: #ffffff;
      font-family: monospace;
      font-size: ${fontSize};
      padding: 16px;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }${printStyles}
    }
    @page { size: A4 landscape; margin: 10mm; }
  </style>
</head>
<body>
${htmlLines.map(line => `<div>${line}</div>`).join('\n')}
</body>
</html>`;
  };

  const handleDownloadHtml = () => {
    triggerDownload(generateStyledHtml('12px'), `logs-${podName}.html`, 'text/html');
    setIsDownloadOpen(false);
  };

  const handleDownloadText = () => {
    const plainText = logs.map(log => Anser.ansiToText(log)).join('\n');
    triggerDownload(plainText, `logs-${podName}.txt`, 'text/plain');
    setIsDownloadOpen(false);
  };

  const handleDownloadJson = () => {
    const jsonContent = JSON.stringify({
      podName,
      exportedAt: new Date().toISOString(),
      totalLines: logs.length,
      logs,
    }, null, 2);
    triggerDownload(jsonContent, `logs-${podName}.json`, 'application/json');
    setIsDownloadOpen(false);
  };

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
              <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                <FlexItem>
                  <Button variant="control" icon={<CopyIcon />} onClick={handleCopyLogs} size="sm" aria-label="Copy logs to clipboard" />
                </FlexItem>
                <FlexItem>
                  <Dropdown
                    isOpen={isDownloadOpen}
                    onOpenChange={(isOpen) => setIsDownloadOpen(isOpen)}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        variant="default"
                        ref={toggleRef}
                        aria-label="Download logs"
                        onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                        isExpanded={isDownloadOpen}
                      >
                        <DownloadIcon />
                      </MenuToggle>
                    )}
                    shouldFocusToggleOnSelect
                  >
                    <DropdownList>
                      <DropdownItem key="text" onClick={handleDownloadText}>
                        Text
                      </DropdownItem>
                      <DropdownItem key="html" onClick={handleDownloadHtml}>
                        HTML
                      </DropdownItem>
                      <DropdownItem key="json" onClick={handleDownloadJson}>
                        JSON
                      </DropdownItem>
                    </DropdownList>
                  </Dropdown>
                </FlexItem>
              </Flex>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          <LogTerminal ref={logsContainerRef} logs={logs} compact={compact} ariaLabel="Scenario log output" />
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
