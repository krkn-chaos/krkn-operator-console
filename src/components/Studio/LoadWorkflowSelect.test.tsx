import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { LoadWorkflowSelect } from './LoadWorkflowSelect';
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

vi.mock('../../services/operatorApi', () => ({
  operatorApi: {
    getAvailableFiles: vi.fn(),
    getFile: vi.fn(),
  },
}));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockLoadWorkflow = vi.fn();

const defaultContext = {
  workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
  loadWorkflow: mockLoadWorkflow,
  savedFile: null as unknown as ReturnType<typeof useStudioContext>['savedFile'],
  isDirty: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useStudioContext).mockReturnValue(defaultContext as unknown as ReturnType<typeof useStudioContext>);
  vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue({
    files: [
      { fileId: 'f1', fileName: 'my-workflow', description: 'A test workflow', availableToAll: true },
      { fileId: 'f2', fileName: 'another-workflow', availableToAll: false },
    ],
  });
});

describe('LoadWorkflowSelect', () => {
  it('shows "Load Workflow" when no savedFile', () => {
    render(<LoadWorkflowSelect />);
    expect(screen.getByText('Load Workflow')).toBeInTheDocument();
  });

  it('shows savedFile.fileName when a workflow is loaded', () => {
    vi.mocked(useStudioContext).mockReturnValue({
      ...defaultContext,
      savedFile: {
        fileId: 'f1',
        fileName: 'my-workflow',
        availableToAll: true,
        savedAt: new Date().toISOString(),
      },
    } as unknown as ReturnType<typeof useStudioContext>);

    render(<LoadWorkflowSelect />);
    expect(screen.getByText('my-workflow')).toBeInTheDocument();
  });

  it('does not show confirm dialog when switching workflows with clean canvas', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');

    const validWorkflow = {
      nodes: [{ nodeId: 'n1', status: 'configured' as const, position: { x: 0, y: 0 } }],
      edges: [],
      nextNodeNumber: 2,
    };

    vi.mocked(operatorApi.getFile).mockResolvedValue({
      fileId: 'f1',
      fileName: 'my-workflow',
      content: JSON.stringify(validWorkflow),
      availableToAll: true,
    });

    render(<LoadWorkflowSelect />);

    // Open dropdown
    await user.click(screen.getByText('Load Workflow'));

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });

    // Select a workflow
    await user.click(screen.getByText('my-workflow'));

    // confirm should NOT have been called (no unsaved changes)
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows confirm when switching with unsaved changes (savedFile && isDirty)', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    vi.mocked(useStudioContext).mockReturnValue({
      ...defaultContext,
      savedFile: {
        fileId: 'existing',
        fileName: 'existing-workflow',
        availableToAll: true,
        savedAt: new Date().toISOString(),
      },
      isDirty: true,
    } as unknown as ReturnType<typeof useStudioContext>);

    render(<LoadWorkflowSelect />);

    await user.click(screen.getByText('existing-workflow'));
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });
    await user.click(screen.getByText('my-workflow'));

    expect(confirmSpy).toHaveBeenCalledWith(
      'You have unsaved changes. Loading a new workflow will discard them. Continue?'
    );
    // Since confirm returned false, getFile should NOT have been called
    expect(operatorApi.getFile).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows confirm when switching with unsaved canvas (!savedFile && nodes.length > 0)', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    vi.mocked(useStudioContext).mockReturnValue({
      ...defaultContext,
      savedFile: null,
      workflow: {
        nodes: [{ nodeId: 'n1', status: 'unconfigured' as const, position: { x: 0, y: 0 } }],
        edges: [],
        nextNodeNumber: 2,
      },
    } as unknown as ReturnType<typeof useStudioContext>);

    render(<LoadWorkflowSelect />);

    await user.click(screen.getByText('Load Workflow'));
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });
    await user.click(screen.getByText('my-workflow'));

    expect(confirmSpy).toHaveBeenCalledWith(
      'You have unsaved changes. Loading a new workflow will discard them. Continue?'
    );
    expect(operatorApi.getFile).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('calls loadWorkflow with correct data on successful load', async () => {
    const user = userEvent.setup();

    const validWorkflow = {
      nodes: [{ nodeId: 'n1', status: 'configured' as const, position: { x: 0, y: 0 } }],
      edges: [],
      nextNodeNumber: 2,
    };

    vi.mocked(operatorApi.getFile).mockResolvedValue({
      fileId: 'f1',
      fileName: 'my-workflow',
      content: JSON.stringify(validWorkflow),
      description: 'A test workflow',
      availableToAll: true,
      groups: ['group-a'],
    });

    render(<LoadWorkflowSelect />);

    await user.click(screen.getByText('Load Workflow'));
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });
    await user.click(screen.getByText('my-workflow'));

    await waitFor(() => {
      expect(mockLoadWorkflow).toHaveBeenCalledWith(
        validWorkflow,
        expect.objectContaining({
          fileId: 'f1',
          fileName: 'my-workflow',
          description: 'A test workflow',
          availableToAll: true,
          groups: ['group-a'],
          savedAt: expect.any(String),
        })
      );
    });

    expect(mockShowSuccess).toHaveBeenCalledWith(
      'Workflow loaded',
      '"my-workflow" loaded successfully'
    );
  });

  it('shows error notification on load failure', async () => {
    const user = userEvent.setup();

    vi.mocked(operatorApi.getFile).mockRejectedValue(new Error('Network error'));

    render(<LoadWorkflowSelect />);

    await user.click(screen.getByText('Load Workflow'));
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });
    await user.click(screen.getByText('my-workflow'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Load failed', 'Network error');
    });
  });

  it('shows error notification for invalid workflow format', async () => {
    const user = userEvent.setup();

    vi.mocked(operatorApi.getFile).mockResolvedValue({
      fileId: 'f1',
      fileName: 'my-workflow',
      content: JSON.stringify({ nodes: 'not-an-array' }),
      availableToAll: true,
    });

    render(<LoadWorkflowSelect />);

    await user.click(screen.getByText('Load Workflow'));
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });
    await user.click(screen.getByText('my-workflow'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Load failed', 'Invalid workflow format');
    });
  });
});
