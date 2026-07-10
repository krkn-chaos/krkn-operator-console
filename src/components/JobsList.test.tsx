import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { JobsList } from './JobsList';
import type { ScenarioRunState, GraphRunState } from '../types/api';

vi.mock('../hooks/useRole', () => ({
  useRole: () => ({ isAdmin: false }),
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
  pausedPollingRunIds: noopSet,
  onToggleRunAccordion: noop,
  onToggleJobAccordion: noop,
  onDeleteScenarioRun: noopAsync,
  onDeleteJob: noopAsync,
  onCreateJob: noop,
  onRefreshScenarioRun: noop,
  onNavigateToStudio: noop,
  graphRuns: [],
  expandedGraphRunIds: noopSet,
  pausedGraphPollingIds: noopSet,
  onToggleGraphRunAccordion: noop,
  onDeleteGraphRun: noopAsync,
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

function makeGraphRun(name: string, phase: GraphRunState['phase'] = 'Running'): GraphRunState {
  return {
    name,
    namespace: 'default',
    creationTimestamp: '2026-01-01T00:00:00Z',
    phase,
    ownerUserId: 'user@example.com',
    targetRequestId: 'req-123',
    summary: { totalNodes: 1, completedNodes: 0, runningNodes: 1, failedNodes: 0, pendingNodes: 0 },
  };
}

describe('JobsList', () => {
  it('does not render JobStatsSummary when there are no runs', () => {
    render(<JobsList {...defaultProps} />);
    expect(screen.getByText('No Scenario Runs')).toBeInTheDocument();
    expect(screen.queryByText('Total Jobs')).not.toBeInTheDocument();
  });

  it('renders JobStatsSummary when scenarioRuns are present', () => {
    const runs = [
      makeScenarioRun('run-1', 'Succeeded', { total: 3, succeeded: 3, failed: 0 }),
      makeScenarioRun('run-2', 'Failed', { total: 2, succeeded: 0, failed: 2 }),
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
