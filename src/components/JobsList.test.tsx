import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { JobsList } from './JobsList';
import type { ClusterJob, ClusterJobPhase, ScenarioRunState } from '../types/api';

// The log viewer opens real WebSocket streams; stub it to a marker that records
// the phase it was mounted with, so we can assert *which* phases show logs.
vi.mock('./LogViewer', () => ({
  LogViewer: ({ status }: { status: string }) => <div data-testid={`log-viewer-${status}`} />,
}));
// Unrelated children that would otherwise pull in pollers/modals.
vi.mock('./ActiveRunsSummary', () => ({ ActiveRunsSummary: () => null }));
vi.mock('./GraphRunDetail', () => ({ GraphRunDetail: () => null }));
vi.mock('./FileManagement', () => ({ FileManagementModal: () => null }));
vi.mock('../hooks/useRole', () => ({ useRole: () => ({ isAdmin: true }) }));
vi.mock('../hooks/useActiveRunsPoller', () => ({
  useActiveRunsPoller: () => ({ activeRuns: [], loading: false, error: null }),
}));

const makeJob = (phase: ClusterJobPhase, jobId: string): ClusterJob => ({
  providerName: 'krkn-operator',
  clusterName: 'cluster-a',
  jobId,
  podName: `pod-${jobId}`,
  phase,
});

// One run holding a job in each phase we care about: an active one, the between-
// attempts 'Retrying' state, a retries-exhausted terminal one, and a not-yet-started one.
const run: ScenarioRunState = {
  scenarioRunName: 'run-1',
  scenarioName: 'pod-scenario',
  phase: 'Running',
  totalTargets: 4,
  successfulJobs: 0,
  failedJobs: 1,
  runningJobs: 1,
  createdAt: '2026-01-01T00:00:00Z',
  clusterJobs: [
    makeJob('Running', 'job-running'),
    makeJob('Retrying', 'job-retrying'),
    makeJob('MaxRetriesExceeded', 'job-terminal'),
    makeJob('Pending', 'job-pending'),
  ],
};

function renderJobsList() {
  return render(
    <JobsList
      scenarioRuns={[run]}
      expandedRunIds={new Set(['run-1'])}
      expandedJobIds={new Set(['job-running', 'job-retrying', 'job-terminal', 'job-pending'])}
      pausedPollingRunIds={new Set()}
      onToggleRunAccordion={vi.fn()}
      onToggleJobAccordion={vi.fn()}
      onDeleteScenarioRun={vi.fn().mockResolvedValue(undefined)}
      onDeleteJob={vi.fn().mockResolvedValue(undefined)}
      onCreateJob={vi.fn()}
      onRefreshScenarioRun={vi.fn()}
      onNavigateToStudio={vi.fn()}
      graphRuns={[]}
      expandedGraphRunIds={new Set()}
      pausedGraphPollingIds={new Set()}
      onToggleGraphRunAccordion={vi.fn()}
      onDeleteGraphRun={vi.fn().mockResolvedValue(undefined)}
    />
  );
}

describe('JobsList terminal-phase job UI', () => {
  it('shows the log viewer for running, retrying, and terminal jobs, but not pending', () => {
    renderJobsList();

    // Pod has started (or finished) -> logs available.
    expect(screen.getByTestId('log-viewer-Running')).toBeInTheDocument();
    expect(screen.getByTestId('log-viewer-Retrying')).toBeInTheDocument();
    // The regression this guards: a retries-exhausted job ends as 'MaxRetriesExceeded'
    // (not 'Failed') and must still surface its logs.
    expect(screen.getByTestId('log-viewer-MaxRetriesExceeded')).toBeInTheDocument();

    // 'Pending' has no pod yet -> no log viewer.
    expect(screen.queryByTestId('log-viewer-Pending')).not.toBeInTheDocument();
  });

  it('offers Delete only for non-terminal jobs', () => {
    renderJobsList();

    // Running, Retrying, Pending are non-terminal -> deletable; the terminal
    // MaxRetriesExceeded job must not expose a delete control.
    const deleteButtons = screen.getAllByRole('button', { name: /^Delete Job$/ });
    expect(deleteButtons).toHaveLength(3);
  });
});
