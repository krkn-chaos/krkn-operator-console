import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dropdown, DropdownList, MenuToggle } from '@patternfly/react-core';
import { RollbackMenuAction } from './RollbackMenuAction';
import { operatorApi } from '../services/operatorApi';
import type { ClusterJob } from '../types/api';

const notifications = vi.hoisted(() => ({ showSuccess: vi.fn(), showError: vi.fn() }));
vi.mock('../hooks/useNotifications', () => ({ useNotifications: () => notifications }));
vi.mock('../services/operatorApi', () => ({
  operatorApi: { getRollbackAvailability: vi.fn(), startRollback: vi.fn() },
}));

const job: ClusterJob = {
  providerName: 'krkn-operator-acm',
  clusterName: 'krkn-operator-acm-2',
  jobId: '918e8635-b304-4038-8e22-cc9f2ac380d9',
  podName: 'krkn-job-918e8635-b304-4038-8e22-cc9f2ac380d9',
  phase: 'MaxRetriesExceeded',
};

function renderAction(rollbackEnabled = true, jobs: ClusterJob[] = [job]) {
  function ActionDropdown() {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <Dropdown containsFlyout isOpen={isOpen} onOpenChange={setIsOpen} toggle={() => <MenuToggle>Actions</MenuToggle>}>
        <DropdownList>
          <RollbackMenuAction
            runName="node-cpu-hog-953e3861"
            rollbackEnabled={rollbackEnabled}
            jobs={jobs}
            isJobsLoading={false}
            isMenuOpen={isOpen}
            onCloseMenu={() => setIsOpen(false)}
          />
        </DropdownList>
      </Dropdown>
    );
  }
  return render(<ActionDropdown />);
}

describe('RollbackMenuAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps rollback disabled and explains when it was not enabled', async () => {
    const user = userEvent.setup();
    renderAction(false);
    const item = screen.getByText('Rollback').closest('button');
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(operatorApi.getRollbackAvailability).not.toHaveBeenCalled();
    await user.hover(screen.getByText('Rollback'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Rollback was not enabled for this run');
  });

  it('keeps rollback disabled with a tooltip when no files are found', async () => {
    const user = userEvent.setup();
    vi.mocked(operatorApi.getRollbackAvailability).mockResolvedValue({ jobId: job.jobId, state: 'absent', canExecute: false });
    renderAction();
    await waitFor(() => expect(operatorApi.getRollbackAvailability).toHaveBeenCalledWith('node-cpu-hog-953e3861', job.jobId));
    await user.hover(screen.getByText('Rollback'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('No rollback files found');
    expect(screen.getByText('Rollback').closest('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the API reason in the disabled rollback tooltip', async () => {
    const user = userEvent.setup();
    vi.mocked(operatorApi.getRollbackAvailability).mockResolvedValue({
      jobId: job.jobId, state: 'available', canExecute: false, message: 'The workload-rollback image does not have a trusted signature',
    });
    renderAction();
    await waitFor(() => expect(operatorApi.getRollbackAvailability).toHaveBeenCalled());
    await user.hover(screen.getByText('Rollback'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('The workload-rollback image does not have a trusted signature');
  });

  it('opens confirmation directly for a single available attempt and executes only after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(operatorApi.getRollbackAvailability).mockResolvedValue({ jobId: job.jobId, state: 'available', canExecute: true });
    vi.mocked(operatorApi.startRollback).mockResolvedValue({ jobId: job.jobId, state: 'running', rollbackRunName: 'rollback-run' });
    renderAction();
    await waitFor(() => expect(screen.getByText('Rollback').closest('button')).not.toHaveAttribute('aria-disabled'));
    await user.click(screen.getByText('Rollback'));
    expect(screen.getByText(/Run rollback for krkn-operator-acm\/krkn-operator-acm-2/)).toBeVisible();
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Confirm rollback' })).toBeVisible());
    expect(operatorApi.startRollback).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Execute rollback' }));
    await waitFor(() => expect(operatorApi.startRollback).toHaveBeenCalledWith('node-cpu-hog-953e3861', job.jobId));
    expect(notifications.showSuccess).toHaveBeenCalledWith('Rollback started', 'krkn-operator-acm/krkn-operator-acm-2');
  });

  it('shows a submenu when multiple attempts can be rolled back', async () => {
    const user = userEvent.setup();
    const second = { ...job, clusterName: 'krkn-operator-acm-3', jobId: 'second-attempt' };
    vi.mocked(operatorApi.getRollbackAvailability).mockImplementation(async (_run, jobId) => ({ jobId, state: 'available', canExecute: true }));
    renderAction(true, [job, second]);
    await waitFor(() => expect(screen.getByText('Rollback').closest('button')).toHaveAttribute('aria-expanded', 'false'));
    await user.hover(screen.getByText('Rollback'));
    expect(await screen.findByText('krkn-operator-acm/krkn-operator-acm-2 · 918e8635')).toBeVisible();
    await user.click(screen.getByText('krkn-operator-acm/krkn-operator-acm-3 · second-a'));
    expect(screen.getByText(/Run rollback for krkn-operator-acm\/krkn-operator-acm-3/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Confirm rollback' })).not.toBeInTheDocument();
    expect(operatorApi.startRollback).not.toHaveBeenCalled();
  });
});
