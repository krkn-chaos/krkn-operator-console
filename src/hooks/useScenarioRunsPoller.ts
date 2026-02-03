import { useEffect } from 'react';
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

  useEffect(() => {
    // Filter only active scenario runs
    const activeRuns = state.scenarioRuns.filter(
      (run) => !['Succeeded', 'PartiallyFailed', 'Failed'].includes(run.phase)
    );

    console.log('All scenario runs:', state.scenarioRuns);
    console.log('Active runs to poll:', activeRuns);

    if (activeRuns.length === 0) {
      console.log('No active runs to poll');
      return;
    }

    console.log(`Polling ${activeRuns.length} active scenario runs...`);

    const intervalId = setInterval(async () => {
      for (const run of activeRuns) {
        try {
          console.log(`Polling scenario run: ${run.scenarioRunName}`);
          const updated = await operatorApi.getScenarioRunStatus(run.scenarioRunName);
          console.log(`Received update for ${run.scenarioRunName}:`, updated);

          const updatedState: ScenarioRunState = {
            scenarioRunName: updated.scenarioRunName,
            scenarioName: run.scenarioName, // Keep from original
            phase: updated.phase,
            totalTargets: updated.totalTargets,
            successfulJobs: updated.successfulJobs,
            failedJobs: updated.failedJobs,
            runningJobs: updated.runningJobs,
            clusterJobs: updated.clusterJobs || [], // Fallback
            createdAt: run.createdAt,
          };

          // Only update if there are changes
          if (hasChanges(run, updatedState)) {
            dispatch({
              type: 'UPDATE_SCENARIO_RUN',
              payload: { run: updatedState },
            });
          }
        } catch (error) {
          console.error(`Failed to poll scenario run ${run.scenarioRunName}:`, error);
        }
      }
    }, 5000); // Poll every 5 seconds (per spec)

    return () => {
      console.log('Stopping scenario run polling');
      clearInterval(intervalId);
    };
  }, [state.scenarioRuns, dispatch]);
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
