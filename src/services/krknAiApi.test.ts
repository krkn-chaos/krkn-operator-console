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

  it('requests cancellation without using the destructive delete route', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 202, statusText: 'Accepted' });

    await expect(krknAiApi.cancelRun('run / with spaces')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      `${config.apiBaseUrl}/krkn-ai/runs/run%20%2F%20with%20spaces/cancel`,
      expect.objectContaining({ method: 'POST', headers: expect.any(Headers) }),
    );
  });

  it('surfaces cancellation conflicts', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: vi.fn().mockResolvedValue({ message: 'Run is already complete' }),
    });

    await expect(krknAiApi.cancelRun('completed-run')).rejects.toMatchObject({
      message: 'Run is already complete',
      status: 409,
    });
  });

  it('reads archived log text through the parent run artifact route', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('archived line\\n'),
    });

    await expect(krknAiApi.getRunFile('parent run', 'logs/scenario 1.log')).resolves.toBe('archived line\\n');
    expect(mockFetch).toHaveBeenCalledWith(
      `${config.apiBaseUrl}/krkn-ai/runs/parent%20run/files/logs/scenario%201.log`,
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
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
    const timeoutAssertion = expect(pending).rejects.toThrow('Component discovery timed out after 390 seconds.');
    await vi.advanceTimersByTimeAsync(389_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

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
describe('Krkn-AI private registry request context', () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  const registryContext = {
    registryName: 'private-registry',
  };

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends registry metadata on discovery, validation, and run creation without changing YAML', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ configYaml: 'scenario: {}', warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        metadata: { name: 'private-run', uid: 'private-run-uid', creationTimestamp: '2026-11-12T00:00:00Z' },
        spec: { targetRequestId: 'target-1', targetClusters: { operator: ['cluster'] } },
        status: { phase: 'Pending' },
      }), { status: 201 }));

    const target = { targetRequestId: 'target-1', targetClusters: { operator: ['cluster'] } };
    await krknAiApi.discover({ ...target, namespacePattern: 'shop', ...registryContext });
    await krknAiApi.validateConfig('scenario: {}', registryContext);
    await krknAiApi.createRun({ ...target, ...registryContext, name: 'private-run', configId: 'config-1' });

    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
      ...target,
      namespacePattern: 'shop',
      registryName: 'private-registry',
    });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1]?.body))).toEqual({
      configYaml: 'scenario: {}',
      registryName: 'private-registry',
    });
    expect(JSON.parse(String(mockFetch.mock.calls[2][1]?.body))).toEqual({
      ...target,
      registryName: 'private-registry',
      name: 'private-run',
      configId: 'config-1',
    });
    expect(JSON.parse(String(mockFetch.mock.calls[1][1]?.body)).configYaml).not.toContain('private-registry');
  });

  it('omits registry metadata on the existing public discovery path', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ configYaml: 'public: true', warnings: [] }), { status: 200 }));

    await krknAiApi.discover({ targetRequestId: 'target-1', targetClusters: {}, namespacePattern: 'shop' });

    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({
      targetRequestId: 'target-1',
      targetClusters: {},
      namespacePattern: 'shop',
    });
  });
});
