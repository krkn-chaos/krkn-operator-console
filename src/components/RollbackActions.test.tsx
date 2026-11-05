import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RollbackActions } from './RollbackActions';
import { operatorApi } from '../services/operatorApi';
import type { ClusterJob } from '../types/api';

vi.mock('../services/operatorApi', () => ({
  operatorApi: { getRollbackAvailability: vi.fn(), startRollback: vi.fn() },
}));

const job: ClusterJob = {
  providerName: 'operator', clusterName: 'cluster-a', jobId: 'current-id',
  podName: 'scenario-pod', phase: 'Failed',
};

describe('RollbackActions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows no execution button when the exact attempt has no rollback files', async () => {
    vi.mocked(operatorApi.getRollbackAvailability).mockResolvedValue({ jobId: 'current-id', state: 'absent' });
    render(<RollbackActions scenarioRunName="run-a" job={job} />);
    await waitFor(() => expect(operatorApi.getRollbackAvailability).toHaveBeenCalledWith('run-a', 'current-id'));
    expect(screen.queryByRole('button', { name: /Rollback attempt/ })).not.toBeInTheDocument();
  });

  it('does not offer execution to a viewer without run permission', async () => {
    vi.mocked(operatorApi.getRollbackAvailability).mockResolvedValue({ jobId: 'current-id', state: 'available', canExecute: false });
    render(<RollbackActions scenarioRunName="run-a" job={job} />);
    await waitFor(() => expect(operatorApi.getRollbackAvailability).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Rollback attempt/ })).not.toBeInTheDocument();
    expect(await screen.findByText('Rollback is unavailable')).toBeVisible();
  });

  it('shows the execution outcome without offering a second action', async () => {
    vi.mocked(operatorApi.getRollbackAvailability).mockResolvedValue({ jobId: 'current-id', state: 'running', canExecute: true, rollbackRunName: 'rollback-current' });
    const { rerender } = render(<RollbackActions scenarioRunName="run-a" job={job} />);
    expect(await screen.findByText('Rollback is running')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Rollback attempt/ })).not.toBeInTheDocument();
    vi.mocked(operatorApi.getRollbackAvailability).mockResolvedValue({ jobId: 'current-id', state: 'succeeded', canExecute: false, rollbackRunName: 'rollback-current' });
    rerender(<RollbackActions scenarioRunName="run-b" job={job} />);
    expect(await screen.findByText('Rollback completed')).toBeVisible();
  });

  it('shows inspection errors without an execution button', async () => {
    vi.mocked(operatorApi.getRollbackAvailability).mockRejectedValue(new Error('Inspection failed'));
    render(<RollbackActions scenarioRunName="run-a" job={job} />);
    expect(await screen.findByText('Inspection failed')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Rollback attempt/ })).not.toBeInTheDocument();
  });

  it('confirms and starts rollback for an available earlier attempt', async () => {
    vi.mocked(operatorApi.getRollbackAvailability).mockImplementation(async (_run, id) => ({
      jobId: id, state: id === 'older-id' ? 'available' : 'absent', canExecute: true,
    }));
    vi.mocked(operatorApi.startRollback).mockResolvedValue({ jobId: 'older-id', state: 'running', rollbackRunName: 'rollback-older' });
    render(<RollbackActions scenarioRunName="run-a" job={{ ...job, attemptHistory: [{ jobId: 'older-id' }] }} />);

    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Rollback attempt older-id' });
    expect(screen.queryByRole('button', { name: 'Rollback attempt current-' })).not.toBeInTheDocument();
    await user.click(button);
    expect(screen.getByText(/Run rollback for operator\/cluster-a/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Execute rollback' }));
    await waitFor(() => expect(operatorApi.startRollback).toHaveBeenCalledWith('run-a', 'older-id'));
  });
});
