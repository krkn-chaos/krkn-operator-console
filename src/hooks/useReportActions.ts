import { useEffect, useRef, useState } from 'react';
import { operatorApi } from '../services/operatorApi';
import type { ReportStatus } from '../types/api';

interface UseReportActionsOptions {
  runId?: string;
  runName: string;
  runPhase?: string;
}

interface UseReportActionsResult {
  reportStatus: ReportStatus | null;
  isLoading: boolean;
  error: string | null;
  hasHtml: boolean;
  hasPdf: boolean;
  hasReports: boolean;
  preview: { format: 'html' | 'pdf'; url: string } | null;
  isDownloading: 'html' | 'pdf' | null;
  isPreviewing: 'html' | 'pdf' | null;
  handleDownload: (format: 'html' | 'pdf') => Promise<void>;
  handlePreview: (format: 'html' | 'pdf') => Promise<void>;
  closePreview: () => void;
  retry: () => void;
}

const MAX_POLLS = 180;

/**
 * Polls for report availability and provides download/preview actions.
 * Skips polling when `runId` is undefined (e.g. graph runs without reports).
 *
 * @example
 * const report = useReportActions({ runId: 'run-1', runName: 'run-1', runPhase: 'Succeeded' });
 * if (report.hasHtml) report.handleDownload('html');
 */
export function useReportActions({ runId, runName, runPhase }: UseReportActionsOptions): UseReportActionsResult {
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(!!runId);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<'html' | 'pdf' | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<'html' | 'pdf' | null>(null);
  const [preview, setPreview] = useState<{ format: 'html' | 'pdf'; url: string } | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const pollCount = useRef(0);
  const isCompleted = runPhase && ['Succeeded', 'PartiallyFailed', 'Failed'].includes(runPhase);

  useEffect(() => {
    if (!runId) return;
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

        if (status.htmlAvailable || status.pdfAvailable) { setIsLoading(false); return; }
        if (isCompleted) { setIsLoading(false); return; }

        attempts += 1;
        pollCount.current = attempts;
        if (attempts >= MAX_POLLS) {
          setError('Report generation timed out');
          setIsLoading(false);
          return;
        }
        timeout = setTimeout(checkStatus, 5000);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch report status');
        setIsLoading(false);
      }
    };

    void checkStatus();
    return () => { cancelled = true; if (timeout) clearTimeout(timeout); };
  }, [runId, isCompleted, retryToken]);

  useEffect(() => {
    return () => { if (preview?.url) URL.revokeObjectURL(preview.url); };
  }, [preview]);

  const fetchReport = async (format: 'html' | 'pdf') => {
    return format === 'html'
      ? operatorApi.downloadReportHTML(runId!)
      : operatorApi.downloadReportPDF(runId!);
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

  const closePreview = () => setPreview(null);

  const retry = () => {
    setError(null);
    pollCount.current = 0;
    setReportStatus(null);
    setIsLoading(true);
    setRetryToken((t) => t + 1);
  };

  const hasHtml = !!reportStatus?.htmlAvailable;
  const hasPdf = !!reportStatus?.pdfAvailable;

  return {
    reportStatus,
    isLoading,
    error,
    hasHtml,
    hasPdf,
    hasReports: hasHtml || hasPdf,
    preview,
    isDownloading,
    isPreviewing,
    handleDownload,
    handlePreview,
    closePreview,
    retry,
  };
}
