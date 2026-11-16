import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScenarioRunsPoller } from '../useScenarioRunsPoller';
import { operatorApi } from '../../services/operatorApi';
import type { ScenarioRunState } from '../../types/api';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { scenarioRuns: [], expandedRunIds: new Set<string>() },
    dispatch: mocks.dispatch,
  }),
}));
vi.mock('../../services/operatorApi', () => ({
  operatorApi: { getScenarioRunStatus: vi.fn() },
}));
vi.mock('../useWebSocket', () => ({
  useWebSocket: () => ({ connectionState: 'disconnected' }),
}));
vi.mock('../../services/websocketService', () => ({
  websocketService: { buildResourceUrl: () => 'ws://localhost/runs' },
}));

describe('scenario run detail updates', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['Running', 'Cancelled'] as const)(
    'retains cancellation counts and rollback metadata when a %s run receives details',
    async (phase) => {
      const base: ScenarioRunState = {
        scenarioRunName: 'run-1',
        scenarioName: 'pod-scenarios',
        phase,
        totalTargets: 2,
        successfulJobs: 0,
        failedJobs: 0,
        cancelledJobs: 0,
        runningJobs: 0,
        clusterJobs: [],
        createdAt: '2026-11-12T00:00:00Z',
      };
      const clusterJobs = [{
        providerName: 'krkn-operator',
        clusterName: 'cluster-1',
        jobId: 'job-1',
        podName: 'pod-1',
        phase: 'Cancelled' as const,
      }];
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue({
        ...base,
        phase: 'Running',
        cancelledJobs: 1,
        rollbackEnabled: true,
        isRollback: false,
        clusterJobs,
      });
      const { result } = renderHook(() => useScenarioRunsPoller());

      await act(() => result.current.fetchRunDetails(base.scenarioRunName, base));

      expect(mocks.dispatch).toHaveBeenCalledWith({
        type: 'UPDATE_SCENARIO_RUN',
        payload: {
          run: expect.objectContaining({
            phase,
            cancelledJobs: 1,
            rollbackEnabled: true,
            isRollback: false,
            clusterJobs,
          }),
        },
      });
    },
  );
});
