import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphRunDetail as GraphRunDetailType, NodeStatus } from '../../types/api';

// Mock ReactFlow - it doesn't render in jsdom
vi.mock('reactflow', () => {
  const Position = { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' };
  const MarkerType = { ArrowClosed: 'arrowclosed' };
  return {
    default: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => (
      <div data-testid="reactflow-mock">
        <div data-testid="node-count">{nodes.length}</div>
        <div data-testid="edge-count">{edges.length}</div>
        {(nodes as { id: string; data: { nodeStatus: NodeStatus; resiliencyEnabled: boolean; resiliencyBaseline?: number } }[]).map((node) => (
          <div key={node.id} data-testid={`flow-node-${node.id}`}>
            {/* Render the actual ScenarioNode component via nodeTypes */}
          </div>
        ))}
      </div>
    ),
    Controls: () => <div data-testid="controls" />,
    Background: () => <div data-testid="background" />,
    Handle: ({ type }: { type: string }) => <div data-testid={`handle-${type}`} />,
    Position,
    MarkerType,
    useNodesState: (initial: unknown[]) => {
      const nodes = [...initial];
      return [nodes, vi.fn((newNodes: unknown[]) => { nodes.length = 0; nodes.push(...newNodes); }), vi.fn()];
    },
    useEdgesState: (initial: unknown[]) => {
      const edges = [...initial];
      return [edges, vi.fn((newEdges: unknown[]) => { edges.length = 0; edges.push(...newEdges); }), vi.fn()];
    },
  };
});

vi.mock('reactflow/dist/style.css', () => ({}));

vi.mock('dagre', () => ({
  default: {
    graphlib: {
      Graph: class {
        nodes: Record<string, { x: number; y: number; width: number; height: number }> = {};
        edges: Array<{ source: string; target: string }> = [];
        setDefaultEdgeLabel() {}
        setGraph() {}
        setNode(id: string, dim: { width: number; height: number }) {
          this.nodes[id] = { x: 0, y: 0, ...dim };
        }
        setEdge(source: string, target: string) {
          this.edges.push({ source, target });
        }
        node(id: string) {
          return this.nodes[id] || { x: 0, y: 0 };
        }
      },
    },
    layout(g: { nodes: Record<string, { x: number; y: number }> }) {
      let i = 0;
      for (const key of Object.keys(g.nodes)) {
        g.nodes[key].x = i * 300;
        g.nodes[key].y = 0;
        i++;
      }
    },
  },
}));

const mockDownloadJson = vi.fn();
vi.mock('../../utils/downloadJson', () => ({
  downloadJson: (...args: unknown[]) => mockDownloadJson(...args),
}));

const mockGetGraphRun = vi.fn();
const mockGetGraphRunConfig = vi.fn();
const mockCreateGraphRun = vi.fn();
const mockGetScenarios = vi.fn();
vi.mock('../../services', () => ({
  graphRunsApi: {
    getGraphRun: (...args: unknown[]) => mockGetGraphRun(...args),
    getGraphRunConfig: (...args: unknown[]) => mockGetGraphRunConfig(...args),
    createGraphRun: (...args: unknown[]) => mockCreateGraphRun(...args),
  },
  operatorApi: {
    getScenarios: (...args: unknown[]) => mockGetScenarios(...args),
  },
}));

// Import component after mocks
const { GraphRunDetail } = await import('../GraphRunDetail');

const makeMockDetail = (overrides?: Partial<GraphRunDetailType>): GraphRunDetailType => ({
  name: 'test-graph-run',
  namespace: 'krkn-operator-system',
  creationTimestamp: '2026-07-02T08:00:00Z',
  spec: {
    graph: {
      'node-a': { name: 'pod-kill', image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios' },
      'node-b': { name: 'net-chaos', image: 'quay.io/krkn-chaos/krkn-hub:network-chaos', depends_on: 'node-a' },
    },
    targetRequestId: 'target-001',
    targetClusters: { 'krkn-operator': ['cluster1'] },
    ownerUserId: 'admin@test.com',
    resiliencyScoreEnabled: true,
    resiliencyScoreBaseline: 80.0,
  },
  status: {
    phase: 'Completed',
    summary: { totalNodes: 2, completedNodes: 2, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
    nodeStatuses: [
      {
        nodeId: 'node-a', nodeName: 'pod-kill', phase: 'Completed',
        scenarioRunRef: 'sr-001', startTime: '2026-07-02T08:00:00Z', completionTime: '2026-07-02T08:05:00Z',
        resiliencyScores: [{ clusterName: 'cluster1', score: 95.0 }], resiliencyScoreAvg: 95.0,
      },
      {
        nodeId: 'node-b', nodeName: 'net-chaos', phase: 'Completed',
        scenarioRunRef: 'sr-002', startTime: '2026-07-02T08:05:00Z', completionTime: '2026-07-02T08:12:00Z',
        dependsOn: ['node-a'],
        resiliencyScores: [{ clusterName: 'cluster1', score: 72.3 }], resiliencyScoreAvg: 72.3,
      },
    ],
    resolvedLevels: [['node-a'], ['node-b']],
    startTime: '2026-07-02T08:00:00Z',
    completionTime: '2026-07-02T08:12:00Z',
    resiliencyScores: [
      { clusterName: 'cluster1', calculated: 83.7, baseline: 80.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'node-a': 95.0, 'node-b': 72.3 } },
    ],
  },
  ...overrides,
});

describe('GraphRunDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScenarios.mockResolvedValue({ scenarios: [
      { name: 'pod-kill', signature_status: 'signed' },
      { name: 'net-chaos', signature_status: 'signed' },
    ] });
  });

  describe('Loading State', () => {
    it('should show spinner while loading', () => {
      mockGetGraphRun.mockReturnValue(new Promise(() => {}));
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      expect(screen.getByLabelText('Loading graph run details')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error alert on API failure', async () => {
      mockGetGraphRun.mockRejectedValue(new Error('Network error'));
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should show generic error for non-Error throws', async () => {
      mockGetGraphRun.mockRejectedValue('unknown error');
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load graph run details')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Bar', () => {
    it('should render node count labels', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText(/Total: 2/)).toBeInTheDocument();
        expect(screen.getByText(/Completed: 2/)).toBeInTheDocument();
        expect(screen.getByText(/Running: 0/)).toBeInTheDocument();
        expect(screen.getByText(/Failed: 0/)).toBeInTheDocument();
        expect(screen.getByText(/Pending: 0/)).toBeInTheDocument();
      });
    });

    it('keeps workflow replay in the run actions menu, outside the expanded details', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);

      await waitFor(() => expect(screen.getByText(/Total: 2/)).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Re-run workflow' })).not.toBeInTheDocument();
      expect(mockGetGraphRunConfig).not.toHaveBeenCalled();
      expect(mockCreateGraphRun).not.toHaveBeenCalled();
    });

    it('should show cluster score in cluster scores section when enabled', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('83.7')).toBeInTheDocument();
        expect(screen.getByText('cluster1')).toBeInTheDocument();
      });
    });

    it('should not show cluster scores section for running graph without scores', async () => {
      const detail = makeMockDetail({
        status: {
          phase: 'Running',
          summary: { totalNodes: 2, completedNodes: 0, runningNodes: 1, failedNodes: 0, pendingNodes: 1 },
          nodeStatuses: [
            { nodeId: 'node-a', nodeName: 'pod-kill', phase: 'Running', startTime: '2026-07-02T08:00:00Z' },
            { nodeId: 'node-b', nodeName: 'net-chaos', phase: 'Pending', dependsOn: ['node-a'] },
          ],
          resolvedLevels: [['node-a'], ['node-b']],
          startTime: '2026-07-02T08:00:00Z',
        },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText(/Running: 1/)).toBeInTheDocument();
      });
      expect(screen.queryByText('Cluster Scores')).not.toBeInTheDocument();
    });

    it('should not show cluster scores when not enabled', async () => {
      const detail = makeMockDetail({
        spec: {
          ...makeMockDetail().spec,
          resiliencyScoreEnabled: false,
        },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText(/Total: 2/)).toBeInTheDocument();
      });
      expect(screen.queryByText('83.7')).not.toBeInTheDocument();
    });
  });

  describe('Multi-Cluster Scores', () => {
    it('should show both clusters in cluster scores section', async () => {
      const detail = makeMockDetail({
        status: {
          ...makeMockDetail().status,
          resiliencyScores: [
            { clusterName: 'cluster-a', calculated: 91.2, baseline: 80.0, status: 'pass', message: '', nodeContributions: {} },
            { clusterName: 'cluster-b', calculated: 78.5, baseline: 80.0, status: 'fail', message: '', nodeContributions: {} },
          ],
        },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('cluster-a')).toBeInTheDocument();
        expect(screen.getByText('cluster-b')).toBeInTheDocument();
        expect(screen.getByText('91.2')).toBeInTheDocument();
        expect(screen.getByText('78.5')).toBeInTheDocument();
      });
    });
  });

  describe('Cluster Scores Section', () => {
    it('should render per-cluster score cards with level label', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('cluster1')).toBeInTheDocument();
        expect(screen.getByText('Excellent')).toBeInTheDocument();
      });
    });

    it('should show level labels for each cluster', async () => {
      const detail = makeMockDetail({
        status: {
          ...makeMockDetail().status,
          resiliencyScores: [
            { clusterName: 'prod-east', calculated: 92.0, baseline: 80.0, status: 'pass', message: 'OK', nodeContributions: { 'node-a': 95.0, 'node-b': 89.0 } },
            { clusterName: 'prod-west', calculated: 65.0, baseline: 80.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'node-a': 60.0, 'node-b': 70.0 } },
          ],
        },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('prod-east')).toBeInTheDocument();
        expect(screen.getByText('prod-west')).toBeInTheDocument();
        expect(screen.getByText('Excellent')).toBeInTheDocument();
        expect(screen.getByText('Poor')).toBeInTheDocument();
      });
    });

    it('should show node breakdown toggle', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText(/2 nodes/)).toBeInTheDocument();
      });
    });

    it('should show header with cluster count', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('Cluster Scores')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should not show cluster list when resiliency not enabled', async () => {
      const detail = makeMockDetail({
        spec: { ...makeMockDetail().spec, resiliencyScoreEnabled: false },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText(/Total: 2/)).toBeInTheDocument();
      });
      expect(screen.queryByText('cluster1')).not.toBeInTheDocument();
    });
  });

  describe('Calculating State (sentinel -1)', () => {
    it('should show Calculating label when calculated is -1', async () => {
      const detail = makeMockDetail({
        status: {
          ...makeMockDetail().status,
          resiliencyScores: [
            { clusterName: 'cluster1', calculated: -1, baseline: 80.0, status: 'pass', message: '' },
          ],
        },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('Calculating...')).toBeInTheDocument();
        expect(screen.getByText('cluster1')).toBeInTheDocument();
      });
      expect(screen.queryByText('-1.0')).not.toBeInTheDocument();
    });

    it('should show Calculating for clusters still computing while showing scores for completed ones', async () => {
      const detail = makeMockDetail({
        status: {
          ...makeMockDetail().status,
          resiliencyScores: [
            { clusterName: 'cluster-done', calculated: 91.2, baseline: 80.0, status: 'pass', message: 'OK', nodeContributions: {} },
            { clusterName: 'cluster-pending', calculated: -1, baseline: 80.0, status: 'pass', message: '' },
          ],
        },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText('91.2')).toBeInTheDocument();
        expect(screen.getByText('Calculating...')).toBeInTheDocument();
      });
    });
  });

  describe('Export JSON', () => {
    it('exports the graph run as a downloadable krknctl-compatible file', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);

      const exportButton = await screen.findByRole('button', { name: 'Export JSON' });
      expect(exportButton).not.toBeDisabled();
      fireEvent.click(exportButton);

      await waitFor(() => expect(mockDownloadJson).toHaveBeenCalledTimes(1));
      const [payload, filename] = mockDownloadJson.mock.calls[0];

      // Filename carries the graph-run name.
      expect(filename).toMatch(/^chaos-workflow-test-graph-run-\d+\.json$/);
      // Top level is the flat executable graph; Studio state under `_` keys.
      expect(payload['node-a']).toBeDefined();
      expect(payload['node-b']).toBeDefined();
      expect(payload._studioLayout.nodes).toHaveLength(2);
      expect(payload._metadata.graphRunName).toBe('test-graph-run');
      expect(payload._metadata.nodeCount).toBe(2);
    });

    it('disables Export JSON when the graph has no real nodes', async () => {
      const detail = makeMockDetail({
        spec: { ...makeMockDetail().spec, graph: { _comment: { name: 'note' } } },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);

      const exportButton = await screen.findByRole('button', { name: 'Export JSON' });
      expect(exportButton).toBeDisabled();
    });

    it('alerts and does not download when the graph is invalid', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const detail = makeMockDetail({
        spec: {
          ...makeMockDetail().spec,
          graph: {
            'node-a': { name: 'a', image: 'i', depends_on: 'node-b' },
            'node-b': { name: 'b', image: 'i', depends_on: 'node-a' },
          },
        },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);

      fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expect(alertSpy.mock.calls[0][0]).toMatch(/Invalid workflow graph/);
      expect(mockDownloadJson).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('embeds graph-level resiliency settings in the export', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);

      fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }));

      await waitFor(() => expect(mockDownloadJson).toHaveBeenCalledTimes(1));
      const [payload] = mockDownloadJson.mock.calls[0];
      expect(payload._studioLayout.resiliencyScoreConfig).toEqual({
        baseline: 80.0,
        mountPath: '/etc/krkn/metrics.yaml',
      });
    });

    it('omits resiliency config when the run has scoring disabled', async () => {
      const detail = makeMockDetail({
        spec: { ...makeMockDetail().spec, resiliencyScoreEnabled: false },
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);

      fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }));

      await waitFor(() => expect(mockDownloadJson).toHaveBeenCalledTimes(1));
      const [payload] = mockDownloadJson.mock.calls[0];
      expect(payload._studioLayout.resiliencyScoreConfig).toBeUndefined();
    });
  });

  describe('Graph Rendering', () => {
    it('should render ReactFlow with correct number of nodes', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByTestId('reactflow-mock')).toBeInTheDocument();
      });
    });

    it('should filter out _comment nodes', async () => {
      const detail = makeMockDetail();
      detail.status.nodeStatuses.push({
        nodeId: '_comment',
        nodeName: 'comment',
        phase: 'Completed',
      });
      mockGetGraphRun.mockResolvedValue(detail);
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText(/Total: 2/)).toBeInTheDocument();
      });
    });
  });

  describe('Polling', () => {
    it('should call getGraphRun on mount', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="my-graph" />);
      await waitFor(() => {
        expect(mockGetGraphRun).toHaveBeenCalledWith('my-graph');
      });
    });

    it('should not poll when all nodes are terminal', async () => {
      mockGetGraphRun.mockResolvedValue(makeMockDetail());
      render(<GraphRunDetail graphRunName="test-graph-run" />);
      await waitFor(() => {
        expect(screen.getByText(/Total: 2/)).toBeInTheDocument();
      });
      expect(mockGetGraphRun).toHaveBeenCalledTimes(1);
    });
  });
});
