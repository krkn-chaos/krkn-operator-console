import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { operatorApi } from '../operatorApi';
import { isApiError } from '../../utils/apiClient';

const mockFetch = vi.fn();

describe('OperatorApi - deleteScenarioRun / deleteJob', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  describe('deleteScenarioRun', () => {
    it('resolves on a successful delete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await expect(operatorApi.deleteScenarioRun('run-1')).resolves.toBeUndefined();
    });

    it('throws a status-bearing ApiError recognized by isApiError on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'You do not own this scenario run' }),
      });

      let caught: unknown;
      try {
        await operatorApi.deleteScenarioRun('run-1');
      } catch (err) {
        caught = err;
      }

      expect(isApiError(caught)).toBe(true);
      expect((caught as { status: number }).status).toBe(403);
      expect((caught as Error).message).toBe('You do not own this scenario run');
    });

    it('preserves the backend message for non-403 failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'internal error validating cluster access' }),
      });

      await expect(operatorApi.deleteScenarioRun('run-1')).rejects.toThrow(
        'internal error validating cluster access',
      );
    });
  });

  describe('deleteJob', () => {
    it('resolves on a successful delete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await expect(operatorApi.deleteJob('job-1')).resolves.toBeUndefined();
    });

    it('throws a status-bearing ApiError recognized by isApiError on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'You do not own this job' }),
      });

      let caught: unknown;
      try {
        await operatorApi.deleteJob('job-1');
      } catch (err) {
        caught = err;
      }

      expect(isApiError(caught)).toBe(true);
      expect((caught as { status: number }).status).toBe(403);
      expect((caught as Error).message).toBe('You do not own this job');
    });

    it('falls back to a status-text message when the error body is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      });

      await expect(operatorApi.deleteJob('job-1')).rejects.toThrow('HTTP 502: Bad Gateway');
    });
  });
});
