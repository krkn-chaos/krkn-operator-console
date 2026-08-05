import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { ClusterJob, UnifiedJobItem, PaginationMeta, ScenarioRunStatusResponse, GraphRunListItem } from '../types/api';

const mockSetPage = vi.fn();
const mockSetLimit = vi.fn();
let mockJobs: UnifiedJobItem[] = [];
let mockPagination: PaginationMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };
let mockIsLoading = false;

vi.mock('../hooks/useJobs', () => ({
  useJobs: () => ({
    jobs: mockJobs,
    pagination: mockPagination,
    page: mockPagination.page,
    setPage: mockSetPage,
    limit: mockPagination.limit,
    setLimit: mockSetLimit,
    isLoading: mockIsLoading,
  }),
}));

vi.mock('../hooks/useRole', () => ({
  useRole: () => ({ isAdmin: false, role: 'user' }),
}));

vi.mock('../hooks/useActiveRunsPoller', () => ({
  useActiveRunsPoller: () => ({ activeRuns: null, loading: false, error: null }),
}));

vi.mock('./GraphRunDetail', () => ({
  GraphRunDetail: ({ graphRunName }: { graphRunName: string }) => (
    <div data-testid={`graph-detail-${graphRunName}`}>Graph Detail Mock</div>
  ),
}));

vi.mock('./LogViewer', () => ({
  LogViewer: () => <div data-testid="log-viewer-mock" />,
}));

vi.mock('./ActiveRunsSummary', () => ({
  ActiveRunsSummary: () => <div data-testid="active-runs-summary" />,
}));

vi.mock('./FileManagement', () => ({
  FileManagementModal: () => null,
}));

vi.mock('react-icons/hi2', () => ({
  HiOutlineRocketLaunch: () => <span data-testid="rocket-icon" />,
}));

const { JobsList } = await import('./JobsList');

const noopSet = new Set<string>();
const noop = () => {};
const noopAsync = async () => {};

const defaultProps = {
  expandedRunIds: noopSet,
  expandedJobIds: noopSet,
  onToggleRunAccordion: noop,
  onToggleJobAccordion: noop,
  onDeleteScenarioRun: noopAsync,
  onDeleteJob: noopAsync,
  onCreateJob: noop,
  onNavigateToStudio: noop,
  expandedGraphRunIds: noopSet,
  onToggleGraphRunAccordion: noop,
  onDeleteGraphRun: noopAsync,
  onRerunScenario: noop,
};

function makeScenarioJobItem(
  name: string,
  phase: string,
  opts: {
    clusterJobs?: ClusterJob[];
    customRunName?: string;
    createdAt?: string;
    scenarioName?: string;
  } = {},
): UnifiedJobItem {
  return {
    type: 'scenarioRun',
    name,
    createdAt: opts.createdAt || '2026-01-01T00:00:00Z',
    scenarioRun: {
      scenarioRunName: name,
      scenarioName: opts.scenarioName,
      phase: phase as ScenarioRunStatusResponse['phase'],
      totalTargets: 1,
      successfulJobs: (opts.clusterJobs || []).filter(j => j.phase === 'Succeeded').length,
      failedJobs: (opts.clusterJobs || []).filter(j => j.phase === 'Failed').length,
      runningJobs: (opts.clusterJobs || []).filter(j => j.phase === 'Running').length,
      clusterJobs: opts.clusterJobs || [],
      customRunName: opts.customRunName,
    },
  };
}

function makeGraphJobItem(
  name: string,
  phase: GraphRunListItem['phase'] = 'Running',
  overrides: Partial<GraphRunListItem> = {},
): UnifiedJobItem {
  return {
    type: 'graphRun',
    name,
    createdAt: overrides.creationTimestamp || '2026-01-01T00:00:00Z',
    graphRun: {
      name,
      namespace: 'default',
      creationTimestamp: '2026-01-01T00:00:00Z',
      phase,
      ownerUserId: 'user@example.com',
      targetRequestId: 'req-123',
      summary: { totalNodes: 1, completedNodes: 0, runningNodes: 1, failedNodes: 0, pendingNodes: 0 },
      ...overrides,
    },
  };
}

