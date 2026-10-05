import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedJobItem } from '../../types/api';
import { useKrknAIOrigins } from '../useKrknAIOrigins';

const mocks = vi.hoisted(() => ({ listRuns: vi.fn(), listScenarioRuns: vi.fn() }));
vi.mock('../../services/krknAiApi', () => ({ krknAiApi: { listRuns: mocks.listRuns } }));
vi.mock('../../services/operatorApi', () => ({ operatorApi: { listScenarioRuns: mocks.listScenarioRuns } }));

function job(name: string): UnifiedJobItem {
  return { type: 'scenarioRun', name, createdAt: '2026-09-30T10:00:00Z' };
}

function run(name: string, phase = 'Running', scenarioRunRefs?: string[]) {
  return {
    metadata: { name },
    status: { phase, ...(scenarioRunRefs === undefined ? {} : { scenarioRunRefs }) },
  };
}

function apiError(status: number, message = `HTTP ${status}`) {
  return Object.assign(new Error(message), { status });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('useKrknAIOrigins', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());
  it('skips origin lookups when the operator has Krkn-AI disabled', () => {
    const { result } = renderHook(() => useKrknAIOrigins([job('child')], false));

    expect(result.current.origins).toEqual({});
    expect(result.current.error).toBeNull();
    expect(mocks.listRuns).not.toHaveBeenCalled();
    expect(mocks.listScenarioRuns).not.toHaveBeenCalled();
  });


  it('marks only label-matched children, not similarly named manual jobs', async () => {
    mocks.listRuns.mockResolvedValue([run('ai-parent')]);
    mocks.listScenarioRuns.mockResolvedValue({ scenarioRuns: [{ scenarioRunName: 'child' }, { scenarioRunName: 'off-page' }] });
    const { result } = renderHook(() => useKrknAIOrigins([job('child'), job('ai-parent-manual')]));
    await waitFor(() => expect(result.current.origins).toEqual({ child: 'ai-parent' }));
    expect(result.current.error).toBeNull();
  });
  it('uses authoritative child references and caches an empty terminal reference list', async () => {
    mocks.listRuns.mockResolvedValueOnce([
      run('active-parent', 'Running', ['active-child']),
      run('completed-parent', 'Succeeded', []),
    ]).mockResolvedValueOnce([run('completed-parent', 'Succeeded')]);
    const { result, rerender } = renderHook(({ jobs }) => useKrknAIOrigins(jobs), {
      initialProps: { jobs: [job('active-child'), job('child-without-origin')] },
    });
    await waitFor(() => expect(result.current.origins).toEqual({ 'active-child': 'active-parent' }));
    expect(mocks.listScenarioRuns).not.toHaveBeenCalled();
    rerender({ jobs: [job('child-without-origin')] });
    await waitFor(() => expect(result.current.origins).toEqual({}));
    expect(mocks.listScenarioRuns).not.toHaveBeenCalled();
  });

  it('ignores stale page lookups after navigating to another page', async () => {
    const first = deferred<{ scenarioRuns: { scenarioRunName: string }[] }>();
    mocks.listRuns.mockResolvedValue([run('ai-parent')]);
    mocks.listScenarioRuns.mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ scenarioRuns: [{ scenarioRunName: 'second' }] });
    const { result, rerender } = renderHook(({ jobs }) => useKrknAIOrigins(jobs), { initialProps: { jobs: [job('first')] } });
    await waitFor(() => expect(mocks.listScenarioRuns).toHaveBeenCalledTimes(1));
    rerender({ jobs: [job('second')] });
    await waitFor(() => expect(result.current.origins).toEqual({ second: 'ai-parent' }));
    await act(async () => first.resolve({ scenarioRuns: [{ scenarioRunName: 'first' }] }));
    expect(result.current.origins).toEqual({ second: 'ai-parent' });
  });

  it('keeps successful mappings when another parent lookup fails', async () => {
    mocks.listRuns.mockResolvedValue([run('parent-failing'), run('parent-working')]);
    mocks.listScenarioRuns.mockImplementation((_page, _limit, { labelSelector }) => {
      if (labelSelector.endsWith('parent-failing')) return Promise.reject(apiError(500));
      return Promise.resolve({ scenarioRuns: [{ scenarioRunName: 'child-working' }] });
    });
    const { result } = renderHook(() => useKrknAIOrigins([job('child-failing'), job('child-working')]));
    await waitFor(() => expect(result.current.origins).toEqual({ 'child-working': 'parent-working' }));
    expect(result.current.error).toContain('parent-failing');
    expect(result.current.error).toContain('500');
  });

  it('reuses terminal-run child mappings when navigating to another page', async () => {
    mocks.listRuns.mockResolvedValue([run('completed-parent', 'Succeeded')]);
    mocks.listScenarioRuns.mockResolvedValue({
      scenarioRuns: [{ scenarioRunName: 'first-page-child' }, { scenarioRunName: 'second-page-child' }],
    });
    const { result, rerender } = renderHook(({ jobs }) => useKrknAIOrigins(jobs), {
      initialProps: { jobs: [job('first-page-child')] },
    });
    await waitFor(() => expect(result.current.origins).toEqual({ 'first-page-child': 'completed-parent' }));
    rerender({ jobs: [job('second-page-child')] });
    await waitFor(() => expect(result.current.origins).toEqual({ 'second-page-child': 'completed-parent' }));
    expect(mocks.listScenarioRuns).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404, 503])('does not warn when an optional origin lookup returns HTTP %s', async (status) => {
    mocks.listRuns.mockResolvedValue([run('ai-parent')]);
    mocks.listScenarioRuns.mockRejectedValue(apiError(status));
    const { result } = renderHook(() => useKrknAIOrigins([job('child')]));
    await waitFor(() => expect(mocks.listScenarioRuns).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.error).toBeNull();
  });
  it.each([403, 404, 503])('clears cached origins when run listing returns optional HTTP %s', async (status) => {
    mocks.listRuns.mockResolvedValueOnce([run('ai-parent')]).mockRejectedValueOnce(apiError(status));
    mocks.listScenarioRuns.mockResolvedValueOnce({ scenarioRuns: [{ scenarioRunName: 'child' }] });
    const { result } = renderHook(() => useKrknAIOrigins([job('child')]));
    await waitFor(() => expect(result.current.origins).toEqual({ child: 'ai-parent' }));

    await act(async () => result.current.refresh());

    await waitFor(() => {
      expect(result.current.origins).toEqual({});
      expect(result.current.error).toBeNull();
    });
    expect(mocks.listScenarioRuns).toHaveBeenCalledTimes(1);
  });

  it('surfaces a genuine transient HTTP 500 lookup failure', async () => {
    mocks.listRuns.mockResolvedValue([run('ai-parent')]);
    mocks.listScenarioRuns.mockRejectedValue(apiError(500, 'upstream request timed out'));
    const { result } = renderHook(() => useKrknAIOrigins([job('child')]));
    await waitFor(() => expect(result.current.error).toContain('upstream request timed out'));
  });

  it('clears an actionable lookup error after a successful retry', async () => {
    mocks.listRuns.mockResolvedValue([run('ai-parent')]);
    mocks.listScenarioRuns.mockRejectedValueOnce(apiError(500))
      .mockResolvedValueOnce({ scenarioRuns: [{ scenarioRunName: 'child' }] });
    const { result } = renderHook(() => useKrknAIOrigins([job('child')]));
    await waitFor(() => expect(result.current.error).toContain('500'));
    await act(async () => result.current.refresh());
    await waitFor(() => {
      expect(result.current.origins).toEqual({ child: 'ai-parent' });
      expect(result.current.error).toBeNull();
    });
  });

  it('skips only long-name hashing without WebCrypto and resolves other runs', async () => {
    vi.stubGlobal('crypto', {});
    const longName = 'a'.repeat(64);
    mocks.listRuns.mockResolvedValue([run(longName), run('ordinary-parent')]);
    mocks.listScenarioRuns.mockResolvedValue({ scenarioRuns: [{ scenarioRunName: 'ordinary-child' }] });
    const { result } = renderHook(() => useKrknAIOrigins([job('long-child'), job('ordinary-child')]));
    await waitFor(() => expect(result.current.origins).toEqual({ 'ordinary-child': 'ordinary-parent' }));
    expect(mocks.listScenarioRuns).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('limits concurrent per-run lookups to a small batch', async () => {
    const pending = Array.from({ length: 5 }, () => deferred<{ scenarioRuns: { scenarioRunName: string }[] }>());
    mocks.listRuns.mockResolvedValue(Array.from({ length: 5 }, (_, index) => run(`parent-${index}`)));
    mocks.listScenarioRuns.mockImplementation(() => pending[mocks.listScenarioRuns.mock.calls.length - 1].promise);
    const { result } = renderHook(() => useKrknAIOrigins([job('child-0')]));
    await waitFor(() => expect(mocks.listScenarioRuns).toHaveBeenCalledTimes(4));
    await act(async () => pending[0].resolve({ scenarioRuns: [{ scenarioRunName: 'child-0' }] }));
    await waitFor(() => expect(mocks.listScenarioRuns).toHaveBeenCalledTimes(5));
    for (let index = 1; index < pending.length; index += 1) {
      await act(async () => pending[index].resolve({ scenarioRuns: [] }));
    }
    await waitFor(() => expect(result.current.origins).toEqual({ 'child-0': 'parent-0' }));
  });
});
