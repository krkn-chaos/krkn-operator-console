import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NodeStatus, ScenarioRunStatusResponse } from '../../types/api';

vi.mock('../LogViewer', () => ({
  LogViewer: () => <div data-testid="log-viewer-mock" />,
}));

const mockGetScenarioRunStatus = vi.fn();
vi.mock('../../services', () => ({
  operatorApi: {
    getScenarioRunStatus: (...args: unknown[]) => mockGetScenarioRunStatus(...args),
  },
}));

const { NodeDetailModal } = await import('../NodeDetailModal');

const makeNodeStatus = (overrides?: Partial<NodeStatus>): NodeStatus => ({
  nodeId: 'node-a',
  nodeName: 'pod-kill',
  phase: 'Completed',
  scenarioRunRef: 'sr-001',
  startTime: '2026-07-02T08:00:00Z',
  completionTime: '2026-07-02T08:05:00Z',
  ...overrides,
});

const makeScenarioRun = (overrides?: Partial<ScenarioRunStatusResponse>): ScenarioRunStatusResponse => ({
  scenarioRunName: 'sr-001',
  scenarioName: 'pod-kill',
  phase: 'Succeeded',
  totalTargets: 1,
  successfulJobs: 1,
  failedJobs: 0,
  runningJobs: 0,
  clusterJobs: [
    {
      providerName: 'aws',
      clusterName: 'staging-us-east-1',
      jobId: 'job-001',
      podName: 'krkn-pod-kill-abc',
      phase: 'Succeeded',
      startTime: '2026-07-02T08:00:00Z',
      completionTime: '2026-07-02T08:05:00Z',
      containerImage: 'quay.io/krkn-chaos/krkn-hub:latest',
    },
  ],
  creationTimestamp: '2026-07-02T08:00:00Z',
  ownerUserId: 'admin@test.com',
  ...overrides,
});

describe('NodeDetailModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScenarioRunStatus.mockResolvedValue(makeScenarioRun());
  });

  it('should return null when nodeStatus is null', () => {
    const { container } = render(<NodeDetailModal nodeStatus={null} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show node name in modal title', async () => {
    render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
    expect(screen.getByText('Node: pod-kill')).toBeInTheDocument();
  });

  it('should show node ID', async () => {
    render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
    expect(screen.getByText('node-a')).toBeInTheDocument();
  });

  it('should show phase label', async () => {
    render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should show dependencies when present', async () => {
    const node = makeNodeStatus({ dependsOn: ['node-x', 'node-y'] });
    render(<NodeDetailModal nodeStatus={node} onClose={onClose} />);
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
    expect(screen.getByText('node-x')).toBeInTheDocument();
    expect(screen.getByText('node-y')).toBeInTheDocument();
  });

  it('should not show dependencies when empty', async () => {
    render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
    expect(screen.queryByText('Dependencies')).not.toBeInTheDocument();
  });

  it('should show message when present', async () => {
    const node = makeNodeStatus({ message: 'Node failed due to timeout' });
    render(<NodeDetailModal nodeStatus={node} onClose={onClose} />);
    expect(screen.getByText('Node failed due to timeout')).toBeInTheDocument();
  });

  describe('Resiliency Scores', () => {
    it('should show single cluster score', async () => {
      const node = makeNodeStatus({
        resiliencyScores: [{ clusterName: 'cluster1', score: 95.0 }],
        resiliencyScoreAvg: 95.0,
      });
      render(<NodeDetailModal nodeStatus={node} onClose={onClose} />);
      expect(screen.getByText('Resiliency Score')).toBeInTheDocument();
      expect(screen.getByText('95.0')).toBeInTheDocument();
    });

    it('should show multi-cluster scores with average', async () => {
      const node = makeNodeStatus({
        resiliencyScores: [
          { clusterName: 'cluster-a', score: 92.0 },
          { clusterName: 'cluster-b', score: 74.0 },
        ],
        resiliencyScoreAvg: 83.0,
      });
      render(<NodeDetailModal nodeStatus={node} onClose={onClose} />);
      expect(screen.getByText('Resiliency Scores')).toBeInTheDocument();
      expect(screen.getByText(/cluster-a:/)).toBeInTheDocument();
      expect(screen.getByText(/cluster-b:/)).toBeInTheDocument();
      expect(screen.getByText('Average: 83.0')).toBeInTheDocument();
    });

    it('should not show resiliency section when no scores', async () => {
      render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
      expect(screen.queryByText('Resiliency Score')).not.toBeInTheDocument();
      expect(screen.queryByText('Resiliency Scores')).not.toBeInTheDocument();
    });
  });

  describe('ScenarioRun Loading', () => {
    it('should show spinner while loading scenario run', () => {
      mockGetScenarioRunStatus.mockReturnValue(new Promise(() => {}));
      render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
      expect(screen.getByLabelText('Loading scenario run details')).toBeInTheDocument();
    });

    it('should show error on API failure', async () => {
      mockGetScenarioRunStatus.mockRejectedValue(new Error('Connection refused'));
      render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
      await waitFor(() => {
        expect(screen.getByText('Connection refused')).toBeInTheDocument();
      });
    });

    it('should show waiting message when no scenarioRunRef', () => {
      const node = makeNodeStatus({ scenarioRunRef: undefined });
      mockGetScenarioRunStatus.mockReturnValue(new Promise(() => {}));
      render(<NodeDetailModal nodeStatus={node} onClose={onClose} />);
      expect(screen.getByText('Scenario run not started yet')).toBeInTheDocument();
    });
  });

  describe('ScenarioRun Details', () => {
    it('should show scenario run phase and job counts', async () => {
      render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
      await waitFor(() => {
        expect(screen.getByText('Cluster Jobs')).toBeInTheDocument();
      });
      expect(screen.getByText(/✓ 1/)).toBeInTheDocument();
      expect(screen.getByText(/✗ 0/)).toBeInTheDocument();
      expect(screen.getByText(/⟳ 0/)).toBeInTheDocument();
    });

    it('should show cluster jobs', async () => {
      render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
      await waitFor(() => {
        expect(screen.getByText('Cluster Jobs')).toBeInTheDocument();
        expect(screen.getByText('aws/staging-us-east-1')).toBeInTheDocument();
      });
    });

    it('should fetch scenario run with correct ref', async () => {
      render(<NodeDetailModal nodeStatus={makeNodeStatus({ scenarioRunRef: 'sr-abc' })} onClose={onClose} />);
      await waitFor(() => {
        expect(mockGetScenarioRunStatus).toHaveBeenCalledWith('sr-abc');
      });
    });
  });

  it('should call onClose when close button clicked', async () => {
    render(<NodeDetailModal nodeStatus={makeNodeStatus()} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Cluster Jobs')).toBeInTheDocument();
    });
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});