function setMockJobs(items: UnifiedJobItem[]) {
  mockJobs = items;
  mockPagination = { page: 1, limit: 20, total: items.length, totalPages: 1 };
}

describe('JobsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobs = [];
    mockPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
    mockIsLoading = false;
  });

  it('shows empty state when no jobs', () => {
    render(<JobsList {...defaultProps} />);
    expect(screen.getByText('No Scenario Runs')).toBeInTheDocument();
    expect(screen.queryByText('Total Jobs')).not.toBeInTheDocument();
  });

  it('shows loading state when loading with no jobs', () => {
    mockIsLoading = true;
    render(<JobsList {...defaultProps} />);
    expect(screen.getByText('Loading Jobs')).toBeInTheDocument();
  });

  it('renders JobStatsSummary when jobs are present', () => {
    const makeJob = (phase: 'Succeeded' | 'Failed'): ClusterJob => ({
      providerName: 'krkn-operator',
      clusterName: 'cluster-1',
      jobId: `job-${phase}`,
      podName: 'pod-1',
      phase,
    });
    setMockJobs([
      makeScenarioJobItem('run-1', 'Succeeded', {
        clusterJobs: [makeJob('Succeeded'), makeJob('Succeeded'), makeJob('Succeeded')],
      }),
      makeScenarioJobItem('run-2', 'Failed', {
        clusterJobs: [makeJob('Failed'), makeJob('Failed')],
      }),
    ]);
    render(<JobsList {...defaultProps} />);
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });

  describe('Run Name Filter', () => {
    it('matches a graph run by name and shows the row', async () => {
      const user = userEvent.setup();
      setMockJobs([makeGraphJobItem('graphrun-abc123')]);
      render(<JobsList {...defaultProps} />);

      const filterInput = screen.getByRole('textbox', { name: /Filter by run name/i });
      await user.type(filterInput, 'graphrun-abc123');

      await waitFor(() => {
        expect(screen.getByText('graphrun-abc123')).toBeInTheDocument();
      });
    });

    it('hides a graph run when the filter does not match', async () => {
      const user = userEvent.setup();
      setMockJobs([makeGraphJobItem('graphrun-abc123')]);
      render(<JobsList {...defaultProps} />);

      const filterInput = screen.getByRole('textbox', { name: /Filter by run name/i });
      await user.type(filterInput, 'unrelated-name');

      await waitFor(() => {
        expect(screen.queryByText('graphrun-abc123')).not.toBeInTheDocument();
      });
      expect(screen.getByText('No Matching Runs')).toBeInTheDocument();
    });

    it('matches a labeled standalone run by scenarioRunName', async () => {
      const user = userEvent.setup();
      setMockJobs([makeScenarioJobItem('scenario-run-id', 'Succeeded', { customRunName: 'my-label' })]);
      render(<JobsList {...defaultProps} />);

      const filterInput = screen.getByRole('textbox', { name: /Filter by run name/i });
      await user.type(filterInput, 'scenario-run-id');

      await waitFor(() => {
        expect(screen.getByText('scenario-run-id')).toBeInTheDocument();
      });
    });

    it('matches a labeled standalone run by customRunName', async () => {
      const user = userEvent.setup();
      setMockJobs([makeScenarioJobItem('scenario-run-id', 'Succeeded', { customRunName: 'my-label' })]);
      render(<JobsList {...defaultProps} />);

      const filterInput = screen.getByRole('textbox', { name: /Filter by run name/i });
      await user.type(filterInput, 'my-label');

      await waitFor(() => {
        expect(screen.getByText('my-label')).toBeInTheDocument();
      });
    });
  });
});

