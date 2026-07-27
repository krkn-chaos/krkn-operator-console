import { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import { config } from '../config';

/**
 * Custom hook to manage the target polling workflow
 *
 * Workflow (new multi-target flow):
 * 1. App starts → jobs_list (no target creation)
 * 2. User clicks "Create Job" → POST /targets (via App.tsx)
 * 3. Poll GET /targets/{UUID} until 200 OK → selecting_clusters
 * 4. GET /clusters?id={UUID}
 * 5. User selects N clusters → create N target UUIDs
 */
export function useTargetPoller() {
  const { state, dispatch } = useAppContext();
  const pollIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);

  // Poll: GET /targets/{UUID}
  useEffect(() => {
    if (state.phase !== 'polling' || !state.uuid) {
      return;
    }
    pollStartTimeRef.current = Date.now();
    let attempt = 0;

    async function pollTargetStatus() {
      if (!state.uuid) return;

      attempt++;
      dispatch({ type: 'POLL_ATTEMPT', payload: { attempt } });

      // Check timeout
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > config.pollTimeout) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        dispatch({
          type: 'POLL_ERROR',
          payload: {
            message: 'Polling timeout exceeded. Target request took too long to complete.',
            type: 'timeout'
          }
        });
        return;
      }

      try {
        const status = await operatorApi.getTargetStatus(state.uuid);

        if (status === 200) {
          // Success - stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          dispatch({ type: 'POLL_SUCCESS' });
        } else if (status === 202) {
          // Continue polling (202 Accepted - pending)
          if (config.debugMode) {
            console.log(`Poll attempt ${attempt}: 202 Accepted (pending)`);
          }
        } else if (status === 404) {
          // UUID not found
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          dispatch({
            type: 'POLL_ERROR',
            payload: {
              message: 'Target request not found',
              type: 'not_found'
            }
          });
        } else {
          // Other error
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          dispatch({
            type: 'POLL_ERROR',
            payload: {
              message: `Unexpected status code: ${status}`,
              type: 'api_error'
            }
          });
        }
      } catch (error) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        dispatch({
          type: 'POLL_ERROR',
          payload: {
            message: error instanceof Error ? error.message : 'Failed to poll target status',
            type: 'network'
          }
        });
      }
    }

    // Start polling
    pollTargetStatus(); // First attempt immediately
    pollIntervalRef.current = window.setInterval(pollTargetStatus, config.pollInterval);

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [state.phase, state.uuid, dispatch]);

  // Fetch clusters: GET /clusters?id={UUID} (when creating new job)
  useEffect(() => {
    if (state.phase !== 'selecting_clusters' || !state.uuid || state.clusters) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 2000; // 2 seconds

    async function fetchClusters() {
      if (!state.uuid) return;

      try {
        const response = await operatorApi.getClusters(state.uuid);
        dispatch({
          type: 'CLUSTERS_SUCCESS',
          payload: { clusters: response.targetData }
        });
      } catch (error) {
        // Retry on 404 (clusters not ready yet)
        if (retryCount < maxRetries) {
          retryCount++;
          if (config.debugMode) {
            console.log(`Retrying clusters fetch (${retryCount}/${maxRetries})...`);
          }
          setTimeout(fetchClusters, retryDelay);
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch clusters';
          dispatch({
            type: 'CLUSTERS_ERROR',
            payload: {
              message: `Failed to fetch clusters after ${maxRetries} retries: ${errorMessage}. The backend may need more time to prepare the target data.`,
              type: 'api_error'
            }
          });
        }
      }
    }

    fetchClusters();
  }, [state.phase, state.uuid, state.clusters, dispatch]);
}
