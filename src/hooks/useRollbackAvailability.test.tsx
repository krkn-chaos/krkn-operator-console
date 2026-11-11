import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../services/operatorApi';
import type { RollbackAvailability } from '../types/api';
import { useRollbackAvailability } from './useRollbackAvailability';

vi.mock('../services/operatorApi', () => ({ operatorApi: { getRollbackAvailability: vi.fn() } }));

function deferred() {
  let resolve!: (value: RollbackAvailability) => void;
  const promise = new Promise<RollbackAvailability>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('useRollbackAvailability', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('waits for inspection to finish before scheduling another poll', async () => {
    const pending = deferred();
    vi.mocked(operatorApi.getRollbackAvailability).mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ jobId: 'attempt', state: 'absent' });
    const { result, unmount } = renderHook(() => useRollbackAvailability('run', ['attempt'], true));
    expect(operatorApi.getRollbackAvailability).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(operatorApi.getRollbackAvailability).toHaveBeenCalledTimes(1);

    await act(async () => { pending.resolve({ jobId: 'attempt', state: 'available', canExecute: true }); });
    expect(result.current.availability.attempt?.state).toBe('available');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(operatorApi.getRollbackAvailability).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('ignores a response from the previous run', async () => {
    const oldRun = deferred();
    vi.mocked(operatorApi.getRollbackAvailability).mockReturnValueOnce(oldRun.promise)
      .mockResolvedValueOnce({ jobId: 'attempt', state: 'absent' });
    const { result, rerender } = renderHook(({ runName }) => useRollbackAvailability(runName, ['attempt'], true), {
      initialProps: { runName: 'old-run' },
    });
    rerender({ runName: 'new-run' });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.availability.attempt?.state).toBe('absent');

    await act(async () => { oldRun.resolve({ jobId: 'attempt', state: 'available', canExecute: true }); });
    expect(result.current.availability.attempt?.state).toBe('absent');
  });
});
