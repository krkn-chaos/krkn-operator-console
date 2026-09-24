import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetScenarioRunStatus = vi.fn();

vi.mock('../services/operatorApi', () => ({
  operatorApi: {
    getScenarioRunStatus: (...args: unknown[]) => mockGetScenarioRunStatus(...args),
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
});
