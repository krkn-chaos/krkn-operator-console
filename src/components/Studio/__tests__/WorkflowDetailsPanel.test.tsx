import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowDetailsPanel } from '../WorkflowDetailsPanel';
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

const savedWorkflow = {
  workflowId: 'wf-001',
  workflowName: 'existing-workflow',
  description: 'test',
  availableToAll: true,
  savedAt: '2026-07-01T00:00:00Z',
};

describe('WorkflowDetailsPanel - 409 conflict handling', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();
  const mockSetSavedWorkflow = vi.fn();
  const mockSetIsEditingDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useStudioContext).mockReturnValue({
      savedWorkflow,
      setSavedWorkflow: mockSetSavedWorkflow,
      workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
      isEditingDetails: true,
      setIsEditingDetails: mockSetIsEditingDetails,
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

    // isApiError returns true for errors with a numeric status property
    vi.mocked(isApiError).mockImplementation(
      (err: unknown): err is import('../../../utils/apiClient').ApiError =>
        err instanceof Error && typeof (err as unknown as Record<string, unknown>).status === 'number',
    );
  });

  it('calls showError with 409 message when workflow name conflicts', async () => {
    const conflictError = Object.assign(new Error('conflict'), {
      status: 409,
      statusText: 'Conflict',
    });
    vi.mocked(workflowsApi.updateWorkflow).mockRejectedValue(conflictError);

    const user = userEvent.setup();
    render(<WorkflowDetailsPanel />);

    // The Name TextInput is pre-filled with savedWorkflow.workflowName.
    // Clear it and type a conflicting name.
    const nameInput = screen.getByDisplayValue('existing-workflow');
    await user.clear(nameInput);
    await user.type(nameInput, 'conflicting-name');

    // Click the Save button
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledOnce();
      expect(mockShowError).toHaveBeenCalledWith(
        'Name already exists',
        'A workflow named "conflicting-name" already exists.',
      );
    });
  });

  it('shows validation error text for conflicting name', async () => {
    const conflictError = Object.assign(new Error('conflict'), {
      status: 409,
      statusText: 'Conflict',
    });
    vi.mocked(workflowsApi.updateWorkflow).mockRejectedValue(conflictError);

    const user = userEvent.setup();
    render(<WorkflowDetailsPanel />);

    const nameInput = screen.getByDisplayValue('existing-workflow');
    await user.clear(nameInput);
    await user.type(nameInput, 'conflicting-name');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText('"conflicting-name" already exists. Please choose a different name.'),
      ).toBeInTheDocument();
    });
  });
});
