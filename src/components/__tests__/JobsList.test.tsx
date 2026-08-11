import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphRunListItem, UnifiedJobItem } from '../../types/api';
import { setMockJobs, resetJobsMock } from '../../hooks/__mocks__/useJobs';

vi.mock('../../hooks/useJobs');

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

const makeGraphJobItem = (
  name: string,
  phase: GraphRunListItem['phase'] = 'Completed',
  overrides: Partial<GraphRunListItem> = {},
): UnifiedJobItem => ({
  type: 'graphRun',
  name,
  createdAt: overrides.creationTimestamp || '2026-07-02T08:00:00Z',
  graphRun: {
    name,
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T08:00:00Z',
    phase,
    ownerUserId: 'admin@test.com',
    targetRequestId: 'target-001',
    summary: { totalNodes: 3, completedNodes: 3, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
    resiliencyScoreEnabled: true,
    resiliencyScoreBaseline: 80.0,
    resiliencyScores: [
      { clusterName: 'cluster1', calculated: 87.5, baseline: 80.0, status: 'pass' as const, message: 'Meets baseline', nodeContributions: {} },
    ],
    ...overrides,
  },
});

const makeScenarioJobItem = (
  name: string,
  overrides: Partial<UnifiedJobItem> = {},
): UnifiedJobItem => ({
  type: 'scenarioRun',
  name,
  createdAt: '2026-06-01T00:00:00Z',
  scenarioRun: {
    scenarioRunName: name,
    scenarioName: 'dummy',
    phase: 'Succeeded',
    totalTargets: 1,
    successfulJobs: 1,
    failedJobs: 0,
    runningJobs: 0,
    clusterJobs: [],
    ownerUserId: 'system@test.com',
  },
  ...overrides,
});

const defaultProps = () => ({
  expandedRunIds: new Set<string>(),
  expandedJobIds: new Set<string>(),
  onToggleRunAccordion: vi.fn(),
  onToggleJobAccordion: vi.fn(),
  onDeleteScenarioRun: vi.fn().mockResolvedValue(undefined),
  onDeleteJob: vi.fn().mockResolvedValue(undefined),
  onCreateJob: vi.fn(),
  onNavigateToStudio: vi.fn(),
  expandedGraphRunIds: new Set<string>(),
  onToggleGraphRunAccordion: vi.fn(),
  onDeleteGraphRun: vi.fn().mockResolvedValue(undefined),
  onRerunScenario: vi.fn(),
  loadingRunDetails: new Set<string>(),
});

describe('JobsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetJobsMock();
  });

  describe('Empty State', () => {
    it('should show empty state when no runs', () => {
      const props = defaultProps();
      render(<JobsList {...props} />);
      expect(screen.getByText('No Scenario Runs')).toBeInTheDocument();
    });
  });

  describe('GraphRun Rendering', () => {
    it('should render graph run workflow name', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText('test-graph-run')).toBeInTheDocument();
    });

    it('should show owner', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    it('should show node count', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });

    it('should show Succeeded phase label for Completed graph run', () => {
      setMockJobs([makeGraphJobItem('test-graph-run', 'Completed')]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getAllByText('Succeeded').length).toBeGreaterThanOrEqual(1);
    });

    it('should show Running phase for running graph run', () => {
      setMockJobs([makeGraphJobItem('test-graph-run', 'Running', {
        summary: { totalNodes: 3, completedNodes: 1, runningNodes: 1, failedNodes: 0, pendingNodes: 1 },
      })]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });
  });

  describe('Resiliency Score Display', () => {
    it('should show score when enabled with single cluster', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText('87.5')).toBeInTheDocument();
    });

    it('should show avg label for multi-cluster scores', () => {
      setMockJobs([makeGraphJobItem('test-graph-run', 'Completed', {
        resiliencyScores: [
          { clusterName: 'cluster-a', calculated: 90.0, baseline: 80.0, status: 'pass' as const, message: '', nodeContributions: {} },
          { clusterName: 'cluster-b', calculated: 75.0, baseline: 80.0, status: 'fail' as const, message: '', nodeContributions: {} },
        ],
      })]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText(/\(avg\)/)).toBeInTheDocument();
    });

    it('should show Calculating when scores have sentinel value -1', () => {
      setMockJobs([makeGraphJobItem('test-graph-run', 'Running', {
        resiliencyScores: [
          { clusterName: 'cluster-a', calculated: -1, baseline: 80.0, status: 'pass' as const, message: '' },
        ],
        summary: { totalNodes: 3, completedNodes: 0, runningNodes: 1, failedNodes: 0, pendingNodes: 2 },
      })]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText('Calculating...')).toBeInTheDocument();
    });

    it('should show N/A when resiliency not enabled', () => {
      setMockJobs([makeGraphJobItem('test-graph-run', 'Completed', {
        resiliencyScoreEnabled: false,
        resiliencyScores: undefined,
        resiliencyScoreBaseline: undefined,
      })]);
      render(<JobsList {...defaultProps()} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should show Calculating for standalone run with scoring enabled while running', () => {
      setMockJobs([makeScenarioJobItem('running-with-score', {
        scenarioRun: {
          scenarioRunName: 'running-with-score',
          scenarioName: 'network-chaos',
          phase: 'Running',
          totalTargets: 1,
          successfulJobs: 0,
          failedJobs: 0,
          runningJobs: 1,
          clusterJobs: [],
          ownerUserId: 'admin@test.com',
          resiliencyScoreEnabled: true,
        },
      })]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText('Calculating...')).toBeInTheDocument();
    });

    it('should show N/A for standalone run without scoring enabled while running', () => {
      setMockJobs([makeScenarioJobItem('running-no-score', {
        scenarioRun: {
          scenarioRunName: 'running-no-score',
          scenarioName: 'network-chaos',
          phase: 'Running',
          totalTargets: 1,
          successfulJobs: 0,
          failedJobs: 0,
          runningJobs: 1,
          clusterJobs: [],
          ownerUserId: 'admin@test.com',
        },
      })]);
      render(<JobsList {...defaultProps()} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

  });

  describe('Delete Confirmation', () => {
    it('should show confirmation modal when delete clicked', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      render(<JobsList {...defaultProps()} />);
      const deleteBtn = screen.getByLabelText('Delete graph run');
      fireEvent.click(deleteBtn);
      expect(screen.getByText('Delete Graph Run')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete graph run/)).toBeInTheDocument();
    });

    it('should call onDeleteGraphRun on confirm', async () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      const props = defaultProps();
      render(<JobsList {...props} />);
      fireEvent.click(screen.getByLabelText('Delete graph run'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => {
        expect(props.onDeleteGraphRun).toHaveBeenCalledWith('test-graph-run');
      });
    });

    it('should close modal on cancel', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      render(<JobsList {...defaultProps()} />);
      fireEvent.click(screen.getByLabelText('Delete graph run'));
      expect(screen.getByText('Delete Graph Run')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText('Delete Graph Run')).not.toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should call onToggleGraphRunAccordion when toggle clicked', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      const props = defaultProps();
      render(<JobsList {...props} />);
      const toggle = document.getElementById('toggle-graph-test-graph-run');
      expect(toggle).toBeTruthy();
      fireEvent.click(toggle!);
      expect(props.onToggleGraphRunAccordion).toHaveBeenCalledWith('test-graph-run');
    });

    it('should render GraphRunDetail when expanded', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      const props = defaultProps();
      props.expandedGraphRunIds = new Set(['test-graph-run']);
      render(<JobsList {...props} />);
      expect(screen.getByTestId('graph-detail-test-graph-run')).toBeInTheDocument();
    });

    it('should not render GraphRunDetail when collapsed', () => {
      setMockJobs([makeGraphJobItem('test-graph-run')]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.queryByTestId('graph-detail-test-graph-run')).not.toBeInTheDocument();
    });
  });

  describe('Mixed Runs', () => {
    it('should show both graph runs and standalone scenario runs', () => {
      setMockJobs([
        makeGraphJobItem('test-graph-run'),
        makeScenarioJobItem('standalone-run', {
          scenarioRun: {
            scenarioRunName: 'standalone-run',
            scenarioName: 'cpu-hog',
            phase: 'Succeeded',
            totalTargets: 1,
            successfulJobs: 1,
            failedJobs: 0,
            runningJobs: 0,
            clusterJobs: [],
            ownerUserId: 'user@test.com',
          },
        }),
      ]);
      render(<JobsList {...defaultProps()} />);
      expect(screen.getByText('test-graph-run')).toBeInTheDocument();
      expect(screen.getByText('cpu-hog')).toBeInTheDocument();
    });
  });

  describe('Loading Run Details', () => {
    it('should show spinner when run details are loading', () => {
      setMockJobs([makeScenarioJobItem('loading-run', {
        scenarioRun: {
          scenarioRunName: 'loading-run',
          scenarioName: 'cpu-hog',
          phase: 'Running',
          totalTargets: 1,
          successfulJobs: 0,
          failedJobs: 0,
          runningJobs: 1,
          clusterJobs: [],
          ownerUserId: 'user@test.com',
        },
      })]);
      const props = defaultProps();
      props.expandedRunIds = new Set(['loading-run']);
      props.loadingRunDetails = new Set(['loading-run']);
      render(<JobsList {...props} />);
      expect(screen.getByLabelText('Loading run details')).toBeInTheDocument();
    });

    it('should show "No jobs available" when not loading and no jobs', () => {
      setMockJobs([makeScenarioJobItem('empty-run', {
        scenarioRun: {
          scenarioRunName: 'empty-run',
          scenarioName: 'cpu-hog',
          phase: 'Running',
          totalTargets: 1,
          successfulJobs: 0,
          failedJobs: 0,
          runningJobs: 1,
          clusterJobs: [],
          ownerUserId: 'user@test.com',
        },
      })]);
      const props = defaultProps();
      props.expandedRunIds = new Set(['empty-run']);
      props.loadingRunDetails = new Set();
      render(<JobsList {...props} />);
      expect(screen.getByText('No jobs available for this scenario run')).toBeInTheDocument();
    });
  });
});
