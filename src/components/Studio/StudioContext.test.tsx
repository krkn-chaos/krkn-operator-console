/**
 * Tests for StudioContext - State management for Chaos Scenario Studio
 *
 * Covers:
 * - isDirty computation
 * - saveWorkflowToCluster (cluster persistence)
 * - setSavedWorkflow (metadata + snapshot capture)
 * - loadWorkflow (full state hydration)
 * - clearWorkflow (reset to empty)
 * - Conditional autosave (localStorage only when no cluster workflow)
 * - Node CRUD operations
 * - Edge management with validation
 * - exportWorkflow
 * - buildGraph helper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { StudioProvider, useStudioContext, buildGraph } from './StudioContext';
import type { StudioWorkflow, StudioNode, StudioEdge } from '../../types/api';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../services/workflowsApi', () => ({
  workflowsApi: {
    updateWorkflow: vi.fn().mockResolvedValue({ message: 'ok', workflowId: 'w-1' }),
  },
}));

vi.mock('./studioAutosave', () => ({
  AUTOSAVE_VERSION: '1.0',
  saveAutosave: vi.fn(),
  clearAutosave: vi.fn(),
  loadAutosave: vi.fn().mockReturnValue(null),
}));

import { workflowsApi } from '../../services/workflowsApi';
import { saveAutosave, clearAutosave } from './studioAutosave';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrapper = ({ children }: { children: ReactNode }) => (
  <StudioProvider>{children}</StudioProvider>
);

/** Build a wrapper that injects an initial workflow. */
function wrapperWith(initialWorkflow: StudioWorkflow) {
  return ({ children }: { children: ReactNode }) => (
    <StudioProvider initialWorkflow={initialWorkflow}>{children}</StudioProvider>
  );
}

/** A minimal configured StudioNode. */
function makeConfiguredNode(nodeId: string, overrides?: Partial<StudioNode>): StudioNode {
  return {
    nodeId,
    status: 'configured',
    position: { x: 100, y: 200 },
    config: {
      registryType: 'public',
      registryConfig: {},
      scenarioName: `scenario-${nodeId}`,
      scenarioImage: `quay.io/test/${nodeId}`,
      scenarioFormValues: { KEY: 'val' },
    },
    ...overrides,
  };
}

