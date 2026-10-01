import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Label, Title } from '@patternfly/react-core';
import {
  CalendarAltIcon,
  ChartLineIcon,
  ClipboardListIcon,
  CubesIcon,
  DnaIcon,
  FileCodeIcon,
  HeartbeatIcon,
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
import { ScenarioExplorer } from './ScenarioExplorer';
import { formatDateTime } from '../../utils/dateTime';

interface RunDetailProps {
  run: KrknAIRunResource;
  onBack: () => void;
}

const ACTIVE_PHASES: Record<string, true> = { Pending: true, Provisioning: true, Running: true };
const TERMINAL_PHASES: Record<string, true> = { Succeeded: true, Failed: true, Cancelled: true };
const POLL_INTERVAL_MS = 10_000;
const SCENARIO_PAGE_LIMIT = 500;

type ConfigState = 'loading' | 'available' | 'unavailable' | 'error';

function mergeIndexWhileActive(
  previous: KrknAIScenarioIndexResponse | null,
  next: KrknAIScenarioIndexResponse,
  active: boolean,
): KrknAIScenarioIndexResponse {
  if (!active || !previous) return next;
  const visible = new Set(next.scenarios.map((row) => scenarioKey(row.generation, row.scenarioId)));
  const scenarios = [
    ...next.scenarios,
    ...previous.scenarios.filter((row) => !visible.has(scenarioKey(row.generation, row.scenarioId))),
  ];
  const total = Math.max(next.pagination.total, scenarios.length);
  return {
    ...next,
    scenarios,
    pagination: {
      ...next.pagination,
      total,
      totalPages: Math.max(next.pagination.totalPages, Math.ceil(total / next.pagination.limit)),
    },
  };
}


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
  const [logs, setLogs] = useState<string[]>(['Connecting to orchestrator log stream…']);
  const [hasConnected, setHasConnected] = useState(false);
  const everConnectedRef = useRef(false);
  const follow = TERMINAL_PHASES[phase] !== true;
  const connectionId = `krkn-ai-orchestrator-${runName}`;
  const url = websocketService.buildAiRunLogsUrl(runName, follow, 200, true);
  const handleMessage = useCallback((message: string) => {
    setLogs((current) => {
      if (current.length === 0 || current[0].startsWith('Connecting') || current[0].startsWith('Reconnecting')) {
        return [message];
      }
      return [...current, message];
    });
  }, []);
  const { connectionState } = useWebSocket(connectionId, url, handleMessage, {
    disabled: !podName,
    subscriptionMode: false,
  });

  useEffect(() => {
    if (connectionState === 'reconnecting' || (connectionState === 'connecting' && everConnectedRef.current)) {
      setLogs(['Reconnecting to orchestrator log stream…']);
      setHasConnected(false);
      return;
    }
    if (connectionState === 'connected') {
      if (everConnectedRef.current) setLogs([]);
      everConnectedRef.current = true;
      setHasConnected(true);
    }
  }, [connectionState]);

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
        ) : !hasConnected && logs.length === 0 ? (
          <p className="krkn-ai-not-available">Connecting to the operator-authorized orchestrator log stream…</p>
        ) : (
          <LogTerminal logs={logs} ariaLabel="Orchestrator log output" />
        )}
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
  const phaseRef = useRef(run.status?.phase ?? 'Pending');
  const selectedScenarioRef = useRef(selectedScenario);
  const scenarioDetailsRef = useRef(scenarioDetails);
  const scenarioUpdatingRef = useRef(scenarioUpdating);
  const missingRunCount = useRef(0);
  indexRef.current = scenarioIndex;
  phaseRef.current = summary?.phase ?? run.status?.phase ?? 'Pending';
  selectedScenarioRef.current = selectedScenario;
  scenarioDetailsRef.current = scenarioDetails;
  scenarioUpdatingRef.current = scenarioUpdating;

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

    const refresh = async () => {
      if (disposed || document.hidden || deleted) return;
      if (inFlight) return;
      clearTimer();
      inFlight = true;
      controller = new AbortController();
      const [summaryResult, indexResult] = await Promise.allSettled([
        krknAiApi.getRunSummary(name, { signal: controller.signal }),
        krknAiApi.getScenarioIndex(name, { page, limit: SCENARIO_PAGE_LIMIT }, { signal: controller.signal }),
      ]);
      if (disposed) return;
      initialLoadCompleted = true;

      const summaryStatus = summaryResult.status === 'rejected' ? errorStatus(summaryResult.reason) : undefined;
      const indexStatus = indexResult.status === 'rejected' ? errorStatus(indexResult.reason) : undefined;
      const nextPhase = summaryResult.status === 'fulfilled' ? summaryResult.value.phase : phaseRef.current;
      phaseRef.current = nextPhase || 'Pending';
      const generationCompleted = summaryResult.status === 'fulfilled'
        && summaryRef.current?.completedGenerations !== summaryResult.value.completedGenerations;

      if (summaryResult.status === 'fulfilled') {
        missingRunCount.current = 0;
        const nextSummary = summaryResult.value;
        summaryRef.current = nextSummary;
        setSummary(nextSummary);
        setSummaryError(null);
        setDeleted(false);
      } else {
        const failure = summaryResult.reason;
        const cacheMiss = summaryStatus === 404 && ACTIVE_PHASES[phaseRef.current] === true;
        setSummaryError(cacheMiss ? 'Run results are not visible in the operator cache yet; retrying while the run is active.' : errorText(failure));
        if (summaryStatus === 404) {
          missingRunCount.current += 1;
          if (missingRunCount.current >= 2 || TERMINAL_PHASES[phaseRef.current] === true) {
            setDeleted(true);
          }
        } else {
          missingRunCount.current = 0;
        }
      }
      if (indexResult.status === 'fulfilled') {
        const oldIndex = indexRef.current;
        const nextIndex = mergeIndexWhileActive(
          oldIndex,
          indexResult.value,
          ACTIVE_PHASES[phaseRef.current] === true,
        );
        const selected = selectedScenarioRef.current;
        if (selected) {
          const key = scenarioKey(selected.generation, selected.scenarioId);
          const oldRow = oldIndex?.scenarios.find((row) => scenarioKey(row.generation, row.scenarioId) === key);
          const newRow = nextIndex.scenarios.find((row) => scenarioKey(row.generation, row.scenarioId) === key);
          if (newRow) {
            selectedScenarioRef.current = newRow;
            setSelectedScenario(newRow);
            if (fitnessChanged(oldRow, newRow) || scenarioUpdatingRef.current[key]
              || (generationCompleted && newRow.generation < (summaryRef.current?.completedGenerations ?? 0))) {
              void fetchScenarioDetail(newRow, true);
            }
          }
        }
        setScenarioIndex(nextIndex);
        indexRef.current = nextIndex;
        setIndexError(null);
      } else {
        const cacheMiss = indexStatus === 404 && ACTIVE_PHASES[phaseRef.current] === true;
        setIndexError(cacheMiss ? 'Scenario results are not visible in the operator cache yet; retrying while the run is active.' : errorText(indexResult.reason));
      }

      const transientFailure = summaryStatus === 503 || indexStatus === 503
        || (ACTIVE_PHASES[phaseRef.current] === true && (summaryStatus === 404 || indexStatus === 404));
      setUpdating(transientFailure);
      setInitialLoading(false);
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
    if (!document.hidden) void refresh();

    return () => {
      disposed = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [deleted, fetchScenarioDetail, name, page]);

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
        <Button variant="secondary" onClick={onBack}>Back to runs</Button>
        <Title id="krkn-ai-deleted-title" headingLevel="h1">Run is no longer available</Title>
        <p>The operator no longer returns {name}. Refresh the run list to discover current runs.</p>
      </section>
    );
  }

  return (
    <main className="krkn-ai-run-detail">
      <header className="krkn-ai-run-detail__header">
        <Button variant="secondary" onClick={onBack} className="krkn-ai-run-detail__back">Back to runs</Button>
        <div className="krkn-ai-run-detail__title-row">
          <div>
            <Title headingLevel="h1" size="2xl">{name}</Title>
            <p className="krkn-ai-run-detail__cluster"><TopologyIcon aria-hidden="true" />Cluster: {cluster}</p>
          </div>
          <Label color={phase === 'Succeeded' ? 'green' : phase === 'Failed' ? 'red' : phase === 'Running' ? 'blue' : 'grey'}>
            {phase}
          </Label>
        </div>
        <div className="krkn-ai-run-detail__metadata-groups">
          <section className="krkn-ai-run-detail__metadata-group" aria-labelledby="krkn-ai-run-overview">
            <h2 id="krkn-ai-run-overview" className="krkn-ai-run-detail__metadata-heading">
              <CalendarAltIcon aria-hidden="true" />Run
            </h2>
            <dl className="krkn-ai-run-detail__metadata">
              <div>
                <dt><CalendarAltIcon aria-hidden="true" />Created</dt>
                <dd>{createdAt ? <time dateTime={createdAt}>{formatDateTime(createdAt)}</time> : 'Not available'}</dd>
              </div>
              <div>
                <dt><FileCodeIcon aria-hidden="true" />Artifact status</dt>
                <dd>{summary?.artifactStatus ?? 'not_available'}</dd>
              </div>
            </dl>
          </section>

          <section className="krkn-ai-run-detail__metadata-group" aria-labelledby="krkn-ai-run-progress">
            <h2 id="krkn-ai-run-progress" className="krkn-ai-run-detail__metadata-heading">
              <ClipboardListIcon aria-hidden="true" />Progress
            </h2>
            <dl className="krkn-ai-run-detail__metadata">
              <div>
                <dt><DnaIcon aria-hidden="true" />Generations completed</dt>
                <dd>{generationProgress}</dd>
              </div>
              <div>
                <dt><CubesIcon aria-hidden="true" />Population size</dt>
                <dd>{summary?.populationSize ?? 'Not available yet'}</dd>
              </div>
              <div>
                <dt><ClipboardListIcon aria-hidden="true" />Scenarios completed</dt>
                <dd>{summary?.completedScenarios ?? 'Not available yet'}</dd>
              </div>
            </dl>
          </section>

          <section className="krkn-ai-run-detail__metadata-group" aria-labelledby="krkn-ai-run-fitness">
            <h2 id="krkn-ai-run-fitness" className="krkn-ai-run-detail__metadata-heading">
              <ChartLineIcon aria-hidden="true" />Fitness
            </h2>
            <dl className="krkn-ai-run-detail__metadata">
              <div>
                <dt><ChartLineIcon aria-hidden="true" />Best fitness (0–100)</dt>
                <dd><FitnessValue value={summary?.bestFitness} calculatingGeneration={calculatingGeneration} /></dd>
              </div>
              <div>
                <dt><ChartLineIcon aria-hidden="true" />Average fitness (0–100)</dt>
                <dd><FitnessValue value={summary?.averageFitness} calculatingGeneration={calculatingGeneration} /></dd>
              </div>
              <div>
                <dt><HeartbeatIcon aria-hidden="true" />Baseline fitness (0–100)</dt>
                <dd>{summary?.baselineFitness == null ? 'Not available yet' : summary.baselineFitness.toLocaleString(undefined, { maximumFractionDigits: 4 })}</dd>
              </div>
            </dl>
          </section>
        </div>
        {summary?.failureReason && <p className="krkn-ai-run-detail__failure">{summary.failureReason}</p>}
        {initialLoading && <p role="status">Loading committed run results…</p>}
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

      <Card className="krkn-ai-run-detail__fitness">
        <CardBody>
          <FitnessChart points={summary?.fitnessProgression ?? []} runName={name} />
        </CardBody>
      </Card>

      <ScenarioExplorer
        scenarios={scenarioIndex?.scenarios ?? []}
        pagination={scenarioIndex?.pagination ?? { page: 1, limit: SCENARIO_PAGE_LIMIT, total: 0, totalPages: 0 }}
        page={page}
        onPageChange={setPage}
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
    </main>
  );
}
