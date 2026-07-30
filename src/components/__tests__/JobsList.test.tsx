import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphRunState, ScenarioRunState } from '../../types/api';

vi.mock('../../hooks/useRole', () => ({
  useRole: () => ({ isAdmin: false, role: 'user' }),
}));

vi.mock('../../hooks/useActiveRunsPoller', () => ({
  useActiveRunsPoller: () => ({ activeRuns: null, loading: false, error: null }),
}));

vi.mock('../GraphRunDetail', () => ({
  GraphRunDetail: ({ graphRunName }: { graphRunName: string }) => (
    <div data-testid={`graph-detail-${graphRunName}`}>Graph Detail Mock</div>
  ),
}));

vi.mock('../LogViewer', () => ({
  LogViewer: () => <div data-testid="log-viewer-mock" />,
}));

vi.mock('../ActiveRunsSummary', () => ({
  ActiveRunsSummary: () => <div data-testid="active-runs-summary" />,
}));

vi.mock('../FileManagement', () => ({
  FileManagementModal: () => null,
}));

vi.mock('react-icons/hi2', () => ({
  HiOutlineRocketLaunch: () => <span data-testid="rocket-icon" />,
}));

const { JobsList } = await import('../JobsList');

const dummyScenarioRun: ScenarioRunState = {
  scenarioRunName: 'dummy-run',
  scenarioName: 'dummy',
  phase: 'Succeeded' as const,
  totalTargets: 1,
  successfulJobs: 1,
  failedJobs: 0,
  runningJobs: 0,
  clusterJobs: [],
  createdAt: '2026-06-01T00:00:00Z',
  ownerUserId: 'system@test.com',
};

const defaultProps = () => ({
  scenarioRuns: [dummyScenarioRun] as ScenarioRunState[],
  expandedRunIds: new Set<string>(),
  expandedJobIds: new Set<string>(),
  onToggleRunAccordion: vi.fn(),
  onToggleJobAccordion: vi.fn(),
  onDeleteScenarioRun: vi.fn().mockResolvedValue(undefined),
  onDeleteJob: vi.fn().mockResolvedValue(undefined),
  onCreateJob: vi.fn(),
  onNavigateToStudio: vi.fn(),
  graphRuns: [] as GraphRunState[],
  expandedGraphRunIds: new Set<string>(),
  onToggleGraphRunAccordion: vi.fn(),
  onDeleteGraphRun: vi.fn().mockResolvedValue(undefined),
});

