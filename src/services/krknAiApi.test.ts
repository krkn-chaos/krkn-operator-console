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
  it('deletes an encoded run name through the existing Krkn-AI API route', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, statusText: 'No Content' });

    await expect(krknAiApi.deleteRun('run / with spaces')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      `${config.apiBaseUrl}/krkn-ai/runs/run%20%2F%20with%20spaces`,
      expect.objectContaining({ method: 'DELETE', headers: expect.any(Headers) }),
    );
  });

  it('surfaces API errors when run deletion is denied', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue({ message: 'Run cancellation is not authorized' }),
    });

    await expect(krknAiApi.deleteRun('protected-run')).rejects.toMatchObject({
      message: 'Run cancellation is not authorized',
      status: 403,
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

describe('krknAiApi.discover deadline', () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it('reports a discovery-specific timeout and clears its timer', async () => {
    let requestSignal: AbortSignal | undefined;
    mockFetch.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal;
      requestSignal = signal;
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));

    const pending = krknAiApi.discover({ targetRequestId: 'target-1', targetClusters: {}, namespacePattern: 'shop' });
    const timeoutAssertion = expect(pending).rejects.toMatchObject({ name: 'Error' });
    await vi.runOnlyPendingTimersAsync();

    await timeoutAssertion;
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears its timer after a successful response', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ configYaml: 'configuration', warnings: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(krknAiApi.discover({ targetRequestId: 'target-1', targetClusters: {}, namespacePattern: 'shop' }))
      .resolves.toEqual({ configYaml: 'configuration', warnings: [] });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears its timer after an HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Discovery unavailable' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(krknAiApi.discover({ targetRequestId: 'target-1', targetClusters: {}, namespacePattern: 'shop' }))
      .rejects.toMatchObject({ message: 'Discovery unavailable', status: 503 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates caller cancellation and clears its timer', async () => {
    mockFetch.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const caller = new AbortController();
    const reason = new DOMException('Discovery cancelled', 'AbortError');
    const removeAbortListener = vi.spyOn(caller.signal, 'removeEventListener');
    const pending = krknAiApi.discover(
      { targetRequestId: 'target-1', targetClusters: {}, namespacePattern: 'shop' },
      { signal: caller.signal },
    );
    caller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
    expect(removeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
