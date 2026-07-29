import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { LoadWorkflowSelect } from './LoadWorkflowSelect';
import { useStudioContext } from './StudioContext';
import { workflowsApi } from '../../services/workflowsApi';

vi.mock('./StudioContext', () => ({
  useStudioContext: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  useNotifications: vi.fn(() => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  })),
}));

vi.mock('../../services/workflowsApi', () => ({
  workflowsApi: {
    getAvailableWorkflows: vi.fn(),
    getWorkflow: vi.fn(),
  },
}));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockLoadWorkflow = vi.fn();

const defaultContext = {
  workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
  loadWorkflow: mockLoadWorkflow,
  savedWorkflow: null as unknown as ReturnType<typeof useStudioContext>['savedWorkflow'],
  isDirty: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useStudioContext).mockReturnValue(defaultContext as unknown as ReturnType<typeof useStudioContext>);
  vi.mocked(workflowsApi.getAvailableWorkflows).mockResolvedValue({
    workflows: [
      { workflowId: 'w1', workflowName: 'my-workflow', description: 'A test workflow' },
      { workflowId: 'w2', workflowName: 'another-workflow' },
    ],
  });
});

describe('LoadWorkflowSelect', () => {
  it('shows "Load Workflow" when no savedWorkflow', () => {
    render(<LoadWorkflowSelect />);
    expect(screen.getByText('Load Workflow')).toBeInTheDocument();
  });

  it('shows savedWorkflow.workflowName when a workflow is loaded', () => {
    vi.mocked(useStudioContext).mockReturnValue({
      ...defaultContext,
      savedWorkflow: {
        workflowId: 'w1',
        workflowName: 'my-workflow',
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

    const validLayout = {
      nodes: [{ nodeId: 'n1', status: 'configured' as const, position: { x: 0, y: 0 } }],
      edges: [],
      nextNodeNumber: 2,
    };

    vi.mocked(workflowsApi.getWorkflow).mockResolvedValue({
      workflowId: 'w1',
      workflowName: 'my-workflow',
      graph: {},
      studioLayout: validLayout,
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

  it('shows confirm when switching with unsaved changes (savedWorkflow && isDirty)', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    vi.mocked(useStudioContext).mockReturnValue({
      ...defaultContext,
      savedWorkflow: {
        workflowId: 'existing',
        workflowName: 'existing-workflow',
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
    // Since confirm returned false, getWorkflow should NOT have been called
    expect(workflowsApi.getWorkflow).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows confirm when switching with unsaved canvas (!savedWorkflow && nodes.length > 0)', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    vi.mocked(useStudioContext).mockReturnValue({
      ...defaultContext,
      savedWorkflow: null,
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
    expect(workflowsApi.getWorkflow).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('calls loadWorkflow with correct data on successful load', async () => {
    const user = userEvent.setup();

    const validLayout = {
      nodes: [{ nodeId: 'n1', status: 'configured' as const, position: { x: 0, y: 0 } }],
      edges: [],
      nextNodeNumber: 2,
    };

    vi.mocked(workflowsApi.getWorkflow).mockResolvedValue({
      workflowId: 'w1',
      workflowName: 'my-workflow',
      graph: {},
      studioLayout: validLayout,
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
        validLayout,
        expect.objectContaining({
          workflowId: 'w1',
          workflowName: 'my-workflow',
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

    vi.mocked(workflowsApi.getWorkflow).mockRejectedValue(new Error('Network error'));

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

    vi.mocked(workflowsApi.getWorkflow).mockResolvedValue({
      workflowId: 'w1',
      workflowName: 'my-workflow',
      graph: {},
      studioLayout: { nodes: 'not-an-array' } as unknown as undefined,
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

  it('shows descriptive error when workflow has no studioLayout (graph-only)', async () => {
    const user = userEvent.setup();

    vi.mocked(workflowsApi.getWorkflow).mockResolvedValue({
      workflowId: 'w1',
      workflowName: 'my-workflow',
      graph: { 'node-1': { image: 'img', volumes: {}, env: {} } },
      availableToAll: true,
    });

    render(<LoadWorkflowSelect />);

    await user.click(screen.getByText('Load Workflow'));
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });
    await user.click(screen.getByText('my-workflow'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Load failed',
        'This workflow has no studio layout and cannot be opened in the visual editor'
      );
    });
  });

  it('uses backend updatedAt timestamp for savedAt', async () => {
    const user = userEvent.setup();

    const validLayout = {
      nodes: [{ nodeId: 'n1', status: 'configured' as const, position: { x: 0, y: 0 } }],
      edges: [],
      nextNodeNumber: 2,
    };

    vi.mocked(workflowsApi.getWorkflow).mockResolvedValue({
      workflowId: 'w1',
      workflowName: 'my-workflow',
      graph: {},
      studioLayout: validLayout,
      availableToAll: true,
      updatedAt: '2025-06-15T10:30:00Z',
      createdAt: '2025-06-01T08:00:00Z',
    });

    render(<LoadWorkflowSelect />);

    await user.click(screen.getByText('Load Workflow'));
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });
    await user.click(screen.getByText('my-workflow'));

    await waitFor(() => {
      expect(mockLoadWorkflow).toHaveBeenCalledWith(
        validLayout,
        expect.objectContaining({
          savedAt: '2025-06-15T10:30:00Z',
        })
      );
    });
  });

  it('falls back to createdAt when updatedAt is absent', async () => {
    const user = userEvent.setup();

    const validLayout = {
      nodes: [{ nodeId: 'n1', status: 'configured' as const, position: { x: 0, y: 0 } }],
      edges: [],
      nextNodeNumber: 2,
    };

    vi.mocked(workflowsApi.getWorkflow).mockResolvedValue({
      workflowId: 'w1',
      workflowName: 'my-workflow',
      graph: {},
      studioLayout: validLayout,
      availableToAll: true,
      createdAt: '2025-06-01T08:00:00Z',
    });

    render(<LoadWorkflowSelect />);

    await user.click(screen.getByText('Load Workflow'));
    await waitFor(() => {
      expect(screen.getByText('my-workflow')).toBeInTheDocument();
    });
    await user.click(screen.getByText('my-workflow'));

    await waitFor(() => {
      expect(mockLoadWorkflow).toHaveBeenCalledWith(
        validLayout,
        expect.objectContaining({
          savedAt: '2025-06-01T08:00:00Z',
        })
      );
    });
  });
});
