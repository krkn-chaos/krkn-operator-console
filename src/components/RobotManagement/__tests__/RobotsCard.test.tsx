import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RobotsCard } from '../RobotsCard';
import { robotsApi } from '../../../services/robotsApi';
import { useNotifications } from '../../../hooks/useNotifications';
import type { ListRobotsResponse, RobotDetails } from '../../../types/api';

vi.mock('../../../services/robotsApi');
vi.mock('../../../hooks/useNotifications');

const TOKEN = 'krkn-robot-secret-token-value';

/** Builds an ApiError-shaped rejection the way apiClient does. */
const apiError = (status: number, message: string) =>
  Object.assign(new Error(message), { status, statusText: '' });

const now = Date.now();
const isoFromNow = (days: number) => new Date(now + days * 86400000).toISOString();

const baseRobot = (overrides: Partial<RobotDetails> = {}): RobotDetails => ({
  name: 'ci-runner',
  description: 'CI pipeline robot',
  disabled: false,
  groups: ['dev-team'],
  tokenId: 'token-1',
  tokenIssuedAt: isoFromNow(-1),
  tokenExpiresAt: isoFromNow(60),
  lastUsedAt: new Date(now).toISOString(),
  createdAt: isoFromNow(-30),
  ...overrides,
});

const listResponse = (robots: RobotDetails[], mcpEnabled = true): ListRobotsResponse => ({
  robots,
  total: robots.length,
  mcpEnabled,
});

