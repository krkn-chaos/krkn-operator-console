/**
 * StudioToolbar.test.tsx - Tests for StudioToolbar component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    exportWorkflow: vi.fn().mockReturnValue({ graph: {}, studioLayout: { nodes: [], edges: [], nextNodeNumber: 1 }, metadata: {} }),
    clearWorkflow: vi.fn(),
    importWorkflow: vi.fn(),
    saveWorkflowToCluster: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('StudioToolbar', () => {
  const mockOnRunWorkflow = vi.fn();
  let mockShowError: ReturnType<typeof vi.fn>;
  let mockShowSuccess: ReturnType<typeof vi.fn>;
  let mockShowWarning: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockShowError = vi.fn();
    mockShowSuccess = vi.fn();
    mockShowWarning = vi.fn();
    vi.mocked(useNotifications).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showWarning: mockShowWarning,
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

  describe('Export JSON', () => {
    const configuredWorkflow = {
      nodes: [{ nodeId: 'node-alpha', status: 'configured', position: { x: 0, y: 0 } }],
      edges: [],
      nextNodeNumber: 2,
    };
    const studioLayout = {
      nodes: [{ nodeId: 'node-alpha', status: 'configured', position: { x: 0, y: 0 }, config: { scenarioName: 'pod-scenarios' } }],
      edges: [],
      nextNodeNumber: 2,
    };

    let clickSpy: ReturnType<typeof vi.fn>;
    let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };
    let createElementSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      clickSpy = vi.fn();
      anchor = { href: '', download: '', click: clickSpy };
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      });
      const realCreateElement = document.createElement.bind(document);
      createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        if (tag === 'a') return anchor as unknown as HTMLElement;
        return realCreateElement(tag);
      }) as typeof document.createElement);
    });

    afterEach(() => {
      createElementSpy.mockRestore();
      vi.unstubAllGlobals();
    });

    it('downloads a krknctl-compatible file assembled from the export result', async () => {
      const user = userEvent.setup();
      const exportWorkflow = vi.fn().mockReturnValue({
        graph: { _comment: { note: 'x' }, 'node-alpha': { name: 'pod-scenarios', image: 'img:1' } },
        studioLayout,
        metadata: { source: 'studio' },
      });
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({ workflow: configuredWorkflow, exportWorkflow }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);
      await user.click(screen.getByText('Export JSON'));

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(anchor.download).toMatch(/^chaos-workflow-\d+\.json$/);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      // Serialized blob is the flat graph plus `_studioLayout`/`_metadata`; `_comment` stripped.
      const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed['node-alpha']).toBeDefined();
      expect(parsed._comment).toBeUndefined();
      expect(parsed._studioLayout).toEqual(studioLayout);
      expect(parsed._metadata.nodeCount).toBe(1);
      expect(parsed._metadata.source).toBe('studio');
    });

    it('alerts and does not download when export returns an error', async () => {
      const user = userEvent.setup();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const exportWorkflow = vi.fn().mockReturnValue({ error: 'nothing to export' });
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({ workflow: configuredWorkflow, exportWorkflow }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);
      await user.click(screen.getByText('Export JSON'));

      expect(alertSpy).toHaveBeenCalledWith('nothing to export');
      expect(clickSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('Import JSON', () => {
    const losslessFile = JSON.stringify({
      nodes: [{
        nodeId: 'node-alpha',
        status: 'configured',
        position: { x: 0, y: 0 },
        config: { registryType: 'public', registryConfig: {}, scenarioName: 'pod-scenarios', scenarioImage: 'img:1', scenarioFormValues: {} },
      }],
      edges: [],
      nextNodeNumber: 2,
    });
    const lossyFile = JSON.stringify({
      'node-alpha': { name: 'pod-scenarios', image: 'img:1' },
    });

    const getFileInput = () => screen.getByLabelText('Import workflow JSON file') as HTMLInputElement;

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('imports a lossless file and shows a success notification', async () => {
      const user = userEvent.setup();
      const importWorkflow = vi.fn();
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({ importWorkflow }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);
      await user.upload(getFileInput(), new File([losslessFile], 'wf.json', { type: 'application/json' }));

      await waitFor(() => expect(importWorkflow).toHaveBeenCalledTimes(1));
      expect(importWorkflow.mock.calls[0][0].nodes).toHaveLength(1);
      expect(mockShowSuccess).toHaveBeenCalledWith('Workflow imported', 'Imported 1 node(s) successfully');
      expect(mockShowWarning).not.toHaveBeenCalled();
    });

    it('warns when a flat graph is imported (lossy)', async () => {
      const user = userEvent.setup();
      const importWorkflow = vi.fn();
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({ importWorkflow }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);
      await user.upload(getFileInput(), new File([lossyFile], 'wf.json', { type: 'application/json' }));

      await waitFor(() => expect(importWorkflow).toHaveBeenCalledTimes(1));
      expect(mockShowWarning).toHaveBeenCalledTimes(1);
      expect(mockShowWarning.mock.calls[0][0]).toBe('Workflow imported with limited detail');
      expect(mockShowSuccess).not.toHaveBeenCalled();
    });

    it('shows an error notification when the file is invalid', async () => {
      const user = userEvent.setup();
      const importWorkflow = vi.fn();
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({ importWorkflow }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);
      await user.upload(getFileInput(), new File(['{not json'], 'wf.json', { type: 'application/json' }));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledTimes(1));
      expect(mockShowError.mock.calls[0][0]).toBe('Import failed');
      expect(importWorkflow).not.toHaveBeenCalled();
    });

    it('confirms before discarding unsaved changes and proceeds on accept', async () => {
      const user = userEvent.setup();
      const importWorkflow = vi.fn();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          importWorkflow,
          workflow: { nodes: [{ nodeId: 'node-x', status: 'configured', position: { x: 0, y: 0 } }], edges: [], nextNodeNumber: 2 },
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);
      await user.upload(getFileInput(), new File([losslessFile], 'wf.json', { type: 'application/json' }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(importWorkflow).toHaveBeenCalledTimes(1));
      confirmSpy.mockRestore();
    });

    it('cancels the import when the unsaved-changes prompt is declined', async () => {
      const user = userEvent.setup();
      const importWorkflow = vi.fn();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      vi.mocked(useStudioContext).mockReturnValue(
        buildMockContext({
          importWorkflow,
          workflow: { nodes: [{ nodeId: 'node-x', status: 'configured', position: { x: 0, y: 0 } }], edges: [], nextNodeNumber: 2 },
        }) as unknown as ReturnType<typeof useStudioContext>,
      );

      render(<StudioToolbar onRunWorkflow={mockOnRunWorkflow} />);
      await user.upload(getFileInput(), new File([losslessFile], 'wf.json', { type: 'application/json' }));

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(importWorkflow).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });
});