const makeGraphRunState = (overrides?: Partial<GraphRunState>): GraphRunState => ({
  name: 'test-graph-run',
  namespace: 'krkn-operator-system',
  creationTimestamp: '2026-07-02T08:00:00Z',
  phase: 'Completed',
  ownerUserId: 'admin@test.com',
  targetRequestId: 'target-001',
  summary: { totalNodes: 3, completedNodes: 3, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
  resiliencyScoreEnabled: true,
  resiliencyScoreBaseline: 80.0,
  resiliencyScores: [
    { clusterName: 'cluster1', calculated: 87.5, baseline: 80.0, status: 'pass' as const, message: 'Meets baseline', nodeContributions: {} },
  ],
  ...overrides,
});

describe('JobsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should show empty state when no runs', () => {
      const props = defaultProps();
      props.scenarioRuns = [];
      render(<JobsList {...props} />);
      expect(screen.getByText('No Scenario Runs')).toBeInTheDocument();
    });
  });

  describe('GraphRun Rendering', () => {
    it('should render graph run workflow name', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      expect(screen.getByText('test-graph-run')).toBeInTheDocument();
    });

    it('should show owner', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    it('should show node count', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });

    it('should show Succeeded phase label for Completed graph run', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      expect(screen.getAllByText('Succeeded').length).toBeGreaterThanOrEqual(1);
    });

    it('should show Running phase for running graph run', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState({
        phase: 'Running',
        summary: { totalNodes: 3, completedNodes: 1, runningNodes: 1, failedNodes: 0, pendingNodes: 1 },
      })];
      render(<JobsList {...props} />);
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });
  });

  describe('Resiliency Score Display', () => {
    it('should show score when enabled with single cluster', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      expect(screen.getByText('87.5')).toBeInTheDocument();
    });

    it('should show avg label for multi-cluster scores', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState({
        resiliencyScores: [
          { clusterName: 'cluster-a', calculated: 90.0, baseline: 80.0, status: 'pass' as const, message: '', nodeContributions: {} },
          { clusterName: 'cluster-b', calculated: 75.0, baseline: 80.0, status: 'fail' as const, message: '', nodeContributions: {} },
        ],
      })];
      render(<JobsList {...props} />);
      expect(screen.getByText(/\(avg\)/)).toBeInTheDocument();
    });

    it('should show Calculating when scores have sentinel value -1', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState({
        phase: 'Running',
        resiliencyScores: [
          { clusterName: 'cluster-a', calculated: -1, baseline: 80.0, status: 'pass' as const, message: '' },
        ],
        summary: { totalNodes: 3, completedNodes: 0, runningNodes: 1, failedNodes: 0, pendingNodes: 2 },
      })];
      render(<JobsList {...props} />);
      expect(screen.getByText('Calculating...')).toBeInTheDocument();
    });

    it('should show N/A when resiliency not enabled', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState({
        resiliencyScoreEnabled: false,
        resiliencyScores: undefined,
        resiliencyScoreBaseline: undefined,
      })];
      render(<JobsList {...props} />);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('Delete Confirmation', () => {
    it('should show confirmation modal when delete clicked', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      const deleteBtn = screen.getByLabelText('Delete graph run');
      fireEvent.click(deleteBtn);
      expect(screen.getByText('Delete Graph Run')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete graph run/)).toBeInTheDocument();
    });

    it('should call onDeleteGraphRun on confirm', async () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      fireEvent.click(screen.getByLabelText('Delete graph run'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(props.onDeleteGraphRun).toHaveBeenCalledWith('test-graph-run');
      });
    });

    it('should close modal on cancel', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      fireEvent.click(screen.getByLabelText('Delete graph run'));
      expect(screen.getByText('Delete Graph Run')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText('Delete Graph Run')).not.toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should call onToggleGraphRunAccordion when toggle clicked', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      const toggle = document.getElementById('toggle-graph-test-graph-run');
      expect(toggle).toBeTruthy();
      fireEvent.click(toggle!);
      expect(props.onToggleGraphRunAccordion).toHaveBeenCalledWith('test-graph-run');
    });

    it('should render GraphRunDetail when expanded', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      props.expandedGraphRunIds = new Set(['test-graph-run']);
      render(<JobsList {...props} />);
      expect(screen.getByTestId('graph-detail-test-graph-run')).toBeInTheDocument();
    });

    it('should not render GraphRunDetail when collapsed', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      render(<JobsList {...props} />);
      expect(screen.queryByTestId('graph-detail-test-graph-run')).not.toBeInTheDocument();
    });
  });

  describe('Mixed Runs', () => {
    it('should show both graph runs and standalone scenario runs', () => {
      const props = defaultProps();
      props.graphRuns = [makeGraphRunState()];
      props.scenarioRuns = [{
        scenarioRunName: 'standalone-run',
        scenarioName: 'cpu-hog',
        phase: 'Succeeded' as const,
        totalTargets: 1,
        successfulJobs: 1,
        failedJobs: 0,
        runningJobs: 0,
        clusterJobs: [],
        createdAt: '2026-07-01T08:00:00Z',
        ownerUserId: 'user@test.com',
      }];
      render(<JobsList {...props} />);
      expect(screen.getByText('test-graph-run')).toBeInTheDocument();
      expect(screen.getByText('cpu-hog')).toBeInTheDocument();
    });
  });
});
