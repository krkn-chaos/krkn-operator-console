import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RobotGroupsModal } from '../RobotGroupsModal';
import { robotsApi } from '../../../services/robotsApi';
import { groupsApi } from '../../../services/groupsApi';
import type { GroupDetails, RobotDetails } from '../../../types/api';

vi.mock('../../../services/robotsApi');
vi.mock('../../../services/groupsApi');

const apiError = (status: number, message: string) =>
  Object.assign(new Error(message), { status, statusText: '' });

const allGroups: GroupDetails[] = [
  {
    name: 'dev-team',
    description: 'Developers',
    clusterPermissions: {
      'https://api.cluster1': { actions: ['view', 'run'] },
      'https://api.cluster2': { actions: ['view'] },
    },
  },
  {
    name: 'qa-team',
    description: 'QA engineers',
    clusterPermissions: {
      'https://api.cluster3': { actions: ['view', 'run', 'cancel'] },
    },
  },
];

const robot: RobotDetails = {
  name: 'ci-runner',
  description: '',
  disabled: false,
  groups: ['dev-team'],
  tokenId: 'tok',
  createdAt: new Date().toISOString(),
};

describe('RobotGroupsModal', () => {
  const onSuccess = vi.fn();

  const renderModal = () =>
    render(
      <RobotGroupsModal
        robot={robot}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(groupsApi.listGroups).mockResolvedValue(allGroups);
    vi.mocked(robotsApi.setRobotGroups).mockResolvedValue(robot);
  });

  it('lists groups with a read-only grants summary', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText('dev-team')).toBeInTheDocument();
    });
    expect(screen.getByText('qa-team')).toBeInTheDocument();
    expect(screen.getByText(/grants: 2 clusters \(view\/run\/cancel\)/i)).toBeInTheDocument();
    expect(screen.getByText(/grants: 1 clusters \(view\/run\/cancel\)/i)).toBeInTheDocument();
    expect(screen.getByText('Developers')).toBeInTheDocument();
  });

  it('sends the FULL group set and never calls groupsApi.updateGroup', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText('dev-team')).toBeInTheDocument();
    });

    // Remove dev-team, add qa-team
    await userEvent.click(screen.getByLabelText('dev-team'));
    await userEvent.click(screen.getByLabelText('qa-team'));

    // Diff summary reflects the changes
    await waitFor(() => {
      expect(screen.getByText(/Adds: qa-team/)).toBeInTheDocument();
      expect(screen.getByText(/Removes: dev-team/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save Groups' }));

    await waitFor(() => {
      expect(robotsApi.setRobotGroups).toHaveBeenCalledWith('ci-runner', ['qa-team']);
    });
    expect(groupsApi.updateGroup).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('keeps unchanged groups in the full-set payload', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText('qa-team')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('qa-team'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Groups' }));

    await waitFor(() => {
      expect(robotsApi.setRobotGroups).toHaveBeenCalledWith('ci-runner', [
        'dev-team',
        'qa-team',
      ]);
    });
  });

  it('warns when the resulting group set is empty', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText('dev-team')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('dev-team'));

    expect(screen.getByText(/No groups selected/i)).toBeInTheDocument();
    expect(screen.getByText(/no cluster access/i)).toBeInTheDocument();
  });

  it('sends an empty set when all groups are removed', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText('dev-team')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('dev-team'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Groups' }));

    await waitFor(() => {
      expect(robotsApi.setRobotGroups).toHaveBeenCalledWith('ci-runner', []);
    });
  });

  it('shows a reload-and-retry error on 500', async () => {
    vi.mocked(robotsApi.setRobotGroups).mockRejectedValue(apiError(500, 'boom'));

    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText('dev-team')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save Groups' }));

    await waitFor(() => {
      expect(screen.getByText('Update failed, reload and retry')).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('links to Users & Groups for editing what a group can do', async () => {
    const onNavigateToGroups = vi.fn();
    render(
      <RobotGroupsModal
        robot={robot}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        onNavigateToGroups={onNavigateToGroups}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('dev-team')).toBeInTheDocument();
    });

    const link = screen.getByRole('button', { name: /Edit what a group can do/ });
    await userEvent.click(link);
    expect(onNavigateToGroups).toHaveBeenCalled();
  });
});
