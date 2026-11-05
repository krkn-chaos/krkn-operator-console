import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetScenarioRunStatus = vi.fn();
const mockGetRollbackAvailability = vi.fn();

vi.mock('../services/operatorApi', () => ({
  operatorApi: {
    getScenarioRunStatus: (...args: unknown[]) => mockGetScenarioRunStatus(...args),
    getRollbackAvailability: (...args: unknown[]) => mockGetRollbackAvailability(...args),
  },
}));

vi.mock('./ScenarioConfigDisplay', () => ({
  ScenarioConfigDisplay: () => <div data-testid="scenario-config" />,
}));

vi.mock('./LogViewer', () => ({
  LogViewer: () => <div data-testid="log-viewer" />,
}));

vi.mock('./ReportDownloadButton', () => ({
  ReportDownloadButton: ({ runId, runPhase }: { runId: string; runPhase?: string }) => (
    <div data-testid="report-download" data-run-id={runId} data-run-phase={runPhase} />
  ),
}));

const { ScenarioRunDetailModal } = await import('./ScenarioRunDetailModal');

describe('ScenarioRunDetailModal report controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScenarioRunStatus.mockResolvedValue({
      scenarioRunName: 'scenario-run-001',
      scenarioName: 'pod-disruption',
      phase: 'Succeeded',
      totalTargets: 1,
      successfulJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      clusterJobs: [],
    });
    mockGetRollbackAvailability.mockResolvedValue({ jobId: 'job-rollback', state: 'available', canExecute: true });
  });

  it('renders report controls with the loaded run identity and phase', async () => {
    render(
      <ScenarioRunDetailModal
        scenarioRunName="scenario-run-001"
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('report-download')).toHaveAttribute('data-run-id', 'scenario-run-001');
    });
    expect(screen.getByTestId('report-download')).toHaveAttribute('data-run-phase', 'Succeeded');
  });

  it('renders retry exhaustion as a red terminal status for the run and job', async () => {
    mockGetScenarioRunStatus.mockResolvedValueOnce({
      scenarioRunName: 'scenario-run-001',
      scenarioName: 'pod-disruption',
      phase: 'MaxRetriesExceeded',
      totalTargets: 1,
      successfulJobs: 0,
      failedJobs: 1,
      runningJobs: 0,
      clusterJobs: [{
        providerName: 'local',
        clusterName: 'cluster-1',
        jobId: 'job-1',
        podName: 'pod-1',
        phase: 'MaxRetriesExceeded',
      }],
    });

    render(<ScenarioRunDetailModal scenarioRunName="scenario-run-001" isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('Max retries exceeded')).toHaveLength(2);
    });
    expect(screen.getAllByText('Max retries exceeded').every(label => label.closest('.pf-v5-c-label')?.classList.contains('pf-m-red'))).toBe(true);
  });

  it('only shows failed-job diagnostics after expanding the job', async () => {
    mockGetScenarioRunStatus.mockResolvedValueOnce({
      scenarioRunName: 'scenario-run-001',
      scenarioName: 'pod-disruption',
      phase: 'Failed',
      totalTargets: 1,
      successfulJobs: 0,
      failedJobs: 1,
      runningJobs: 0,
      clusterJobs: [{
        providerName: 'local',
        clusterName: 'cluster-1',
        jobId: 'job-failed',
        podName: 'pod-failed',
        phase: 'Failed',
        message: 'ImagePullBackOff: failed to pull image',
      }],
    });

    const user = userEvent.setup();
    render(<ScenarioRunDetailModal scenarioRunName="scenario-run-001" isOpen onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Failed').length).toBeGreaterThan(0));
    expect(screen.queryByText('Job failure reason')).not.toBeInTheDocument();
    expect(screen.queryByTestId('log-viewer')).not.toBeInTheDocument();

    await user.click(document.getElementById('toggle-job-job-failed')!);

    expect(screen.getByText('Job failure reason')).toBeInTheDocument();
    expect(screen.getByTestId('log-viewer')).toBeInTheDocument();
  });

  it('shows rollback for a failed run only when inspection finds files', async () => {
    mockGetScenarioRunStatus.mockResolvedValueOnce({
      scenarioRunName: 'scenario-run-001', scenarioName: 'pod-disruption', rollbackEnabled: true,
      phase: 'Failed', totalTargets: 1, successfulJobs: 0, failedJobs: 1, runningJobs: 0,
      clusterJobs: [{ providerName: 'local', clusterName: 'cluster-1', jobId: 'job-rollback', podName: 'pod-1', phase: 'Failed' }],
    });
    const user = userEvent.setup();
    render(<ScenarioRunDetailModal scenarioRunName="scenario-run-001" isOpen onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Cluster Jobs')).toBeInTheDocument());
    await user.click(document.getElementById('toggle-job-job-rollback')!);
    expect(await screen.findByRole('button', { name: 'Rollback attempt job-roll' })).toBeVisible();
    expect(mockGetRollbackAvailability).toHaveBeenCalledWith('scenario-run-001', 'job-rollback');
  });
});
