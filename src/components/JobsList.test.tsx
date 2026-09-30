import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { ClusterJob, UnifiedJobItem, ScenarioRunState, ScenarioRunStatusResponse, GraphRunListItem } from '../types/api';
import { setMockJobs, setMockIsLoading, setMockPagination, setMockStats, resetJobsMock } from '../hooks/__mocks__/useJobs';

vi.mock('../hooks/useJobs');

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

vi.mock('../hooks/useReportActions', () => ({
  useReportActions: () => ({
    reportStatus: null,
    isLoading: false,
    error: null,
    hasHtml: false,
    hasPdf: false,
    hasReports: false,
    preview: null,
    isDownloading: null,
    isPreviewing: null,
    handleDownload: vi.fn(),
    handlePreview: vi.fn(),
    closePreview: vi.fn(),
    retry: vi.fn(),
  }),
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
  expandedGraphRunIds: noopSet,
  onToggleGraphRunAccordion: noop,
  onDeleteGraphRun: noopAsync,
  onRerunScenario: noop,
  loadingRunDetails: new Set<string>(),
};

function makeScenarioJobItem(
  name: string,
  phase: string,
  opts: {
    clusterJobs?: ClusterJob[];
    customRunName?: string;
    createdAt?: string;
    scenarioName?: string;
    ownerUserId?: string;
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
      ownerUserId: opts.ownerUserId,
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

describe('JobsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetJobsMock();
  });

  it('shows empty state when no jobs', () => {
    render(<JobsList {...defaultProps} />);
    expect(screen.getByText('No Scenario Runs')).toBeInTheDocument();
    expect(screen.queryByText('Total Jobs')).not.toBeInTheDocument();
  });

  it('shows loading state when loading with no jobs', () => {
    setMockIsLoading(true);
    render(<JobsList {...defaultProps} />);
    expect(screen.getByText('Loading Jobs')).toBeInTheDocument();
  });

  it('shows logs for jobs that exceeded the retry limit', () => {
    const expandedRunIds = new Set(['run-retries']);
    const expandedJobIds = new Set(['job-max-retries']);
    setMockJobs([
      makeScenarioJobItem('run-retries', 'Failed', {
        clusterJobs: [{
          providerName: 'krkn-operator',
          clusterName: 'cluster-1',
          jobId: 'job-max-retries',
          podName: 'pod-1',
          phase: 'MaxRetriesExceeded',
        }],
      }),
    ]);

    render(
      <JobsList
        {...defaultProps}
        expandedRunIds={expandedRunIds}
        expandedJobIds={expandedJobIds}
      />
    );

    expect(screen.getByText('Max retries exceeded')).toBeInTheDocument();
    expect(screen.getByTestId('log-viewer-mock')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Job' })).not.toBeInTheDocument();
  });

  it('shows logs and the failure reason for an expanded failed job', () => {
    setMockJobs([
      makeScenarioJobItem('run-failed', 'Failed', {
        clusterJobs: [{
          providerName: 'krkn-operator',
          clusterName: 'cluster-1',
          jobId: 'job-failed',
          podName: 'pod-failed',
          phase: 'Failed',
          message: 'ImagePullBackOff: failed to pull image',
        }],
      }),
    ]);

    render(
      <JobsList
        {...defaultProps}
        expandedRunIds={new Set(['run-failed'])}
        expandedJobIds={new Set(['job-failed'])}
      />
    );

    expect(screen.getByText('Job failure reason')).toBeInTheDocument();
    expect(screen.getByText(/ImagePullBackOff: failed to pull image/)).toBeInTheDocument();
    expect(screen.getByTestId('log-viewer-mock')).toBeInTheDocument();
  });

  it('shows the pod-start error and investigation guidance for a pending pod', () => {
    setMockJobs([
      makeScenarioJobItem('run-pending', 'Running', {
        clusterJobs: [{
          providerName: 'krkn-operator',
          clusterName: 'cluster-1',
          jobId: 'job-pending',
          podName: 'pod-pending',
          phase: 'Pending',
          message: 'pod sandbox changed, it will be killed and re-created',
        }],
      }),
    ]);

    render(
      <JobsList
        {...defaultProps}
        expandedRunIds={new Set(['run-pending'])}
        expandedJobIds={new Set(['job-pending'])}
      />
    );

    expect(screen.getByText('Pod did not start running')).toBeInTheDocument();
    expect(screen.getByText(/pod sandbox changed/)).toBeInTheDocument();
    expect(screen.getByText(/Investigate the pod events for more detail/)).toBeInTheDocument();
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
    setMockStats({ totalJobs: 5, succeededJobs: 3, failedJobs: 2 });
    render(<JobsList {...defaultProps} />);
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });

  it('applies the small shadow to the filters card when jobs are present', () => {
    setMockJobs([makeScenarioJobItem('run-with-filters', 'Succeeded')]);
    render(<JobsList {...defaultProps} />);

    const filtersCard = screen.getByRole('heading', { name: 'Filters' }).closest('.pf-v5-c-card');
    expect(filtersCard).not.toBeNull();
    expect(filtersCard).toHaveStyle({ boxShadow: 'var(--pf-v5-global--BoxShadow--sm)' });
  });

  describe('Run name rendering', () => {
    it('shows a matching custom name once', () => {
      setMockJobs([makeScenarioJobItem('same-run', 'Succeeded', { customRunName: 'same-run' })]);
      render(<JobsList {...defaultProps} />);

      const runNameCell = screen.getByRole('list', { name: 'Scenario runs list' })
        .querySelector('.jobs-list-summary-cell--run-name');
      expect(Array.from(runNameCell?.querySelectorAll('code') ?? []).map((code) => code.textContent))
        .toEqual(['same-run']);
    });

    it('shows a different custom name and its run ID', () => {
      setMockJobs([makeScenarioJobItem('scenario-run-id', 'Succeeded', { customRunName: 'my-label' })]);
      render(<JobsList {...defaultProps} />);

      const runNameCell = screen.getByRole('list', { name: 'Scenario runs list' })
        .querySelector('.jobs-list-summary-cell--run-name');
      expect(Array.from(runNameCell?.querySelectorAll('code') ?? []).map((code) => code.textContent))
        .toEqual(['my-label', 'scenario-run-id']);
    });

    it('falls back to the run ID when the custom name is blank', () => {
      setMockJobs([makeScenarioJobItem('scenario-run-id', 'Succeeded', { customRunName: '   ' })]);
      render(<JobsList {...defaultProps} />);

      const runNameCell = screen.getByRole('list', { name: 'Scenario runs list' })
        .querySelector('.jobs-list-summary-cell--run-name');
      expect(Array.from(runNameCell?.querySelectorAll('code') ?? []).map((code) => code.textContent))
        .toEqual(['scenario-run-id']);
    });
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
        expect(screen.getAllByText('scenario-run-id').length).toBeGreaterThan(0);
      });
    });

    it('matches a labeled standalone run by customRunName', async () => {
      const user = userEvent.setup();
      setMockJobs([makeScenarioJobItem('scenario-run-id', 'Succeeded', { customRunName: 'my-label' })]);
      render(<JobsList {...defaultProps} />);

      const filterInput = screen.getByRole('textbox', { name: /Filter by run name/i });
      await user.type(filterInput, 'my-label');

      await waitFor(() => {
        expect(screen.getAllByText('my-label').length).toBeGreaterThan(0);
      });
    });
  });
});

