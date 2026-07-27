import { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import { useWebSocket } from './useWebSocket';
import { websocketService } from '../services/websocketService';
import type { ServerMessage } from '../types/websocket';
import type { ScenarioRunState, ScenarioRunStatusResponse } from '../types/api';

/**
 * Hook to receive real-time scenario run updates via WebSocket.
 * Initial list+details fetched once via REST on first connect.
 * WebSocket provides real-time status updates afterward.
 */
export function useScenarioRunsPoller() {
  const { state, dispatch } = useAppContext();

  const scenarioRunsRef = useRef(state.scenarioRuns);
  const pausedPollingRunIdsRef = useRef(state.pausedPollingRunIds);
  scenarioRunsRef.current = state.scenarioRuns;
  pausedPollingRunIdsRef.current = state.pausedPollingRunIds;

  const initialFetchDoneRef = useRef(false);
  const fetchedDetailsRef = useRef<Set<string>>(new Set());

  const fetchInitialScenarioRuns = useCallback(async () => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;

    try {
      const scenarioRuns = await operatorApi.listScenarioRuns();

      const scenarioRunStates: ScenarioRunState[] = scenarioRuns.map((run) => {
        const scenarioName = run.scenarioName || run.scenarioRunName.replace(/-[a-f0-9]{8}$/, '');
        return {
          scenarioRunName: run.scenarioRunName,
          scenarioName,
          phase: run.phase,
          totalTargets: run.totalTargets,
          successfulJobs: run.successfulJobs,
          failedJobs: run.failedJobs,
          runningJobs: run.runningJobs,
          clusterJobs: run.clusterJobs || [],
          createdAt: run.createdAt || (run.clusterJobs && run.clusterJobs[0]?.startTime) || new Date().toISOString(),
          ownerUserId: run.ownerUserId,
          registryName: run.registryName,
          graphRunName: run.graphRunName,
          graphNodeId: run.graphNodeId,
        };
      });

      dispatch({
        type: 'LOAD_SCENARIO_RUNS_SUCCESS',
        payload: { runs: scenarioRunStates },
      });

      // Fetch details for runs without clusterJobs
      const runsWithoutJobs = scenarioRunStates.filter(
        (run) => !run.clusterJobs || run.clusterJobs.length === 0
      );
      for (const run of runsWithoutJobs) {
        fetchRunDetails(run.scenarioRunName, run);
      }
    } catch {
      initialFetchDoneRef.current = false;
    }
  }, [dispatch]);

  const fetchRunDetails = useCallback(async (runName: string, base: ScenarioRunState) => {
    if (fetchedDetailsRef.current.has(runName)) return;
    fetchedDetailsRef.current.add(runName);

    try {
      const details = await operatorApi.getScenarioRunStatus(runName);
      if (!details.clusterJobs || details.clusterJobs.length === 0) {
        fetchedDetailsRef.current.delete(runName);
        return;
      }

      dispatch({
        type: 'UPDATE_SCENARIO_RUN',
        payload: {
          run: {
            ...base,
            phase: details.phase,
            totalTargets: details.totalTargets,
            successfulJobs: details.successfulJobs,
            failedJobs: details.failedJobs,
            runningJobs: details.runningJobs,
            clusterJobs: details.clusterJobs,
            ownerUserId: details.ownerUserId || base.ownerUserId,
            registryName: details.registryName || base.registryName,
            graphRunName: details.graphRunName || base.graphRunName,
            graphNodeId: details.graphNodeId || base.graphNodeId,
          },
        },
      });
    } catch {
      fetchedDetailsRef.current.delete(runName);
    }
  }, [dispatch]);

  const handleMessage = useCallback((message: ServerMessage) => {
    if (message.resource !== 'run') return;

    const data = message.data as ScenarioRunStatusResponse;
    const runName = message.id || data.scenarioRunName;

    if (pausedPollingRunIdsRef.current.has(runName)) return;

    if (message.event === 'updated' || message.event === 'created') {
      const existing = scenarioRunsRef.current.find(r => r.scenarioRunName === runName);

      const hasWsJobs = data.clusterJobs && data.clusterJobs.length > 0;

      const updatedState: ScenarioRunState = {
        scenarioRunName: data.scenarioRunName || runName,
        scenarioName: data.scenarioName || existing?.scenarioName || runName.replace(/-[a-f0-9]{8}$/, ''),
        phase: data.phase,
        totalTargets: data.totalTargets,
        successfulJobs: data.successfulJobs,
        failedJobs: data.failedJobs,
        runningJobs: data.runningJobs,
        clusterJobs: hasWsJobs ? data.clusterJobs : (existing?.clusterJobs || []),
        createdAt: existing?.createdAt || data.createdAt || new Date().toISOString(),
        ownerUserId: data.ownerUserId || existing?.ownerUserId,
        registryName: data.registryName || existing?.registryName,
        graphRunName: data.graphRunName || existing?.graphRunName,
        graphNodeId: data.graphNodeId || existing?.graphNodeId,
      };

      if (existing) {
        if (hasChanges(existing, updatedState)) {
          dispatch({ type: 'UPDATE_SCENARIO_RUN', payload: { run: updatedState } });
        }
      } else {
        dispatch({ type: 'ADD_SCENARIO_RUN', payload: { run: updatedState } });
      }

      // Fetch details if no clusterJobs from either source
      if (!hasWsJobs && (!existing || existing.clusterJobs.length === 0)) {
        fetchRunDetails(runName, updatedState);
      }
    } else if (message.event === 'deleted') {
      fetchedDetailsRef.current.delete(runName);
      dispatch({
        type: 'LOAD_SCENARIO_RUNS_SUCCESS',
        payload: { runs: scenarioRunsRef.current.filter(r => r.scenarioRunName !== runName) },
      });
    }
  }, [dispatch, fetchRunDetails]);

  const wsUrl = websocketService.buildResourceUrl('runs');
  const { connectionState } = useWebSocket('scenario-runs', wsUrl, handleMessage);

  useEffect(() => {
    if (connectionState === 'connected') {
      fetchInitialScenarioRuns();
      websocketService.subscribe('scenario-runs', 'run');
    }
  }, [connectionState, fetchInitialScenarioRuns]);

  // Periodically re-fetch details for expanded runs that are still active.
  // Keeps clusterJob phases up-to-date until the per-run detail WebSocket is implemented.
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const intervalId = setInterval(() => {
      const expandedIds = state.expandedRunIds;
      const runs = scenarioRunsRef.current;

      for (const runName of expandedIds) {
        const run = runs.find(r => r.scenarioRunName === runName);
        if (!run) continue;
        if (['Succeeded', 'Failed', 'PartiallyFailed'].includes(run.phase)) continue;

        fetchedDetailsRef.current.delete(runName);
        fetchRunDetails(runName, run);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [connectionState, state.expandedRunIds, fetchRunDetails]);

  // Handle manual refresh trigger (for paused runs with explicit refresh button)
  useEffect(() => {
    if (state.scenarioRunsRefreshTrigger === 0) return;

    const runToRefresh = state.scenarioRunToRefresh;
    if (!runToRefresh) return;

    const run = state.scenarioRuns.find(r => r.scenarioRunName === runToRefresh);
    if (!run) return;

    if (!state.pausedPollingRunIds.has(runToRefresh) ||
        ['Succeeded', 'PartiallyFailed', 'Failed'].includes(run.phase)) {
      return;
    }

    (async () => {
      try {
        const updated = await operatorApi.getScenarioRunStatus(runToRefresh);

        const updatedState: ScenarioRunState = {
          scenarioRunName: updated.scenarioRunName,
          scenarioName: run.scenarioName,
          phase: updated.phase,
          totalTargets: updated.totalTargets,
          successfulJobs: updated.successfulJobs,
          failedJobs: updated.failedJobs,
          runningJobs: updated.runningJobs,
          clusterJobs: updated.clusterJobs || run.clusterJobs || [],
          createdAt: run.createdAt,
          ownerUserId: updated.ownerUserId || run.ownerUserId,
          registryName: updated.registryName || run.registryName,
          graphRunName: updated.graphRunName || run.graphRunName,
          graphNodeId: updated.graphNodeId || run.graphNodeId,
        };

        if (hasChanges(run, updatedState)) {
          dispatch({ type: 'UPDATE_SCENARIO_RUN', payload: { run: updatedState } });
        }
      } catch {
        // Silently handle error
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scenarioRunsRefreshTrigger, dispatch]);
}

function hasChanges(prev: ScenarioRunState, next: ScenarioRunState): boolean {
  if (prev.phase !== next.phase) return true;
  if (prev.runningJobs !== next.runningJobs) return true;
  if (prev.successfulJobs !== next.successfulJobs) return true;
  if (prev.failedJobs !== next.failedJobs) return true;

  if (prev.clusterJobs.length !== next.clusterJobs.length) return true;

  for (let i = 0; i < prev.clusterJobs.length; i++) {
    const prevJob = prev.clusterJobs[i];
    const nextJob = next.clusterJobs.find(j => j.clusterName === prevJob.clusterName);
    if (!nextJob || prevJob.phase !== nextJob.phase) return true;
  }

  return false;
}
