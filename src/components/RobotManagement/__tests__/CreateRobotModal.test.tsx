import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRobotModal } from '../CreateRobotModal';
import { robotsApi } from '../../../services/robotsApi';
import { groupsApi } from '../../../services/groupsApi';
import { useNotifications } from '../../../hooks/useNotifications';
import type { GroupDetails, RobotDetails } from '../../../types/api';

vi.mock('../../../services/robotsApi');
vi.mock('../../../services/groupsApi');
vi.mock('../../../hooks/useNotifications');

const apiError = (status: number, message: string) =>
  Object.assign(new Error(message), { status, statusText: '' });

const mockGroups: GroupDetails[] = [
  {
    name: 'dev-team',
    description: 'Developers',
    clusterPermissions: { 'https://api.cluster1': { actions: ['view', 'run'] } },
  },
  {
    name: 'qa-team',
    description: 'QA',
    clusterPermissions: {},
  },
];

const createdRobot: RobotDetails = {
  name: 'ci-runner',
  description: '',
  disabled: false,
  groups: ['dev-team'],
  tokenId: '',
  createdAt: new Date().toISOString(),
};

async function fillName(name: string) {
  await userEvent.type(screen.getByLabelText(/Name/), name);
}

describe('CreateRobotModal', () => {
  const mockShowWarning = vi.fn();
  const onSuccess = vi.fn();
  const onTokenIssued = vi.fn();

  const renderModal = () =>
    render(
      <CreateRobotModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        onTokenIssued={onTokenIssued}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotifications).mockReturnValue({
      showNotification: vi.fn(),
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showWarning: mockShowWarning,
      showInfo: vi.fn(),
      hideNotification: vi.fn(),
    });
    vi.mocked(groupsApi.listGroups).mockResolvedValue(mockGroups);
    vi.mocked(robotsApi.createRobot).mockResolvedValue(createdRobot);
    vi.mocked(robotsApi.issueRobotToken).mockResolvedValue({
      token: 'tok',
      tokenId: 'tid',
      expiresAt: new Date().toISOString(),
      message: 'issued',
    });
  });

  describe('name validation', () => {
    it.each([
      ['accepts a 1-character name', 'a', true],
      ['accepts a 48-character name', 'a'.repeat(48), true],
      ['rejects a 49-character name', 'a'.repeat(49), false],
      ['rejects uppercase letters', 'Robot', false],
      ['rejects a leading dash', '-robot', false],
      ['rejects a trailing dash', 'robot-', false],
    ])('%s', async (_label, name, isValid) => {
      renderModal();
      await fillName(name);
      await userEvent.click(screen.getByRole('button', { name: 'Create Robot' }));

      await waitFor(() => {
        if (isValid) {
          expect(robotsApi.createRobot).toHaveBeenCalled();
        } else {
          expect(robotsApi.createRobot).not.toHaveBeenCalled();
          expect(screen.getByText(/must be 1-48/i)).toBeInTheDocument();
        }
      });
    });
  });

  describe('description UTF-8 byte limit', () => {
    it('accepts exactly 256 bytes', async () => {
      renderModal();
      await fillName('ok-name');
      // 128 two-byte characters = 256 UTF-8 bytes
      await userEvent.type(screen.getByLabelText(/Description/), 'é'.repeat(128));
      await userEvent.click(screen.getByRole('button', { name: 'Create Robot' }));

      await waitFor(() => {
        expect(robotsApi.createRobot).toHaveBeenCalled();
      });
    });

    it('rejects descriptions over 256 UTF-8 bytes', async () => {
      renderModal();
      await fillName('ok-name');
      // 129 two-byte characters = 258 UTF-8 bytes
      await userEvent.type(screen.getByLabelText(/Description/), 'é'.repeat(129));
      await userEvent.click(screen.getByRole('button', { name: 'Create Robot' }));

      await waitFor(() => {
        expect(robotsApi.createRobot).not.toHaveBeenCalled();
        expect(screen.getByText(/at most 256 bytes/i)).toBeInTheDocument();
      });
    });

    it('counts bytes, not characters', async () => {
      renderModal();
      await fillName('ok-name');
      const area = screen.getByLabelText(/Description/);
      await userEvent.type(area, 'é'.repeat(128));
      expect(screen.getByText(/258 \/ 256|256 \/ 256/)).toBeInTheDocument();
    });
  });

  it('shows an inline name error on 409 conflict', async () => {
    vi.mocked(robotsApi.createRobot).mockRejectedValue(
      apiError(409, 'Robot already exists')
    );

    renderModal();
    await fillName('ci-runner');
    await userEvent.click(screen.getByRole('button', { name: 'Create Robot' }));

    await waitFor(() => {
      expect(screen.getByText('Robot already exists')).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows an inline groups error on 400 unknown group', async () => {
    vi.mocked(robotsApi.createRobot).mockRejectedValue(
      apiError(400, 'Unknown group: ghost')
    );

    renderModal();
    await fillName('ci-runner');
    await userEvent.click(screen.getByRole('button', { name: 'Create Robot' }));

    await waitFor(() => {
      expect(screen.getByText('Unknown group: ghost')).toBeInTheDocument();
    });
  });

  it('creates the robot, issues a token when requested, and passes the token to the parent', async () => {
    renderModal();
    await fillName('ci-runner');
    await userEvent.click(screen.getByLabelText('Issue a token now'));
    await userEvent.click(screen.getByRole('button', { name: 'Create Robot' }));

    await waitFor(() => {
      expect(robotsApi.createRobot).toHaveBeenCalledWith({
        name: 'ci-runner',
        description: undefined,
        groups: undefined,
      });
    });
    expect(robotsApi.issueRobotToken).toHaveBeenCalledWith('ci-runner');
    expect(onTokenIssued).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok', tokenId: 'tid' }),
      'ci-runner'
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(mockShowWarning).not.toHaveBeenCalled();
  });

  it('warns (without failing) when the robot is created but token issue fails', async () => {
    vi.mocked(robotsApi.issueRobotToken).mockRejectedValue(apiError(500, 'nope'));

    renderModal();
    await fillName('ci-runner');
    await userEvent.click(screen.getByLabelText('Issue a token now'));
    await userEvent.click(screen.getByRole('button', { name: 'Create Robot' }));

    await waitFor(() => {
      expect(mockShowWarning).toHaveBeenCalled();
    });
    expect(onTokenIssued).not.toHaveBeenCalled();
    // The robot was still created successfully
    expect(onSuccess).toHaveBeenCalled();
  });

  it('warns that no groups means no cluster access', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/No groups = no cluster access/i)).toBeInTheDocument();
    });
  });
});