describe('RobotsCard', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();
  const mockShowWarning = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotifications).mockReturnValue({
      showNotification: vi.fn(),
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showWarning: mockShowWarning,
      showInfo: vi.fn(),
      hideNotification: vi.fn(),
    });
  });

  it('shows a spinner while loading', () => {
    vi.mocked(robotsApi.listRobots).mockReturnValue(new Promise(() => {}));

    render(<RobotsCard />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the robot list with details', async () => {
    vi.mocked(robotsApi.listRobots).mockResolvedValue(
      listResponse([baseRobot()])
    );

    render(<RobotsCard />);

    await waitFor(() => {
      expect(screen.getByText('ci-runner')).toBeInTheDocument();
    });
    expect(screen.getByText('CI pipeline robot')).toBeInTheDocument();
    expect(screen.getByText('dev-team')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText(/within 5 min/)).toBeInTheDocument();
    expect(screen.getByText('Create robot')).toBeInTheDocument();
  });

  it('shows the persistent MCP endpoint info alert when mcpEnabled', async () => {
    vi.mocked(robotsApi.listRobots).mockResolvedValue(listResponse([]));

    render(<RobotsCard />);

    await waitFor(() => {
      expect(
        screen.getAllByText(/authenticate ONLY to the MCP endpoint/i).length
      ).toBeGreaterThan(0);
    });
    expect(screen.getByText(/cannot sign in to this console/i)).toBeInTheDocument();
  });

  it('shows a warning alert when mcpEnabled is false', async () => {
    vi.mocked(robotsApi.listRobots).mockResolvedValue(listResponse([], false));

    render(<RobotsCard />);

    await waitFor(() => {
      expect(
        screen.getAllByText(/MCP endpoint is disabled on this operator/i).length
      ).toBeGreaterThan(0);
    });
  });

  it('shows an empty state with a create action when no robots exist', async () => {
    vi.mocked(robotsApi.listRobots).mockResolvedValue(listResponse([]));

    render(<RobotsCard />);

    await waitFor(() => {
      expect(screen.getByText('No robots yet')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Create robot').length).toBeGreaterThan(0);
  });

  it('shows an error state with retry and recovers', async () => {
    vi.mocked(robotsApi.listRobots)
      .mockRejectedValueOnce(apiError(500, 'boom'))
      .mockResolvedValueOnce(listResponse([baseRobot()]));

    render(<RobotsCard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load robots')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('ci-runner')).toBeInTheDocument();
    });
  });

  it('shows the unsupported (404) empty state without retry', async () => {
    vi.mocked(robotsApi.listRobots).mockRejectedValue(apiError(404, 'not found'));

    render(<RobotsCard />);

    await waitFor(() => {
      expect(
        screen.getByText(/Robot accounts are not supported by this operator version/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  describe('kebab actions per token state', () => {
    const openKebab = async (robotName: string) => {
      await userEvent.click(screen.getByRole('button', { name: `Robot actions for ${robotName}` }));
    };

    it('shows Issue token (enabled) and hides Revoke/Rotate when the robot has no token', async () => {
      vi.mocked(robotsApi.listRobots).mockResolvedValue(
        listResponse([baseRobot({ tokenId: '', tokenExpiresAt: undefined })])
      );

      render(<RobotsCard />);
      await waitFor(() => expect(screen.getByText('ci-runner')).toBeInTheDocument());

      await openKebab('ci-runner');

      const issueItem = screen.getByText('Issue token').closest('button');
      expect(issueItem).not.toBeNull();
      expect(issueItem).toBeEnabled();
      expect(screen.queryByText('Revoke token')).not.toBeInTheDocument();
      expect(screen.queryByText('Rotate token')).not.toBeInTheDocument();
    });

    it('shows Rotate token for an active token and hides Issue', async () => {
      vi.mocked(robotsApi.listRobots).mockResolvedValue(listResponse([baseRobot()]));

      render(<RobotsCard />);
      await waitFor(() => expect(screen.getByText('ci-runner')).toBeInTheDocument());

      await openKebab('ci-runner');

      expect(screen.getByText('Rotate token')).toBeInTheDocument();
      expect(screen.queryByText('Issue token')).not.toBeInTheDocument();
      expect(screen.getByText('Revoke token')).toBeInTheDocument();
    });

    it('shows Issue token as a disabled item with tooltip when the robot is disabled', async () => {
      vi.mocked(robotsApi.listRobots).mockResolvedValue(
        listResponse([baseRobot({ disabled: true })])
      );

      render(<RobotsCard />);
      await waitFor(() => expect(screen.getByText('ci-runner')).toBeInTheDocument());

      await openKebab('ci-runner');

      const issueItem = screen.getByText('Issue token').closest('button');
      expect(issueItem).not.toBeNull();
      expect(issueItem).toBeDisabled();
      expect(screen.getByText('Revoke token')).toBeInTheDocument();
      expect(screen.queryByText('Rotate token')).not.toBeInTheDocument();
      expect(screen.getByText('Enable')).toBeInTheDocument();
    });

    it('shows Revoke when the robot has a token, hidden without one', async () => {
      vi.mocked(robotsApi.listRobots).mockResolvedValue(
        listResponse([
          baseRobot({ name: 'with-token' }),
          baseRobot({ name: 'no-token', tokenId: '', tokenExpiresAt: undefined }),
        ])
      );

      render(<RobotsCard />);
      await waitFor(() => expect(screen.getByText('with-token')).toBeInTheDocument());

      await openKebab('with-token');
      expect(screen.getByText('Revoke token')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Robot actions for with-token' }));

      await openKebab('no-token');
      expect(screen.queryByText('Revoke token')).not.toBeInTheDocument();
    });
  });

  describe('issue token flow', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
      });
    });

    it('opens the token reveal modal and never leaks the token to storage or toasts', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      vi.mocked(robotsApi.listRobots).mockResolvedValue(
        listResponse([baseRobot({ tokenId: '', tokenExpiresAt: undefined })])
      );
      vi.mocked(robotsApi.issueRobotToken).mockResolvedValue({
        token: TOKEN,
        tokenId: 'tid-1',
        expiresAt: isoFromNow(90),
        message: 'issued',
      });

      render(<RobotsCard />);
      await waitFor(() => expect(screen.getByText('ci-runner')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'Robot actions for ci-runner' }));
      await userEvent.click(screen.getByText('Issue token'));

      await waitFor(() => {
        expect(screen.getByLabelText('Robot token')).toBeInTheDocument();
      });
      expect((screen.getByLabelText('Robot token') as HTMLInputElement).value).toBe(TOKEN);

      // Success toast must never contain the token value
      expect(mockShowSuccess).toHaveBeenCalled();
      for (const call of mockShowSuccess.mock.calls) {
        expect(call.join(' ')).not.toContain(TOKEN);
      }
      // Token must never be written to web storage
      for (const call of setItemSpy.mock.calls) {
        expect(call.join(' ')).not.toContain(TOKEN);
      }
      setItemSpy.mockRestore();
    });

    it('maps action errors (403) to a friendly message', async () => {
      vi.mocked(robotsApi.listRobots).mockResolvedValue(
        listResponse([baseRobot({ tokenId: '', tokenExpiresAt: undefined })])
      );
      vi.mocked(robotsApi.issueRobotToken).mockRejectedValue(
        apiError(403, 'forbidden')
      );

      render(<RobotsCard />);
      await waitFor(() => expect(screen.getByText('ci-runner')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'Robot actions for ci-runner' }));
      await userEvent.click(screen.getByText('Issue token'));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to issue token', 'Admin privileges required');
      });
    });
  });

  describe('confirm modal actions', () => {
    it('requires typing the robot name for delete', async () => {
      vi.mocked(robotsApi.listRobots).mockResolvedValue(listResponse([baseRobot()]));

      render(<RobotsCard />);
      await waitFor(() => expect(screen.getByText('ci-runner')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'Robot actions for ci-runner' }));
      await userEvent.click(screen.getByText('Delete'));

      const confirmButton = screen.getByRole('button', { name: 'Delete robot' });
      expect(confirmButton).toBeDisabled();

      await userEvent.type(screen.getByLabelText(/Type the robot name/i), 'ci-runner');
      expect(confirmButton).toBeEnabled();
    });

    it('revokes a token after confirmation and shows an inline 404 error with refetch', async () => {
      vi.mocked(robotsApi.listRobots)
        .mockResolvedValueOnce(listResponse([baseRobot()]))
        .mockResolvedValueOnce(listResponse([]));
      vi.mocked(robotsApi.revokeRobotToken).mockRejectedValueOnce(
        apiError(404, 'gone')
      );

      render(<RobotsCard />);
      await waitFor(() => expect(screen.getByText('ci-runner')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'Robot actions for ci-runner' }));
      await userEvent.click(screen.getByText('Revoke token'));
      await userEvent.click(screen.getByRole('button', { name: 'Revoke token' }));

      await waitFor(() => {
        expect(screen.getByText('Robot no longer exists')).toBeInTheDocument();
      });
      // 404 triggers a refetch of the robot list
      await waitFor(() => {
        expect(robotsApi.listRobots).toHaveBeenCalledTimes(2);
      });
    });
  });
});
