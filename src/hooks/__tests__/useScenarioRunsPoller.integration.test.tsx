import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerMessage } from '../../types/websocket';
import type { ScenarioRunState, ScenarioRunStatusResponse, ScenarioRunListResponse } from '../../types/api';

const mockDispatch = vi.fn();
let mockScenarioRuns: ScenarioRunState[] = [];

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { scenarioRuns: mockScenarioRuns, expandedRunIds: new Set<string>() },
    dispatch: mockDispatch,
  }),
}));

let capturedHandler: ((msg: ServerMessage) => void) | null = null;
const mockConnectionState = { value: 'disconnected' as string };

vi.mock('../useWebSocket', () => ({
  useWebSocket: (_id: string, _url: string, handler: (msg: ServerMessage) => void) => {
    capturedHandler = handler;
    return { connectionState: mockConnectionState.value, subscribe: vi.fn(), unsubscribe: vi.fn() };
  },
}));

vi.mock('../../services/operatorApi');
vi.mock('../../services/websocketService', () => ({
  websocketService: {
    buildResourceUrl: vi.fn(() => 'ws://localhost/api/v2/ws/runs'),
    subscribe: vi.fn(),
  },
}));

import { operatorApi } from '../../services/operatorApi';
import { useScenarioRunsPoller } from '../useScenarioRunsPoller';

function makeRunState(overrides: Partial<ScenarioRunState> = {}): ScenarioRunState {
  return {
    scenarioRunName: 'run-001',
    scenarioName: 'test-scenario',
    phase: 'Running',
    totalTargets: 2,
    successfulJobs: 0,
    failedJobs: 0,
    runningJobs: 2,
    clusterJobs: [],
    createdAt: '2025-06-15T10:00:00Z',
    ...overrides,
  };
}

function sendWsMessage(msg: ServerMessage) {
  act(() => { capturedHandler?.(msg); });
}

