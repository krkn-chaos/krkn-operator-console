import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@patternfly/react-core';
import { krknAiApi, isCancellationSettled } from '../../services/krknAiApi';
import type { KrknAIRunResource, KrknAIScenarioReplayRequest } from '../../services/krknAiApi';
import { CreateRun } from './CreateRun';
import { RunDetail } from './RunDetail';
import { RunList } from './RunList';
import type { KrknAIRunListEntry } from './RunList';
import { useClusterDiscovery } from '../../hooks/useClusterDiscovery';
import { isRetryableKrknAIError, useKrknAIPolling } from '../../hooks/useKrknAIPolling';
import type { KrknAIPollResult, RefreshReason } from '../../hooks/useKrknAIPolling';
import { isActiveAIRunPhase } from '../../utils/krknAIPhases';
import './KrknAI.css';

function phaseOf(run: KrknAIRunResource): string {
  return run.status?.phase ?? 'Pending';
}

function isActive(run: KrknAIRunResource): boolean {
  return isActiveAIRunPhase(phaseOf(run));
}


function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load Krkn-AI runs.';
}


function mergeSummaryIntoRun(run: KrknAIRunResource, summary: KrknAIRunListEntry['summary']): KrknAIRunResource {
  if (!summary) return run;
  const currentPhase = phaseOf(run);
  const phase = currentPhase;
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
  onReplayScenario,
}: {
  initialRunName?: string | null;
  onInitialRunHandled?: () => void;
  onReplayScenario?: (scenario: KrknAIScenarioReplayRequest) => void;
}) {
  const [runs, setRuns] = useState<KrknAIRunListEntry[]>([]);
  const runsRef = useRef(runs);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedRunError, setLinkedRunError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRun, setSelectedRun] = useState<KrknAIRunResource | null>(null);
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

  const loadRuns = useCallback(async (signal: AbortSignal, reason: RefreshReason): Promise<KrknAIPollResult> => {
    let retry = false;
    setRefreshing(true);
    if (runsRef.current.length === 0) setLoading(true);
    try {
      const resources = await krknAiApi.listRuns({ signal });
      if (signal.aborted) return { active: false, retry: false };
      setError(null);
      const previousByName = new Map(runsRef.current.map((entry) => [entry.resource.metadata.name, entry]));
      const fetchAllSummaries = reason === 'entry' || reason === 'manual' || reason === 'visibility';
      const entries = resources.map((resource): KrknAIRunListEntry => {
        const previous = previousByName.get(resource.metadata.name);
        const sameRun = previous?.resource.metadata.uid === resource.metadata.uid;
        return {
          resource,
          summary: sameRun ? previous.summary : null,
          summaryError: sameRun ? previous.summaryError : undefined,
          updating: sameRun ? previous.updating : false,
        };
      });
      updateRuns(entries);
      setLoading(false);

      const loadSummary = async ({ resource }: KrknAIRunListEntry) => {
        const name = resource.metadata.name;
        const previous = previousByName.get(name);
        const shouldFetchSummary = fetchAllSummaries
          || !previous
          || previous.resource.metadata.uid !== resource.metadata.uid
          || isActive(resource)
          || (isActive(previous.resource) && !isActive(resource))
          || (phaseOf(resource) === 'Cancelled' && !isCancellationSettled(resource, previous.summary))
          || Boolean(previous.updating);
        if (!shouldFetchSummary) return;
        try {
          const summary = await krknAiApi.getRunSummary(name, { signal });
          if (signal.aborted) return;
          updateRuns(runsRef.current.map((entry) => entry.resource.metadata.uid === resource.metadata.uid
            ? { resource: mergeSummaryIntoRun(entry.resource, summary), summary, updating: false }
            : entry));
        } catch (summaryError) {
          if (signal.aborted) return;
          updateRuns(runsRef.current.map((entry) => entry.resource.metadata.uid === resource.metadata.uid
            ? { ...entry, summaryError: errorText(summaryError), updating: isRetryableKrknAIError(summaryError) }
            : entry));
        }
      };
      let nextEntry = 0;
      await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
        while (!signal.aborted) {
          const entry = entries[nextEntry++];
          if (!entry) return;
          await loadSummary(entry);
        }
      }));
    } catch (listError) {
      if (!signal.aborted) {
        retry = isRetryableKrknAIError(listError);
        setError(errorText(listError));
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    return {
      active: runsRef.current.some((entry) => isActive(entry.resource)
        || (phaseOf(entry.resource) === 'Cancelled' && !isCancellationSettled(entry.resource, entry.summary))),
      retry: retry || runsRef.current.some((entry) => entry.updating),
    };
  }, [updateRuns]);

  const { refresh: handleRefresh, retryExhausted } = useKrknAIPolling(loadRuns, listVisible);
  const handleDeleteRun = useCallback(async (runName: string) => {
    await krknAiApi.deleteRun(runName);
    updateRuns(runsRef.current.filter((entry) => entry.resource.metadata.name !== runName));
  }, [updateRuns]);

  const handleCancelRun = useCallback(async (runName: string) => {
    await krknAiApi.cancelRun(runName);
    updateRuns(runsRef.current.map((entry) => entry.resource.metadata.name === runName
      ? { ...entry, resource: { ...entry.resource, status: { ...entry.resource.status, phase: 'Cancelling' } } }
      : entry));
    setSelectedRun((resource) => resource?.metadata.name === runName
      ? { ...resource, status: { ...resource.status, phase: 'Cancelling' } }
      : resource);
    handleRefresh();
  }, [handleRefresh, updateRuns]);

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
        <RunDetail run={selectedRun} onBack={() => setSelectedRun(null)} onCancel={handleCancelRun} onReplayScenario={onReplayScenario} />
      </div>
    );
  }

  return (
    <div className="krkn-ai">
      {linkedRunError && <Alert variant="danger" title={linkedRunError} isInline />}
      {retryExhausted && <Alert variant="warning" title="Automatic refresh paused" isInline>Use Refresh to retry loading results.</Alert>}
      <RunList
        runs={runs}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onCreate={handleCreateRun}
        onRefresh={handleRefresh}
        onCancel={handleCancelRun}
        onSelect={setSelectedRun}
        onDelete={handleDeleteRun}
      />
    </div>
  );
}
