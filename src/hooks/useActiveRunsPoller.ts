import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import type { ActiveRunsResponse } from '../types/api';

/**
 * Hook to poll active runs dashboard data
 * Polls every 2 seconds ONLY when on jobs_list page
 * Automatically stops polling when navigating away
 *
 * @returns Object containing activeRuns data, loading state, and error state
 */
export function useActiveRunsPoller() {
  const { state } = useAppContext();
  const [activeRuns, setActiveRuns] = useState<ActiveRunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only poll when on jobs_list page
    const shouldPoll = state.phase === 'jobs_list';

    if (!shouldPoll) {
      console.log('[useActiveRunsPoller] Not on jobs_list page, skipping polling');
      return;
    }

    console.log('[useActiveRunsPoller] Starting active runs polling (on jobs_list page)');
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
      console.log('[useActiveRunsPoller] Stopping active runs polling (cleanup)');
      mounted = false;
      clearInterval(intervalId);
    };
  }, [state.phase]); // Re-run when phase changes

  return { activeRuns, loading, error };
}
