import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { websocketService } from '../services/websocketService';
import { operatorApi } from '../services';
import type { ServerMessage } from '../types/websocket';
import type { ScenarioRunStatusResponse } from '../types/api';

/**
 * Hook to receive real-time scenario run DETAIL updates via WebSocket.
 * Subscribes to "run-detail" resource type which includes full clusterJobs array.
 *
 * Initial data comes from WebSocket snapshot (sent automatically on subscribe).
 * No REST call needed - backend sends snapshot immediately.
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

  // Reset when scenarioRunName changes (including when disabled)
  useEffect(() => {
    setRunDetail(null);
  }, [scenarioRunName]);

  // WebSocket message handler
  const handleMessage = useCallback((message: ServerMessage) => {
    if (message.resource !== 'run-detail') return;

    if (message.event === 'updated' || message.event === 'created') {
      const data = message.data as ScenarioRunStatusResponse;
      setRunDetail(data);
    } else if (message.event === 'deleted') {
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
  // Backend automatically sends snapshot on subscribe - no REST call needed!
  useEffect(() => {
    if (!scenarioRunName || connectionState !== 'connected') return;

    websocketService.subscribe(
      `run-detail-${scenarioRunName}`,
      'run-detail',
      [scenarioRunName]
    );
  }, [scenarioRunName, connectionState]);

  // Manual refetch via REST (fallback only if WebSocket disconnected)
  const refetch = useCallback(async () => {
    if (!scenarioRunName) return;

    setIsLoading(true);
    try {
      const detail = await operatorApi.getScenarioRunStatus(scenarioRunName);
      setRunDetail(detail);
    } catch {
      // Silent failure — caller can retry
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