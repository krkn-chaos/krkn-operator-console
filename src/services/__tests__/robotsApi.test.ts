import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RobotDetails, ListRobotsResponse, IssueRobotTokenResponse } from '../../types/api';

// Mock BaseApiClient's fetchJson / fetchNoContent methods - must be declared before mock
const mockFetchJson = vi.fn();
const mockFetchNoContent = vi.fn();

vi.mock('../../utils/apiClient', () => {
  return {
    BaseApiClient: class {
      protected baseUrl: string;
      constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
      }
      protected fetchJson(...args: unknown[]) {
        return mockFetchJson(...args);
      }
      protected fetchNoContent(...args: unknown[]) {
        return mockFetchNoContent(...args);
      }
    },
  };
});

// Import after mocking
const { robotsApi } = await import('../robotsApi');

const baseRobot: RobotDetails = {
  name: 'ci-runner',
  description: 'CI pipeline robot',
  disabled: false,
  groups: ['dev-team'],
  tokenId: 'tok-123',
  createdAt: '2026-11-01T00:00:00Z',
};

describe('robotsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listRobots', () => {
    it('should GET /robots and return the full response', async () => {
      const mockResponse: ListRobotsResponse = {
        robots: [baseRobot],
        total: 1,
        mcpEnabled: true,
      };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await robotsApi.listRobots();

      expect(mockFetchJson).toHaveBeenCalledWith('/robots');
      expect(result).toEqual(mockResponse);
    });

    it('should reject with ApiError status and server message on 403', async () => {
      const err = new Error('Admin access required') as Error & { status: number };
      err.status = 403;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.listRobots()).rejects.toMatchObject({
        status: 403,
        message: 'Admin access required',
      });
    });

    it('should reject on 500 server error', async () => {
      const err = new Error('Internal server error') as Error & { status: number };
      err.status = 500;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.listRobots()).rejects.toMatchObject({ status: 500 });
    });
  });

  describe('getRobot', () => {
    it('should GET /robots/{name}', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      const result = await robotsApi.getRobot('ci-runner');

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci-runner');
      expect(result).toEqual(baseRobot);
    });

    it('should URL-encode the robot name', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      await robotsApi.getRobot('ci runner+1');

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci%20runner%2B1');
    });

    it('should reject with 404 when robot not found', async () => {
      const err = new Error('Robot not found') as Error & { status: number };
      err.status = 404;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.getRobot('nope')).rejects.toMatchObject({
        status: 404,
        message: 'Robot not found',
      });
    });
  });

  describe('createRobot', () => {
    it('should POST /robots with the request body', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      const result = await robotsApi.createRobot({
        name: 'ci-runner',
        description: 'CI pipeline robot',
        groups: ['dev-team'],
      });

      expect(mockFetchJson).toHaveBeenCalledWith('/robots', {
        method: 'POST',
        body: JSON.stringify({
          name: 'ci-runner',
          description: 'CI pipeline robot',
          groups: ['dev-team'],
        }),
      });
      expect(result).toEqual(baseRobot);
    });

    it('should reject with 409 when robot already exists', async () => {
      const err = new Error('Robot already exists') as Error & { status: number };
      err.status = 409;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.createRobot({ name: 'ci-runner' })).rejects.toMatchObject({
        status: 409,
        message: 'Robot already exists',
      });
    });

    it('should reject with 400 on invalid body', async () => {
      const err = new Error('Invalid robot name') as Error & { status: number };
      err.status = 400;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.createRobot({ name: '' })).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('updateRobot', () => {
    it('should PATCH /robots/{name} with only the provided keys', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      await robotsApi.updateRobot('ci-runner', { description: 'New description' });

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci-runner', {
        method: 'PATCH',
        body: JSON.stringify({ description: 'New description' }),
      });
    });

    it('should send only disabled when only disabled is provided', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      await robotsApi.updateRobot('ci-runner', { disabled: true });

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci-runner', {
        method: 'PATCH',
        body: JSON.stringify({ disabled: true }),
      });
    });

    it('should send only groups when only groups is provided ([] clears)', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      await robotsApi.updateRobot('ci-runner', { groups: [] });

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci-runner', {
        method: 'PATCH',
        body: JSON.stringify({ groups: [] }),
      });
    });

    it('should send all provided keys together', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      await robotsApi.updateRobot('ci-runner', {
        description: 'x',
        disabled: true,
        groups: ['a', 'b'],
      });

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci-runner', {
        method: 'PATCH',
        body: JSON.stringify({ description: 'x', disabled: true, groups: ['a', 'b'] }),
      });
    });

    it('should URL-encode the robot name', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      await robotsApi.updateRobot('ci runner', { disabled: false });

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci%20runner', {
        method: 'PATCH',
        body: JSON.stringify({ disabled: false }),
      });
    });

    it('should reject with 404 when robot not found', async () => {
      const err = new Error('Robot not found') as Error & { status: number };
      err.status = 404;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.updateRobot('nope', { disabled: true })).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should reject with 409 on conflict', async () => {
      const err = new Error('Conflict') as Error & { status: number };
      err.status = 409;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.updateRobot('ci-runner', { groups: ['x'] })).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('setRobotDisabled', () => {
    it('should PATCH only the disabled flag', async () => {
      mockFetchJson.mockResolvedValue({ ...baseRobot, disabled: true });

      const result = await robotsApi.setRobotDisabled('ci-runner', true);

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci-runner', {
        method: 'PATCH',
        body: JSON.stringify({ disabled: true }),
      });
      expect(result.disabled).toBe(true);
    });
  });

  describe('setRobotGroups', () => {
    it('should PATCH only the groups array', async () => {
      mockFetchJson.mockResolvedValue(baseRobot);

      await robotsApi.setRobotGroups('ci-runner', ['qa-team']);

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci-runner', {
        method: 'PATCH',
        body: JSON.stringify({ groups: ['qa-team'] }),
      });
    });
  });

  describe('deleteRobot', () => {
    it('should DELETE /robots/{name} via fetchNoContent and resolve void on 204', async () => {
      mockFetchNoContent.mockResolvedValue(undefined);

      await expect(robotsApi.deleteRobot('ci-runner')).resolves.toBeUndefined();

      expect(mockFetchNoContent).toHaveBeenCalledWith('/robots/ci-runner', {
        method: 'DELETE',
      });
      expect(mockFetchJson).not.toHaveBeenCalled();
    });

    it('should URL-encode the robot name', async () => {
      mockFetchNoContent.mockResolvedValue(undefined);

      await robotsApi.deleteRobot('ci runner+1');

      expect(mockFetchNoContent).toHaveBeenCalledWith('/robots/ci%20runner%2B1', {
        method: 'DELETE',
      });
    });

    it('should reject with 404 when robot not found', async () => {
      const err = new Error('Robot not found') as Error & { status: number };
      err.status = 404;
      mockFetchNoContent.mockRejectedValue(err);

      await expect(robotsApi.deleteRobot('nope')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('issueRobotToken', () => {
    it('should POST /robots/{name}/token with no body', async () => {
      const mockResponse: IssueRobotTokenResponse = {
        token: 'krkn_robot_demo.PREVIEW-NOT-A-REAL-TOKEN',
        tokenId: 'tok-456',
        expiresAt: '2027-01-01T00:00:00Z',
        message: 'Token issued — save it now, it will not be shown again',
      };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await robotsApi.issueRobotToken('ci-runner');

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci-runner/token', {
        method: 'POST',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should URL-encode the robot name', async () => {
      mockFetchJson.mockResolvedValue({
        token: 't',
        tokenId: 't1',
        expiresAt: '2027-01-01T00:00:00Z',
        message: 'ok',
      });

      await robotsApi.issueRobotToken('ci runner');

      expect(mockFetchJson).toHaveBeenCalledWith('/robots/ci%20runner/token', {
        method: 'POST',
      });
    });

    it('should reject with 409 when robot is disabled', async () => {
      const err = new Error('Robot is disabled') as Error & { status: number };
      err.status = 409;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.issueRobotToken('ci-runner')).rejects.toMatchObject({
        status: 409,
        message: 'Robot is disabled',
      });
    });

    it('should reject with 404 when robot not found', async () => {
      const err = new Error('Robot not found') as Error & { status: number };
      err.status = 404;
      mockFetchJson.mockRejectedValue(err);

      await expect(robotsApi.issueRobotToken('nope')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('revokeRobotToken', () => {
    it('should DELETE /robots/{name}/token via fetchNoContent and resolve void on 204', async () => {
      mockFetchNoContent.mockResolvedValue(undefined);

      await expect(robotsApi.revokeRobotToken('ci-runner')).resolves.toBeUndefined();

      expect(mockFetchNoContent).toHaveBeenCalledWith('/robots/ci-runner/token', {
        method: 'DELETE',
      });
      expect(mockFetchJson).not.toHaveBeenCalled();
    });

    it('should URL-encode the robot name', async () => {
      mockFetchNoContent.mockResolvedValue(undefined);

      await robotsApi.revokeRobotToken('ci runner');

      expect(mockFetchNoContent).toHaveBeenCalledWith('/robots/ci%20runner/token', {
        method: 'DELETE',
      });
    });

    it('should reject with 404 when robot not found', async () => {
      const err = new Error('Robot not found') as Error & { status: number };
      err.status = 404;
      mockFetchNoContent.mockRejectedValue(err);

      await expect(robotsApi.revokeRobotToken('nope')).rejects.toMatchObject({ status: 404 });
    });
  });
});