describe('JobsList - Run actions menu', () => {
  it('keeps summary rows horizontal and truncates cells when the list is narrow', () => {
    setMockJobs([makeScenarioJobItem('responsive-run', 'Succeeded')]);

    render(<JobsList {...defaultProps} />);

    const runsList = screen.getByRole('list', { name: 'Scenario runs list' });
    expect(runsList).toHaveClass('pf-m-grid-none', 'pf-m-truncate', 'jobs-list-runs');
    expect(runsList.querySelector('.jobs-list-summary-cell--status')).not.toBeNull();
    expect(runsList.querySelector('.jobs-list-summary-cell--primary')).not.toBeNull();
  });

  it('shows Jobs before Run Name in standalone run rows', () => {
    setMockJobs([makeScenarioJobItem('ordered-run', 'Succeeded')]);

    render(<JobsList {...defaultProps} />);

    const summaryCells = Array.from(
      screen.getByRole('list', { name: 'Scenario runs list' }).querySelectorAll('.pf-v5-c-data-list__cell'),
    );
    const jobsIndex = summaryCells.findIndex((cell) => cell.textContent?.includes('Jobs:'));
    const runNameIndex = summaryCells.findIndex((cell) => cell.textContent?.includes('Run Name:'));

    expect(jobsIndex).toBeGreaterThanOrEqual(0);
    expect(jobsIndex).toBeLessThan(runNameIndex);
  });

  it('shows the job counts and their descriptive tooltip', async () => {
    const user = userEvent.setup();
    const makeJob = (phase: ClusterJob['phase'], jobId: string): ClusterJob => ({
      providerName: 'krkn-operator',
      clusterName: 'cluster-1',
      jobId,
      podName: `pod-${jobId}`,
      phase,
    });
    setMockJobs([makeScenarioJobItem('counts-run', 'Running', {
      clusterJobs: [makeJob('Succeeded', 'succeeded'), makeJob('Failed', 'failed'), makeJob('Running', 'running')],
    })]);

    render(<JobsList {...defaultProps} />);

    const jobCounts = screen.getByRole('list', { name: 'Scenario runs list' })
      .querySelector('.jobs-list-job-counts');
    expect(jobCounts?.textContent).toBe('1/1/1');
    await user.hover(jobCounts as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('1 succeeded, 1 failed, 1 running');
  });

  it('shows graph node counts and their descriptive tooltip', async () => {
    const user = userEvent.setup();
    setMockJobs([makeGraphJobItem('counted-workflow', 'Running', {
      summary: { totalNodes: 9, completedNodes: 2, runningNodes: 3, failedNodes: 1, pendingNodes: 3 },
    })]);

    render(<JobsList {...defaultProps} />);

    const graphNodeCounts = screen.getByRole('list', { name: 'Scenario runs list' })
      .querySelector('.jobs-list-graph-node-counts');
    expect(graphNodeCounts?.textContent).toBe('2/9');
    await user.hover(graphNodeCounts as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('2 completed, 1 failed, 3 running, 3 pending, 9 total');
  });

  it('keeps status and run identity in the summary, and truncates long owners', async () => {
    const user = userEvent.setup();
    const ownerUserId = 'a-very-long-owner-id-that-would-push-the-other-columns@example.com';
    setMockJobs([makeScenarioJobItem('distinctive-run-id', 'Failed', {
      customRunName: 'distinctive-label',
      ownerUserId,
    })]);

    render(<JobsList {...defaultProps} />);

    const runsList = screen.getByRole('list', { name: 'Scenario runs list' });
    expect(runsList.querySelector('.jobs-list-summary-cell--status')).toHaveTextContent('Failed');
    const compactIdentity = runsList.querySelector('.jobs-list-compact-run-identity');
    expect(compactIdentity).toHaveTextContent('distinctive-label');
    expect(compactIdentity).not.toHaveTextContent('distinctive-run-id');
    expect(compactIdentity).toHaveAttribute('aria-label', 'Run name distinctive-label');
    await user.hover(compactIdentity as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Run name: distinctive-label; run ID: distinctive-run-id');
    const owner = runsList.querySelector('.jobs-list-owner-id');
    expect(owner).toHaveTextContent(ownerUserId);
    await user.hover(owner as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(ownerUserId);
  });

  it('keeps the run ID available from the scenario label without adding a second visible line', async () => {
    const user = userEvent.setup();
    const runId = 'pod-scenarios-4c56abcd';
    setMockJobs([makeScenarioJobItem(runId, 'Succeeded', { scenarioName: 'pod-scenarios' })]);

    render(<JobsList {...defaultProps} />);

    const runsList = screen.getByRole('list', { name: 'Scenario runs list' });
    const scenarioName = runsList.querySelector('.jobs-list-run-primary-value');
    expect(scenarioName).toHaveTextContent('pod-scenarios');
    expect(runsList.querySelector('.jobs-list-compact-run-identity')).toBeNull();
    await user.hover(scenarioName as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(`Run ID: ${runId}`);
  });

  it('keeps Resiliency Score and Created as the final columns for both run types', () => {
    setMockJobs([
      makeGraphJobItem('aligned-workflow', 'Completed'),
      makeScenarioJobItem('aligned-scenario', 'Succeeded'),
    ]);

    render(<JobsList {...defaultProps} />);

    const rowCells = Array.from(
      screen.getByRole('list', { name: 'Scenario runs list' }).querySelectorAll('.pf-v5-c-data-list__item-content'),
    ).map((content) => Array.from(content.children));

    expect(rowCells).toHaveLength(2);
    for (const cells of rowCells) {
      expect(cells[cells.length - 2]).toHaveClass('jobs-list-summary-cell--score');
      expect(cells[cells.length - 1]).toHaveClass('jobs-list-summary-cell--created');
    }
  });

  it('places the single run kebab menu in the dedicated row action area', () => {
    const runName = 'report-run-001';
    setMockJobs([makeScenarioJobItem(runName, 'Succeeded')]);

    render(<JobsList {...defaultProps} />);

    const actionsButton = screen.getByRole('button', { name: `Actions for run ${runName}` });
    expect(actionsButton).toBeInTheDocument();
    expect(actionsButton).toHaveClass('run-category-actions__toggle');
    expect(actionsButton.closest('.pf-v5-c-data-list__item-action')).not.toBeNull();
    expect(actionsButton.closest('.pf-v5-c-data-list__item-action')).toHaveStyle({ alignItems: 'center' });
  });

  it('places the workflow kebab menu in the same dedicated row action area', () => {
    const runName = 'workflow-run-001';
    setMockJobs([makeGraphJobItem(runName, 'Completed')]);

    render(<JobsList {...defaultProps} />);

    const actionsButton = screen.getByRole('button', { name: `Actions for run ${runName}` });
    expect(actionsButton).toBeInTheDocument();
    expect(actionsButton).toHaveClass('run-category-actions__toggle');
    expect(actionsButton.closest('.pf-v5-c-data-list__item-action')).not.toBeNull();
    expect(actionsButton.closest('.pf-v5-c-data-list__item-action')).toHaveStyle({ alignItems: 'center' });
  });
});

describe('JobsList - Replay actions', () => {
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
    onRerunScenario: mockOnRerunScenario,
    expandedGraphRunIds: new Set<string>(),
    onToggleGraphRunAccordion: vi.fn(),
    onDeleteGraphRun: vi.fn(),
    loadingRunDetails: new Set<string>(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockIsLoading(false);
  });

  it('shows no completed clusters to replay for a running job', async () => {
    const user = userEvent.setup();
    setMockJobs([makeScenarioJobItem('run-001', 'Running', { clusterJobs: [makeJob({ phase: 'Running' })] })]);
    render(<JobsList {...rerunDefaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Actions for run run-001' }));
    await user.hover(screen.getByText('Replay'));
    expect(await screen.findByText('No completed clusters to replay')).toBeInTheDocument();
  });

  it('shows no completed clusters to replay for a pending job', async () => {
    const user = userEvent.setup();
    setMockJobs([makeScenarioJobItem('run-001', 'Pending', { clusterJobs: [makeJob({ phase: 'Pending' })] })]);
    render(<JobsList {...rerunDefaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Actions for run run-001' }));
    await user.hover(screen.getByText('Replay'));
    expect(await screen.findByText('No completed clusters to replay')).toBeInTheDocument();
  });

  it('renders scenario runs when the jobs snapshot omits clusterJobs', async () => {
    const user = userEvent.setup();
    const itemWithoutClusterJobs = makeScenarioJobItem('run-001', 'Succeeded');
    if (itemWithoutClusterJobs.scenarioRun) {
      delete (itemWithoutClusterJobs.scenarioRun as Partial<ScenarioRunStatusResponse>).clusterJobs;
    }
    setMockJobs([itemWithoutClusterJobs]);

    render(<JobsList {...rerunDefaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Actions for run run-001' }));
    await user.hover(screen.getByText('Replay'));

    expect(await screen.findByText('No completed clusters to replay')).toBeInTheDocument();
  });

  it('replays a completed cluster from the run actions submenu', async () => {
    const user = userEvent.setup();
    setMockJobs([makeScenarioJobItem('run-001', 'Succeeded', {
      clusterJobs: [makeJob({ phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z' })],
    })]);
    render(<JobsList {...rerunDefaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Actions for run run-001' }));
    await user.hover(screen.getByText('Replay'));
    const replayCluster = await screen.findByText('krkn-operator-acm/managed-cluster-1', {
      selector: '.pf-v5-c-menu__item-text',
    });
    await user.click(replayCluster);
    expect(mockOnRerunScenario).toHaveBeenCalledTimes(1);
    const [calledRun, calledJobId] = mockOnRerunScenario.mock.calls[0];
    expect(calledRun.scenarioRunName).toBe('run-001');
    expect(calledJobId).toBe('job-001');
  });

  it('only lists completed clusters for replay in a mixed-status run', async () => {
    const user = userEvent.setup();
    setMockJobs([makeScenarioJobItem('run-001', 'Running', {
      clusterJobs: [
        makeJob({ jobId: 'job-running', phase: 'Running' }),
        makeJob({ jobId: 'job-done', phase: 'Succeeded', completionTime: '2026-07-29T11:00:00Z', clusterName: 'cluster-2' }),
      ],
    })]);
    render(<JobsList {...rerunDefaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Actions for run run-001' }));
    await user.hover(screen.getByText('Replay'));

    expect(await screen.findByText('krkn-operator-acm/cluster-2', {
      selector: '.pf-v5-c-menu__item-text',
    })).toBeInTheDocument();
    expect(screen.queryByText('krkn-operator-acm/managed-cluster-1', {
      selector: '.pf-v5-c-menu__item-text',
    })).not.toBeInTheDocument();
  });

  it('uses cluster jobs fetched into app state when the jobs snapshot is empty', async () => {
    const user = userEvent.setup();
    const onLoadRunDetails = vi.fn();
    const baseProps = {
      ...rerunDefaultProps,
      onLoadRunDetails,
      scenarioRunDetails: [] as ScenarioRunState[],
    };
    setMockJobs([makeScenarioJobItem('run-001', 'Succeeded')]);
    const { rerender } = render(<JobsList {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Actions for run run-001' }));
    await user.hover(screen.getByText('Replay'));
    expect(await screen.findByText('No completed clusters to replay')).toBeInTheDocument();
    expect(onLoadRunDetails).toHaveBeenCalledOnce();

    rerender(<JobsList {...baseProps} scenarioRunDetails={[{
      scenarioRunName: 'run-001',
      scenarioName: 'pod-scenarios',
      phase: 'Succeeded',
      totalTargets: 1,
      successfulJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      clusterJobs: [makeJob({
        clusterName: 'loaded-cluster',
        phase: 'Succeeded',
        completionTime: '2026-07-29T11:00:00Z',
      })],
      createdAt: '2026-07-29T10:00:00Z',
    }]} />);

    expect(await screen.findByText('krkn-operator-acm/loaded-cluster', {
      selector: '.pf-v5-c-menu__item-text',
    })).toBeInTheDocument();
  });

  it('handles context run details that omit clusterJobs when opening replay', async () => {
    const user = userEvent.setup();
    const contextRunWithoutClusterJobs = {
      scenarioRunName: 'run-001',
      scenarioName: 'pod-scenarios',
      phase: 'Succeeded',
      totalTargets: 1,
      successfulJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      createdAt: '2026-07-29T10:00:00Z',
    } as unknown as ScenarioRunState;
    setMockJobs([makeScenarioJobItem('run-001', 'Succeeded')]);

    render(<JobsList
      {...rerunDefaultProps}
      scenarioRunDetails={[contextRunWithoutClusterJobs]}
    />);

    await user.click(screen.getByRole('button', { name: 'Actions for run run-001' }));
    await user.hover(screen.getByText('Replay'));

    expect(await screen.findByText('No completed clusters to replay')).toBeInTheDocument();
  });

  it.each(['Completed', 'Failed', 'PartiallyFailed'] as const)(
    'offers direct workflow replay for %s graph runs', async (phase) => {
      const user = userEvent.setup();
      const onReplayWorkflow = vi.fn().mockResolvedValue(undefined);
      setMockJobs([makeGraphJobItem('graphrun-001', phase, {
        completionTime: '2026-07-29T11:00:00Z',
      })]);
      render(<JobsList {...rerunDefaultProps} onReplayWorkflow={onReplayWorkflow} />);

      await user.click(screen.getByRole('button', { name: 'Actions for run graphrun-001' }));
      const replayItem = screen.getByRole('menuitem', { name: 'Replay' });
      expect(replayItem).not.toBeDisabled();
      await user.click(replayItem);

      expect(onReplayWorkflow).toHaveBeenCalledWith('graphrun-001');
    },
  );
});

describe('JobsList - Date/Time Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockIsLoading(false);
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
      expect(screen.getAllByText('run-new').length).toBeGreaterThan(0);
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
      expect(screen.getAllByText('run-inside').length).toBeGreaterThan(0);
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
      expect(screen.getAllByText('run-control').length).toBeGreaterThan(0);
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
      expect(screen.getAllByText('graphrun-inside').length).toBeGreaterThan(0);
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
      expect(screen.getAllByText('run-old').length).toBeGreaterThan(0);
      expect(screen.getAllByText('run-new').length).toBeGreaterThan(0);
    });
  });
});

describe('JobsList - Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockIsLoading(false);
  });

  it('does not show pagination when totalPages <= 1', () => {
    setMockJobs([makeScenarioJobItem('run-1', 'Succeeded')]);
    render(<JobsList {...defaultProps} />);
    expect(screen.queryByLabelText(/Go to next page/i)).not.toBeInTheDocument();
  });

  it('shows pagination when totalPages > 1', () => {
    setMockJobs([makeScenarioJobItem('run-1', 'Succeeded')]);
    setMockPagination({ page: 1, limit: 10, total: 25, totalPages: 3 });
    render(<JobsList {...defaultProps} />);
    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
  });
});
