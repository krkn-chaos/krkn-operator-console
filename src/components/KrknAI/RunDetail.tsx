import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Checkbox, Label, Modal, ModalVariant, Spinner, Title } from '@patternfly/react-core';
import {
  ArrowLeftIcon,
  BanIcon,
  CalendarAltIcon,
  ChartLineIcon,
  ClipboardListIcon,
  TopologyIcon,
} from '@patternfly/react-icons';
import { krknAiApi, isCancellationSettled } from '../../services/krknAiApi';
import { operatorApi } from '../../services/operatorApi';
import type {
  KrknAIRunResource,
  KrknAIRunSummary,
  KrknAIScenarioDetail,
  KrknAIScenarioIndexResponse,
  KrknAIScenarioIndexRow,
  KrknAIScenarioReplayRequest,
} from '../../services/krknAiApi';
import { isApiError } from '../../utils/apiClient';
import { websocketService } from '../../services/websocketService';
import { useWebSocket } from '../../hooks/useWebSocket';
import { isRetryableKrknAIError, useKrknAIPolling } from '../../hooks/useKrknAIPolling';
import type { KrknAIPollResult, RefreshReason } from '../../hooks/useKrknAIPolling';
import { canCancelAIRunPhase, isActiveAIRunPhase, isTerminalAIRunPhase } from '../../utils/krknAIPhases';
import { LogTerminal } from '../LogTerminal';
import { FitnessChart } from './FitnessChart';
import { FitnessValue } from './FitnessValue';
import { ScenarioExplorer, type ScenarioExplorerFilters } from './ScenarioExplorer';
import { formatDateTime } from '../../utils/dateTime';
import { MetadataPanel } from './MetadataPanel';
import { ResultsDownloadButton } from './ResultsDownloadButton';

interface RunDetailProps {
  run: KrknAIRunResource;
  onBack: () => void;
  onCancel?: (runName: string) => Promise<void>;
  onReplayScenario?: (scenario: KrknAIScenarioReplayRequest) => void;
}

const SCENARIO_PAGE_LIMIT = 500;
const MAX_LIVE_LOG_LINES = 2_000;
const MAX_LIVE_LOG_CHARACTERS = 512 * 1024;

type ConfigState = 'loading' | 'available' | 'unavailable' | 'error';



function errorStatus(error: unknown): number | undefined {
  return isApiError(error) ? error.status : undefined;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load Krkn-AI results.';
}

function scenarioKey(generation: number, scenarioId: string): string {
  return `${generation}:${scenarioId}`;
}

function fitnessChanged(previous: KrknAIScenarioIndexRow | undefined, next: KrknAIScenarioIndexRow): boolean {
  return !previous
    || previous.fitnessScore !== next.fitnessScore
    || previous.fitnessState !== next.fitnessState;
}

