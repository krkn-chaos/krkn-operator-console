import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { websocketService } from '../services/websocketService';
import { operatorApi } from '../services';
import type { ServerMessage } from '../types/websocket';
import type { ScenarioRunStatusResponse } from '../types/api';

/**
 * Hook to receive real-time scenario run DETAIL updates via WebSocket.
 * Subscribes to "run-detail" resource type which includes full clusterJobs array.
 *
 * Use this when displaying a single run's full details (e.g., accordion expanded).
 * For lightweight list view, use useScenarioRunsPoller instead.
 *
 * @param scenarioRunName - Name of the run to watch (null to disable)
 * @returns {runDetail, connectionState, refetch}
 */
export function useScenarioRunDetail(scenarioRunName: string | null) {
  const [runDetail, setRunDetail] = useState<ScenarioRunStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const initialFetchDoneRef = useRef(false);

  // Reset when scenarioRunName changes
  useEffect(() => {
    if (scenarioRunName) {
      setRunDetail(null);
      initialFetchDoneRef.current = false;
    }
  }, [scenarioRunName]);

  // Fetch initial data via REST
  const fetchDetail = useCallback(async () => {
    if (!scenarioRunName || initialFetchDoneRef.current) return;

    setIsLoading(true);
    try {
      const detail = await operatorApi.getScenarioRunStatus(scenarioRunName);
      setRunDetail(detail);
      initialFetchDoneRef.current = true;
    } catch (error) {
      console.error('[useScenarioRunDetail] Failed to fetch initial data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [scenarioRunName]);

  // WebSocket message handler
  const handleMessage = useCallback((message: ServerMessage) => {
    if (message.resource !== 'run-detail') return;

    console.log('[useScenarioRunDetail] Received message:', message);

    if (message.event === 'updated' || message.event === 'created') {
      const data = message.data as ScenarioRunStatusResponse;
      setRunDetail(data);
    } else if (message.event === 'deleted') {
      console.log('[useScenarioRunDetail] Run deleted, clearing detail');
      setRunDetail(null);
    }
  }, []);

  // WebSocket connection (only if scenarioRunName is set)
  const wsUrl = scenarioRunName
    ? websocketService.buildResourceUrl('runs')
    : '';

  const { connectionState } = useWebSocket(
    scenarioRunName ? `run-detail-${scenarioRunName}` : 'disabled',
    wsUrl,
    handleMessage,
    { disabled: !scenarioRunName }
  );

  // Subscribe to this specific run when connected
  useEffect(() => {
    if (!scenarioRunName || connectionState !== 'connected') return;

    // Subscribe to run-detail for this specific run
    websocketService.subscribe(
      `run-detail-${scenarioRunName}`,
      'run-detail',
      [scenarioRunName]
    );

    // Fetch initial data
    fetchDetail();
  }, [scenarioRunName, connectionState, fetchDetail]);

  // Manual refetch
  const refetch = useCallback(async () => {
    if (!scenarioRunName) return;

    setIsLoading(true);
    try {
      const detail = await operatorApi.getScenarioRunStatus(scenarioRunName);
      setRunDetail(detail);
    } catch (error) {
      console.error('[useScenarioRunDetail] Failed to refetch:', error);
    } finally {
      setIsLoading(false);
    }
  }, [scenarioRunName]);

  return {
    runDetail,
    connectionState,
    isLoading,
    refetch,
  };
}