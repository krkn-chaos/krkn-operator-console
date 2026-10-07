import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@patternfly/react-core';
import { krknAiApi } from '../../services/krknAiApi';
import type { KrknAIRunResource } from '../../services/krknAiApi';
import { CreateRun } from './CreateRun';
import { RunDetail } from './RunDetail';
import { RunList } from './RunList';
import type { KrknAIRunListEntry } from './RunList';
import { useClusterDiscovery } from '../../hooks/useClusterDiscovery';
import './KrknAI.css';

const ACTIVE_PHASES: Record<string, true> = { Pending: true, Provisioning: true, Running: true };
const TERMINAL_PHASES: Record<string, true> = { Succeeded: true, Failed: true, Cancelled: true };
const POLL_INTERVAL_MS = 10_000;

type RefreshReason = 'entry' | 'tick' | 'manual' | 'visibility';

function phaseOf(run: KrknAIRunResource): string {
  return run.status?.phase ?? 'Pending';
}

function isActive(run: KrknAIRunResource): boolean {
  return ACTIVE_PHASES[phaseOf(run)] === true;
}

function isTerminal(phase: string): boolean {
  return TERMINAL_PHASES[phase] === true;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load Krkn-AI runs.';
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = error.status;
  return typeof status === 'number' ? status : undefined;
}

function mergeSummaryIntoRun(run: KrknAIRunResource, summary: KrknAIRunListEntry['summary']): KrknAIRunResource {
  if (!summary) return run;
  const currentPhase = phaseOf(run);
  const phase = isTerminal(currentPhase) ? currentPhase : summary.phase || currentPhase;
  return {
    ...run,
    metadata: {
      ...run.metadata,
      creationTimestamp: run.metadata.creationTimestamp || summary.createdAt,
    },
    status: {
      ...run.status,
      phase,
      orchestratorPodName: summary.orchestratorPodName || run.status?.orchestratorPodName,
      failureReason: summary.failureReason || run.status?.failureReason,
    },
  };
}

