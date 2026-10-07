import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Checkbox, Label, Spinner, Title } from '@patternfly/react-core';
import {
  ArrowLeftIcon,
  CalendarAltIcon,
  ChartLineIcon,
  ClipboardListIcon,
  TopologyIcon,
} from '@patternfly/react-icons';
import { operatorApi } from '../../services/operatorApi';
import { krknAiApi } from '../../services/krknAiApi';
import type {
  KrknAIRunResource,
  KrknAIRunSummary,
  KrknAIScenarioDetail,
  KrknAIScenarioIndexResponse,
  KrknAIScenarioIndexRow,
} from '../../services/krknAiApi';
import { isApiError } from '../../utils/apiClient';
import { websocketService } from '../../services/websocketService';
import { useWebSocket } from '../../hooks/useWebSocket';
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
}

const ACTIVE_PHASES: Record<string, true> = { Pending: true, Provisioning: true, Running: true };
const TERMINAL_PHASES: Record<string, true> = { Succeeded: true, Failed: true, Cancelled: true };
const POLL_INTERVAL_MS = 10_000;
const SCENARIO_PAGE_LIMIT = 500;
const ORCHESTRATOR_LOG_WINDOW = 500;

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
  const [logWindow, setLogWindow] = useState<{ lines: string[]; truncated: boolean }>({
    lines: ['Connecting to orchestrator log stream…'],
    truncated: false,
  });
  const [hasConnected, setHasConnected] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const everConnectedRef = useRef(false);
  const follow = TERMINAL_PHASES[phase] !== true;
  const connectionId = `krkn-ai-orchestrator-${runName}`;
  const url = websocketService.buildAiRunLogsUrl(runName, follow, follow ? 200 : undefined, true);
  const handleMessage = useCallback((message: string) => {
    setLogWindow((current) => {
      const existing = current.lines.length === 1
        && (current.lines[0].startsWith('Connecting') || current.lines[0].startsWith('Reconnecting'))
        ? []
        : current.lines;
      const lines = [...existing, message];
      return lines.length > ORCHESTRATOR_LOG_WINDOW
        ? { lines: lines.slice(-ORCHESTRATOR_LOG_WINDOW), truncated: true }
        : { lines, truncated: current.truncated };
    });
  }, []);
  const { connectionState } = useWebSocket(connectionId, url, handleMessage, {
    disabled: !podName,
    subscriptionMode: false,
  });

  useEffect(() => {
    setLogWindow({ lines: ['Connecting to orchestrator log stream…'], truncated: false });
    setHasConnected(false);
    everConnectedRef.current = false;
  }, [url]);

  useEffect(() => {
    if (connectionState === 'reconnecting' || (connectionState === 'connecting' && everConnectedRef.current)) {
      setLogWindow((current) => ({ lines: ['Reconnecting to orchestrator log stream…'], truncated: current.truncated }));
      setHasConnected(false);
      return;
    }
    if (connectionState === 'connected') {
      everConnectedRef.current = true;
      setHasConnected(true);
    }
  }, [connectionState]);

  useLayoutEffect(() => {
    if (isFollowing && logsContainerRef.current && logWindow.lines.length > 0) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [isFollowing, logWindow.lines]);

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
        ) : !hasConnected && logWindow.lines.length === 0 ? (
          <p className="krkn-ai-not-available">Connecting to the operator-authorized orchestrator log stream…</p>
        ) : (
          <>
            {logWindow.truncated && (
              <p role="status" className="krkn-ai-log-truncation">
                Showing only the most recent {ORCHESTRATOR_LOG_WINDOW} log entries. Download the complete results ZIP for full completed logs.
              </p>
            )}
            <LogTerminal ref={logsContainerRef} logs={logWindow.lines} ariaLabel="Orchestrator log output" />
          </>
        )}
        <div className="krkn-ai-log-follow">
          <Checkbox id={`follow-orchestrator-${runName}`} label="Follow" description="Auto-scroll to latest logs" isChecked={isFollowing} onChange={(_event, checked) => setIsFollowing(checked)} />
        </div>
      </CardBody>
    </Card>
  );
}

