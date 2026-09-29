import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../operatorApi';

const mockFetch = vi.fn();

describe('OperatorApi - resiliency history query', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts category and cluster filters to the authenticated v2 endpoint', async () => {
    const response = {
      clusters: {
        'cluster-a': {
          resilience: [{
            date: '2026-09-29T10:00:00Z',
            runId: 'run-1',
            runType: 'scenario-runs',
            score: 0,
            configurationGroupId: 'config-1',
          }],
        },
      },
      configurationGroups: {
        resilience: { 'config-1': { runType: 'scenario-runs', representativeRunId: 'run-1' } },
      },
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => response });

    await expect(operatorApi.queryResiliencyHistory({
      categories: ['resilience'],
      clusters: ['cluster-a'],
    })).resolves.toEqual(response);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v2/resiliency-history',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ categories: ['resilience'], clusters: ['cluster-a'] }),
        headers: expect.anything(),
      }),
    );
  });

  it('surfaces query errors from the v2 API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'The selected category is not visible' }),
    });

    await expect(operatorApi.queryResiliencyHistory({
      categories: ['private'],
      clusters: ['cluster-a'],
    })).rejects.toThrow('The selected category is not visible');
  });
});
