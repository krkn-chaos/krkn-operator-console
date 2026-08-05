import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerMessage } from '../../types/websocket';
import type { ScenarioRunState, ScenarioRunStatusResponse } from '../../types/api';

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
