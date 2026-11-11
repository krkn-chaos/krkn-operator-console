import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../services/operatorApi';
import { useScenariosFetch } from './useScenariosFetch';

vi.mock('../services/operatorApi', () => ({
  operatorApi: {
    getScenarios: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useScenariosFetch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ignores an old registry response after reset and a newer request', async () => {
    const oldRequest = deferred<{ scenarios: Array<{ name: string }> }>();
    const currentRequest = deferred<{ scenarios: Array<{ name: string }> }>();
    vi.mocked(operatorApi.getScenarios)
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);

    const { result } = renderHook(() => useScenariosFetch());
    let oldFetch!: Promise<void>;
    let currentFetch!: Promise<void>;

    act(() => {
      oldFetch = result.current.fetchScenarios({ registryName: 'old-registry' });
    });
    act(() => {
      result.current.resetScenarios();
      currentFetch = result.current.fetchScenarios({ registryName: 'current-registry' });
    });

    oldRequest.resolve({ scenarios: [{ name: 'old-scenario' }] });
    await act(async () => oldFetch);

    expect(result.current.loading).toBe(true);
    expect(result.current.scenarios).toEqual([]);

    currentRequest.resolve({ scenarios: [{ name: 'current-scenario' }] });
    await act(async () => currentFetch);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scenarios).toEqual([{ name: 'current-scenario' }]);
  });

  it('marks loaded true for an empty successful response', async () => {
    const request = deferred<{ scenarios: Array<{ name: string }> }>();
    vi.mocked(operatorApi.getScenarios).mockReturnValueOnce(request.promise);

    const { result } = renderHook(() => useScenariosFetch());
    expect(result.current.loaded).toBe(false);

    let fetch!: Promise<void>;
    act(() => {
      fetch = result.current.fetchScenarios({ registryName: 'empty-registry' });
    });

    request.resolve({ scenarios: [] });
    await act(async () => fetch);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scenarios).toEqual([]);
    expect(result.current.loaded).toBe(true);
  });

  it('keeps loaded false after an error and resets it on resetScenarios', async () => {
    vi.mocked(operatorApi.getScenarios).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useScenariosFetch());
    await act(async () => {
      await result.current.fetchScenarios({ registryName: 'bad-registry' });
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.loaded).toBe(false);

    act(() => result.current.resetScenarios());
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