describe('useScenarioRunsPoller initial fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    mockScenarioRuns = [];
    mockConnectionState.value = 'connected';
  });

  it('fetches and maps ScenarioRunListResponse on connect', async () => {
    const listResponse: ScenarioRunListResponse = {
      scenarioRuns: [
        {
          scenarioRunName: 'sr-init-001',
          phase: 'Running',
          totalTargets: 2,
          successfulJobs: 1,
          failedJobs: 0,
          runningJobs: 1,
          clusterJobs: [],
          creationTimestamp: '2025-07-01T12:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    vi.mocked(operatorApi.listScenarioRuns).mockResolvedValue(listResponse);

    renderHook(() => useScenarioRunsPoller());

    await vi.waitFor(() => {
      expect(operatorApi.listScenarioRuns).toHaveBeenCalledTimes(1);
    });

    const dispatchCall = mockDispatch.mock.calls.find(
      ([a]) => a.type === 'LOAD_SCENARIO_RUNS_SUCCESS',
    );
    expect(dispatchCall).toBeDefined();
    const runs = dispatchCall![0].payload.runs as ScenarioRunState[];
    expect(runs).toHaveLength(1);
    expect(runs[0].scenarioRunName).toBe('sr-init-001');
    expect(runs[0].createdAt).toBe('2025-07-01T12:00:00Z');
  });

  it('handles empty ScenarioRunListResponse gracefully', async () => {
    vi.mocked(operatorApi.listScenarioRuns).mockResolvedValue({
      scenarioRuns: [],
    });

    renderHook(() => useScenarioRunsPoller());

    await vi.waitFor(() => {
      expect(operatorApi.listScenarioRuns).toHaveBeenCalledTimes(1);
    });

    const dispatchCall = mockDispatch.mock.calls.find(
      ([a]) => a.type === 'LOAD_SCENARIO_RUNS_SUCCESS',
    );
    expect(dispatchCall).toBeDefined();
    expect(dispatchCall![0].payload.runs).toHaveLength(0);
  });
});

describe('useScenarioRunsPoller handleMessage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    mockScenarioRuns = [];
    mockConnectionState.value = 'connected';
  });

  it('dispatches UPDATE_SCENARIO_RUN on terminal transition', () => {
    mockScenarioRuns = [makeRunState({ phase: 'Running' })];
    renderHook(() => useScenarioRunsPoller());

    sendWsMessage({
      resource: 'run',
      id: 'run-001',
      event: 'updated',
      data: { scenarioRunName: 'run-001', phase: 'Succeeded', totalTargets: 2, successfulJobs: 2, failedJobs: 0, runningJobs: 0, clusterJobs: [] },
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UPDATE_SCENARIO_RUN' }),
    );
  });

  it('triggers fetchRunDetails on terminal transition when WS has no clusterJobs', async () => {
    const restResponse: ScenarioRunStatusResponse = {
      scenarioRunName: 'run-001',
      phase: 'Running',
      totalTargets: 2,
      successfulJobs: 2,
      failedJobs: 0,
      runningJobs: 0,
      clusterJobs: [{ providerName: 'krkn', clusterName: 'c1', jobId: 'j1', podName: 'p1', phase: 'Succeeded', startTime: '' }],
    };
    vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue(restResponse);

    mockScenarioRuns = [makeRunState({ phase: 'Running' })];
    renderHook(() => useScenarioRunsPoller());

    sendWsMessage({
      resource: 'run',
      id: 'run-001',
      event: 'updated',
      data: { scenarioRunName: 'run-001', phase: 'Succeeded', totalTargets: 2, successfulJobs: 2, failedJobs: 0, runningJobs: 0, clusterJobs: [] },
    });

    await vi.waitFor(() => {
      expect(operatorApi.getScenarioRunStatus).toHaveBeenCalledWith('run-001');
    });
  });

  it('skips fetchRunDetails on terminal transition when WS already includes clusterJobs', () => {
    mockScenarioRuns = [makeRunState({ phase: 'Running' })];
    renderHook(() => useScenarioRunsPoller());

    sendWsMessage({
      resource: 'run',
      id: 'run-001',
      event: 'updated',
      data: {
        scenarioRunName: 'run-001', phase: 'Succeeded', totalTargets: 2, successfulJobs: 2, failedJobs: 0, runningJobs: 0,
        clusterJobs: [{ providerName: 'krkn', clusterName: 'c1', jobId: 'j1', podName: 'p1', phase: 'Succeeded', startTime: '' }],
      },
    });

    expect(operatorApi.getScenarioRunStatus).not.toHaveBeenCalled();
  });

  it('does not trigger duplicate REST calls on repeated terminal WS messages', () => {
    mockScenarioRuns = [makeRunState({ phase: 'Running' })];
    renderHook(() => useScenarioRunsPoller());

    const terminalMsg: ServerMessage = {
      resource: 'run',
      id: 'run-001',
      event: 'updated',
      data: { scenarioRunName: 'run-001', phase: 'Succeeded', totalTargets: 2, successfulJobs: 2, failedJobs: 0, runningJobs: 0, clusterJobs: [] },
    };

    sendWsMessage(terminalMsg);
    sendWsMessage(terminalMsg);
    sendWsMessage(terminalMsg);

    // fetchRunDetails has its own guard, plus terminalFetchDoneRef prevents re-entry
    const callCount = vi.mocked(operatorApi.getScenarioRunStatus).mock.calls.length;
    expect(callCount).toBeLessThanOrEqual(1);
  });

  it('preserves terminal phase when REST returns stale non-terminal data', async () => {
    const staleRest: ScenarioRunStatusResponse = {
      scenarioRunName: 'run-001',
      phase: 'Running',
      totalTargets: 2,
      successfulJobs: 1,
      failedJobs: 0,
      runningJobs: 1,
      clusterJobs: [{ providerName: 'krkn', clusterName: 'c1', jobId: 'j1', podName: 'p1', phase: 'Running', startTime: '' }],
    };
    vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue(staleRest);

    mockScenarioRuns = [makeRunState({ phase: 'Running' })];
    renderHook(() => useScenarioRunsPoller());

    sendWsMessage({
      resource: 'run',
      id: 'run-001',
      event: 'updated',
      data: { scenarioRunName: 'run-001', phase: 'Succeeded', totalTargets: 2, successfulJobs: 2, failedJobs: 0, runningJobs: 0, clusterJobs: [] },
    });

    await vi.waitFor(() => {
      expect(operatorApi.getScenarioRunStatus).toHaveBeenCalled();
    });

    const restDispatch = mockDispatch.mock.calls.find(
      ([action]) => action.type === 'UPDATE_SCENARIO_RUN' && action.payload.run.clusterJobs.length > 0,
    );
    expect(restDispatch).toBeDefined();
    // Terminal phase from WS is preserved, not overwritten by stale REST
    expect(restDispatch![0].payload.run.phase).toBe('Succeeded');
  });

  it('adds new run on created event', () => {
    mockScenarioRuns = [];
    renderHook(() => useScenarioRunsPoller());

    sendWsMessage({
      resource: 'run',
      id: 'new-run-001',
      event: 'created',
      data: { scenarioRunName: 'new-run-001', phase: 'Pending', totalTargets: 1, successfulJobs: 0, failedJobs: 0, runningJobs: 0, clusterJobs: [] },
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_SCENARIO_RUN',
        payload: expect.objectContaining({ run: expect.objectContaining({ scenarioRunName: 'new-run-001' }) }),
      }),
    );
  });

  it('removes run on deleted event', () => {
    mockScenarioRuns = [makeRunState()];
    renderHook(() => useScenarioRunsPoller());

    sendWsMessage({
      resource: 'run',
      id: 'run-001',
      event: 'deleted',
      data: {},
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOAD_SCENARIO_RUNS_SUCCESS' }),
    );
  });

  it('resets terminal guard after delete so re-created run can fetch again', async () => {
    vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue({
      scenarioRunName: 'run-001', phase: 'Succeeded', totalTargets: 2,
      successfulJobs: 2, failedJobs: 0, runningJobs: 0,
      clusterJobs: [{ providerName: 'krkn', clusterName: 'c1', jobId: 'j1', podName: 'p1', phase: 'Succeeded', startTime: '' }],
    });

    mockScenarioRuns = [makeRunState({ phase: 'Running' })];
    renderHook(() => useScenarioRunsPoller());

    // Terminal transition → triggers REST fetch
    sendWsMessage({
      resource: 'run', id: 'run-001', event: 'updated',
      data: { scenarioRunName: 'run-001', phase: 'Succeeded', totalTargets: 2, successfulJobs: 2, failedJobs: 0, runningJobs: 0, clusterJobs: [] },
    });
    await vi.waitFor(() => {
      expect(operatorApi.getScenarioRunStatus).toHaveBeenCalledTimes(1);
    });

    // Delete clears the guard
    sendWsMessage({ resource: 'run', id: 'run-001', event: 'deleted', data: {} });

    // Re-create with same name → terminal transition should fire again
    mockScenarioRuns = [makeRunState({ phase: 'Running', scenarioRunName: 'run-001' })];
    vi.mocked(operatorApi.getScenarioRunStatus).mockClear();

    sendWsMessage({
      resource: 'run', id: 'run-001', event: 'updated',
      data: { scenarioRunName: 'run-001', phase: 'Failed', totalTargets: 2, successfulJobs: 0, failedJobs: 2, runningJobs: 0, clusterJobs: [] },
    });

    await vi.waitFor(() => {
      expect(operatorApi.getScenarioRunStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('ignores messages for other resources', () => {
    renderHook(() => useScenarioRunsPoller());

    sendWsMessage({
      resource: 'graph-run',
      id: 'gr-001',
      event: 'updated',
      data: {},
    });

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe('useScenarioRunsPoller fetchRunDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    mockScenarioRuns = [];
    mockConnectionState.value = 'connected';
  });

  it('dispatches SET_RUN_DETAILS_LOADING true then false around fetch', async () => {
    const details: ScenarioRunStatusResponse = {
      scenarioRunName: 'run-001',
      phase: 'Running',
      totalTargets: 1,
      successfulJobs: 0,
      failedJobs: 0,
      runningJobs: 1,
      clusterJobs: [{ providerName: 'krkn', clusterName: 'c1', jobId: 'j1', podName: 'p1', phase: 'Running', startTime: '' }],
    };
    vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue(details);

    const { result } = renderHook(() => useScenarioRunsPoller());
    const base = makeRunState();

    await act(async () => {
      await result.current.fetchRunDetails('run-001', base);
    });

    const loadingCalls = mockDispatch.mock.calls.filter(
      ([a]) => a.type === 'SET_RUN_DETAILS_LOADING' && a.payload.scenarioRunName === 'run-001',
    );
    expect(loadingCalls).toHaveLength(2);
    expect(loadingCalls[0][0].payload.loading).toBe(true);
    expect(loadingCalls[1][0].payload.loading).toBe(false);
  });

  it('skips fetch when already in-flight for the same run', async () => {
    let resolveFirst: () => void;
    const blockingPromise = new Promise<ScenarioRunStatusResponse>((resolve) => {
      resolveFirst = () => resolve({
        scenarioRunName: 'run-001',
        phase: 'Running',
        totalTargets: 1,
        successfulJobs: 0,
        failedJobs: 0,
        runningJobs: 1,
        clusterJobs: [{ providerName: 'krkn', clusterName: 'c1', jobId: 'j1', podName: 'p1', phase: 'Running', startTime: '' }],
      });
    });
    vi.mocked(operatorApi.getScenarioRunStatus).mockReturnValue(blockingPromise);

    const { result } = renderHook(() => useScenarioRunsPoller());
    const base = makeRunState();

    act(() => {
      result.current.fetchRunDetails('run-001', base);
    });

    await act(async () => {
      await result.current.fetchRunDetails('run-001', base);
    });

    expect(operatorApi.getScenarioRunStatus).toHaveBeenCalledTimes(1);

    await act(async () => { resolveFirst!(); });
  });

  it('clears fetchedDetails when API returns empty clusterJobs', async () => {
    const emptyDetails: ScenarioRunStatusResponse = {
      scenarioRunName: 'run-001',
      phase: 'Running',
      totalTargets: 1,
      successfulJobs: 0,
      failedJobs: 0,
      runningJobs: 1,
      clusterJobs: [],
    };
    vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue(emptyDetails);

    const { result } = renderHook(() => useScenarioRunsPoller());
    const base = makeRunState();

    await act(async () => {
      await result.current.fetchRunDetails('run-001', base);
    });

    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UPDATE_SCENARIO_RUN' }),
    );

    vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue({
      ...emptyDetails,
      clusterJobs: [{ providerName: 'krkn', clusterName: 'c1', jobId: 'j1', podName: 'p1', phase: 'Running', startTime: '' }],
    });

    await act(async () => {
      await result.current.fetchRunDetails('run-001', base);
    });

    expect(operatorApi.getScenarioRunStatus).toHaveBeenCalledTimes(2);
  });

  it('preserves terminal phase in dispatched update', async () => {
    const details: ScenarioRunStatusResponse = {
      scenarioRunName: 'run-001',
      phase: 'Running',
      totalTargets: 1,
      successfulJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      clusterJobs: [{ providerName: 'krkn', clusterName: 'c1', jobId: 'j1', podName: 'p1', phase: 'Succeeded', startTime: '' }],
    };
    vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue(details);

    const { result } = renderHook(() => useScenarioRunsPoller());
    const base = makeRunState({ phase: 'Succeeded' });

    await act(async () => {
      await result.current.fetchRunDetails('run-001', base);
    });

    const updateCall = mockDispatch.mock.calls.find(([a]) => a.type === 'UPDATE_SCENARIO_RUN');
    expect(updateCall).toBeDefined();
    expect(updateCall![0].payload.run.phase).toBe('Succeeded');
    expect(updateCall![0].payload.run.clusterJobs).toEqual(details.clusterJobs);
  });
});
