import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { operatorApi } from '../operatorApi';
import type { UnifiedJobsResponse } from '../../types/api';

const mockFetch = vi.fn();

describe('OperatorApi - listUnifiedJobs', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  const mockResponse: UnifiedJobsResponse = {
    jobs: [
      {
        type: 'scenarioRun',
        name: 'run-001',
        createdAt: '2026-08-01T10:00:00Z',
        scenarioRun: {
          scenarioRunName: 'run-001',
          phase: 'Running',
          totalTargets: 2,
          successfulJobs: 0,
          failedJobs: 0,
          runningJobs: 2,
          clusterJobs: [],
        },
      },
      {
        type: 'graphRun',
        name: 'graph-001',
        createdAt: '2026-08-01T09:00:00Z',
      },
    ],
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  };

  it('should fetch jobs with pagination params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await operatorApi.listUnifiedJobs(1, 20);

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v2/jobs');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
  });

  it('should fetch all jobs when no pagination params provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await operatorApi.listUnifiedJobs();

    expect(result).toEqual(mockResponse);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v2/jobs');
    expect(url).not.toContain('page=');
    expect(url).not.toContain('limit=');
  });

  it('should return empty response on 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Not Found' }),
    });

    const result = await operatorApi.listUnifiedJobs(1, 20);

    expect(result.jobs).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('should throw on non-404 errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'Database error' }),
    });

    await expect(operatorApi.listUnifiedJobs(1, 20)).rejects.toThrow('Database error');
  });
});
