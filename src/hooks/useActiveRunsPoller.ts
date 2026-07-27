import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import { useWebSocket } from './useWebSocket';
import { websocketService } from '../services/websocketService';
import type { ActiveRunsResponse } from '../types/api';
import type { ServerMessage } from '../types/websocket';

/**
 * Hook for dashboard active runs data.
 * Initial load via REST (once), then real-time updates via WebSocket.
 * Only active when on jobs_list page.
 *
 * @returns Object containing activeRuns data, loading state, and error state
 */
export function useActiveRunsPoller() {
  const { state } = useAppContext();
  const [activeRuns, setActiveRuns] = useState<ActiveRunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const shouldConnect = state.phase === 'jobs_list';
  const initialFetchDoneRef = useRef(false);

  const fetchInitialData = useCallback(async () => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;

    try {
      const data = await operatorApi.getActiveRuns();
      setActiveRuns(data);
      setError(null);
      setLoading(false);
    } catch (err) {
      initialFetchDoneRef.current = false;
      setError(err instanceof Error ? err.message : 'Failed to fetch active runs');
      setLoading(false);
    }
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    if (message.resource !== 'dashboard') return;

    const data = message.data as ActiveRunsResponse;
    setActiveRuns(data);
    setError(null);
    setLoading(false);
  }, []);

  const wsUrl = websocketService.buildResourceUrl('dashboard/active-runs');
  const { connectionState } = useWebSocket('dashboard-active-runs', wsUrl, handleMessage, {
    disabled: !shouldConnect,
  });

  useEffect(() => {
    if (connectionState === 'connected' && shouldConnect) {
      fetchInitialData();
      websocketService.subscribe('dashboard-active-runs', 'dashboard');
    }
  }, [connectionState, shouldConnect, fetchInitialData]);

  return { activeRuns, loading, error };
}
