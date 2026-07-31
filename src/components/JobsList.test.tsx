import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { JobsList } from './JobsList';
import type { ScenarioRunState, ClusterJob, GraphRunState } from '../types/api';

vi.mock('../hooks/useRole', () => ({
  useRole: () => ({ isAdmin: false, role: 'user' }),
}));

vi.mock('../hooks/useActiveRunsPoller', () => ({
  useActiveRunsPoller: () => ({ activeRuns: null, loading: false, error: null }),
}));

const noopSet = new Set<string>();
const noop = () => {};
const noopAsync = async () => {};

const defaultProps = {
  scenarioRuns: [] as ScenarioRunState[],
  expandedRunIds: noopSet,
  expandedJobIds: noopSet,
  onToggleRunAccordion: noop,
  onToggleJobAccordion: noop,
  onDeleteScenarioRun: noopAsync,
  onDeleteJob: noopAsync,
  onCreateJob: noop,
  onNavigateToStudio: noop,
  graphRuns: [] as GraphRunState[],
  expandedGraphRunIds: noopSet,
  onToggleGraphRunAccordion: noop,
  onDeleteGraphRun: noopAsync,
  onRerunScenario: noop,
};

function makeScenarioRun(
  name: string,
  phase: string,
  jobs: { total: number; succeeded: number; failed: number } = { total: 1, succeeded: 0, failed: 0 },
  overrides: Partial<ScenarioRunState> = {},
): ScenarioRunState {
  return {
    scenarioRunName: name,
    phase,
    totalTargets: jobs.total,
    successfulJobs: jobs.succeeded,
    failedJobs: jobs.failed,
    runningJobs: 0,
    clusterJobs: [],
    scenarios: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as unknown as ScenarioRunState;
}

function makeGraphRun(
  name: string,
  phase: GraphRunState['phase'] = 'Running',
  overrides: Partial<GraphRunState> = {},
): GraphRunState {
  return {
    name,
    namespace: 'default',
    creationTimestamp: '2026-01-01T00:00:00Z',
    phase,
    ownerUserId: 'user@example.com',
    targetRequestId: 'req-123',
    summary: { totalNodes: 1, completedNodes: 0, runningNodes: 1, failedNodes: 0, pendingNodes: 0 },
    ...overrides,
  };
}

describe('JobsList', () => {
  it('does not render JobStatsSummary when there are no runs', () => {
    render(<JobsList {...defaultProps} />);
    expect(screen.getByText('No Scenario Runs')).toBeInTheDocument();
    expect(screen.queryByText('Total Jobs')).not.toBeInTheDocument();
  });

  it('renders JobStatsSummary when scenarioRuns are present', () => {
    const makeJob = (phase: 'Succeeded' | 'Failed') => ({
      providerName: 'krkn-operator',
      clusterName: 'cluster-1',
      jobId: `job-${Math.random()}`,
      podName: 'pod-1',
      phase,
    });
    const runs = [
      makeScenarioRun('run-1', 'Succeeded', { total: 3, succeeded: 3, failed: 0 }, {
        clusterJobs: [makeJob('Succeeded'), makeJob('Succeeded'), makeJob('Succeeded')],
      }),
      makeScenarioRun('run-2', 'Failed', { total: 2, succeeded: 0, failed: 2 }, {
        clusterJobs: [makeJob('Failed'), makeJob('Failed')],
      }),
    ];
    render(<JobsList {...defaultProps} scenarioRuns={runs} />);
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });

  describe('Run Name Filter', () => {
    it('matches a graph run by graphRunName and shows the row', async () => {
      const user = userEvent.setup();
      const graphRun = makeGraphRun('graphrun-abc123');
      const node = makeScenarioRun('node-scenario-run-1', 'Running', { total: 1, succeeded: 0, failed: 0 }, {
        graphRunName: 'graphrun-abc123',
      });

      render(<JobsList {...defaultProps} scenarioRuns={[node]} graphRuns={[graphRun]} />);

      const filterInput = screen.getByRole('textbox', { name: /Filter by run name/i });
      await user.type(filterInput, 'graphrun-abc123');

      await waitFor(() => {
        expect(screen.getByText('graphrun-abc123')).toBeInTheDocument();
      });
    });

    it('hides a graph run when the filter does not match its graphRunName', async () => {
      const user = userEvent.setup();
      const graphRun = makeGraphRun('graphrun-abc123');
      const node = makeScenarioRun('node-scenario-run-1', 'Running', { total: 1, succeeded: 0, failed: 0 }, {
        graphRunName: 'graphrun-abc123',
      });

      render(<JobsList {...defaultProps} scenarioRuns={[node]} graphRuns={[graphRun]} />);

      const filterInput = screen.getByRole('textbox', { name: /Filter by run name/i });
      await user.type(filterInput, 'unrelated-name');

      await waitFor(() => {
        expect(screen.queryByText('graphrun-abc123')).not.toBeInTheDocument();
      });
      expect(screen.getByText('No Matching Runs')).toBeInTheDocument();
    });

    it('matches a labeled standalone run by scenarioRunName even when customRunName is set', async () => {
      const user = userEvent.setup();
      const run = makeScenarioRun('scenario-run-generated-id', 'Succeeded', undefined, {
        customRunName: 'my-label',
      });

      render(<JobsList {...defaultProps} scenarioRuns={[run]} />);

      const filterInput = screen.getByRole('textbox', { name: /Filter by run name/i });
      await user.type(filterInput, 'scenario-run-generated-id');

      await waitFor(() => {
        expect(screen.getByText('scenario-run-generated-id')).toBeInTheDocument();
      });
    });

    it('matches a labeled standalone run by customRunName', async () => {
      const user = userEvent.setup();
      const run = makeScenarioRun('scenario-run-generated-id', 'Succeeded', undefined, {
        customRunName: 'my-label',
      });

      render(<JobsList {...defaultProps} scenarioRuns={[run]} />);

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

  const makeRerunRun = (jobs: ClusterJob[]): ScenarioRunState => ({
    scenarioRunName: 'run-001',
    scenarioName: 'node-cpu-hog',
    phase: jobs.some(j => j.phase === 'Running') ? 'Running' : 'Succeeded',
    totalTargets: jobs.length,
    successfulJobs: jobs.filter(j => j.phase === 'Succeeded').length,
    failedJobs: jobs.filter(j => j.phase === 'Failed').length,
    runningJobs: jobs.filter(j => j.phase === 'Running').length,
    clusterJobs: jobs,
    createdAt: '2026-07-29T10:00:00Z',
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
    graphRuns: [] as GraphRunState[],
    expandedGraphRunIds: new Set<string>(),
    onToggleGraphRunAccordion: vi.fn(),
    onDeleteGraphRun: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not show Re-run button for a running job (no completionTime)', () => {
    const jobs = [makeJob({ phase: 'Running' })];
    render(<JobsList {...rerunDefaultProps} scenarioRuns={[makeRerunRun(jobs)]} />);

    expect(screen.queryByLabelText('Re-run scenario')).not.toBeInTheDocument();
  });

  it('should not show Re-run button for a pending job', () => {
    const jobs = [makeJob({ phase: 'Pending' })];
    render(<JobsList {...rerunDefaultProps} scenarioRuns={[makeRerunRun(jobs)]} />);

    expect(screen.queryByLabelText('Re-run scenario')).not.toBeInTheDocument();
  });

  it('should show Re-run button for a completed job (has completionTime)', () => {
    const jobs = [makeJob({ phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z' })];
    render(<JobsList {...rerunDefaultProps} scenarioRuns={[makeRerunRun(jobs)]} />);

    expect(screen.getByLabelText('Re-run scenario')).toBeInTheDocument();
  });

  it('should show Re-run button for a failed job with completionTime', () => {
    const jobs = [makeJob({ phase: 'Failed', completionTime: '2026-07-29T11:00:00Z', message: 'OOM killed' })];
    render(<JobsList {...rerunDefaultProps} scenarioRuns={[makeRerunRun(jobs)]} />);

    expect(screen.getByLabelText('Re-run scenario')).toBeInTheDocument();
  });

  it('should call onRerunScenario with correct args when Re-run clicked', async () => {
    const user = userEvent.setup();
    const jobs = [makeJob({ phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z' })];
    const run = makeRerunRun(jobs);
    render(<JobsList {...rerunDefaultProps} scenarioRuns={[run]} />);

    await user.click(screen.getByLabelText('Re-run scenario'));

    expect(mockOnRerunScenario).toHaveBeenCalledTimes(1);
    expect(mockOnRerunScenario).toHaveBeenCalledWith(run, 'job-001');
  });

  it('should show Re-run only for completed jobs in a mixed-status run', () => {
    const jobs = [
      makeJob({ jobId: 'job-running', phase: 'Running' }),
      makeJob({ jobId: 'job-done', phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z', clusterName: 'cluster-2' }),
    ];
    render(<JobsList {...rerunDefaultProps} scenarioRuns={[makeRerunRun(jobs)]} />);

    const rerunButtons = screen.getAllByLabelText('Re-run scenario');
    expect(rerunButtons).toHaveLength(1);
  });

  it('should not show Re-run button for graph runs', () => {

    const graphRun: GraphRunState = {
      name: 'graphrun-001',
      namespace: 'default',
      creationTimestamp: '2026-07-29T10:00:00Z',
      phase: 'Completed',
      ownerUserId: 'user@example.com',
      targetRequestId: 'uuid-001',
      summary: { totalNodes: 1, completedNodes: 1, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
      completionTime: '2026-07-29T11:00:00Z',
    };

    const graphNodeRun: ScenarioRunState = {
      scenarioRunName: 'run-graph-001',
      scenarioName: 'node-cpu-hog',
      phase: 'Succeeded',
      totalTargets: 1,
      successfulJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      clusterJobs: [makeJob({ phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z' })],
      createdAt: '2026-07-29T10:00:00Z',
      graphRunName: 'graphrun-001',
      graphNodeId: 'node-1',
    };

    render(
      <JobsList
        {...rerunDefaultProps}
        scenarioRuns={[graphNodeRun]}
        graphRuns={[graphRun]}
        expandedRunIds={new Set<string>()}
        expandedGraphRunIds={new Set<string>(['graphrun-001'])}
      />
    );

    expect(screen.queryByLabelText('Re-run scenario')).not.toBeInTheDocument();
  });
});

describe('JobsList - Date/Time Filter', () => {
  it('hides a scenario run whose createdAt is before the "from" date', async () => {
    const user = userEvent.setup();
    const oldRun = makeScenarioRun('run-old', 'Succeeded', undefined, { createdAt: '2026-01-14T12:00:00.000Z' });
    const newRun = makeScenarioRun('run-new', 'Succeeded', undefined, { createdAt: '2026-01-15T12:00:00.000Z' });

    render(<JobsList {...defaultProps} scenarioRuns={[oldRun, newRun]} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-15');

    await waitFor(() => {
      expect(screen.queryByText('run-old')).not.toBeInTheDocument();
      expect(screen.getByText('run-new')).toBeInTheDocument();
    });
  });

  it('hides a scenario run whose createdAt is after the "to" datetime', async () => {
    const user = userEvent.setup();
    const insideRun = makeScenarioRun('run-inside', 'Succeeded', undefined, { createdAt: '2026-01-15T12:00:00.000Z' });
    const outsideRun = makeScenarioRun('run-outside', 'Succeeded', undefined, { createdAt: '2026-01-16T12:00:00.000Z' });

    render(<JobsList {...defaultProps} scenarioRuns={[insideRun, outsideRun]} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-15');
    await user.type(screen.getByRole('textbox', { name: 'End date' }), '2026-01-15');
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '23:59:59' } });

    await waitFor(() => {
      expect(screen.getByText('run-inside')).toBeInTheDocument();
      expect(screen.queryByText('run-outside')).not.toBeInTheDocument();
    });
  });

  it('hides a graph run whose creationTimestamp is before the "from" date', async () => {
    const user = userEvent.setup();
    // Scenario run is needed both for the filter UI to appear and to pass the filter
    const controlRun = makeScenarioRun('run-control', 'Succeeded', undefined, { createdAt: '2026-01-16T12:00:00.000Z' });
    const graphRun = makeGraphRun('graphrun-old', 'Completed', { creationTimestamp: '2026-01-14T12:00:00.000Z' });

    render(<JobsList {...defaultProps} scenarioRuns={[controlRun]} graphRuns={[graphRun]} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-16');

    await waitFor(() => {
      expect(screen.queryByText('graphrun-old')).not.toBeInTheDocument();
      expect(screen.getByText('run-control')).toBeInTheDocument();
    });
  });

  it('shows a graph run whose creationTimestamp is within the date range', async () => {
    const user = userEvent.setup();
    const controlRun = makeScenarioRun('run-control', 'Succeeded', undefined, { createdAt: '2026-01-15T12:00:00.000Z' });
    const graphRun = makeGraphRun('graphrun-inside', 'Running', { creationTimestamp: '2026-01-15T12:00:00.000Z' });

    render(<JobsList {...defaultProps} scenarioRuns={[controlRun]} graphRuns={[graphRun]} />);

    await user.type(screen.getByRole('textbox', { name: 'Start date' }), '2026-01-15');

    await waitFor(() => {
      expect(screen.getByText('graphrun-inside')).toBeInTheDocument();
    });
  });

  it('shows a time range error when same-day start time is after end time', async () => {
    const user = userEvent.setup();
    const run = makeScenarioRun('run-1', 'Succeeded', undefined, { createdAt: '2026-01-15T12:00:00.000Z' });

    render(<JobsList {...defaultProps} scenarioRuns={[run]} />);

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
    const oldRun = makeScenarioRun('run-old', 'Succeeded', undefined, { createdAt: '2026-01-14T12:00:00.000Z' });
    const newRun = makeScenarioRun('run-new', 'Succeeded', undefined, { createdAt: '2026-01-15T12:00:00.000Z' });

    render(<JobsList {...defaultProps} scenarioRuns={[oldRun, newRun]} />);

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
