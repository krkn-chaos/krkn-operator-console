/**
 * useScenariosFetch - Hook for fetching scenarios from registry
 *
 * Extracts the fetch logic from RegistrySelector to be reusable
 * in both the single-run flow and the Studio wizard.
 */

import { useState, useCallback, useMemo } from 'react';
import { operatorApi } from '../services/operatorApi';
import type { ScenariosRequest, ScenarioTag } from '../types/api';

interface UseScenariosFetchResult {
  scenarios: ScenarioTag[];
  loading: boolean;
  error: string | null;
  fetchScenarios: (request: ScenariosRequest) => Promise<void>;
}

export function useScenariosFetch(): UseScenariosFetchResult {
  const [scenarios, setScenarios] = useState<ScenarioTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScenarios = useCallback(async (request: ScenariosRequest) => {
    setLoading(true);
    setError(null);
    setScenarios([]); // Clear previous scenarios

    try {
      const response = await operatorApi.getScenarios(request);
      setScenarios(response.scenarios);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scenarios';
      setError(errorMessage);
      setScenarios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return useMemo(() => ({
    scenarios,
    loading,
    error,
    fetchScenarios,
  }), [scenarios, loading, error, fetchScenarios]);
}
