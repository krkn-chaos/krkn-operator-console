import { useState, useEffect } from 'react';
import { operatorApi } from '../services/operatorApi';
import type { ActiveRunsResponse } from '../types/api';

/**
 * Hook to poll active runs dashboard data
 * Polls every 2 seconds to get current status of all active scenario runs
 *
 * @returns Object containing activeRuns data, loading state, and error state
 */
export function useActiveRunsPoller() {
  const [activeRuns, setActiveRuns] = useState<ActiveRunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return { activeRuns, loading, error };
}
