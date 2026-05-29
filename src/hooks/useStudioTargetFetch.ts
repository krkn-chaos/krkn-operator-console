/**
 * useStudioTargetFetch - Hook for fetching clusters for Studio workflow runs
 *
 * Reuses the same target creation and polling logic as normal runs,
 * but manages state locally without affecting AppContext phase.
 */

import { useState, useEffect, useRef } from 'react';
import { operatorApi } from '../services/operatorApi';
import { config } from '../config';
import type { Cluster } from '../types/api';

type FetchState =
  | { status: 'idle' }
  | { status: 'creating_target' }
  | { status: 'polling'; uuid: string; attempts: number }
  | { status: 'fetching_clusters'; uuid: string }
  | { status: 'ready'; uuid: string; clusters: { [operatorName: string]: Cluster[] } }
  | { status: 'error'; error: string };

export function useStudioTargetFetch() {
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const pollIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);
  const currentUuidRef = useRef<string | null>(null);

  // Start target creation and polling
  const startFetch = async () => {
    setState({ status: 'creating_target' });

    try {
      const response = await operatorApi.createTargetRequest();
      currentUuidRef.current = response.uuid;
      setState({ status: 'polling', uuid: response.uuid, attempts: 0 });
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to create target'
      });
    }
  };

  // Poll target status
  useEffect(() => {
    if (state.status !== 'polling') return;

    const uuid = currentUuidRef.current;
    if (!uuid) return;

    pollStartTimeRef.current = Date.now();
    let attempt = 0;

    const pollTargetStatus = async () => {
      attempt++;
      setState(prev => prev.status === 'polling' ? { ...prev, attempts: attempt } : prev);

      // Check timeout
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > config.pollTimeout) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        setState({ status: 'error', error: 'Polling timeout exceeded' });
        return;
      }

      try {
        const status = await operatorApi.getTargetStatus(uuid);

        if (status === 200) {
          // Success - stop polling and fetch clusters
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setState({ status: 'fetching_clusters', uuid });
        } else if (status === 202) {
          // Continue polling (no state update needed)
          if (config.debugMode) {
            console.log(`Poll attempt ${attempt}: 202 Accepted (pending)`);
          }
        } else if (status === 404) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setState({ status: 'error', error: 'Target request not found' });
        } else {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setState({ status: 'error', error: `Unexpected status code: ${status}` });
        }
      } catch (error) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to poll target status'
        });
      }
    };

    // Start polling
    pollTargetStatus();
    pollIntervalRef.current = window.setInterval(pollTargetStatus, config.pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [state.status]); // Only depend on status, not entire state

  // Fetch clusters when polling succeeds
  useEffect(() => {
    if (state.status !== 'fetching_clusters') return;

    const uuid = currentUuidRef.current;
    if (!uuid) return;

    const fetchClusters = async () => {
      try {
        const response = await operatorApi.getClusters(uuid);
        setState({
          status: 'ready',
          uuid,
          clusters: response.targetData
        });
      } catch (error) {
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to fetch clusters'
        });
      }
    };

    fetchClusters();
  }, [state.status]); // Only depend on status, not entire state

  // Reset to idle
  const reset = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    currentUuidRef.current = null;
    setState({ status: 'idle' });
  };

  return {
    state,
    startFetch,
    reset,
  };
}
