import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CategoryResponse } from '../../types/api';

const mockHandleDownload = vi.fn();
const mockHandlePreview = vi.fn();
const mockClosePreview = vi.fn();
const mockRetry = vi.fn();

let mockReportReturn = {
  reportStatus: null,
  isLoading: false,
  error: null as string | null,
  hasHtml: false,
  hasPdf: false,
  hasReports: false,
  preview: null as { format: 'html' | 'pdf'; url: string } | null,
  isDownloading: null as 'html' | 'pdf' | null,
  isPreviewing: null as 'html' | 'pdf' | null,
  handleDownload: mockHandleDownload,
  handlePreview: mockHandlePreview,
  closePreview: mockClosePreview,
  retry: mockRetry,
};

vi.mock('../../hooks/useReportActions', () => ({
  useReportActions: () => mockReportReturn,
}));

const { RunCategoryActions } = await import('../RunCategoryActions');

const categories: CategoryResponse[] = [
  { name: 'resilience', color: '#0066CC', availableToAll: true },
];

const defaultProps = {
  runName: 'run-123',
  categories: [] as CategoryResponse[],
  assignedCategoryNames: [] as string[],
  isCategoriesLoading: false,
  categoriesError: null,
  isCategoryUpdating: false,
  isDeleting: false,
  onOpenCategories: vi.fn(),
  onToggleCategory: vi.fn(),
  onDelete: vi.fn(),
};

describe('RunCategoryActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportReturn = {
      reportStatus: null,
      isLoading: false,
      error: null,
      hasHtml: false,
      hasPdf: false,
      hasReports: false,
      preview: null,
      isDownloading: null,
      isPreviewing: null,
      handleDownload: mockHandleDownload,
      handlePreview: mockHandlePreview,
      closePreview: mockClosePreview,
      retry: mockRetry,
    };
  });

  it('opens category actions and supports adding and removing a category', async () => {
    const onOpenCategories = vi.fn();
    const onToggleCategory = vi.fn();
    render(
      <RunCategoryActions
        runName="run-123"
        categories={categories}
        assignedCategoryNames={['resilience']}
        isCategoriesLoading={false}
        categoriesError={null}
        isCategoryUpdating={false}
        isDeleting={false}
        onOpenCategories={onOpenCategories}
        onToggleCategory={onToggleCategory}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.mouseEnter(screen.getByText('Category'));
    const categoryItem = await screen.findByRole('menuitem', { name: 'Remove category resilience' });
    fireEvent.click(categoryItem.querySelector('input[type="checkbox"]')!);

    expect(onOpenCategories).toHaveBeenCalledOnce();
    await waitFor(() => expect(onToggleCategory).toHaveBeenCalledWith(categories[0]));
  });

  it('shows the delete action as the final menu item', () => {
    const onDelete = vi.fn();
    render(
      <RunCategoryActions
        runName="run-123"
        categories={[]}
        assignedCategoryNames={[]}
        isCategoriesLoading={false}
        categoriesError={null}
        isCategoryUpdating={false}
        isDeleting={false}
        onOpenCategories={vi.fn()}
        onToggleCategory={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('does not show Reports item when runId is not provided', () => {
    render(<RunCategoryActions {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Checking reports…')).not.toBeInTheDocument();
  });

  it('shows loading state while reports are being checked', () => {
    mockReportReturn = { ...mockReportReturn, isLoading: true };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    expect(screen.getByText('Checking reports…')).toBeInTheDocument();
  });

  it('shows Reports flyout with HTML actions when HTML is available', () => {
    mockReportReturn = { ...mockReportReturn, hasHtml: true, hasReports: true };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));

    const reportsItem = screen.getByText('Reports');
    expect(reportsItem).toBeInTheDocument();

    fireEvent.mouseEnter(reportsItem);
    expect(screen.getByText('Preview HTML')).toBeInTheDocument();
    expect(screen.getByText('Download HTML')).toBeInTheDocument();
    expect(screen.queryByText('Preview PDF')).not.toBeInTheDocument();
    expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();
  });

  it('shows Reports flyout with PDF actions when PDF is available', () => {
    mockReportReturn = { ...mockReportReturn, hasPdf: true, hasReports: true };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.mouseEnter(screen.getByText('Reports'));

    expect(screen.getByText('Preview PDF')).toBeInTheDocument();
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
    expect(screen.queryByText('Preview HTML')).not.toBeInTheDocument();
  });

  it('shows all report actions when both HTML and PDF are available', () => {
    mockReportReturn = { ...mockReportReturn, hasHtml: true, hasPdf: true, hasReports: true };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.mouseEnter(screen.getByText('Reports'));

    expect(screen.getByText('Preview HTML')).toBeInTheDocument();
    expect(screen.getByText('Download HTML')).toBeInTheDocument();
    expect(screen.getByText('Preview PDF')).toBeInTheDocument();
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('calls handleDownload when Download HTML is clicked', () => {
    mockReportReturn = { ...mockReportReturn, hasHtml: true, hasReports: true };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.mouseEnter(screen.getByText('Reports'));
    fireEvent.click(screen.getByText('Download HTML'));

    expect(mockHandleDownload).toHaveBeenCalledWith('html');
  });

  it('calls handlePreview when Preview HTML is clicked', () => {
    mockReportReturn = { ...mockReportReturn, hasHtml: true, hasReports: true };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.mouseEnter(screen.getByText('Reports'));
    fireEvent.click(screen.getByText('Preview HTML'));

    expect(mockHandlePreview).toHaveBeenCalledWith('html');
  });

  it('calls handleDownload(pdf) when Download PDF is clicked', () => {
    mockReportReturn = { ...mockReportReturn, hasPdf: true, hasReports: true };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.mouseEnter(screen.getByText('Reports'));
    fireEvent.click(screen.getByText('Download PDF'));

    expect(mockHandleDownload).toHaveBeenCalledWith('pdf');
  });

  it('disables Reports item when download is in progress', () => {
    mockReportReturn = { ...mockReportReturn, hasHtml: true, hasReports: true, isDownloading: 'html' };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));

    const reportsButton = screen.getByText('Reports').closest('button');
    expect(reportsButton).toBeDisabled();
  });

  it('disables Reports item when preview is in progress', () => {
    mockReportReturn = { ...mockReportReturn, hasHtml: true, hasReports: true, isPreviewing: 'html' };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));

    const reportsButton = screen.getByText('Reports').closest('button');
    expect(reportsButton).toBeDisabled();
  });

  it('shows error state with retry action when report fetch fails', () => {
    mockReportReturn = { ...mockReportReturn, error: 'Network error' };
    render(<RunCategoryActions {...defaultProps} runId="run-123" />);
    fireEvent.click(screen.getByLabelText('Actions for run run-123'));

    const retryItem = screen.getByText('Reports failed — Retry');
    expect(retryItem).toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();

    fireEvent.click(retryItem);
    expect(mockRetry).toHaveBeenCalledOnce();
  });
});
