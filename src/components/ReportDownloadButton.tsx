import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  Spinner,
  Alert,
  Flex,
  FlexItem,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  ExpandableSection,
  Modal,
  ModalVariant,
} from '@patternfly/react-core';
import { operatorApi } from '../services/operatorApi';
import type { ReportStatus } from '../types/api';

interface ReportDownloadButtonProps {
  runId: string;
  runName: string;
  runPhase?: string;
}

/**
 * Displays report availability for a scenario run and downloads the generated
 * HTML/PDF files. The component polls sequentially while a run is active and
 * exposes a retry action after a status or download failure.
 *
 * @example
 * <ReportDownloadButton
 *   runId={run.scenarioRunName}
 *   runName={run.scenarioRunName}
 *   runPhase={run.phase}
 * />
 */
export const ReportDownloadButton: React.FC<ReportDownloadButtonProps> = ({ runId, runName, runPhase }) => {
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState<'html' | 'pdf' | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<'html' | 'pdf' | null>(null);
  const [preview, setPreview] = useState<{ format: 'html' | 'pdf'; url: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollCount = useRef(0);
  const [retryToken, setRetryToken] = useState(0);
  const MAX_POLLS = 180;
  const isCompleted = runPhase && ['Succeeded', 'PartiallyFailed', 'Failed'].includes(runPhase);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const checkStatus = async () => {
      if (cancelled) return;

      try {
        const status = await operatorApi.getReportStatus(runId);
        if (cancelled) return;
        setReportStatus(status);
        setError(null);

        if (status.htmlAvailable || status.pdfAvailable) {
          setIsLoading(false);
          return;
        }

        if (isCompleted) {
          setIsLoading(false);
          return;
        }

        attempts += 1;
        pollCount.current = attempts;
        if (attempts >= MAX_POLLS) {
          setError('Report generation timed out');
          setIsLoading(false);
          return;
        }

        // Schedule the next request only after this request has completed.
        // This prevents slow status calls from accumulating in flight.
        timeout = setTimeout(checkStatus, 5000);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch report status');
        setIsLoading(false);
      }
    };

    void checkStatus();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [runId, isCompleted, retryToken]);

  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  const fetchReport = async (format: 'html' | 'pdf') => {
    return format === 'html'
      ? operatorApi.downloadReportHTML(runId)
      : operatorApi.downloadReportPDF(runId);
  };

  const handleDownload = async (format: 'html' | 'pdf') => {
    setIsDownloading(format);
    try {
      const blob = await fetchReport(format);

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

  const handlePreview = async (format: 'html' | 'pdf') => {
    setIsPreviewing(format);
    try {
      const blob = await fetchReport(format);
      setPreview({ format, url: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsPreviewing(null);
    }
  };

  const closePreview = () => {
    setPreview(null);
  };

  const handleRetry = () => {
    setError(null);
    pollCount.current = 0;
    setReportStatus(null);
    setIsLoading(true);
    setRetryToken((token) => token + 1);
  };

  if (error) {
    return (
      <ExpandableSection
        toggleContent={
          <span style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>
            Report Error
          </span>
        }
        isExpanded={isErrorExpanded}
        onToggle={(_event, expanded) => setIsErrorExpanded(expanded)}
      >
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
      </ExpandableSection>
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
    <>
      <Flex>
        <Dropdown
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              variant="secondary"
              onClick={() => setIsMenuOpen((open) => !open)}
              isExpanded={isMenuOpen}
              isDisabled={isDownloading !== null || isPreviewing !== null}
            >
              Reports
            </MenuToggle>
          )}
        >
          <DropdownList>
            {reportStatus?.htmlAvailable && (
              <>
                <DropdownItem
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handlePreview('html');
                  }}
                >
                  Preview HTML
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handleDownload('html');
                  }}
                >
                  Download HTML
                </DropdownItem>
              </>
            )}
            {reportStatus?.pdfAvailable && (
              <>
                <DropdownItem
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handlePreview('pdf');
                  }}
                >
                  Preview PDF
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handleDownload('pdf');
                  }}
                >
                  Download PDF
                </DropdownItem>
              </>
            )}
          </DropdownList>
        </Dropdown>
      </Flex>
      <Modal
        title={(preview?.format.toUpperCase() || '') + ' report preview'}
        variant={ModalVariant.large}
        isOpen={preview !== null}
        onClose={closePreview}
      >
        {preview && (
          <iframe
            src={preview.url}
            title={preview.format.toUpperCase() + ' report preview'}
            style={{ width: '100%', height: '70vh', border: 0 }}
            sandbox={preview.format === 'html' ? '' : undefined}
          />
        )}
      </Modal>
    </>
  );
};
