import { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import { config } from '../config';

/**
 * Custom hook to manage the target polling workflow
 *
 * Workflow:
 * 1. POST /targets → get UUID
 * 2. Poll GET /targets/{UUID} until 200 OK
 * 3. GET /clusters?id={UUID}
 * 4. User selects cluster
 * 5. GET /nodes?id={UUID}&cluster-name={clusterName}
 */
export function useTargetPoller() {
  const { state, dispatch } = useAppContext();
  const pollIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);

  // Initialize: POST /targets
  useEffect(() => {
    async function initializeTarget() {
      dispatch({ type: 'INIT_START' });

      try {
        const response = await operatorApi.createTargetRequest();
        dispatch({
          type: 'INIT_SUCCESS',
          payload: { uuid: response.uuid }
        });
      } catch (error) {
        dispatch({
          type: 'INIT_ERROR',
          payload: {
            message: error instanceof Error ? error.message : 'Failed to initialize target request',
            type: 'network'
          }
        });
      }
    }

    initializeTarget();
  }, [dispatch]);

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
        } else if (status === 100) {
          // Continue polling (100 Continue)
          if (config.debugMode) {
            console.log(`Poll attempt ${attempt}: 100 Continue`);
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

  // Load existing jobs: GET /scenarios/run
  useEffect(() => {
    if (state.phase !== 'jobs_list') {
      return;
    }

    async function loadJobs() {
      try {
        const response = await operatorApi.listJobs();
        dispatch({
          type: 'LOAD_JOBS_SUCCESS',
          payload: { jobs: response.jobs }
        });
      } catch (error) {
        console.error('Failed to load jobs:', error);
        // Don't transition to error phase, just log it
        // Jobs list can be empty on first load
      }
    }

    loadJobs();
  }, [state.phase, dispatch]);

  // Fetch clusters: GET /clusters?id={UUID} (when creating new job)
  useEffect(() => {
    if (state.phase !== 'selecting_clusters' || !state.uuid || state.clusters) {
      return;
    }

    async function fetchClusters() {
      if (!state.uuid) return;

      try {
        const response = await operatorApi.getClusters(state.uuid);
        dispatch({
          type: 'CLUSTERS_SUCCESS',
          payload: { clusters: response.targetData }
        });
      } catch (error) {
        dispatch({
          type: 'CLUSTERS_ERROR',
          payload: {
            message: error instanceof Error ? error.message : 'Failed to fetch clusters',
            type: 'api_error'
          }
        });
      }
    }

    fetchClusters();
  }, [state.phase, state.uuid, state.clusters, dispatch]);
}
