import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedJobItem } from '../../types/api';
import { useKrknAIOrigins } from '../useKrknAIOrigins';

const mocks = vi.hoisted(() => ({ listRuns: vi.fn(), listScenarioRuns: vi.fn() }));
vi.mock('../../services/krknAiApi', () => ({ krknAiApi: { listRuns: mocks.listRuns } }));
vi.mock('../../services/operatorApi', () => ({ operatorApi: { listScenarioRuns: mocks.listScenarioRuns } }));

function job(name: string): UnifiedJobItem {
  return { type: 'scenarioRun', name, createdAt: '2026-09-30T10:00:00Z' };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('useKrknAIOrigins', () => {
  beforeEach(() => vi.resetAllMocks());

  it('marks only label-matched children, not similarly named manual jobs', async () => {
    mocks.listRuns.mockResolvedValue([{ metadata: { name: 'ai-parent' } }]);
    mocks.listScenarioRuns.mockResolvedValue({ scenarioRuns: [{ scenarioRunName: 'child' }, { scenarioRunName: 'off-page' }] });
    const { result } = renderHook(() => useKrknAIOrigins([job('child'), job('ai-parent-manual')]));
    await waitFor(() => expect(result.current.origins).toEqual({ child: 'ai-parent' }));
    expect(result.current.error).toBeNull();
  });

  it('ignores stale page lookups after navigating to another page', async () => {
    const first = deferred<{ scenarioRuns: { scenarioRunName: string }[] }>();
    mocks.listRuns.mockResolvedValue([{ metadata: { name: 'ai-parent' } }]);
    mocks.listScenarioRuns.mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ scenarioRuns: [{ scenarioRunName: 'second' }] });
    const { result, rerender } = renderHook(({ jobs }) => useKrknAIOrigins(jobs), { initialProps: { jobs: [job('first')] } });
    await waitFor(() => expect(mocks.listScenarioRuns).toHaveBeenCalledTimes(1));
    rerender({ jobs: [job('second')] });
    await waitFor(() => expect(result.current.origins).toEqual({ second: 'ai-parent' }));
    await act(async () => first.resolve({ scenarioRuns: [{ scenarioRunName: 'first' }] }));
    expect(result.current.origins).toEqual({ second: 'ai-parent' });
  });
});