export function KrknAIPage({
  initialRunName,
  onInitialRunHandled,
}: {
  initialRunName?: string | null;
  onInitialRunHandled?: () => void;
}) {
  const [runs, setRuns] = useState<KrknAIRunListEntry[]>([]);
  const runsRef = useRef(runs);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedRunError, setLinkedRunError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRun, setSelectedRun] = useState<KrknAIRunResource | null>(null);
  const refreshRef = useRef<(reason: RefreshReason) => void>(() => undefined);
  const {
    clusters: discoveredClusters,
    discoveryUuid: targetRequestId,
    isLoading: targetLoading,
    error: targetError,
    startDiscovery,
    retry: retryTargetDiscovery,
    reset: resetTargetDiscovery,
  } = useClusterDiscovery();

  const updateRuns = useCallback((next: KrknAIRunListEntry[]) => {
    runsRef.current = next;
    setRuns(next);
  }, []);

  useEffect(() => {
    if (!initialRunName) return;
    const controller = new AbortController();
    setLoading(true);
    setLinkedRunError(null);
    void krknAiApi.getRun(initialRunName, { signal: controller.signal })
      .then((run) => {
        if (!controller.signal.aborted) setSelectedRun(run);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setLinkedRunError(`Unable to open Krkn-AI run ${initialRunName}: ${errorText(loadError)}`);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          onInitialRunHandled?.();
        }
      });
    return () => controller.abort();
  }, [initialRunName, onInitialRunHandled]);

  const listVisible = !isCreating && selectedRun === null && !initialRunName;

  useEffect(() => {
    if (!listVisible) return undefined;

    let disposed = false;
    let inFlight = false;
    let refreshWhenVisible = false;
    let pausedForActiveRuns = false;
    let initialLoadCompleted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNext = () => {
      if (disposed || timer !== null) return;
      const shouldPoll = runsRef.current.some((entry) => isActive(entry.resource) || entry.updating);
      if (document.hidden) {
        pausedForActiveRuns ||= shouldPoll;
        return;
      }
      if (shouldPoll) timer = setTimeout(() => {
        timer = null;
        void refresh('tick');
      }, POLL_INTERVAL_MS);
    };

    const refresh = async (reason: RefreshReason) => {
      if (disposed || document.hidden) return;
      if (inFlight) {
        if (reason === 'visibility') refreshWhenVisible = true;
        return;
      }
      clearTimer();
      inFlight = true;
      controller = new AbortController();
      setRefreshing(true);
      if (runsRef.current.length === 0) setLoading(true);

      try {
        const resources = await krknAiApi.listRuns({ signal: controller.signal });
        if (disposed) return;
        setError(null);

        const previousByName = new Map(runsRef.current.map((entry) => [entry.resource.metadata.name, entry]));
        const fetchAllSummaries = reason === 'entry' || reason === 'manual' || reason === 'visibility';
        const nextEntries = await Promise.all(resources.map(async (resource): Promise<KrknAIRunListEntry> => {
          const name = resource.metadata.name;
          const previous = previousByName.get(name);
          const previousPhase = previous ? phaseOf(previous.resource) : '';
          const currentPhase = phaseOf(resource);
          const transitionedTerminal = ACTIVE_PHASES[previousPhase] === true && isTerminal(currentPhase);
          const shouldFetchSummary = fetchAllSummaries
            || isActive(resource)
            || transitionedTerminal
            || Boolean(previous?.updating);

          if (!shouldFetchSummary) {
            return {
              resource,
              summary: previous?.summary ?? null,
              summaryError: previous?.summaryError,
              updating: previous?.updating ?? false,
            };
          }

          try {
            const summary = await krknAiApi.getRunSummary(name, { signal: controller?.signal });
            return {
              resource: mergeSummaryIntoRun(resource, summary),
              summary,
              updating: false,
            };
          } catch (summaryError) {
            const status = errorStatus(summaryError);
            return {
              resource,
              summary: previous?.summary ?? null,
              summaryError: errorText(summaryError),
              updating: status === 503,
            };
          }
        }));

        if (!disposed) updateRuns(nextEntries);
        initialLoadCompleted = true;
      } catch (listError) {
        if (!disposed && !(listError instanceof Error && listError.name === 'AbortError')) {
          setError(errorText(listError));
        }
      } finally {
        inFlight = false;
        controller = null;
        if (!disposed) {
          setLoading(false);
          setRefreshing(false);
          if (refreshWhenVisible && !document.hidden) {
            refreshWhenVisible = false;
            void refresh('visibility');
          } else {
            scheduleNext();
          }
        }
      }
    };

    refreshRef.current = (reason) => { void refresh(reason); };
    const onVisibilityChange = () => {
      if (document.hidden) {
        pausedForActiveRuns = runsRef.current.some((entry) => isActive(entry.resource) || entry.updating);
        clearTimer();
        return;
      }
      if (!initialLoadCompleted) {
        void refresh('entry');
        return;
      }
      if (pausedForActiveRuns && runsRef.current.some((entry) => isActive(entry.resource) || entry.updating)) {
        pausedForActiveRuns = false;
        if (inFlight) refreshWhenVisible = true;
        else void refresh('visibility');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void refresh('entry');

    return () => {
      disposed = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      refreshRef.current = () => undefined;
    };
  }, [listVisible, updateRuns]);

  const handleRefresh = useCallback(() => refreshRef.current('manual'), []);
  const handleDeleteRun = useCallback(async (runName: string) => {
    await krknAiApi.deleteRun(runName);
    updateRuns(runsRef.current.filter((entry) => entry.resource.metadata.name !== runName));
  }, [updateRuns]);

  const handleStart = useCallback((run: KrknAIRunResource) => {
    const existing = runsRef.current.filter((entry) => entry.resource.metadata.name !== run.metadata.name);
    updateRuns([{ resource: run, summary: null, updating: false }, ...existing]);
    setIsCreating(false);
    setSelectedRun(run);
  }, [updateRuns]);

  const handleCreateRun = useCallback(() => {
    setIsCreating(true);
    void startDiscovery();
  }, [startDiscovery]);

  const handleCancelCreate = useCallback(() => {
    resetTargetDiscovery();
    setIsCreating(false);
  }, [resetTargetDiscovery]);

  if (isCreating) {
    return (
      <div className="krkn-ai">
        <CreateRun
          existingNames={runs.map((entry) => entry.resource.metadata.name)}
          targetRequestId={targetRequestId ?? ''}
          discoveredClusters={discoveredClusters ?? []}
          targetLoading={targetLoading}
          targetError={targetError}
          onRetryTargetDiscovery={retryTargetDiscovery}
          onStart={handleStart}
          onCancel={handleCancelCreate}
        />
      </div>
    );
  }

  if (selectedRun) {
    return (
      <div className="krkn-ai">
        <RunDetail run={selectedRun} onBack={() => setSelectedRun(null)} />
      </div>
    );
  }

  return (
    <div className="krkn-ai">
      {linkedRunError && <Alert variant="danger" title={linkedRunError} isInline />}
      <RunList
        runs={runs}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onCreate={handleCreateRun}
        onRefresh={handleRefresh}
        onSelect={setSelectedRun}
        onDelete={handleDeleteRun}
      />
    </div>
  );
}
