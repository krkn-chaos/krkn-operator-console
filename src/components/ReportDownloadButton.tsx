import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  Spinner,
  Alert,
  Flex,
  FlexItem,
  Tooltip,
} from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import { operatorApi } from '../services/operatorApi';
import type { ReportStatus } from '../types/api';

interface ReportDownloadButtonProps {
  runId: string;
  runName: string;
  runPhase?: string;
}

export const ReportDownloadButton: React.FC<ReportDownloadButtonProps> = ({ runId, runName, runPhase }) => {
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState<'html' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollCount = useRef(0);
  const MAX_POLLS = 180;
  const isCompleted = runPhase && ['Succeeded', 'PartiallyFailed', 'Failed'].includes(runPhase);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const checkStatus = async () => {
      try {
        const status = await operatorApi.getReportStatus(runId);
        if (cancelled) return;
        setReportStatus(status);
        setError(null);

        if (status.htmlAvailable || status.pdfAvailable) {
          setIsLoading(false);
          if (interval) clearInterval(interval);
          return;
        }

        if (isCompleted) {
          setIsLoading(false);
          if (interval) clearInterval(interval);
          return;
        }

        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          setError('Report generation timed out');
          setIsLoading(false);
          if (interval) clearInterval(interval);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch report status');
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 5000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [runId, isCompleted]);

  const handleDownload = async (format: 'html' | 'pdf') => {
    setIsDownloading(format);
    try {
      const blob = format === 'html'
        ? await operatorApi.downloadReportHTML(runId)
        : await operatorApi.downloadReportPDF(runId);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${runName}-summary.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleRetry = () => {
    setError(null);
    pollCount.current = 0;
    setReportStatus(null);
    setIsLoading(true);
  };

  if (error) {
    return (
      <Alert variant="danger" isInline title="Report Error">
        <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
          <FlexItem>{error}</FlexItem>
          <FlexItem>
            <Button variant="secondary" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </FlexItem>
        </Flex>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
        <FlexItem>
          <Spinner size="sm" />
        </FlexItem>
        <FlexItem>Checking for reports...</FlexItem>
      </Flex>
    );
  }

  const hasReports = reportStatus?.htmlAvailable || reportStatus?.pdfAvailable;

  if (!hasReports) {
    return (
      <span style={{ color: 'var(--pf-v5-global--Color--200)', fontStyle: 'italic' }}>
        No reports available
      </span>
    );
  }

  return (
    <Flex gap={{ default: 'gapMd' }}>
      {reportStatus?.htmlAvailable && (
        <Tooltip content="Download HTML report">
          <Button
            variant="primary"
            icon={<DownloadIcon />}
            onClick={() => handleDownload('html')}
            isLoading={isDownloading === 'html'}
            isDisabled={isDownloading !== null}
          >
            Download HTML
          </Button>
        </Tooltip>
      )}
      {reportStatus?.pdfAvailable && (
        <Tooltip content="Download PDF report">
          <Button
            variant="primary"
            icon={<DownloadIcon />}
            onClick={() => handleDownload('pdf')}
            isLoading={isDownloading === 'pdf'}
            isDisabled={isDownloading !== null}
          >
            Download PDF
          </Button>
        </Tooltip>
      )}
    </Flex>
  );
};
