import { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import type { ScenarioRunState } from '../types/api';

/**
 * Hook to poll scenario runs for status updates (HYBRID POLLING STRATEGY)
 * - Polls each active scenario run individually
 * - useTargetPoller handles initial load via list API
 * - This handles ongoing updates for only active runs
 */
export function useScenarioRunsPoller() {
  const { state, dispatch } = useAppContext();

  // Use refs to always access fresh state values inside interval closure
  const scenarioRunsRef = useRef(state.scenarioRuns);
  const pausedPollingRunIdsRef = useRef(state.pausedPollingRunIds);
  scenarioRunsRef.current = state.scenarioRuns;
  pausedPollingRunIdsRef.current = state.pausedPollingRunIds;

  useEffect(() => {
    const intervalId = setInterval(async () => {
      // Filter active runs dynamically inside the interval (not in deps)
      const activeRuns = scenarioRunsRef.current.filter(
        (run) => !['Succeeded', 'PartiallyFailed', 'Failed'].includes(run.phase) &&
        !pausedPollingRunIdsRef.current.has(run.scenarioRunName)
      );

      if (activeRuns.length === 0) {
        return;
      }

      for (const run of activeRuns) {
        try {
          const updated = await operatorApi.getScenarioRunStatus(run.scenarioRunName);

          const updatedState: ScenarioRunState = {
            scenarioRunName: updated.scenarioRunName,
            scenarioName: run.scenarioName,
            phase: updated.phase,
            totalTargets: updated.totalTargets,
            successfulJobs: updated.successfulJobs,
            failedJobs: updated.failedJobs,
            runningJobs: updated.runningJobs,
            clusterJobs: updated.clusterJobs || [],
            createdAt: run.createdAt,
            ownerUserId: updated.ownerUserId || run.ownerUserId,
          };

          // Only update if there are changes
          if (hasChanges(run, updatedState)) {
            dispatch({
              type: 'UPDATE_SCENARIO_RUN',
              payload: { run: updatedState },
            });
          }
        } catch (error) {
          // Silently handle error
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [dispatch]);

  // Handle manual refresh trigger
  useEffect(() => {
    // This effect runs when scenarioRunsRefreshTrigger changes
    // Used for manual refresh of specific paused run
    if (state.scenarioRunsRefreshTrigger === 0) {
      return; // Skip initial render
    }

    // Find the specific run to refresh
    const runToRefresh = state.scenarioRunToRefresh;
    if (!runToRefresh) {
      return;
    }

    const run = state.scenarioRuns.find(r => r.scenarioRunName === runToRefresh);
    if (!run) {
      return;
    }

    // Only refresh if it's paused and not in terminal state
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
          clusterJobs: updated.clusterJobs || [],
          createdAt: run.createdAt,
          ownerUserId: updated.ownerUserId || run.ownerUserId,
        };

        if (hasChanges(run, updatedState)) {
          dispatch({
            type: 'UPDATE_SCENARIO_RUN',
            payload: { run: updatedState },
          });
        }
      } catch (error) {
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

  // Check cluster job phase changes
  for (let i = 0; i < prev.clusterJobs.length; i++) {
    const prevJob = prev.clusterJobs[i];
    const nextJob = next.clusterJobs.find(j => j.clusterName === prevJob.clusterName);
    if (!nextJob || prevJob.phase !== nextJob.phase) return true;
  }

  return false;
}