export function RunDetail({ run, onBack }: RunDetailProps) {
  const name = run.metadata.name;
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
  const phaseRef = useRef(run.status?.phase ?? 'Pending');
  const selectedScenarioRef = useRef(selectedScenario);
  const scenarioDetailsRef = useRef(scenarioDetails);
  const scenarioUpdatingRef = useRef(scenarioUpdating);
  const missingRunCount = useRef(0);
  indexRef.current = scenarioIndex;
  indexIdentityRef.current = scenarioIndexIdentity;
  phaseRef.current = summary?.phase ?? run.status?.phase ?? 'Pending';
  selectedScenarioRef.current = selectedScenario;
  scenarioDetailsRef.current = scenarioDetails;
  scenarioUpdatingRef.current = scenarioUpdating;
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
        const isUpdating = status === 503 || (status === 404 && ACTIVE_PHASES[phaseRef.current] === true);
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

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let pausedForActiveRuns = false;
    let initialLoadCompleted = false;
    let refreshWhenVisible = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNext = () => {
      if (disposed || timer !== null || deleted) return;
      const shouldPoll = ACTIVE_PHASES[phaseRef.current] === true;
      if (document.hidden) {
        pausedForActiveRuns ||= shouldPoll;
        return;
      }
      if (shouldPoll) {
        timer = setTimeout(() => {
          timer = null;
          void refresh();
        }, POLL_INTERVAL_MS);
      }
    };

    const refresh = async (refreshSummary = true) => {
      if (disposed || document.hidden || deleted || inFlight) return;
      clearTimer();
      inFlight = true;
      controller = new AbortController();
      const options = { signal: controller.signal };
      const previousIndex = indexRef.current;
      const previousIdentity = indexIdentityRef.current;
      let summaryStatus: number | undefined;
      let indexStatus: number | undefined;
      let generationCompleted = false;
      let detailRefreshed = false;

      const summaryRequest = refreshSummary ? krknAiApi.getRunSummary(name, options).then((nextSummary) => {
        if (disposed) return;
        generationCompleted = summaryRef.current !== null
          && summaryRef.current.completedGenerations !== nextSummary.completedGenerations;
        phaseRef.current = nextSummary.phase || 'Pending';
        missingRunCount.current = 0;
        summaryRef.current = nextSummary;
        setSummary(nextSummary);
        setSummaryError(null);
        setDeleted(false);
        setInitialLoading(false);
      }, (failure: unknown) => {
        if (disposed) return;
        summaryStatus = errorStatus(failure);
        const cacheMiss = summaryStatus === 404 && ACTIVE_PHASES[phaseRef.current] === true;
        setSummaryError(cacheMiss ? 'Run results are not visible in the operator cache yet; retrying while the run is active.' : errorText(failure));
        if (summaryStatus === 404) {
          missingRunCount.current += 1;
          if (missingRunCount.current >= 2 || TERMINAL_PHASES[phaseRef.current] === true) setDeleted(true);
        } else {
          missingRunCount.current = 0;
        }
        setInitialLoading(false);
      }) : Promise.resolve();

      const indexRequest = krknAiApi.getScenarioIndex(name, indexFilters, options).then((nextIndex) => {
        if (disposed) return;
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
        if (disposed) return;
        indexStatus = errorStatus(failure);
        const cacheMiss = indexStatus === 404 && ACTIVE_PHASES[phaseRef.current] === true;
        setIndexError(cacheMiss ? 'Scenario results are not visible in the operator cache yet; retrying while the run is active.' : errorText(failure));
      });

      await Promise.all([summaryRequest, indexRequest]);
      if (disposed) return;
      initialLoadCompleted = true;
      const transientFailure = summaryStatus === 503 || indexStatus === 503
        || (ACTIVE_PHASES[phaseRef.current] === true && (summaryStatus === 404 || indexStatus === 404));
      if (ACTIVE_PHASES[phaseRef.current] === true
        && previousIndex && previousIdentity === queryIdentity && indexRef.current?.pagination.total === 0) {
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
      inFlight = false;
      controller = null;

      if (refreshWhenVisible && !document.hidden && ACTIVE_PHASES[phaseRef.current] === true) {
        refreshWhenVisible = false;
        void refresh();
      } else {
        refreshWhenVisible = false;
        scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        pausedForActiveRuns = ACTIVE_PHASES[phaseRef.current] === true;
        clearTimer();
        return;
      }
      if (!initialLoadCompleted) {
        void refresh();
        return;
      }
      if (pausedForActiveRuns && ACTIVE_PHASES[phaseRef.current] === true) {
        pausedForActiveRuns = false;
        if (inFlight) refreshWhenVisible = true;
        else void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!document.hidden) void refresh(!summaryRef.current || summaryRef.current.name !== name);

    return () => {
      disposed = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [deleted, fetchScenarioDetail, indexFilters, name, queryIdentity]);

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

  const phase = summary?.phase ?? run.status?.phase ?? 'Pending';
  const currentGeneration = summary?.currentGeneration;
  const calculatingGeneration = ACTIVE_PHASES[phase] === true && currentGeneration != null
    && (summary?.completedGenerations == null || currentGeneration >= summary.completedGenerations)
    ? currentGeneration : null;
  const cluster = summary?.cluster || Object.values(run.spec.targetClusters ?? {})[0]?.[0] || 'Not available';
  const podName = summary?.orchestratorPodName || run.status?.orchestratorPodName || '';
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
          <ResultsDownloadButton runName={name} runPhase={phase} />
        </div>
        <div className="krkn-ai-run-detail__title-row">
          <div>
            <Title headingLevel="h1" size="2xl">{name}</Title>
            <p className="krkn-ai-run-detail__cluster"><TopologyIcon aria-hidden="true" />Cluster: {cluster}</p>
          </div>
        </div>
        {initialLoading && <div className="krkn-ai-results-loading" role="status"><Spinner size="sm" aria-label="Loading run results" /><p>Loading run results…</p></div>}
        <div className="krkn-ai-run-detail__metadata-groups">
          <MetadataPanel id="krkn-ai-run-overview" title="Run" icon={<CalendarAltIcon aria-hidden="true" />} className="krkn-ai-run-detail__metadata-group--run" items={[
            { label: 'Status', value: <Label color={phase === 'Succeeded' ? 'green' : phase === 'Failed' ? 'red' : phase === 'Running' ? 'blue' : 'grey'}>{phase}</Label> },
            { label: 'Created', value: createdAt ? <time dateTime={createdAt}>{formatDateTime(createdAt)}</time> : 'Not available' },
            { label: 'Artifact status', value: <Label color={summary?.artifactStatus === 'failed' ? 'red' : summary?.artifactStatus === 'succeeded' ? 'green' : summary?.artifactStatus === 'in_progress' ? 'blue' : 'grey'}>{summary?.artifactStatus === 'in_progress' ? 'In progress' : summary?.artifactStatus === 'succeeded' ? 'Succeeded' : summary?.artifactStatus === 'failed' ? 'Failed' : 'Not available'}</Label> },
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
        {summary?.failureReason && <p className="krkn-ai-run-detail__failure">{summary.failureReason}</p>}
        {updating && <Alert variant="warning" title="Results are updating" isInline>Showing the last committed summary and scenario results while the next artifact sync completes.</Alert>}
        {summaryError && <p className="krkn-ai-run-detail__error">{summaryError}</p>}
        {indexError && <p className="krkn-ai-run-detail__error">{indexError}</p>}
      </header>

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
        onClose={closeScenario}
        detail={detail}
        detailLoading={detailLoading}
        detailUpdating={detailUpdating}
        detailError={detailError}
        onRetryDetail={() => selectedScenario && void fetchScenarioDetail(selectedScenario, true)}
        clusterName={cluster}
        runPhase={phase}
        currentGeneration={summary?.currentGeneration ?? null}
        completedGenerations={summary?.completedGenerations ?? null}
      />
      <Card className="krkn-ai-run-detail__fitness">
        <CardBody>
          <FitnessChart points={summary?.fitnessProgression ?? []} runName={name} />
        </CardBody>
      </Card>

    </main>
  );
}