/** Reusable SavedWorkflowMetadata factory. */
function makeSavedWorkflow(overrides?: Record<string, unknown>) {
  return {
    workflowId: 'w-1',
    workflowName: 'my-workflow',
    description: 'test workflow',
    availableToAll: true,
    groups: [] as string[],
    savedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('StudioContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. isDirty computation
  // =========================================================================
  describe('isDirty', () => {
    it('returns false when there is no savedWorkflow', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });
      expect(result.current.isDirty).toBe(false);
    });

    it('returns false immediately after setSavedWorkflow (snapshot matches workflow)', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });

      expect(result.current.isDirty).toBe(false);
    });

    it('returns true when the workflow changes after setSavedWorkflow', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });

      // Mutate workflow by adding a node
      act(() => {
        result.current.addNode();
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('returns false immediately after loadWorkflow (snapshot matches loaded workflow)', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('alpha')],
        edges: [],
        nextNodeNumber: 2,
      };
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.loadWorkflow(wf, makeSavedWorkflow());
      });

      expect(result.current.isDirty).toBe(false);
    });

    it('returns true after loadWorkflow followed by a mutation', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('alpha')],
        edges: [],
        nextNodeNumber: 2,
      };
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.loadWorkflow(wf, makeSavedWorkflow());
      });
      act(() => {
        result.current.addNode();
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('returns false after clearWorkflow (no savedWorkflow)', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });
      act(() => {
        result.current.addNode();
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.clearWorkflow();
      });
      expect(result.current.isDirty).toBe(false);
    });

    it('returns false after saveWorkflowToCluster re-snapshots the current workflow', async () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });
      act(() => {
        result.current.addNode();
      });
      expect(result.current.isDirty).toBe(true);

      await act(async () => {
        await result.current.saveWorkflowToCluster();
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  // =========================================================================
  // 2. saveWorkflowToCluster
  // =========================================================================
  describe('saveWorkflowToCluster', () => {
    it('throws if there is no savedWorkflow', async () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      await expect(
        act(async () => {
          await result.current.saveWorkflowToCluster();
        })
      ).rejects.toThrow('No saved workflow to update');
    });

    it('calls workflowsApi.updateWorkflow with the correct payload', async () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('node-a')],
        edges: [],
        nextNodeNumber: 2,
      };
      const meta = makeSavedWorkflow({ groups: ['team-a'] });
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.loadWorkflow(wf, meta);
      });

      await act(async () => {
        await result.current.saveWorkflowToCluster();
      });

      expect(workflowsApi.updateWorkflow).toHaveBeenCalledOnce();
      const [workflowId, payload] = vi.mocked(workflowsApi.updateWorkflow).mock.calls[0];
      expect(workflowId).toBe('w-1');
      expect(payload.workflowName).toBe('my-workflow');
      expect(payload.availableToAll).toBe(true);
      expect(payload.groups).toEqual(['team-a']);
      expect(payload.graph).toBeDefined();
      expect(payload.graph['node-a']).toBeDefined();
      expect(payload.graph['node-a'].name).toBe('scenario-node-a');
      expect(payload.studioLayout).toBeDefined();
      expect(payload.studioLayout!.nodes).toHaveLength(1);
    });

    it('updates savedWorkflow timestamp after successful save', async () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });
      const meta = makeSavedWorkflow();

      act(() => {
        result.current.setSavedWorkflow(meta);
      });

      const beforeSave = result.current.savedWorkflow?.savedAt;

      await act(async () => {
        await result.current.saveWorkflowToCluster();
      });

      expect(result.current.savedWorkflow?.savedAt).not.toBe(beforeSave);
      // Should be an ISO-8601 string
      expect(new Date(result.current.savedWorkflow!.savedAt).toISOString()).toBe(
        result.current.savedWorkflow!.savedAt
      );
    });

    it('calls clearAutosave after successful save', async () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });

      await act(async () => {
        await result.current.saveWorkflowToCluster();
      });

      // clearAutosave called once by setSavedWorkflow and once by saveWorkflowToCluster
      expect(clearAutosave).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. setSavedWorkflow
  // =========================================================================
  describe('setSavedWorkflow', () => {
    it('stores the metadata and makes it accessible via savedWorkflow', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });
      const meta = makeSavedWorkflow();

      act(() => {
        result.current.setSavedWorkflow(meta);
      });

      expect(result.current.savedWorkflow).toEqual(meta);
    });

    it('captures the current workflow as the snapshot (isDirty stays false)', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      // Add a node first so the workflow is non-trivial
      act(() => {
        result.current.addNode();
      });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });

      expect(result.current.isDirty).toBe(false);
    });

    it('uses an explicit workflowSnapshot when provided', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      const explicitSnapshot: StudioWorkflow = {
        nodes: [makeConfiguredNode('snap-node')],
        edges: [],
        nextNodeNumber: 2,
      };

      // The current workflow is empty but we pass an explicit snapshot
      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow(), explicitSnapshot);
      });

      // Current workflow does NOT match the explicit snapshot, so isDirty should be true
      expect(result.current.isDirty).toBe(true);
    });

    it('calls clearAutosave', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });

      expect(clearAutosave).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. loadWorkflow
  // =========================================================================
  describe('loadWorkflow', () => {
    it('sets the workflow state to the provided workflow', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('load-a'), makeConfiguredNode('load-b')],
        edges: [{ id: 'load-a-load-b', source: 'load-a', target: 'load-b' }],
        nextNodeNumber: 3,
      };
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.loadWorkflow(wf, makeSavedWorkflow());
      });

      expect(result.current.workflow.nodes).toHaveLength(2);
      expect(result.current.workflow.edges).toHaveLength(1);
      expect(result.current.workflow.nextNodeNumber).toBe(3);
    });

    it('sets savedWorkflow metadata', () => {
      const meta = makeSavedWorkflow({ workflowName: 'loaded-workflow' });
      const wf: StudioWorkflow = { nodes: [], edges: [], nextNodeNumber: 1 };
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.loadWorkflow(wf, meta);
      });

      expect(result.current.savedWorkflow?.workflowName).toBe('loaded-workflow');
    });

    it('captures the loaded workflow as the snapshot (isDirty is false)', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('snap-check')],
        edges: [],
        nextNodeNumber: 2,
      };
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.loadWorkflow(wf, makeSavedWorkflow());
      });

      expect(result.current.isDirty).toBe(false);
    });

    it('resets isEditingDetails to false', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setIsEditingDetails(true);
      });
      expect(result.current.isEditingDetails).toBe(true);

      act(() => {
        result.current.loadWorkflow(
          { nodes: [], edges: [], nextNodeNumber: 1 },
          makeSavedWorkflow()
        );
      });

      expect(result.current.isEditingDetails).toBe(false);
    });

    it('calls clearAutosave', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.loadWorkflow(
          { nodes: [], edges: [], nextNodeNumber: 1 },
          makeSavedWorkflow()
        );
      });

      expect(clearAutosave).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. clearWorkflow
  // =========================================================================
  describe('clearWorkflow', () => {
    it('resets workflow to empty state', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('rm-me')],
        edges: [],
        nextNodeNumber: 5,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      act(() => {
        result.current.clearWorkflow();
      });

      expect(result.current.workflow.nodes).toHaveLength(0);
      expect(result.current.workflow.edges).toHaveLength(0);
      expect(result.current.workflow.nextNodeNumber).toBe(1);
    });

    it('clears savedWorkflow', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });
      expect(result.current.savedWorkflow).not.toBeNull();

      act(() => {
        result.current.clearWorkflow();
      });
      expect(result.current.savedWorkflow).toBeNull();
    });

    it('clears the snapshot (isDirty becomes false)', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
        result.current.addNode();
      });

      act(() => {
        result.current.clearWorkflow();
      });

      expect(result.current.isDirty).toBe(false);
    });

    it('calls clearAutosave', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.clearWorkflow();
      });

      expect(clearAutosave).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. Conditional autosave (localStorage timer)
  // =========================================================================
  describe('autosave interval', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('saves to localStorage when nodes exist and savedWorkflow is null', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.addNode();
      });

      // Advance past the 30-second autosave interval
      act(() => {
        vi.advanceTimersByTime(31000);
      });

      expect(saveAutosave).toHaveBeenCalled();
      const call = vi.mocked(saveAutosave).mock.calls[0][0];
      expect(call.workflow.nodes).toHaveLength(1);
      expect(call.version).toBe('1.0');
    });

    it('does NOT save when savedWorkflow is set (workflow is cluster-managed)', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.addNode();
      });
      act(() => {
        result.current.setSavedWorkflow(makeSavedWorkflow());
      });

      vi.mocked(saveAutosave).mockClear();

      act(() => {
        vi.advanceTimersByTime(31000);
      });

      expect(saveAutosave).not.toHaveBeenCalled();
    });

    it('does NOT save when there are no nodes', () => {
      renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        vi.advanceTimersByTime(31000);
      });

      expect(saveAutosave).not.toHaveBeenCalled();
    });

    it('fires repeatedly at 30-second intervals', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.addNode();
      });
      vi.mocked(saveAutosave).mockClear();

      act(() => {
        vi.advanceTimersByTime(90000); // 3 intervals
      });

      expect(saveAutosave).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // 7. clearSavedWorkflow
  // =========================================================================
  describe('clearSavedWorkflow', () => {
    it('sets savedWorkflow to null without resetting workflow', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('keep-me')],
        edges: [],
        nextNodeNumber: 2,
      };
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.loadWorkflow(wf, makeSavedWorkflow());
      });

      act(() => {
        result.current.clearSavedWorkflow();
      });

      expect(result.current.savedWorkflow).toBeNull();
      expect(result.current.workflow.nodes).toHaveLength(1);
    });
  });

  // =========================================================================
  // 8. Node CRUD
  // =========================================================================
  describe('addNode', () => {
    it('adds an unconfigured node with auto-generated id', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.addNode();
      });

      expect(result.current.workflow.nodes).toHaveLength(1);
      const node = result.current.workflow.nodes[0];
      expect(node.nodeId).toBe('node-1');
      expect(node.status).toBe('unconfigured');
      expect(node.position).toEqual({ x: 100, y: 200 });
    });

    it('increments nextNodeNumber', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.addNode();
      });
      act(() => {
        result.current.addNode();
      });

      expect(result.current.workflow.nextNodeNumber).toBe(3);
      expect(result.current.workflow.nodes[1].nodeId).toBe('node-2');
    });
  });

  describe('updateNode', () => {
    it('updates an existing node by nodeId', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.addNode();
      });

      act(() => {
        result.current.updateNode('node-1', {
          status: 'configured',
          config: {
            registryType: 'public',
            registryConfig: {},
            scenarioName: 'test-scenario',
            scenarioImage: 'quay.io/test/img',
            scenarioFormValues: {},
          },
        });
      });

      expect(result.current.workflow.nodes[0].status).toBe('configured');
      expect(result.current.workflow.nodes[0].config?.scenarioName).toBe('test-scenario');
    });

    it('updates edges when nodeId changes', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('src-node'), makeConfiguredNode('tgt-node')],
        edges: [{ id: 'src-node-tgt-node', source: 'src-node', target: 'tgt-node' }],
        nextNodeNumber: 3,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      act(() => {
        result.current.updateNode('src-node', { nodeId: 'renamed-node' });
      });

      const edge = result.current.workflow.edges[0];
      expect(edge.source).toBe('renamed-node');
      expect(edge.target).toBe('tgt-node');
    });

    it('updates edge target references and id when target nodeId changes', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('src-node'), makeConfiguredNode('tgt-node')],
        edges: [{ id: 'src-node-tgt-node', source: 'src-node', target: 'tgt-node' }],
        nextNodeNumber: 3,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      act(() => {
        result.current.updateNode('tgt-node', { nodeId: 'new-target' });
      });

      const edge = result.current.workflow.edges[0];
      expect(edge.target).toBe('new-target');
      expect(edge.id).toBe('src-node-new-target');
    });
  });

  describe('deleteNode', () => {
    it('removes the node and its connected edges', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('node-a'), makeConfiguredNode('node-b')],
        edges: [{ id: 'node-a-node-b', source: 'node-a', target: 'node-b' }],
        nextNodeNumber: 3,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      act(() => {
        result.current.deleteNode('node-a');
      });

      expect(result.current.workflow.nodes).toHaveLength(1);
      expect(result.current.workflow.nodes[0].nodeId).toBe('node-b');
      expect(result.current.workflow.edges).toHaveLength(0);
    });
  });

  describe('cloneNode', () => {
    it('clones a configured node with a new nodeId and offset position', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('original', { position: { x: 100, y: 200 } })],
        edges: [],
        nextNodeNumber: 2,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      act(() => {
        result.current.cloneNode('original', 'cloned-node');
      });

      expect(result.current.workflow.nodes).toHaveLength(2);
      const clone = result.current.workflow.nodes[1];
      expect(clone.nodeId).toBe('cloned-node');
      expect(clone.status).toBe('configured');
      expect(clone.position).toEqual({ x: 150, y: 250 });
      expect(clone.config?.scenarioName).toBe('scenario-original');
    });

    it('does not clone an unconfigured node', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.addNode();
      });

      act(() => {
        result.current.cloneNode('node-1', 'clone-attempt');
      });

      expect(result.current.workflow.nodes).toHaveLength(1);
    });
  });

  // =========================================================================
  // 9. Edge management
  // =========================================================================
  describe('addEdge', () => {
    it('adds an edge between two configured nodes', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('edge-a'), makeConfiguredNode('edge-b')],
        edges: [],
        nextNodeNumber: 3,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      let validation: ReturnType<typeof result.current.addEdge>;
      act(() => {
        validation = result.current.addEdge('edge-a', 'edge-b');
      });

      expect(validation!.valid).toBe(true);
      expect(result.current.workflow.edges).toHaveLength(1);
      expect(result.current.workflow.edges[0]).toEqual({
        id: 'edge-a-edge-b',
        source: 'edge-a',
        target: 'edge-b',
      });
    });

    it('rejects a duplicate edge', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('dup-a'), makeConfiguredNode('dup-b')],
        edges: [{ id: 'dup-a-dup-b', source: 'dup-a', target: 'dup-b' }],
        nextNodeNumber: 3,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      let validation: ReturnType<typeof result.current.addEdge>;
      act(() => {
        validation = result.current.addEdge('dup-a', 'dup-b');
      });

      expect(validation!.valid).toBe(false);
      expect(validation!.error).toContain('already exists');
    });
  });

  describe('deleteEdge', () => {
    it('removes the specified edge', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('del-a'), makeConfiguredNode('del-b')],
        edges: [{ id: 'del-a-del-b', source: 'del-a', target: 'del-b' }],
        nextNodeNumber: 3,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      act(() => {
        result.current.deleteEdge('del-a-del-b');
      });

      expect(result.current.workflow.edges).toHaveLength(0);
    });
  });

  // =========================================================================
  // 10. validateConnection
  // =========================================================================
  describe('validateConnection', () => {
    const cases: Array<{
      name: string;
      nodes: StudioNode[];
      edges: StudioEdge[];
      source: string;
      target: string;
      expectedValid: boolean;
      expectedErrorSubstring?: string;
    }> = [
      {
        name: 'rejects when source node does not exist',
        nodes: [makeConfiguredNode('only-target')],
        edges: [],
        source: 'ghost',
        target: 'only-target',
        expectedValid: false,
        expectedErrorSubstring: 'not found',
      },
      {
        name: 'rejects when source is unconfigured',
        nodes: [
          { nodeId: 'unconf', status: 'unconfigured', position: { x: 0, y: 0 } },
          makeConfiguredNode('conf-tgt'),
        ],
        edges: [],
        source: 'unconf',
        target: 'conf-tgt',
        expectedValid: false,
        expectedErrorSubstring: 'Source node must be configured',
      },
      {
        name: 'rejects when target is unconfigured',
        nodes: [
          makeConfiguredNode('conf-src'),
          { nodeId: 'unconf-tgt', status: 'unconfigured', position: { x: 0, y: 0 } },
        ],
        edges: [],
        source: 'conf-src',
        target: 'unconf-tgt',
        expectedValid: false,
        expectedErrorSubstring: 'Target node must be configured',
      },
      {
        name: 'rejects when target already has a dependency',
        nodes: [
          makeConfiguredNode('dep-src-1'),
          makeConfiguredNode('dep-src-2'),
          makeConfiguredNode('dep-tgt'),
        ],
        edges: [{ id: 'dep-src-1-dep-tgt', source: 'dep-src-1', target: 'dep-tgt' }],
        source: 'dep-src-2',
        target: 'dep-tgt',
        expectedValid: false,
        expectedErrorSubstring: 'one dependency',
      },
      {
        name: 'rejects cycles (A->B->A)',
        nodes: [makeConfiguredNode('cyc-a'), makeConfiguredNode('cyc-b')],
        edges: [{ id: 'cyc-a-cyc-b', source: 'cyc-a', target: 'cyc-b' }],
        source: 'cyc-b',
        target: 'cyc-a',
        expectedValid: false,
        expectedErrorSubstring: 'Circular dependency',
      },
      {
        name: 'allows a valid connection',
        nodes: [makeConfiguredNode('ok-src'), makeConfiguredNode('ok-tgt')],
        edges: [],
        source: 'ok-src',
        target: 'ok-tgt',
        expectedValid: true,
      },
    ];

    cases.forEach(({ name, nodes, edges, source, target, expectedValid, expectedErrorSubstring }) => {
      it(name, () => {
        const wf: StudioWorkflow = { nodes, edges, nextNodeNumber: nodes.length + 1 };
        const { result } = renderHook(() => useStudioContext(), {
          wrapper: wrapperWith(wf),
        });

        let validation: ReturnType<typeof result.current.validateConnection>;
        act(() => {
          validation = result.current.validateConnection(source, target);
        });

        expect(validation!.valid).toBe(expectedValid);
        if (expectedErrorSubstring) {
          expect(validation!.error).toContain(expectedErrorSubstring);
        }
      });
    });
  });

  // =========================================================================
  // 11. validateNodeId
  // =========================================================================
  describe('validateNodeId', () => {
    const validationCases: Array<{
      name: string;
      nodeId: string;
      excludeId?: string;
      existingNodes?: StudioNode[];
      expectedValid: boolean;
      expectedErrorSubstring?: string;
    }> = [
      {
        name: 'rejects IDs shorter than 5 characters',
        nodeId: 'abc',
        expectedValid: false,
        expectedErrorSubstring: '5-25 characters',
      },
      {
        name: 'rejects IDs longer than 25 characters',
        nodeId: 'abcdefghijklmnopqrstuvwxyz',
        expectedValid: false,
        expectedErrorSubstring: '5-25 characters',
      },
      {
        name: 'rejects IDs with uppercase letters',
        nodeId: 'Node-One',
        expectedValid: false,
        expectedErrorSubstring: 'lowercase',
      },
      {
        name: 'rejects IDs with special characters',
        nodeId: 'node_one',
        expectedValid: false,
        expectedErrorSubstring: 'lowercase',
      },
      {
        name: 'accepts a valid lowercase-hyphen ID',
        nodeId: 'my-node',
        expectedValid: true,
      },
      {
        name: 'rejects duplicate nodeId',
        nodeId: 'existing',
        existingNodes: [makeConfiguredNode('existing')],
        expectedValid: false,
        expectedErrorSubstring: 'already exists',
      },
      {
        name: 'allows duplicate when excluded (renaming self)',
        nodeId: 'existing',
        excludeId: 'existing',
        existingNodes: [makeConfiguredNode('existing')],
        expectedValid: true,
      },
    ];

    validationCases.forEach(({ name, nodeId, excludeId, existingNodes, expectedValid, expectedErrorSubstring }) => {
      it(name, () => {
        const wf: StudioWorkflow = {
          nodes: existingNodes || [],
          edges: [],
          nextNodeNumber: (existingNodes?.length || 0) + 1,
        };
        const { result } = renderHook(() => useStudioContext(), {
          wrapper: wrapperWith(wf),
        });

        const validation = result.current.validateNodeId(nodeId, excludeId);

        expect(validation.valid).toBe(expectedValid);
        if (expectedErrorSubstring) {
          expect(validation.error).toContain(expectedErrorSubstring);
        }
      });
    });
  });

  // =========================================================================
  // 12. exportWorkflow
  // =========================================================================
  describe('exportWorkflow', () => {
    it('returns an error when unconfigured nodes exist', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.addNode();
      });

      const exported = result.current.exportWorkflow();
      expect('error' in exported).toBe(true);
      if ('error' in exported) {
        expect(exported.error).toContain('not configured');
      }
    });

    it('exports configured nodes with correct env and depends_on', () => {
      const nodeA = makeConfiguredNode('export-a');
      const nodeB = makeConfiguredNode('export-b');
      const wf: StudioWorkflow = {
        nodes: [nodeA, nodeB],
        edges: [{ id: 'export-a-export-b', source: 'export-a', target: 'export-b' }],
        nextNodeNumber: 3,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      const exported = result.current.exportWorkflow();
      expect('graph' in exported).toBe(true);
      if ('graph' in exported) {
        expect(Object.keys(exported.graph)).toHaveLength(2);
        expect(exported.graph['export-a'].depends_on).toBeUndefined();
        expect(exported.graph['export-b'].depends_on).toBe('export-a');
        expect(exported.graph['export-a'].name).toBe('scenario-export-a');
        expect(exported.graph['export-a'].env).toEqual({ KEY: 'val' });
        expect(exported.metadata.nodeCount).toBe(2);
      }
    });

    it('exports a single root node without depends_on', () => {
      const wf: StudioWorkflow = {
        nodes: [makeConfiguredNode('solo-n')],
        edges: [],
        nextNodeNumber: 2,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(wf),
      });

      const exported = result.current.exportWorkflow();
      expect('graph' in exported).toBe(true);
      if ('graph' in exported) {
        expect(exported.graph['solo-n'].depends_on).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // 13. useStudioContext outside provider
  // =========================================================================
  describe('useStudioContext outside provider', () => {
    it('throws when used without StudioProvider', () => {
      // Suppress console.error from React for this expected error
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useStudioContext());
      }).toThrow('useStudioContext must be used within a StudioProvider');

      spy.mockRestore();
    });
  });

  // =========================================================================
  // 14. isEditingDetails
  // =========================================================================
  describe('isEditingDetails', () => {
    it('defaults to false', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });
      expect(result.current.isEditingDetails).toBe(false);
    });

    it('can be toggled via setIsEditingDetails', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      act(() => {
        result.current.setIsEditingDetails(true);
      });
      expect(result.current.isEditingDetails).toBe(true);

      act(() => {
        result.current.setIsEditingDetails(false);
      });
      expect(result.current.isEditingDetails).toBe(false);
    });
  });

  // =========================================================================
  // 15. initialWorkflow prop
  // =========================================================================
  describe('initialWorkflow', () => {
    it('uses provided initial workflow', () => {
      const init: StudioWorkflow = {
        nodes: [makeConfiguredNode('init-a')],
        edges: [],
        nextNodeNumber: 2,
      };
      const { result } = renderHook(() => useStudioContext(), {
        wrapper: wrapperWith(init),
      });

      expect(result.current.workflow.nodes).toHaveLength(1);
      expect(result.current.workflow.nodes[0].nodeId).toBe('init-a');
      expect(result.current.workflow.nextNodeNumber).toBe(2);
    });

    it('defaults to empty workflow when no initialWorkflow provided', () => {
      const { result } = renderHook(() => useStudioContext(), { wrapper });

      expect(result.current.workflow.nodes).toHaveLength(0);
      expect(result.current.workflow.edges).toHaveLength(0);
      expect(result.current.workflow.nextNodeNumber).toBe(1);
    });
  });

  // =========================================================================
  // 16. buildGraph helper
  // =========================================================================
  describe('buildGraph', () => {
    it('builds graph from configured nodes only', () => {
      const wf: StudioWorkflow = {
        nodes: [
          makeConfiguredNode('node-a'),
          { nodeId: 'node-b', status: 'unconfigured', position: { x: 0, y: 0 } },
          makeConfiguredNode('node-c'),
        ],
        edges: [{ id: 'node-a-node-c', source: 'node-a', target: 'node-c' }],
        nextNodeNumber: 4,
      };

      const graph = buildGraph(wf);
      expect(Object.keys(graph)).toHaveLength(2);
      expect(graph['node-a']).toBeDefined();
      expect(graph['node-c']).toBeDefined();
      expect(graph['node-b']).toBeUndefined();
      expect(graph['node-c'].depends_on).toBe('node-a');
      expect(graph['node-a'].depends_on).toBeUndefined();
    });

    it('returns empty graph for empty workflow', () => {
      const graph = buildGraph({ nodes: [], edges: [], nextNodeNumber: 1 });
      expect(Object.keys(graph)).toHaveLength(0);
    });

    it('includes env from scenarioFormValues and globalFormValues', () => {
      const node = makeConfiguredNode('env-node');
      node.config!.globalFormValues = { GLOBAL_KEY: 'global_val' };
      const wf: StudioWorkflow = {
        nodes: [node],
        edges: [],
        nextNodeNumber: 2,
      };

      const graph = buildGraph(wf);
      expect(graph['env-node'].env).toEqual({ KEY: 'val', GLOBAL_KEY: 'global_val' });
    });
  });
});
