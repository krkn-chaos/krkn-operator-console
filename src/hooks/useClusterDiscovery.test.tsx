import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateTargetResponse } from '../types/api';
import { config } from '../config';
import { operatorApi } from '../services/operatorApi';
import { useClusterDiscovery } from './useClusterDiscovery';

vi.mock('../services/operatorApi', () => ({
  operatorApi: {
    createTargetRequest: vi.fn(),
    getTargetStatus: vi.fn(),
    getClusters: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useClusterDiscovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears loading when the target request does not include a UUID', async () => {
    vi.mocked(operatorApi.createTargetRequest).mockResolvedValueOnce({} as CreateTargetResponse);

    const { result } = renderHook(() => useClusterDiscovery());
    await act(async () => {
      await result.current.startDiscovery();
    });

    expect(result.current).toMatchObject({
      discoveryUuid: null,
      isLoading: false,
      isPolling: false,
      error: 'Target request did not return a UUID.',
    });
    expect(operatorApi.getTargetStatus).not.toHaveBeenCalled();
  });

  it('stops polling and clears loading when a target-status poll rejects', async () => {
    vi.useFakeTimers();
    vi.mocked(operatorApi.createTargetRequest).mockResolvedValueOnce({ uuid: 'target-123' });
    vi.mocked(operatorApi.getTargetStatus)
      .mockResolvedValueOnce(202)
      .mockRejectedValueOnce(new Error('Target status unavailable'));

    const { result } = renderHook(() => useClusterDiscovery());
    await act(async () => {
      await result.current.startDiscovery();
    });
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(config.pollInterval);
    });

    expect(result.current).toMatchObject({
      discoveryUuid: 'target-123',
      isLoading: false,
      isPolling: false,
      error: 'Target status unavailable',
    });
    expect(operatorApi.getTargetStatus).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(config.pollInterval * 3);
    });
    expect(operatorApi.getTargetStatus).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('treats an unexpected target status as terminal and stops polling', async () => {
    vi.useFakeTimers();
    vi.mocked(operatorApi.createTargetRequest).mockResolvedValueOnce({ uuid: 'target-456' });
    vi.mocked(operatorApi.getTargetStatus).mockResolvedValueOnce(503);

    const { result } = renderHook(() => useClusterDiscovery());
    await act(async () => {
      await result.current.startDiscovery();
    });

    expect(result.current).toMatchObject({
      discoveryUuid: 'target-456',
      isLoading: false,
      isPolling: false,
      error: 'Unexpected status: 503',
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(config.pollInterval * 3);
    });
    expect(operatorApi.getTargetStatus).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears polling when fetching clusters fails after the target is ready', async () => {
    vi.useFakeTimers();
    vi.mocked(operatorApi.createTargetRequest).mockResolvedValueOnce({ uuid: 'target-789' });
    vi.mocked(operatorApi.getTargetStatus).mockResolvedValueOnce(200);
    vi.mocked(operatorApi.getClusters).mockRejectedValueOnce(new Error('Cluster list unavailable'));

    const { result } = renderHook(() => useClusterDiscovery());
    await act(async () => {
      await result.current.startDiscovery();
    });

    expect(result.current).toMatchObject({
      discoveryUuid: 'target-789',
      isLoading: false,
      isPolling: false,
      error: 'Cluster list unavailable',
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(config.pollInterval * 3);
    });
    expect(operatorApi.getTargetStatus).toHaveBeenCalledTimes(1);
    expect(operatorApi.getClusters).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a pending target request and ignores its late response after reset', async () => {
    const pendingRequest = deferred<CreateTargetResponse>();
    let requestSignal: AbortSignal | undefined;
    vi.mocked(operatorApi.createTargetRequest).mockImplementation(({ signal } = {}) => {
      requestSignal = signal;
      return pendingRequest.promise;
    });

    const { result } = renderHook(() => useClusterDiscovery());
    let discovery: Promise<void> | undefined;
    act(() => {
      discovery = result.current.startDiscovery();
    });

    expect(result.current.isLoading).toBe(true);
    act(() => result.current.reset());
    expect(requestSignal?.aborted).toBe(true);

    await act(async () => {
      pendingRequest.resolve({ uuid: 'stale-target-request' });
      await discovery;
    });

    expect(operatorApi.getTargetStatus).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      clusters: null,
      discoveryUuid: null,
      isLoading: false,
      isPolling: false,
      error: null,
    });
  });
});
