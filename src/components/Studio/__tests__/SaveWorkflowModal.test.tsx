import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveWorkflowModal } from '../SaveWorkflowModal';
import { workflowsApi } from '../../../services/workflowsApi';
import { operatorApi } from '../../../services/operatorApi';
import { useStudioContext, buildGraph } from '../StudioContext';
import { useNotifications } from '../../../hooks';
import { useRole } from '../../../hooks/useRole';
import { isApiError } from '../../../utils/apiClient';

vi.mock('../../../services/workflowsApi');
vi.mock('../../../services/operatorApi');
vi.mock('../StudioContext');
vi.mock('../../../hooks');
vi.mock('../../../hooks/useRole');
vi.mock('../../../utils/apiClient');

describe('SaveWorkflowModal - 409 conflict handling', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();
  const mockSetSavedWorkflow = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useStudioContext).mockReturnValue({
      workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
      setSavedWorkflow: mockSetSavedWorkflow,
    } as unknown as ReturnType<typeof useStudioContext>);

    vi.mocked(useNotifications).mockReturnValue({
      showNotification: vi.fn(),
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: vi.fn(),
      showWarning: vi.fn(),
      hideNotification: vi.fn(),
    });

    vi.mocked(useRole).mockReturnValue({
      role: 'admin',
      isAdmin: true,
      isUser: false,
      hasRole: vi.fn(),
      isAuthenticated: true,
      userGroups: [],
    });

    vi.mocked(buildGraph).mockReturnValue({});
    vi.mocked(operatorApi.getGroups).mockResolvedValue({ groups: [] });

    vi.mocked(isApiError).mockImplementation(
      (err: unknown): err is import('../../../utils/apiClient').ApiError =>
        err instanceof Error && typeof (err as unknown as Record<string, unknown>).status === 'number',
    );
  });

  it('shows inline validation error and alert when create returns 409', async () => {
    const conflictError = Object.assign(new Error('conflict'), {
      status: 409,
      statusText: 'Conflict',
    });
    vi.mocked(workflowsApi.createWorkflow).mockRejectedValue(conflictError);

    const user = userEvent.setup();
    render(
      <SaveWorkflowModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
    );

    const nameInput = screen.getByPlaceholderText('e.g., network-chaos-suite');
    await user.type(nameInput, 'duplicate-workflow');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(workflowsApi.createWorkflow).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(
        screen.getByText('"duplicate-workflow" already exists. Please choose a different name.'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('A workflow named "duplicate-workflow" already exists.'),
    ).toBeInTheDocument();
  });

  it('does not call showError for 409 conflicts (uses inline alert instead)', async () => {
    const conflictError = Object.assign(new Error('conflict'), {
      status: 409,
      statusText: 'Conflict',
    });
    vi.mocked(workflowsApi.createWorkflow).mockRejectedValue(conflictError);

    const user = userEvent.setup();
    render(
      <SaveWorkflowModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
    );

    await user.type(screen.getByPlaceholderText('e.g., network-chaos-suite'), 'dup-name');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(workflowsApi.createWorkflow).toHaveBeenCalledOnce();
    });

    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('calls showError for non-409 errors', async () => {
    const serverError = Object.assign(new Error('Internal error'), {
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.mocked(workflowsApi.createWorkflow).mockRejectedValue(serverError);

    const user = userEvent.setup();
    render(
      <SaveWorkflowModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
    );

    await user.type(screen.getByPlaceholderText('e.g., network-chaos-suite'), 'my-workflow');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Save failed',
        'Internal error',
      );
    });
  });

  it('does not close the modal on 409 conflict', async () => {
    const conflictError = Object.assign(new Error('conflict'), {
      status: 409,
      statusText: 'Conflict',
    });
    vi.mocked(workflowsApi.createWorkflow).mockRejectedValue(conflictError);

    const user = userEvent.setup();
    render(
      <SaveWorkflowModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
    );

    await user.type(screen.getByPlaceholderText('e.g., network-chaos-suite'), 'dup-name');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(workflowsApi.createWorkflow).toHaveBeenCalledOnce();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});
