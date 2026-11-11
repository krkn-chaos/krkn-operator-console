import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetReportStatus = vi.fn();
const mockDownloadReportHTML = vi.fn();
const mockDownloadReportPDF = vi.fn();

vi.mock('../../services/operatorApi', () => ({
  operatorApi: {
    getReportStatus: (...args: unknown[]) => mockGetReportStatus(...args),
    downloadReportHTML: (...args: unknown[]) => mockDownloadReportHTML(...args),
    downloadReportPDF: (...args: unknown[]) => mockDownloadReportPDF(...args),
  },
}));

const { useReportActions } = await import('../useReportActions');

describe('useReportActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('skips polling when runId is undefined', () => {
    const { result } = renderHook(() =>
      useReportActions({ runName: 'test-run' }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasReports).toBe(false);
    expect(mockGetReportStatus).not.toHaveBeenCalled();
  });

  it('polls for report status when runId is provided', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetReportStatus).toHaveBeenCalledWith('run-1');
    expect(result.current.hasHtml).toBe(true);
    expect(result.current.hasPdf).toBe(false);
    expect(result.current.hasReports).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('stops polling when run is completed with no reports', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: false,
      htmlAvailable: false,
      pdfAvailable: false,
    });

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run', runPhase: 'Succeeded' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasReports).toBe(false);
    expect(mockGetReportStatus).toHaveBeenCalledTimes(1);
  });

  it('stops polling for PartiallyFailed and Failed phases', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: false,
      htmlAvailable: false,
      pdfAvailable: false,
    });

    for (const phase of ['PartiallyFailed', 'Failed']) {
      vi.clearAllMocks();
      const { result } = renderHook(() =>
        useReportActions({ runId: 'run-1', runName: 'test-run', runPhase: phase }),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockGetReportStatus).toHaveBeenCalledTimes(1);
    }
  });

  it('sets error when status fetch fails', async () => {
    mockGetReportStatus.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Network error');
  });

  it('retries after error when retry is called', async () => {
    mockGetReportStatus
      .mockRejectedValueOnce(new Error('Temporary'))
      .mockResolvedValue({
        generated: true,
        htmlAvailable: true,
        pdfAvailable: true,
      });

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.error).toBe('Temporary'));

    act(() => result.current.retry());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    expect(result.current.hasHtml).toBe(true);
    expect(result.current.hasPdf).toBe(true);
    expect(mockGetReportStatus).toHaveBeenCalledTimes(2);
  });

  it('downloads HTML report', async () => {
    const mockBlob = new Blob(['<html>Test</html>'], { type: 'text/html' });
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });
    mockDownloadReportHTML.mockResolvedValue(mockBlob);

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.hasHtml).toBe(true));

    await act(async () => {
      await result.current.handleDownload('html');
    });

    expect(mockDownloadReportHTML).toHaveBeenCalledWith('run-1');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('downloads PDF report', async () => {
    const mockBlob = new Blob(['%PDF'], { type: 'application/pdf' });
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: false,
      pdfAvailable: true,
    });
    mockDownloadReportPDF.mockResolvedValue(mockBlob);

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.hasPdf).toBe(true));

    await act(async () => {
      await result.current.handleDownload('pdf');
    });

    expect(mockDownloadReportPDF).toHaveBeenCalledWith('run-1');
  });

  it('sets preview state for HTML preview', async () => {
    const mockBlob = new Blob(['<html>Preview</html>'], { type: 'text/html' });
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });
    mockDownloadReportHTML.mockResolvedValue(mockBlob);

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.hasHtml).toBe(true));

    await act(async () => {
      await result.current.handlePreview('html');
    });

    expect(result.current.preview).toEqual({ format: 'html', url: 'blob:mock-url' });
  });

  it('clears preview when closePreview is called', async () => {
    const mockBlob = new Blob(['<html>Preview</html>'], { type: 'text/html' });
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });
    mockDownloadReportHTML.mockResolvedValue(mockBlob);

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.hasHtml).toBe(true));

    await act(async () => {
      await result.current.handlePreview('html');
    });
    expect(result.current.preview).not.toBeNull();

    act(() => result.current.closePreview());
    expect(result.current.preview).toBeNull();
  });

  it('sets error when download fails', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });
    mockDownloadReportHTML.mockRejectedValue(new Error('Download failed'));

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.hasHtml).toBe(true));

    await act(async () => {
      await result.current.handleDownload('html');
    });

    expect(result.current.error).toBe('Download failed');
    expect(result.current.isDownloading).toBeNull();
  });

  it('reports both formats available', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: true,
    });

    const { result } = renderHook(() =>
      useReportActions({ runId: 'run-1', runName: 'test-run' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasHtml).toBe(true);
    expect(result.current.hasPdf).toBe(true);
    expect(result.current.hasReports).toBe(true);
  });
});
