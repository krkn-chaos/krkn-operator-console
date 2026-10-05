import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import { krknAiApi } from './krknAiApi';

describe('krknAiApi.downloadResults', () => {
  const originalFetch = global.fetch;
  let mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('encodes the run name in the download URL and returns the response Blob', async () => {
    const archive = new Blob(['complete run archive'], { type: 'application/zip' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      blob: vi.fn().mockResolvedValue(archive),
    });

    const result = await krknAiApi.downloadResults('run / with spaces');

    expect(mockFetch).toHaveBeenCalledWith(
      `${config.apiBaseUrl}/krkn-ai/runs/run%20%2F%20with%20spaces/results/download`,
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(result).toBe(archive);
  });

  it('reports a non-OK download response as an HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: vi.fn().mockResolvedValue({ message: 'Archive service unavailable' }),
    });

    await expect(krknAiApi.downloadResults('failed-run')).rejects.toMatchObject({
      message: 'Archive service unavailable',
      status: 503,
      statusText: 'Service Unavailable',
    });
  });
});
describe('krknAiApi.getStatus', () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reads the operator feature flag without requesting a run resource', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ enabled: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(krknAiApi.getStatus()).resolves.toEqual({ enabled: false });
    expect(mockFetch).toHaveBeenCalledWith(
      `${config.apiBaseUrl}/krkn-ai/status`,
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });
});
