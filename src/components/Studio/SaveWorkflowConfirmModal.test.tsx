/**
 * SaveWorkflowConfirmModal.test.tsx - Tests for SaveWorkflowConfirmModal component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { SaveWorkflowConfirmModal } from './SaveWorkflowConfirmModal';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';

vi.mock('./StudioContext', () => ({
  useStudioContext: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  useNotifications: vi.fn(),
}));

function buildMockContext(overrides: Record<string, unknown> = {}) {
  return {
    savedFile: {
      fileId: 'f1',
      fileName: 'my-workflow',
      description: 'A test workflow',
      availableToAll: true,
      savedAt: '2024-01-01',
    },
    saveWorkflowToCluster: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SaveWorkflowConfirmModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  let mockShowSuccess: ReturnType<typeof vi.fn>;
  let mockShowError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockShowSuccess = vi.fn();
    mockShowError = vi.fn();
    vi.mocked(useNotifications).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    } as any);
  });

  it('does not render when isOpen is false', () => {
    vi.mocked(useStudioContext).mockReturnValue(buildMockContext() as any);

    render(
      <SaveWorkflowConfirmModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    expect(screen.queryByText('Update Workflow')).not.toBeInTheDocument();
  });

  it('shows workflow name in modal text', () => {
    vi.mocked(useStudioContext).mockReturnValue(buildMockContext() as any);

    render(
      <SaveWorkflowConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    expect(screen.getByText('Update Workflow')).toBeInTheDocument();
    expect(screen.getByText(/my-workflow/)).toBeInTheDocument();
  });

  it('calls saveWorkflowToCluster when Update button is clicked', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useStudioContext).mockReturnValue(
      buildMockContext({ saveWorkflowToCluster: mockSave }) as any,
    );

    render(
      <SaveWorkflowConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });

  it('shows success notification on save', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useStudioContext).mockReturnValue(
      buildMockContext({ saveWorkflowToCluster: mockSave }) as any,
    );

    render(
      <SaveWorkflowConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Workflow updated',
        '"my-workflow" updated successfully',
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('shows error notification on failure', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockRejectedValue(new Error('Server error'));

    vi.mocked(useStudioContext).mockReturnValue(
      buildMockContext({ saveWorkflowToCluster: mockSave }) as any,
    );

    render(
      <SaveWorkflowConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Update failed', 'Server error');
    });

    // onClose and onSuccess should NOT be called on failure
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('shows generic error message for non-Error exceptions', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockRejectedValue('something went wrong');

    vi.mocked(useStudioContext).mockReturnValue(
      buildMockContext({ saveWorkflowToCluster: mockSave }) as any,
    );

    render(
      <SaveWorkflowConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Update failed',
        'Failed to update workflow',
      );
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(useStudioContext).mockReturnValue(buildMockContext() as any);

    render(
      <SaveWorkflowConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    await user.click(screen.getByText('Cancel'));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call saveWorkflowToCluster when savedFile is null', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useStudioContext).mockReturnValue(
      buildMockContext({
        savedFile: null,
        saveWorkflowToCluster: mockSave,
      }) as any,
    );

    render(
      <SaveWorkflowConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    await user.click(screen.getByText('Update'));

    expect(mockSave).not.toHaveBeenCalled();
  });
});
