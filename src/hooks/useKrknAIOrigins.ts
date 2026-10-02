import { useCallback, useEffect, useState } from 'react';
import { krknAiApi } from '../services/krknAiApi';
import { operatorApi } from '../services/operatorApi';
import type { UnifiedJobItem } from '../types/api';

// The Jobs API omits child labels. Resolve parents through the operator's
// authorized label-selector endpoint instead of guessing from job names.
export function useKrknAIOrigins(jobs: UnifiedJobItem[]) {
  const scenarioNamesKey = JSON.stringify(jobs.filter((job) => job.type === 'scenarioRun').map((job) => job.name).sort());
  const [origins, setOrigins] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);

  useEffect(() => {
    const names = new Set<string>(JSON.parse(scenarioNamesKey));
    if (names.size === 0) {
      setOrigins({});
      setError(null);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setError(null);
    async function loadOrigins() {
      const runs = await krknAiApi.listRuns({ signal });
      const matches = await Promise.all(runs.map(async (run) => {
        const name = run.metadata.name;
        // Match the operator's HashLogicalName for names exceeding label limits.
        const labelValue = name.length <= 63 ? name : Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name))).subarray(0, 16),
          (byte) => byte.toString(16).padStart(2, '0'),
        ).join('');
        const children = await operatorApi.listScenarioRuns(undefined, undefined, {
          labelSelector: `krkn.dev/ai-run=${labelValue}`,
          signal,
        });
        return children.scenarioRuns.filter((child) => names.has(child.scenarioRunName))
          .map((child) => [child.scenarioRunName, name] as const);
      }));
      if (!signal.aborted) setOrigins(Object.fromEntries(matches.flat()));
    }
    void loadOrigins().catch((loadError) => {
      if (!signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Origin lookup failed');
    });
    return () => controller.abort();
  }, [scenarioNamesKey, refreshVersion]);

  return { origins, error, refresh };
}