describe('JobsList - Re-run button', () => {
  const mockOnRerunScenario = vi.fn();

  const makeJob = (overrides: Partial<ClusterJob> = {}): ClusterJob => ({
    providerName: 'krkn-operator-acm',
    clusterName: 'managed-cluster-1',
    jobId: 'job-001',
    podName: 'krkn-pod-001',
    phase: 'Running',
    message: '',
    ...overrides,
  });

  const rerunDefaultProps = {
    expandedRunIds: new Set<string>(['run-001']),
    expandedJobIds: new Set<string>(),
    onToggleRunAccordion: vi.fn(),
    onToggleJobAccordion: vi.fn(),
    onDeleteScenarioRun: vi.fn(),
    onDeleteJob: vi.fn(),
    onCreateJob: vi.fn(),
    onNavigateToStudio: vi.fn(),
    onRerunScenario: mockOnRerunScenario,
    expandedGraphRunIds: new Set<string>(),
    onToggleGraphRunAccordion: vi.fn(),
    onDeleteGraphRun: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
  });

  it('should not show Re-run button for a running job', () => {
    setMockJobs([makeScenarioJobItem('run-001', 'Running', { clusterJobs: [makeJob({ phase: 'Running' })] })]);
    render(<JobsList {...rerunDefaultProps} />);
    expect(screen.queryByLabelText('Re-run scenario')).not.toBeInTheDocument();
  });

  it('should not show Re-run button for a pending job', () => {
    setMockJobs([makeScenarioJobItem('run-001', 'Pending', { clusterJobs: [makeJob({ phase: 'Pending' })] })]);
    render(<JobsList {...rerunDefaultProps} />);
    expect(screen.queryByLabelText('Re-run scenario')).not.toBeInTheDocument();
  });

  it('should show Re-run button for a completed job', () => {
    setMockJobs([makeScenarioJobItem('run-001', 'Succeeded', {
      clusterJobs: [makeJob({ phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z' })],
    })]);
    render(<JobsList {...rerunDefaultProps} />);
    expect(screen.getByLabelText('Re-run scenario')).toBeInTheDocument();
  });

  it('should show Re-run button for a failed job with completionTime', () => {
    setMockJobs([makeScenarioJobItem('run-001', 'Failed', {
      clusterJobs: [makeJob({ phase: 'Failed', completionTime: '2026-07-29T11:00:00Z', message: 'OOM' })],
    })]);
    render(<JobsList {...rerunDefaultProps} />);
    expect(screen.getByLabelText('Re-run scenario')).toBeInTheDocument();
  });

  it('should call onRerunScenario with correct args', async () => {
    const user = userEvent.setup();
    const jobs = [makeJob({ phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z' })];
    setMockJobs([makeScenarioJobItem('run-001', 'Succeeded', { clusterJobs: jobs, createdAt: '2026-07-29T10:00:00Z' })]);
    render(<JobsList {...rerunDefaultProps} />);

    await user.click(screen.getByLabelText('Re-run scenario'));
    expect(mockOnRerunScenario).toHaveBeenCalledTimes(1);
    const [calledRun, calledJobId] = mockOnRerunScenario.mock.calls[0];
    expect(calledRun.scenarioRunName).toBe('run-001');
    expect(calledJobId).toBe('job-001');
  });

  it('should show Re-run only for completed jobs in a mixed-status run', () => {
    setMockJobs([makeScenarioJobItem('run-001', 'Running', {
      clusterJobs: [
        makeJob({ jobId: 'job-running', phase: 'Running' }),
        makeJob({ jobId: 'job-done', phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z', clusterName: 'cluster-2' }),
      ],
    })]);
    render(<JobsList {...rerunDefaultProps} />);
    const rerunButtons = screen.getAllByLabelText('Re-run scenario');
    expect(rerunButtons).toHaveLength(1);
  });

  it('should not show Re-run button for graph runs', () => {
    setMockJobs([makeGraphJobItem('graphrun-001', 'Completed', {
      completionTime: '2026-07-29T11:00:00Z',
    })]);
    render(<JobsList {...rerunDefaultProps} expandedGraphRunIds={new Set(['graphrun-001'])} />);
    expect(screen.queryByLabelText('Re-run scenario')).not.toBeInTheDocument();
  });
});

describe('JobsList - Date/Time Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
  });

  it('hides a scenario run whose createdAt is before the "from" date', async () => {
    const user = userEvent.setup();
    setMockJobs([
      makeScenarioJobItem('run-old', 'Succeeded', { createdAt: '2026-01-14T12:00:00.000Z' }),
      makeScenarioJobItem('run-new', 'Succeeded', { createdAt: '2026-01-15T12:00:00.000Z' }),
    ]);
    render(<JobsList {...defaultProps} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-15');

    await waitFor(() => {
      expect(screen.queryByText('run-old')).not.toBeInTheDocument();
      expect(screen.getByText('run-new')).toBeInTheDocument();
    });
  });

  it('hides a scenario run whose createdAt is after the "to" datetime', async () => {
    const user = userEvent.setup();
    setMockJobs([
      makeScenarioJobItem('run-inside', 'Succeeded', { createdAt: '2026-01-15T12:00:00.000Z' }),
      makeScenarioJobItem('run-outside', 'Succeeded', { createdAt: '2026-01-16T12:00:00.000Z' }),
    ]);
    render(<JobsList {...defaultProps} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-15');
    await user.type(screen.getByRole('textbox', { name: 'End date' }), '2026-01-15');
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '23:59:59' } });

    await waitFor(() => {
      expect(screen.getByText('run-inside')).toBeInTheDocument();
      expect(screen.queryByText('run-outside')).not.toBeInTheDocument();
    });
  });

  it('hides a graph run whose createdAt is before the "from" date', async () => {
    const user = userEvent.setup();
    setMockJobs([
      makeScenarioJobItem('run-control', 'Succeeded', { createdAt: '2026-01-16T12:00:00.000Z' }),
      makeGraphJobItem('graphrun-old', 'Completed', { creationTimestamp: '2026-01-14T12:00:00.000Z' }),
    ]);
    render(<JobsList {...defaultProps} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-16');

    await waitFor(() => {
      expect(screen.queryByText('graphrun-old')).not.toBeInTheDocument();
      expect(screen.getByText('run-control')).toBeInTheDocument();
    });
  });

  it('shows a graph run whose createdAt is within the date range', async () => {
    const user = userEvent.setup();
    setMockJobs([
      makeScenarioJobItem('run-control', 'Succeeded', { createdAt: '2026-01-15T12:00:00.000Z' }),
      makeGraphJobItem('graphrun-inside', 'Running', { creationTimestamp: '2026-01-15T12:00:00.000Z' }),
    ]);
    render(<JobsList {...defaultProps} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-15');

    await waitFor(() => {
      expect(screen.getByText('graphrun-inside')).toBeInTheDocument();
    });
  });

  it('shows a time range error when same-day start time is after end time', async () => {
    const user = userEvent.setup();
    setMockJobs([makeScenarioJobItem('run-1', 'Succeeded', { createdAt: '2026-01-15T12:00:00.000Z' })]);
    render(<JobsList {...defaultProps} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-15');
    await user.type(screen.getByRole('textbox', { name: 'End date' }), '2026-01-15');
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '10:00:00' } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '11:00:00' } });

    await waitFor(() => {
      expect(screen.getAllByText('Start time must be before end time').length).toBeGreaterThan(0);
    });
  });

  it('clears date filter and restores hidden runs when "Clear all filters" is clicked', async () => {
    const user = userEvent.setup();
    setMockJobs([
      makeScenarioJobItem('run-old', 'Succeeded', { createdAt: '2026-01-14T12:00:00.000Z' }),
      makeScenarioJobItem('run-new', 'Succeeded', { createdAt: '2026-01-15T12:00:00.000Z' }),
    ]);
    render(<JobsList {...defaultProps} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-15');

    await waitFor(() => {
      expect(screen.queryByText('run-old')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Clear all filters/i }));

    await waitFor(() => {
      expect(screen.getByText('run-old')).toBeInTheDocument();
      expect(screen.getByText('run-new')).toBeInTheDocument();
    });
  });
});

describe('JobsList - Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
  });

  it('does not show pagination when totalPages <= 1', () => {
    setMockJobs([makeScenarioJobItem('run-1', 'Succeeded')]);
    render(<JobsList {...defaultProps} />);
    expect(screen.queryByLabelText(/Go to next page/i)).not.toBeInTheDocument();
  });

  it('shows pagination when totalPages > 1', () => {
    mockJobs = [makeScenarioJobItem('run-1', 'Succeeded')];
    mockPagination = { page: 1, limit: 10, total: 25, totalPages: 3 };
    render(<JobsList {...defaultProps} />);
    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
  });
});
