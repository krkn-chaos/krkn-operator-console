import { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { graphRunsApi } from '../services';
import type { GraphRunState, GraphRunListItem } from '../types/api';

/**
 * Hook to poll graph runs for status updates
 * - Fetches full list once per interval (5s), not per active run
 * - Skips polling for completed runs (Completed, Failed, PartiallyFailed)
 * - Skips polling for runs with expanded accordion (pausedGraphPollingIds)
 */
export function useGraphRunsPoller() {
  const { state, dispatch } = useAppContext();

  // Use refs to always access fresh state values inside interval closure
  const graphRunsRef = useRef(state.graphRuns);
  const pausedGraphPollingIdsRef = useRef(state.pausedGraphPollingIds);
  graphRunsRef.current = state.graphRuns;
  pausedGraphPollingIdsRef.current = state.pausedGraphPollingIds;

  useEffect(() => {
    const intervalId = setInterval(async () => {
      // Filter active runs dynamically inside the interval (not in deps)
      const activeRuns = graphRunsRef.current.filter(
        (run) => !['Completed', 'PartiallyFailed', 'Failed'].includes(run.phase) &&
        !pausedGraphPollingIdsRef.current.has(run.name)
      );

      if (activeRuns.length === 0) {
        return;
      }

      try {
        // Fetch list once for all active runs (not N times!)
        const graphRuns = await graphRunsApi.listGraphRuns();

        // Process each active run
        for (const run of activeRuns) {
          const updated = graphRuns.find((gr: GraphRunListItem) => gr.name === run.name);

          if (!updated) {
            // Graph run was deleted
            dispatch({
              type: 'DELETE_GRAPH_RUN',
              payload: { graphRunName: run.name },
            });
            continue;
          }

          const updatedState: GraphRunState = {
            name: updated.name,
            namespace: updated.namespace,
            creationTimestamp: updated.creationTimestamp,
            phase: updated.phase,
            ownerUserId: updated.ownerUserId,
            targetRequestId: updated.targetRequestId,
            summary: updated.summary,
            startTime: updated.startTime,
            completionTime: updated.completionTime,
          };

          // Only update if there are changes
          if (hasChanges(run, updatedState)) {
            dispatch({
              type: 'UPDATE_GRAPH_RUN',
              payload: { run: updatedState },
            });
          }
        }
      } catch (error) {
        // Silently handle error - continue polling
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [dispatch]);
}

/**
 * Check if GraphRunState has meaningful changes
 */
function hasChanges(old: GraphRunState, updated: GraphRunState): boolean {
  return (
    old.phase !== updated.phase ||
    old.summary.completedNodes !== updated.summary.completedNodes ||
    old.summary.runningNodes !== updated.summary.runningNodes ||
    old.summary.failedNodes !== updated.summary.failedNodes ||
    old.summary.pendingNodes !== updated.summary.pendingNodes ||
    old.startTime !== updated.startTime ||
    old.completionTime !== updated.completionTime
  );
}
