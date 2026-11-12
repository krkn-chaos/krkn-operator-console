import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspacesCard } from './WorkspacesCard';
import type { WorkspaceInfo } from '../types/api';
import { workspacesApi } from '../services/workspacesApi';
import { operatorApi } from '../services/operatorApi';
import { useNotifications } from '../hooks/useNotifications';

vi.mock('../services/workspacesApi');
vi.mock('../services/operatorApi');
vi.mock('../hooks/useNotifications');

const sample: WorkspaceInfo = { name: 'rollback', claimName: 'shared-pvc', groups: ['team-a'], availableToAll: false, available: false, reason: 'PVCMissing' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(workspacesApi.listAll).mockResolvedValue([sample]);
  vi.mocked(workspacesApi.listEligiblePVCs).mockResolvedValue([{ name: 'krkn-shared-file' }]);
  vi.mocked(operatorApi.getGroups).mockResolvedValue({ groups: [{ id: 'team-a', name: 'Team A' }] });
  vi.mocked(useNotifications).mockReturnValue({
    showNotification: vi.fn(), showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn(), hideNotification: vi.fn(),
  });
});

describe('WorkspacesCard', () => {
  it('shows unavailable PVC status and retains its group when editing', async () => {
    const user = userEvent.setup();
    render(<WorkspacesCard />);
    expect(await screen.findByText('PVCMissing')).toBeInTheDocument();
    expect(screen.getByText('Group: team-a')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit rollback' }));
    expect(await screen.findByRole('dialog', { name: 'Edit workspace' })).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace name')).toBeDisabled();
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('PVC name')).toBeDisabled();
    expect(screen.getByLabelText('Access group')).toHaveValue('team-a');
  });

  it('publishes a public PVC with a stable alias', async () => {
    const user = userEvent.setup();
    vi.mocked(workspacesApi.listAll).mockResolvedValue([]);
    vi.mocked(workspacesApi.save).mockResolvedValue({ name: 'shared-data', available: false, availableToAll: true });
    render(<WorkspacesCard />);
    await user.click(await screen.findByRole('button', { name: 'Publish PVC' }));
    await user.type(screen.getByLabelText('Workspace name'), 'shared-data');
    await screen.findByRole('option', { name: 'krkn-shared-file' });
    await user.selectOptions(screen.getByLabelText('PVC name'), 'krkn-shared-file');
    await user.click(screen.getByLabelText('Public'));
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(workspacesApi.save).toHaveBeenCalledWith('shared-data', {
      claimName: 'krkn-shared-file', availableToAll: true, groups: [],
    }));
  });

  it('does not allow publication when no eligible PVC exists', async () => {
    const user = userEvent.setup();
    vi.mocked(workspacesApi.listEligiblePVCs).mockResolvedValue([]);
    render(<WorkspacesCard />);
    await user.click(await screen.findByRole('button', { name: 'Publish PVC' }));
    expect(await screen.findByText('No eligible PVCs found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('confirms unpublication without deleting the PVC', async () => {
    const user = userEvent.setup();
    vi.mocked(workspacesApi.remove).mockResolvedValue();
    render(<WorkspacesCard />);
    await screen.findByText('PVCMissing');
    await user.click(screen.getByRole('button', { name: 'Unpublish rollback' }));
    expect(screen.getByText(/Its PVC and files will not be deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(workspacesApi.remove).toHaveBeenCalledWith('rollback'));
  });
});
