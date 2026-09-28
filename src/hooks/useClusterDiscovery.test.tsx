import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateTargetResponse } from '../types/api';
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
