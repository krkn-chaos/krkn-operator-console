import { useState, useEffect } from 'react';
import { operatorApi } from '../services/operatorApi';
import type { ActiveRunsResponse } from '../types/api';

/**
 * Hook to poll active runs dashboard data
 * Polls every 2 seconds to get current status of all active scenario runs
 *
 * @param enabled - Whether polling should be active (default: true)
 * @returns Object containing activeRuns data, loading state, and error state
 */
export function useActiveRunsPoller(enabled: boolean = true) {
  const [activeRuns, setActiveRuns] = useState<ActiveRunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip polling if not enabled
    if (!enabled) {
      console.log('[useActiveRunsPoller] Polling disabled');
      return;
    }

    console.log('[useActiveRunsPoller] Starting active runs polling');
    let mounted = true;

    const fetchActiveRuns = async () => {
      try {
        const data = await operatorApi.getActiveRuns();
        if (mounted) {
          setActiveRuns(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error('Failed to fetch active runs:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch active runs');
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchActiveRuns();

    // Poll every 2 seconds
    const intervalId = setInterval(fetchActiveRuns, 2000);

    return () => {
      console.log('[useActiveRunsPoller] Stopping active runs polling');
      mounted = false;
      clearInterval(intervalId);
    };
  }, [enabled]);

  return { activeRuns, loading, error };
}
