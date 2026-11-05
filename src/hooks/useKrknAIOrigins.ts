import { useCallback, useEffect, useRef, useState } from 'react';
import { krknAiApi, type KrknAIRunResource } from '../services/krknAiApi';
import { operatorApi } from '../services/operatorApi';
import type { UnifiedJobItem } from '../types/api';

const LOOKUP_CONCURRENCY = 4;
const TERMINAL_PHASES: Record<string, true> = {
  Succeeded: true,
  Failed: true,
  Cancelled: true,
};

type ChildOrigins = Map<string, string>;

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = error.status;
  return typeof status === 'number' ? status : undefined;
}
function isOptionalOriginLookupFailure(error: unknown): boolean {
  const status = httpStatus(error);
  // Parent links are optional; unsupported, disabled, or inaccessible lookups don't block Jobs.
  return status === 403 || status === 404 || status === 503;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Origin lookup failed';
}

async function labelValue(name: string): Promise<string | null> {
  if (name.length <= 63) return name;
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(name));
  return Array.from(new Uint8Array(digest).subarray(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// The Jobs API omits child labels. Resolve parents through the operator's
// authorized label-selector endpoint instead of guessing from job names.
export function useKrknAIOrigins(jobs: UnifiedJobItem[], enabled = true) {
  const scenarioNamesKey = JSON.stringify(jobs.filter((job) => job.type === 'scenarioRun').map((job) => job.name).sort());
  const [origins, setOrigins] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const originCache = useRef(new Map<string, ChildOrigins>());
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);

  useEffect(() => {
    const names = new Set<string>(JSON.parse(scenarioNamesKey));
    if (!enabled || names.size === 0) {
      setOrigins({});
      setError(null);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setError(null);
    setOrigins({});

    async function loadOrigins() {
      const runs = await krknAiApi.listRuns({ signal });
      const visibleOrigins: ChildOrigins = new Map();
      const pendingRuns: KrknAIRunResource[] = [];
      for (const run of runs) {
        const parent = run.metadata.name;
        const terminal = TERMINAL_PHASES[run.status?.phase ?? ''] === true;
        const references = run.status?.scenarioRunRefs;

        if (Array.isArray(references)) {
          const referenceOrigins = new Map(references.map((child) => [child, parent] as const));
          if (terminal) originCache.current.set(parent, referenceOrigins);
          else originCache.current.delete(parent);
          referenceOrigins.forEach((origin, child) => {
            if (names.has(child)) visibleOrigins.set(child, origin);
          });
          continue;
        }

        const cached = originCache.current.get(parent);
        if (cached) cached.forEach((origin, child) => {
          if (names.has(child)) visibleOrigins.set(child, origin);
        });
        if (terminal && cached) continue;
        pendingRuns.push(run);
      }

      const failures: string[] = [];
      let nextRun = 0;
      const workers = Array.from(
        { length: Math.min(LOOKUP_CONCURRENCY, pendingRuns.length) },
        async () => {
          while (!signal.aborted) {
            const run = pendingRuns[nextRun++];
            if (!run) return;
            const parent = run.metadata.name;
            try {
              // Long run names need the same truncated SHA-256 label as the operator.
              // Older browsers without WebCrypto can still resolve every other run.
              const value = await labelValue(parent);
              if (value === null) continue;
              const children = await operatorApi.listScenarioRuns(undefined, undefined, {
                labelSelector: `krkn.dev/ai-run=${value}`,
                signal,
              });
              const mapped = new Map(children.scenarioRuns.map((child) => [child.scenarioRunName, parent] as const));
              const cached = originCache.current.get(parent);
              if (cached) mapped.forEach((origin, child) => cached.set(child, origin));
              originCache.current.set(parent, cached ?? mapped);
              mapped.forEach((origin, child) => {
                if (names.has(child)) visibleOrigins.set(child, origin);
              });
            } catch (lookupError) {
              if (signal.aborted) return;
              if (isOptionalOriginLookupFailure(lookupError)) {
                const cached = originCache.current.get(parent);
                cached?.forEach((_origin, child) => {
                  if (visibleOrigins.get(child) === parent) visibleOrigins.delete(child);
                });
                originCache.current.delete(parent);
                continue;
              }
              failures.push(`${parent}: ${errorMessage(lookupError)}`);
            }
          }
        },
      );
      await Promise.all(workers);
      if (signal.aborted) return;
      setOrigins(Object.fromEntries(visibleOrigins));
      setError(failures.length > 0
        ? `Some Krkn-AI origins could not be loaded: ${failures.join('; ')}`
        : null);
    }

    void loadOrigins().catch((loadError: unknown) => {
      if (signal.aborted) return;
      if (isOptionalOriginLookupFailure(loadError)) {
        originCache.current.clear();
        setOrigins({});
        setError(null);
        return;
      }
      const cachedOrigins: ChildOrigins = new Map();
      originCache.current.forEach((children) => children.forEach((parent, child) => {
        if (names.has(child)) cachedOrigins.set(child, parent);
      }));
      setOrigins(Object.fromEntries(cachedOrigins));
      setError(errorMessage(loadError));
    });
    return () => controller.abort();
  }, [enabled, scenarioNamesKey, refreshVersion]);

  return { origins, error, refresh };
}
