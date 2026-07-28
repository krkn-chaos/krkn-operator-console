import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { WorkflowDetailsPanel } from './WorkflowDetailsPanel';
import { useStudioContext } from './StudioContext';
import { operatorApi } from '../../services/operatorApi';

vi.mock('./StudioContext', () => ({
  useStudioContext: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  useNotifications: vi.fn(() => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  })),
}));

vi.mock('../../hooks/useRole', () => ({
  useRole: vi.fn(() => ({ isAdmin: true })),
}));

vi.mock('../../services/operatorApi', () => ({
  operatorApi: {
    getGroups: vi.fn(),
    updateFile: vi.fn(),
  },
}));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockSetSavedFile = vi.fn();
const mockSetIsEditingDetails = vi.fn();

const baseSavedFile = {
  fileId: 'f1',
  fileName: 'test-workflow',
  description: 'A test workflow',
  availableToAll: true,
  groups: undefined as string[] | undefined,
  savedAt: '2024-01-15T12:00:00.000Z',
};

const baseWorkflow = {
  nodes: [],
  edges: [],
  nextNodeNumber: 1,
};

function makeContext(overrides: Partial<ReturnType<typeof useStudioContext>> = {}) {
  return {
    savedFile: baseSavedFile,
    setSavedFile: mockSetSavedFile,
    workflow: baseWorkflow,
    isEditingDetails: false,
    setIsEditingDetails: mockSetIsEditingDetails,
    ...overrides,
  } as ReturnType<typeof useStudioContext>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useStudioContext).mockReturnValue(makeContext());
  vi.mocked(operatorApi.getGroups).mockResolvedValue({ groups: [] });
  vi.mocked(operatorApi.updateFile).mockResolvedValue({ message: 'ok', fileId: 'f1' });
});

describe('WorkflowDetailsPanel', () => {
  it('returns null when no savedFile', () => {
    vi.mocked(useStudioContext).mockReturnValue(makeContext({ savedFile: null }));

    const { container } = render(<WorkflowDetailsPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('shows read-only details when not editing', () => {
    render(<WorkflowDetailsPanel />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('test-workflow')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('A test workflow')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('Last saved')).toBeInTheDocument();
  });

  it('shows "No description" in italics when description is empty', () => {
    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({
        savedFile: { ...baseSavedFile, description: undefined },
      })
    );

    render(<WorkflowDetailsPanel />);
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('shows group label when not public', () => {
    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({
        savedFile: { ...baseSavedFile, availableToAll: false, groups: ['team-alpha'] },
      })
    );

    render(<WorkflowDetailsPanel />);
    expect(screen.getByText('team-alpha')).toBeInTheDocument();
  });

  it('auto-expands panel when isEditingDetails becomes true', () => {
    // Start with editing = true; the useEffect should set isExpanded = true
    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({ isEditingDetails: true })
    );

    render(<WorkflowDetailsPanel />);

    // When editing, editable fields are shown (Name input, Save button)
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    // The section should be expanded and showing "Workflow details"
    expect(screen.getByText('Workflow details')).toBeInTheDocument();
  });

  it('toggle is blocked during editing (clicking does not collapse)', async () => {
    const user = userEvent.setup();

    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({ isEditingDetails: true })
    );

    render(<WorkflowDetailsPanel />);

    // The save button confirms we are in editing mode and the section is expanded
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();

    // Click the toggle to try to collapse
    const toggle = screen.getByText('Workflow details');
    await user.click(toggle);

    // The save button should still be visible (section did not collapse)
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows editable fields when isEditingDetails is true', () => {
    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({ isEditingDetails: true })
    );

    render(<WorkflowDetailsPanel />);

    // Name input should be pre-filled with savedFile.fileName
    const nameInput = screen.getByDisplayValue('test-workflow');
    expect(nameInput).toBeInTheDocument();

    // Description textarea should be pre-filled
    const descInput = screen.getByDisplayValue('A test workflow');
    expect(descInput).toBeInTheDocument();

    // Visibility radios (admin sees Public/Group)
    expect(screen.getByLabelText('Public')).toBeInTheDocument();
    expect(screen.getByLabelText('Group')).toBeInTheDocument();

    // Save and Cancel buttons
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows validation error for empty name', async () => {
    const user = userEvent.setup();

    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({ isEditingDetails: true })
    );

    render(<WorkflowDetailsPanel />);

    // Clear the name field
    const nameInput = screen.getByDisplayValue('test-workflow');
    await user.clear(nameInput);

    // Click save
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Validation error should appear
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    // updateFile should NOT have been called
    expect(operatorApi.updateFile).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid filename characters', async () => {
    const user = userEvent.setup();

    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({ isEditingDetails: true })
    );

    render(<WorkflowDetailsPanel />);

    const nameInput = screen.getByDisplayValue('test-workflow');
    await user.clear(nameInput);
    await user.type(nameInput, 'invalid name!');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Only alphanumeric characters, hyphens, underscores, and dots are allowed')
      ).toBeInTheDocument();
    });
  });

  it('save button calls operatorApi.updateFile and setSavedFile', async () => {
    const user = userEvent.setup();

    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({ isEditingDetails: true })
    );

    render(<WorkflowDetailsPanel />);

    // Modify the name
    const nameInput = screen.getByDisplayValue('test-workflow');
    await user.clear(nameInput);
    await user.type(nameInput, 'updated-workflow');

    // Click Save
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(operatorApi.updateFile).toHaveBeenCalledWith('f1', expect.objectContaining({
        fileName: 'updated-workflow',
        filePurpose: 'workflow-template',
        availableToAll: true,
      }));
    });

    expect(mockSetSavedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'f1',
        fileName: 'updated-workflow',
        availableToAll: true,
        savedAt: expect.any(String),
      }),
      expect.objectContaining({
        nodes: expect.any(Array),
        edges: expect.any(Array),
      })
    );

    expect(mockShowSuccess).toHaveBeenCalledWith(
      'Workflow updated',
      '"updated-workflow" updated successfully'
    );

    expect(mockSetIsEditingDetails).toHaveBeenCalledWith(false);
  });

  it('shows error notification when save fails', async () => {
    const user = userEvent.setup();

    vi.mocked(operatorApi.updateFile).mockRejectedValue(new Error('Server error'));

    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({ isEditingDetails: true })
    );

    render(<WorkflowDetailsPanel />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Update failed', 'Server error');
    });
  });

  it('cancel resets isEditingDetails to false', async () => {
    const user = userEvent.setup();

    vi.mocked(useStudioContext).mockReturnValue(
      makeContext({ isEditingDetails: true })
    );

    render(<WorkflowDetailsPanel />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockSetIsEditingDetails).toHaveBeenCalledWith(false);
  });
});
