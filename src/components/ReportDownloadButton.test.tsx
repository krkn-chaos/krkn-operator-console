import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportDownloadButton } from './ReportDownloadButton';

// Mock the operator API
const mockGetReportStatus = vi.fn();
const mockDownloadReportHTML = vi.fn();
const mockDownloadReportPDF = vi.fn();

vi.mock('../services/operatorApi', () => ({
  operatorApi: {
    getReportStatus: (...args: any[]) => mockGetReportStatus(...args),
    downloadReportHTML: (...args: any[]) => mockDownloadReportHTML(...args),
    downloadReportPDF: (...args: any[]) => mockDownloadReportPDF(...args),
  },
}));

describe('ReportDownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    await waitFor(() => {
      expect(screen.getByText('Download HTML')).toBeInTheDocument();
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
    });
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

    await waitFor(() => {
      expect(screen.getByText('Download HTML')).toBeInTheDocument();
    });

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

    await waitFor(() => {
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
    });

    const downloadButton = screen.getByText('Download PDF');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockDownloadReportPDF).toHaveBeenCalledWith('test-run-1');
    });
  });

  it('shows error message when report status fetch fails', async () => {
    mockGetReportStatus.mockRejectedValue(new Error('Network error'));

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('only shows HTML button when only HTML is available', async () => {
    mockGetReportStatus.mockResolvedValue({
      generated: true,
      htmlAvailable: true,
      pdfAvailable: false,
    });

    render(<ReportDownloadButton runId="test-run-1" runName="test-run" />);

    await waitFor(() => {
      expect(screen.getByText('Download HTML')).toBeInTheDocument();
      expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();
    });
  });
});
