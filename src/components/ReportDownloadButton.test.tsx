import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportDownloadButton } from './ReportDownloadButton';

// Mock the operator API
const mockGetReportStatus = vi.fn();
const mockDownloadReportHTML = vi.fn();
const mockDownloadReportPDF = vi.fn();

vi.mock('../services/operatorApi', () => ({
  operatorApi: {
    getReportStatus: (...args: unknown[]) => mockGetReportStatus(...args),
    downloadReportHTML: (...args: unknown[]) => mockDownloadReportHTML(...args),
    downloadReportPDF: (...args: unknown[]) => mockDownloadReportPDF(...args),
  },
}));

describe('ReportDownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const openReportMenu = async (expectedItem: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));
    await waitFor(() => {
      expect(screen.getByText(expectedItem)).toBeInTheDocument();
    });
  };

  it('shows loading spinner while reports are generating', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: false,
      htmlAvailable: false,
      pdfAvailable: false,
    });

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => {
      expect(screen.getByText(/Checking for reports/)).toBeInTheDocument();
    });
  });

  it('shows download buttons when reports are ready', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: true,
    });

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await openReportMenu('Download HTML');
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('downloads HTML report when button is clicked', async () => {
    const mockBlob = new Blob(['<html>Test</html>'], { type: 'text/html' });
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });
    mockDownloadReportHTML.mockResolvedValue(mockBlob);

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await openReportMenu('Download HTML');

    const downloadButton = screen.getByText('Download HTML');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockDownloadReportHTML).toHaveBeenCalledWith('test-run-1');
    });
  });

  it('downloads PDF report when button is clicked', async () => {
    const mockBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: false,
      pdfAvailable: true,
    });
    mockDownloadReportPDF.mockResolvedValue(mockBlob);

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await openReportMenu('Download PDF');

    const downloadButton = screen.getByText('Download PDF');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockDownloadReportPDF).toHaveBeenCalledWith('test-run-1');
    });
  });

  it('previews an HTML report without downloading it', async () => {
    const mockBlob = new Blob(['<html>Preview</html>'], { type: 'text/html' });
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });
    mockDownloadReportHTML.mockResolvedValue(mockBlob);
    global.URL.createObjectURL = vi.fn(() => 'blob:preview-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await openReportMenu('Preview HTML');
    fireEvent.click(screen.getByText('Preview HTML'));

    await waitFor(() => {
      expect(mockDownloadReportHTML).toHaveBeenCalledWith('test-run-1');
      expect(screen.getByTitle('HTML report preview')).toBeInTheDocument();
    });
  });

  it('shows error message when report status fetch fails', async () => {
    mockGetReportStatus.mockRejectedValue(new Error('Network error'));

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Report Error' })).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Report Error' }));
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('restarts status polling when retry is clicked', async () => {
    mockGetReportStatus
      .mockRejectedValueOnce(new Error('Temporary outage'))
      .mockResolvedValue({
        generated: true,
        htmlAvailable: true,
        pdfAvailable: false,
      });

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Report Error' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Report Error' }));
    expect(screen.getByText('Temporary outage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await openReportMenu('Download HTML');
    expect(mockGetReportStatus).toHaveBeenCalledTimes(2);
  });

  it('stops polling when a completed run has no reports', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: false,
      htmlAvailable: false,
      pdfAvailable: false,
    });

    render(
      <ReportDownloadButton
        runId="test-run-1"
        runName="test-run"
        runPhase="Failed"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('No reports available')).toBeInTheDocument();
    });
    expect(mockGetReportStatus).toHaveBeenCalledTimes(1);
  });

  it('allows retry after a report download fails', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });
    mockDownloadReportHTML
      .mockRejectedValueOnce(new Error('Download unavailable'))
      .mockResolvedValue(new Blob(['<html>retry</html>'], { type: 'text/html' }));

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await openReportMenu('Download HTML');

    fireEvent.click(screen.getByText('Download HTML'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Report Error' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Report Error' }));
    expect(screen.getByText('Download unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await openReportMenu('Download HTML');
  });

  it('only shows HTML button when only HTML is available', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await openReportMenu('Download HTML');
    expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();
  });
});
