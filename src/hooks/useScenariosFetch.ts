/**
 * useScenariosFetch - Hook for fetching scenarios from registry
 *
 * Extracts the fetch logic from RegistrySelector to be reusable
 * in both the single-run flow and the Studio wizard.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { operatorApi } from '../services/operatorApi';
import type { ScenariosRequest, ScenarioTag } from '../types/api';

interface UseScenariosFetchResult {
  scenarios: ScenarioTag[];
  loading: boolean;
  error: string | null;
  /**
   * True once a fetch for the current registry completed successfully,
   * independent of how many scenarios it returned. An empty successful
   * response still sets this, so callers can distinguish "fetched, none found"
   * from "not fetched yet". Reset by resetScenarios (e.g. on registry change).
   */
  loaded: boolean;
  fetchScenarios: (request: ScenariosRequest) => Promise<void>;
  resetScenarios: () => void;
}

export function useScenariosFetch(): UseScenariosFetchResult {
  const [scenarios, setScenarios] = useState<ScenarioTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const requestId = useRef(0);

  const fetchScenarios = useCallback(async (request: ScenariosRequest) => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError(null);
    setLoaded(false);
    setScenarios([]); // Clear previous scenarios

    try {
      const response = await operatorApi.getScenarios(request);
      if (requestId.current === currentRequestId) {
        setScenarios(response.scenarios);
        setLoaded(true);
      }
    } catch (err) {
      if (requestId.current === currentRequestId) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load scenarios';
        setError(errorMessage);
        setScenarios([]);
      }
    } finally {
      if (requestId.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, []);

  const resetScenarios = useCallback(() => {
    requestId.current += 1;
    setScenarios([]);
    setLoading(false);
    setError(null);
    setLoaded(false);
  }, []);

  return useMemo(() => ({
    scenarios,
    loading,
    error,
    loaded,
    fetchScenarios,
    resetScenarios,
  }), [scenarios, loading, error, loaded, fetchScenarios, resetScenarios]);
}
