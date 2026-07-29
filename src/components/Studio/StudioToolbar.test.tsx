/**
 * StudioToolbar.test.tsx - Tests for StudioToolbar component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { StudioToolbar } from './StudioToolbar';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';

vi.mock('./StudioContext', () => ({
  useStudioContext: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  useNotifications: vi.fn(() => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  })),
}));

vi.mock('./SaveWorkflowModal', () => ({
  SaveWorkflowModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="save-workflow-modal">SaveWorkflowModal</div> : null,
}));

vi.mock('./SaveWorkflowConfirmModal', () => ({
  SaveWorkflowConfirmModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="save-confirm-modal">SaveWorkflowConfirmModal</div> : null,
}));

function buildMockContext(overrides: Record<string, unknown> = {}) {
  return {
    workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
    savedWorkflow: null,
    isDirty: false,
    isEditingDetails: false,
    addNode: vi.fn(),
    exportWorkflow: vi.fn().mockReturnValue({ graph: {}, metadata: {} }),
    clearWorkflow: vi.fn(),
    saveWorkflowToCluster: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('StudioToolbar', () => {
  const mockOnRunWorkflow = vi.fn();
  let mockShowError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockShowError = vi.fn();
    vi.mocked(useNotifications).mockReturnValue({
      showSuccess: vi.fn(),
      showError: mockShowError,
    } as unknown as ReturnType<typeof useNotifications>);
  });

  describe('Save button text', () => {
    it('shows "Save Workflow" when no savedFile', () => {
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      expect(screen.getByText('Save Workflow')).toBeInTheDocument();
    });

    it('shows "Save Workflow" when savedFile exists but isDirty is false', () => {
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
          savedWorkflow: {
            workflowId: 'w1',
            workflowName: 'my-workflow',
            availableToAll: true,
            savedAt: '2024-01-01',
          },
          isDirty: false,
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      expect(screen.getByText('Save Workflow')).toBeInTheDocument();
    });

    it('shows "Update Workflow" when savedWorkflow exists and isDirty is true', () => {
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
          savedWorkflow: {
            workflowId: 'w1',
            workflowName: 'my-workflow',
            availableToAll: true,
            savedAt: '2024-01-01',
          },
          isDirty: true,
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      expect(screen.getByText('Update Workflow')).toBeInTheDocument();
    });
  });

  describe('Run Workflow validation', () => {
    it('shows validation error modal when nodes are unconfigured', async () => {
      const user = userEvent.setup();

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [
              { nodeId: 'node-1', status: 'unconfigured', position: { x: 0, y: 0 } },
              { nodeId: 'node-2', status: 'configured', position: { x: 100, y: 0 } },
            ],
            edges: [],
            nextNodeNumber: 3,
          },
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      await user.click(screen.getByText('Run Workflow'));

      expect(screen.getByText('Cannot run workflow')).toBeInTheDocument();
      expect(screen.getByText(/1 node\(s\) not configured: node-1/)).toBeInTheDocument();
      expect(mockOnRunWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('Unsaved changes modal', () => {
    it('shows unsaved changes modal when savedWorkflow exists and isDirty', async () => {
      const user = userEvent.setup();

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
          savedWorkflow: {
            workflowId: 'w1',
            workflowName: 'my-workflow',
            availableToAll: true,
            savedAt: '2024-01-01',
          },
          isDirty: true,
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      await user.click(screen.getByText('Run Workflow'));

      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      expect(screen.getByText(/my-workflow/)).toBeInTheDocument();
      expect(mockOnRunWorkflow).not.toHaveBeenCalled();
    });

    it('Save & Run calls saveWorkflowToCluster then onRunWorkflow', async () => {
      const user = userEvent.setup();
      const mockSave = vi.fn().mockResolvedValue(undefined);

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
          savedWorkflow: {
            workflowId: 'w1',
            workflowName: 'my-workflow',
            availableToAll: true,
            savedAt: '2024-01-01',
          },
          isDirty: true,
          saveWorkflowToCluster: mockSave,
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      // Open the unsaved changes modal
      await user.click(screen.getByText('Run Workflow'));
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

      // Click Save & Run
      await user.click(screen.getByText('Save & Run'));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(mockOnRunWorkflow).toHaveBeenCalledTimes(1);
      });
    });

    it('Run without saving closes modal and calls onRunWorkflow', async () => {
      const user = userEvent.setup();

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
          savedWorkflow: {
            workflowId: 'w1',
            workflowName: 'my-workflow',
            availableToAll: true,
            savedAt: '2024-01-01',
          },
          isDirty: true,
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      // Open the unsaved changes modal
      await user.click(screen.getByText('Run Workflow'));
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

      // Click Run without saving
      await user.click(screen.getByText('Run without saving'));

      await waitFor(() => {
        expect(mockOnRunWorkflow).toHaveBeenCalledTimes(1);
      });

      // Modal should be closed
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    });

    it('shows error notification when Save & Run fails', async () => {
      const user = userEvent.setup();
      const mockSave = vi.fn().mockRejectedValue(new Error('Network error'));

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
          savedWorkflow: {
            workflowId: 'w1',
            workflowName: 'my-workflow',
            availableToAll: true,
            savedAt: '2024-01-01',
          },
          isDirty: true,
          saveWorkflowToCluster: mockSave,
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      await user.click(screen.getByText('Run Workflow'));
      await user.click(screen.getByText('Save & Run'));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Save failed', 'Network error');
      });

      expect(mockOnRunWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('Save button disabled state', () => {
    it('disables save button when isEditingDetails is true', () => {
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
          isEditingDetails: true,
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      const saveButton = screen.getByText('Save Workflow').closest('button')!;
      expect(saveButton).toBeDisabled();
    });

    it('disables save button when workflow has no nodes', () => {
      vi.mocked(useStudioContext).mockReturnValue(buildMockContext() as unknown as ReturnType<typeof useStudioContext>);

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      const saveButton = screen.getByText('Save Workflow').closest('button')!;
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Run Workflow direct call', () => {
    it('calls onRunWorkflow directly when all nodes configured and no unsaved changes', async () => {
      const user = userEvent.setup();

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      await user.click(screen.getByText('Run Workflow'));

      expect(mockOnRunWorkflow).toHaveBeenCalledTimes(1);
    });
  });

  describe('Add Scenario button', () => {
    it('calls addNode when clicked', async () => {
      const user = userEvent.setup();
      const mockAddNode = vi.fn();

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({ addNode: mockAddNode }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      await user.click(screen.getByText('Add Scenario'));

      expect(mockAddNode).toHaveBeenCalledTimes(1);
    });
  });

  describe('Save button behavior', () => {
    it('opens SaveWorkflowModal when no savedWorkflow exists', async () => {
      const user = userEvent.setup();

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      await user.click(screen.getByText('Save Workflow'));

      expect(screen.getByTestId('save-workflow-modal')).toBeInTheDocument();
    });

    it('opens SaveWorkflowConfirmModal when savedWorkflow exists', async () => {
      const user = userEvent.setup();

      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          workflow: {
            nodes: [{ nodeId: 'node-1', status: 'configured', position: { x: 0, y: 0 } }],
            edges: [],
            nextNodeNumber: 2,
          },
          savedWorkflow: {
            workflowId: 'w1',
            workflowName: 'my-workflow',
            availableToAll: true,
            savedAt: '2024-01-01',
          },
          isDirty: true,
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);

      await user.click(screen.getByText('Update Workflow'));

      expect(screen.getByTestId('save-confirm-modal')).toBeInTheDocument();
    });
  });
});