function OrchestratorLogPanel({ runName, podName, phase }: { runName: string; podName: string; phase: string }) {
  const [logWindow, setLogWindow] = useState({ lines: [] as string[], characters: 0, firstLine: 0 });
  const logs = logWindow.lines;
  const [isFollowing, setIsFollowing] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const follow = !isTerminalAIRunPhase(phase);
  const connectionId = `krkn-ai-orchestrator-${runName}`;
  const url = websocketService.buildAiRunLogsUrl(runName, follow, MAX_LIVE_LOG_LINES, true);
  const handleMessage = useCallback((message: string) => {
    setLogWindow((current) => {
      const line = message.slice(-MAX_LIVE_LOG_CHARACTERS);
      const lines = [...current.lines, line];
      let characters = current.characters + line.length;
      let start = 0;
      while (lines.length - start > MAX_LIVE_LOG_LINES || characters > MAX_LIVE_LOG_CHARACTERS) {
        characters -= lines[start++].length;
      }
      return { lines: start > 0 ? lines.slice(start) : lines, characters, firstLine: current.firstLine + start };
    });
  }, []);
  const { connectionState } = useWebSocket(connectionId, url, handleMessage, {
    disabled: !podName,
    subscriptionMode: false,
  });

  useEffect(() => {
    setLogWindow({ lines: [], characters: 0, firstLine: 0 });
  }, [url]);

  useLayoutEffect(() => {
    if (isFollowing && logsContainerRef.current && logs.length > 0) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [isFollowing, logs]);

  const connectionMessage = connectionState === 'connected'
    ? 'Waiting for orchestrator log entries…'
    : connectionState === 'reconnecting'
      ? 'Reconnecting to orchestrator log stream…'
      : 'Connecting to orchestrator log stream…';

  return (
    <Card className="krkn-ai-run-detail__main-logs">
      <CardTitle><Title headingLevel="h2" size="lg">Orchestrator pod log</Title></CardTitle>
      <CardBody>
        <dl className="krkn-ai-main-pod__metadata">
          <div><dt>Pod</dt><dd>{podName || 'Waiting for orchestrator Pod'}</dd></div>
          <div><dt>Connection</dt><dd>{podName ? connectionState : 'waiting'}</dd></div>
        </dl>
        {!podName ? (
          <p className="krkn-ai-not-available">Orchestrator logs will connect when the operator records the Pod name.</p>
        ) : logs.length === 0 ? (
          <p className="krkn-ai-not-available" role="status">{connectionMessage}</p>
        ) : (
          <LogTerminal ref={logsContainerRef} logs={logs} firstLine={logWindow.firstLine} ariaLabel="Orchestrator log output" />
        )}
        <p className="krkn-ai-muted">Showing recent log entries. Download results for the archived <code>run.log</code>.</p>
        <div className="krkn-ai-log-follow">
          <Checkbox id={`follow-orchestrator-${runName}`} label="Follow" description="Auto-scroll to latest logs" isChecked={isFollowing} onChange={(_event, checked) => setIsFollowing(checked)} />
        </div>
      </CardBody>
    </Card>
  );
}

export function RunDetail({ run, onBack, onCancel, onReplayScenario }: RunDetailProps) {
  const name = run.metadata.name;
  const [runResource, setRunResource] = useState(run);
  const runResourceRef = useRef(runResource);
  const [summary, setSummary] = useState<KrknAIRunSummary | null>(null);
  const summaryRef = useRef(summary);
  const [scenarioIndex, setScenarioIndex] = useState<KrknAIScenarioIndexResponse | null>(null);
  const [page, setPage] = useState(1);
  const [scenarioFilters, setScenarioFilters] = useState<ScenarioExplorerFilters>({
    search: '',
    generation: null,
    scenarioType: '',
    sort: 'generation',
    direction: 'asc',
  });
  const [scenarioIndexIdentity, setScenarioIndexIdentity] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<KrknAIScenarioIndexRow | null>(null);
  const [scenarioDetails, setScenarioDetails] = useState<Record<string, KrknAIScenarioDetail>>({});
  const [scenarioLoading, setScenarioLoading] = useState<Record<string, boolean>>({});
  const [scenarioUpdating, setScenarioUpdating] = useState<Record<string, boolean>>({});
  const [scenarioErrors, setScenarioErrors] = useState<Record<string, string>>({});
  const [configYaml, setConfigYaml] = useState<string | null>(null);
  const [configState, setConfigState] = useState<ConfigState>('loading');
  const [configError, setConfigError] = useState<string | null>(null);
  const [configRetry, setConfigRetry] = useState(0);
  const detailControllers = useRef(new Map<string, AbortController>());
  const indexRef = useRef(scenarioIndex);
  const indexIdentityRef = useRef(scenarioIndexIdentity);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const phaseRef = useRef(runResource.status?.phase ?? 'Pending');
  const selectedScenarioRef = useRef(selectedScenario);
  const scenarioDetailsRef = useRef(scenarioDetails);
  const scenarioUpdatingRef = useRef(scenarioUpdating);
  const missingRunCount = useRef(0);
  runResourceRef.current = runResource;
  selectedScenarioRef.current = selectedScenario;
  scenarioDetailsRef.current = scenarioDetails;
  scenarioUpdatingRef.current = scenarioUpdating;
  phaseRef.current = runResource.status?.phase ?? 'Pending';
  const indexFilters = useMemo(() => ({
    page,
    limit: SCENARIO_PAGE_LIMIT,
    generation: scenarioFilters.generation ?? undefined,
    search: scenarioFilters.search.trim() || undefined,
    scenarioType: scenarioFilters.scenarioType.trim() || undefined,
    sort: scenarioFilters.sort,
    direction: scenarioFilters.direction,
  }), [page, scenarioFilters.generation, scenarioFilters.search, scenarioFilters.scenarioType, scenarioFilters.sort, scenarioFilters.direction]);
  const queryIdentity = JSON.stringify([name, indexFilters]);
  const indexPending = scenarioIndexIdentity !== queryIdentity && !indexError;
  const visibleScenarioIndex = scenarioIndexIdentity === queryIdentity ? scenarioIndex : null;

  const fetchScenarioDetail = useCallback(async (row: KrknAIScenarioIndexRow, force = false) => {
    const key = scenarioKey(row.generation, row.scenarioId);
    const pending = detailControllers.current.get(key);
    if (pending && !force) return;
    if (pending && force) pending.abort();
    if (!force && scenarioDetailsRef.current[key]) return;

    const controller = new AbortController();
    detailControllers.current.set(key, controller);
    setScenarioLoading((current) => ({ ...current, [key]: true }));
    setScenarioErrors((current) => ({ ...current, [key]: '' }));
    try {
      const detail = await krknAiApi.getScenario(name, row.generation, row.scenarioId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      scenarioDetailsRef.current = { ...scenarioDetailsRef.current, [key]: detail };
      setScenarioDetails((current) => ({ ...current, [key]: detail }));
      scenarioUpdatingRef.current = { ...scenarioUpdatingRef.current, [key]: false };
      setScenarioUpdating((current) => ({ ...current, [key]: false }));
    } catch (detailError) {
      if (!controller.signal.aborted) {
        const status = errorStatus(detailError);
        const isUpdating = isRetryableKrknAIError(detailError) || (status === 404 && isActiveAIRunPhase(phaseRef.current));
        scenarioUpdatingRef.current = { ...scenarioUpdatingRef.current, [key]: isUpdating };
        setScenarioUpdating((current) => ({ ...current, [key]: isUpdating }));
        setScenarioErrors((current) => ({
          ...current,
          [key]: isUpdating ? '' : errorText(detailError),
        }));
      }
    } finally {
      if (detailControllers.current.get(key) === controller) detailControllers.current.delete(key);
      if (!controller.signal.aborted) setScenarioLoading((current) => ({ ...current, [key]: false }));
    }
  }, [name]);

  useEffect(() => {
    runResourceRef.current = run;
    setRunResource(run);
  }, [run]);

  useEffect(() => {
    const controller = new AbortController();
    setConfigYaml(null);
    setConfigError(null);
    if (!run.spec.configMapName) {
      setConfigYaml(null);
      setConfigState('unavailable');
      return () => controller.abort();
    }
    const loadConfig = async () => {
      try {
        const available = await operatorApi.getAvailableFiles('krkn-ai-config', { signal: controller.signal });
        const configFile = available.files.find((file) => file.fileName === run.spec.configMapName);
        if (!configFile) {
          setConfigState('unavailable');
          return;
        }
        const file = await operatorApi.getFile(configFile.fileId, { signal: controller.signal });
        setConfigYaml(file.content);
        setConfigState('available');
      } catch (error) {
        if (controller.signal.aborted) return;
        const status = errorStatus(error);
        if (status === 401 || status === 403 || status === 404) {
          setConfigState('unavailable');
        } else {
          setConfigError(errorText(error));
          setConfigState('error');
        }
      }
    };
    void loadConfig();
    return () => controller.abort();
  }, [name, run.spec.configMapName, configRetry]);

  const loadResults = useCallback(async (signal: AbortSignal, reason: RefreshReason): Promise<KrknAIPollResult> => {
    const options = { signal };
    const refreshSummary = reason !== 'entry' || !summaryRef.current || summaryRef.current.name !== name;
    const previousIndex = indexRef.current;
    const previousIdentity = indexIdentityRef.current;
    let retry = false;
    let summaryStatus: number | undefined;
    let indexStatus: number | undefined;
    let generationCompleted = false;
    let detailRefreshed = false;

    const runRequest = krknAiApi.getRun(name, options).then((nextRun) => {
      if (signal.aborted) return;
      runResourceRef.current = nextRun;
      phaseRef.current = nextRun.status?.phase ?? 'Pending';
      missingRunCount.current = 0;
      setRunResource(nextRun);
      setDeleted(false);
    }, (failure: unknown) => {
      if (signal.aborted) return;
      retry ||= isRetryableKrknAIError(failure);
      if (errorStatus(failure) === 404) {
        missingRunCount.current += 1;
        if (missingRunCount.current >= 2) setDeleted(true);
      } else {
        missingRunCount.current = 0;
      }
    });
    const summaryRequest = refreshSummary ? krknAiApi.getRunSummary(name, options).then((nextSummary) => {
      if (signal.aborted) return;
      generationCompleted = summaryRef.current !== null
        && summaryRef.current.completedGenerations !== nextSummary.completedGenerations;
      summaryRef.current = nextSummary;
      setSummary(nextSummary);
      setSummaryError(null);
      setInitialLoading(false);
    }, (failure: unknown) => {
      if (signal.aborted) return;
      retry ||= isRetryableKrknAIError(failure);
      summaryStatus = errorStatus(failure);
      const cacheMiss = summaryStatus === 404 && (
        isActiveAIRunPhase(phaseRef.current)
        || phaseRef.current === 'Cancelled' && !isCancellationSettled(runResourceRef.current, summaryRef.current)
      );
      setSummaryError(cacheMiss ? 'Run results are not committed yet; retaining the last available snapshot while polling.' : errorText(failure));
      setInitialLoading(false);
    }) : Promise.resolve();
    const indexRequest = krknAiApi.getScenarioIndex(name, indexFilters, options).then((nextIndex) => {
      if (signal.aborted) return;
      const lastPage = Math.max(nextIndex.pagination.totalPages, 1);
      if (indexFilters.page > lastPage) {
        setPage(lastPage);
        return;
      }
      const oldIndex = indexRef.current;
      const selected = selectedScenarioRef.current;
      if (selected) {
        const key = scenarioKey(selected.generation, selected.scenarioId);
        const oldRow = oldIndex?.scenarios.find((row) => scenarioKey(row.generation, row.scenarioId) === key);
        const newRow = nextIndex.scenarios.find((row) => scenarioKey(row.generation, row.scenarioId) === key);
        if (newRow) {
          selectedScenarioRef.current = newRow;
          setSelectedScenario(newRow);
          if (fitnessChanged(oldRow, newRow) || scenarioUpdatingRef.current[key]) {
            detailRefreshed = true;
            void fetchScenarioDetail(newRow, true);
          }
        }
      }
      setScenarioIndex(nextIndex);
      indexRef.current = nextIndex;
      setScenarioIndexIdentity(queryIdentity);
      indexIdentityRef.current = queryIdentity;
      setIndexError(null);
    }, (failure: unknown) => {
      if (signal.aborted) return;
      retry ||= isRetryableKrknAIError(failure);
      indexStatus = errorStatus(failure);
      const waitingForResult = isActiveAIRunPhase(phaseRef.current)
        || phaseRef.current === 'Cancelled' && !isCancellationSettled(runResourceRef.current, summaryRef.current);
      const cacheMiss = indexStatus === 404 && waitingForResult;
      setIndexError(cacheMiss ? 'Scenario results are not committed yet; retaining the last available snapshot while polling.' : errorText(failure));
    });
    await Promise.all([runRequest, summaryRequest, indexRequest]);
    if (signal.aborted) return { active: false, retry: false };
    const waitingForResult = isActiveAIRunPhase(phaseRef.current)
      || (phaseRef.current === 'Cancelled' && !isCancellationSettled(runResourceRef.current, summaryRef.current));
    const transientFailure = retry || (waitingForResult && (summaryStatus === 404 || indexStatus === 404));
    if (waitingForResult && previousIndex && previousIdentity === queryIdentity && indexRef.current?.pagination.total === 0) {
      indexRef.current = previousIndex;
      setScenarioIndex(previousIndex);
    }
    const selected = selectedScenarioRef.current;
    if (!detailRefreshed && selected
      && (scenarioUpdatingRef.current[scenarioKey(selected.generation, selected.scenarioId)]
        || (generationCompleted && selected.generation < (summaryRef.current?.completedGenerations ?? 0)))) {
      void fetchScenarioDetail(selected, true);
    }
    setUpdating(transientFailure);
    return { active: waitingForResult, retry };
  }, [fetchScenarioDetail, indexFilters, name, queryIdentity]);

  const { refresh: refreshResults, retryExhausted } = useKrknAIPolling(loadResults, !deleted);

  useEffect(() => () => {
    detailControllers.current.forEach((request) => request.abort());
    detailControllers.current.clear();
  }, [name]);

  const selectScenario = useCallback((row: KrknAIScenarioIndexRow) => {
    selectedScenarioRef.current = row;
    setSelectedScenario(row);
    void fetchScenarioDetail(row);
  }, [fetchScenarioDetail]);

  const closeScenario = useCallback(() => {
    const selected = selectedScenarioRef.current;
    if (selected) {
      const key = scenarioKey(selected.generation, selected.scenarioId);
      detailControllers.current.get(key)?.abort();
      detailControllers.current.delete(key);
    }
    selectedScenarioRef.current = null;
    setSelectedScenario(null);
  }, []);

  const confirmCancellation = async () => {
    if (!onCancel || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await onCancel(name);
      setCancelDialogOpen(false);
    } catch (error) {
      setCancelError(errorText(error));
    } finally {
      setCancelling(false);
    }
  };

  const phase = runResource.status?.phase ?? summary?.phase ?? 'Pending';
  const failureReason = runResource.status?.failureReason || summary?.failureReason;
  const currentGeneration = summary?.currentGeneration;
  const calculatingGeneration = isActiveAIRunPhase(phase) && currentGeneration != null
    && (summary?.completedGenerations == null || currentGeneration >= summary.completedGenerations)
    ? currentGeneration : null;
  const cluster = summary?.cluster || Object.values(run.spec.targetClusters ?? {})[0]?.[0] || 'Not available';
  const podName = runResource.status?.orchestratorPodName || summary?.orchestratorPodName || '';
  const createdAt = summary?.createdAt || run.metadata.creationTimestamp;
  const generationProgress = summary?.completedGenerations != null && summary.configuredGenerations != null
    ? `${summary.completedGenerations} / ${summary.configuredGenerations}`
    : 'Not available yet';
  const selectedKey = selectedScenario ? scenarioKey(selectedScenario.generation, selectedScenario.scenarioId) : '';
  const detail = selectedKey ? scenarioDetails[selectedKey] ?? null : null;
  const detailLoading = selectedKey ? scenarioLoading[selectedKey] ?? false : false;
  const detailUpdating = selectedKey ? scenarioUpdating[selectedKey] ?? false : false;
  const detailError = selectedKey ? scenarioErrors[selectedKey] ?? null : null;

  if (deleted) {
    return (
      <section className="krkn-ai-run-detail" aria-labelledby="krkn-ai-deleted-title">
        <Button variant="link" icon={<ArrowLeftIcon />} isInline onClick={onBack} style={{ marginBottom: '0.5rem', paddingLeft: 0 }}>Back to Runs</Button>
        <Title id="krkn-ai-deleted-title" headingLevel="h1">Run is no longer available</Title>
        <p>The operator no longer returns {name}. Refresh the run list to discover current runs.</p>
      </section>
    );
  }


  return (
    <main className="krkn-ai-run-detail">
      <header className="krkn-ai-run-detail__header">
        <div className="krkn-ai-run-actions krkn-ai-run-detail__toolbar">
          <Button variant="link" icon={<ArrowLeftIcon />} isInline onClick={onBack} style={{ marginBottom: '0.5rem', paddingLeft: 0 }}>Back to Runs</Button>
          <div className="krkn-ai-run-actions krkn-ai-run-detail__actions">
            {onCancel && !runResource.spec.cancelRequested && canCancelAIRunPhase(phase) && (
              <Button variant="danger" icon={<BanIcon />} onClick={() => {
                setCancelError(null);
                setCancelDialogOpen(true);
              }}>
                Cancel run
              </Button>
            )}
            <ResultsDownloadButton runName={name} runPhase={phase} summary={summary} />
          </div>
        </div>
        <div className="krkn-ai-run-detail__title-row">
          <div>
            <Title headingLevel="h1" size="2xl">{name}</Title>
            <p className="krkn-ai-run-detail__cluster"><TopologyIcon aria-hidden="true" />Cluster: {cluster}</p>
          </div>
        </div>
        {failureReason && <p className="krkn-ai-run-detail__failure">{failureReason}</p>}
        {initialLoading && <div className="krkn-ai-results-loading" role="status"><Spinner size="sm" aria-label="Loading run results" /><p>Loading run results…</p></div>}
        <div className="krkn-ai-run-detail__metadata-groups">
          <MetadataPanel id="krkn-ai-run-overview" title="Run" icon={<CalendarAltIcon aria-hidden="true" />} className="krkn-ai-run-detail__metadata-group--run" items={[
            { label: 'Status', value: <Label color={phase === 'Succeeded' ? 'green' : phase === 'Failed' ? 'red' : phase === 'Running' ? 'blue' : phase === 'Cancelling' ? 'orange' : 'grey'} icon={phase === 'Cancelled' ? <BanIcon /> : undefined}>{phase}</Label> },
            { label: 'Created', value: createdAt ? <time dateTime={createdAt}>{formatDateTime(createdAt)}</time> : 'Not available' },
            { label: 'Cancellation requested', value: runResource.status.cancellationRequestedAt ? <time dateTime={runResource.status.cancellationRequestedAt}>{formatDateTime(runResource.status.cancellationRequestedAt)}</time> : runResource.spec.cancelRequested ? 'Requested' : 'Not requested' },
            { label: 'Artifact status', value: <Label color={summary?.artifactStatus === 'failed' ? 'red' : summary?.artifactStatus === 'succeeded' ? 'green' : summary?.artifactStatus === 'in_progress' ? 'blue' : 'grey'} icon={summary?.artifactStatus === 'cancelled' ? <BanIcon /> : undefined}>{summary?.artifactStatus === 'in_progress' ? 'In progress' : summary?.artifactStatus === 'succeeded' ? 'Succeeded' : summary?.artifactStatus === 'failed' ? 'Failed' : summary?.artifactStatus === 'cancelled' ? 'Cancelled' : 'Not available'}</Label> },
            { label: 'Results collected', value: summary?.resultsCompleteness === 'partial' ? 'Partial snapshots' : summary?.resultsCompleteness === 'complete' ? 'Complete' : summary?.resultsCompleteness === 'none' ? 'None committed' : 'Not available' },
            { label: 'Last committed', value: summary?.lastCommittedAt ? <time dateTime={summary.lastCommittedAt}>{formatDateTime(summary.lastCommittedAt)}</time> : 'Not available' },
          ]} />
          <MetadataPanel id="krkn-ai-run-progress" title="Progress" icon={<ClipboardListIcon aria-hidden="true" />} items={[
            { label: 'Generations completed', value: generationProgress },
            { label: 'Population size', value: summary?.populationSize ?? 'Not available yet' },
            { label: 'Scenarios completed', value: summary?.completedScenarios ?? 'Not available yet' },
          ]} />
          <MetadataPanel id="krkn-ai-run-fitness" title="Fitness" scale="0–100" icon={<ChartLineIcon aria-hidden="true" />} items={[
            { label: 'Best fitness', value: <FitnessValue value={summary?.bestFitness} calculatingGeneration={calculatingGeneration} /> },
            { label: 'Average fitness', value: <FitnessValue value={summary?.averageFitness} calculatingGeneration={calculatingGeneration} /> },
            { label: 'Baseline fitness', value: summary?.baselineFitness == null ? 'Not available yet' : summary.baselineFitness.toLocaleString(undefined, { maximumFractionDigits: 4 }) },
          ]} />
        </div>
        {updating && <Alert variant="warning" title="Results are updating" isInline>Showing the last committed summary and scenario results while the next artifact sync completes.</Alert>}
        {retryExhausted && <Alert variant="warning" title="Automatic result retries paused" isInline>Retry when the service is available.</Alert>}
        {(updating || summaryError || indexError) && <Button variant="link" isInline onClick={refreshResults}>Retry results</Button>}
        {summaryError && <p className="krkn-ai-run-detail__error">{summaryError}</p>}
        {indexError && <p className="krkn-ai-run-detail__error">{indexError}</p>}
      </header>

      <Modal
        variant={ModalVariant.small}
        title="Cancel Krkn-AI run?"
        isOpen={cancelDialogOpen}
        onClose={() => {
          if (!cancelling) setCancelDialogOpen(false);
        }}
        actions={[
          <Button key="cancel-run" variant="danger" icon={<BanIcon />} onClick={() => void confirmCancellation()} isLoading={cancelling} isDisabled={cancelling}>
            Cancel run
          </Button>,
          <Button key="keep-running" variant="link" onClick={() => setCancelDialogOpen(false)} isDisabled={cancelling}>
            Keep running
          </Button>,
        ]}
      >
        <p>Cancellation stops execution without deleting the run or collected results. Partial snapshots remain available after they are committed.</p>
        {cancelError && <Alert variant="danger" title="Unable to cancel Krkn-AI run" isInline>{cancelError}</Alert>}
      </Modal>
        {summary?.resultsCompleteness === 'none' && <p className="krkn-ai-not-available">No result artifacts were committed. The Krkn-AI run itself is retained and is not deleted.</p>}

      <Card className="krkn-ai-run-detail__config">
        <CardTitle><Title headingLevel="h2" size="lg">Run configuration</Title></CardTitle>
        <CardBody>
          <p>Config: <code>{run.spec.configMapName || 'Not available'}</code></p>
          <details>
            <summary>View krkn-ai.yaml used for this run</summary>
            {configYaml && <pre className="krkn-ai-run-detail__yaml">{configYaml}</pre>}
            {configState === 'loading' && !configYaml && <p role="status">Loading saved configuration…</p>}
            {configState === 'error' && (
              <Alert variant="warning" title="Unable to load saved configuration" isInline>
                {configError || 'The config file request failed.'}
                {' '}
                <Button variant="link" onClick={() => setConfigRetry((value) => value + 1)}>Retry configuration load</Button>
              </Alert>
            )}
            {configState === 'unavailable' && (
              <p className="krkn-ai-not-available">This configuration is not available to your account, or is no longer available.</p>
            )}
          </details>
        </CardBody>
      </Card>

      {podName ? (
        <OrchestratorLogPanel runName={name} podName={podName} phase={phase} />
      ) : (
        <Card className="krkn-ai-run-detail__main-logs">
          <CardTitle><Title headingLevel="h2" size="lg">Orchestrator pod log</Title></CardTitle>
          <CardBody><p className="krkn-ai-not-available">Waiting for the operator to record the orchestrator Pod name.</p></CardBody>
        </Card>
      )}

      <ScenarioExplorer
        scenarios={visibleScenarioIndex?.scenarios ?? []}
        pagination={visibleScenarioIndex?.pagination ?? { page, limit: SCENARIO_PAGE_LIMIT, total: 0, totalPages: 0 }}
        loading={indexPending}
        error={indexError}
        page={page}
        onPageChange={setPage}
        filters={scenarioFilters}
        configuredGenerations={summary?.configuredGenerations ?? null}
        onFiltersChange={(filters) => {
          setScenarioFilters(filters);
          if (filters.search !== scenarioFilters.search || filters.generation !== scenarioFilters.generation
            || filters.scenarioType !== scenarioFilters.scenarioType) setIndexError(null);
          setPage(1);
        }}
        selectedScenario={selectedScenario}
        onSelect={selectScenario}
        onReplayScenario={onReplayScenario ? (scenario) => onReplayScenario({ ...scenario, registryName: runResource.spec.registryName }) : undefined}
        onClose={closeScenario}
        detail={detail}
        detailLoading={detailLoading}
        detailUpdating={detailUpdating}
        detailError={detailError}
        onRetryDetail={() => selectedScenario && void fetchScenarioDetail(selectedScenario, true)}
        clusterName={cluster}
        runName={name}
        runPhase={phase}
        currentGeneration={summary?.currentGeneration ?? null}
        completedGenerations={summary?.completedGenerations ?? null}
        cancelledGeneration={summary?.cancelledGeneration ?? null}
      />
      <Card className="krkn-ai-run-detail__fitness">
        <CardBody>
          <FitnessChart
            points={summary?.fitnessProgression ?? []}
            runName={name}
            runPhase={phase}
            completedGenerations={summary?.completedGenerations ?? null}
          />
        </CardBody>
      </Card>

    </main>
  );
}
