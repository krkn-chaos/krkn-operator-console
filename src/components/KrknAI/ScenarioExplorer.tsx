import { useMemo, useState } from 'react';
import { Button, ClipboardCopy, Label, Modal, ModalVariant, Spinner, Tab, TabTitleText, Tabs, Title, Tooltip } from '@patternfly/react-core';
import { EyeIcon, SyncAltIcon } from '@patternfly/react-icons';
import { LogViewer } from '../LogViewer';
import { ScenarioHealthCharts } from './ScenarioHealthCharts';
import { MetadataPanel } from './MetadataPanel';
import './ScenarioDetail.css';
import type {
  KrknAIScenarioDetail,
  KrknAIScenarioIndexRow,
  KrknAIScenarioPagination,
  KrknAIScenarioSortKey,
} from '../../services/krknAiApi';

interface ScenarioExplorerProps {
  scenarios: KrknAIScenarioIndexRow[];
  pagination: KrknAIScenarioPagination;
  page: number;
  loading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  filters: ScenarioExplorerFilters;
  configuredGenerations: number | null;
  onFiltersChange: (filters: ScenarioExplorerFilters) => void;
  selectedScenario: KrknAIScenarioIndexRow | null;
  onSelect: (scenario: KrknAIScenarioIndexRow) => void;
  onClose: () => void;
  detail: KrknAIScenarioDetail | null;
  detailLoading: boolean;
  detailUpdating: boolean;
  detailError: string | null;
  onRetryDetail: () => void;
  clusterName: string;
  runPhase: string;
  currentGeneration: number | null;
  completedGenerations: number | null;
}

export interface ScenarioExplorerFilters {
  search: string;
  generation: number | null;
  scenarioType: string;
  sort: KrknAIScenarioSortKey;
  direction: 'asc' | 'desc';
}
type ScenarioSortKey = KrknAIScenarioSortKey;


const columns: Array<{ key: ScenarioSortKey; label: string }> = [
  { key: 'generation', label: 'Generation' },
  { key: 'scenarioId', label: 'Scenario ID' },
  { key: 'scenarioType', label: 'Scenario name' },
  { key: 'fitnessScore', label: 'Fitness score (0–100)' },
  { key: 'outcome', label: 'Status' },
  { key: 'durationSeconds', label: 'Duration' },
];

const formatFitness = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 4 });
const ACTIVE_PHASES: Record<string, true> = { Creating: true, Pending: true, Provisioning: true, Running: true };

function isGenerationFinalized(row: KrknAIScenarioIndexRow, completedGenerations: number | null): boolean {
  return row.fitnessState === 'final'
    && completedGenerations !== null
    && row.generation < completedGenerations;
}

function isCalculationPending(
  row: KrknAIScenarioIndexRow,
  runPhase: string,
  currentGeneration: number | null,
  completedGenerations: number | null,
): boolean {
  return ACTIVE_PHASES[runPhase] === true
    && row.fitnessState !== 'unfinalized'
    && (row.fitnessState === 'provisional'
      || row.generation === currentGeneration
      || completedGenerations === null
      || row.generation >= completedGenerations);
}

function CalculationStatus({ label }: { label: string }) {
  const explanation = `${label}; calculation waits for generation completion.`;
  return (
    <span className="krkn-ai-fitness-calculating" role="status" aria-label={explanation}>
      <Tooltip content={explanation} position="top">
        <span tabIndex={0}>
          <Spinner size="sm" aria-label={label} />
        </span>
      </Tooltip>
    </span>
  );
}

function rowStatus(row: KrknAIScenarioIndexRow): string {
  if (row.phase) return row.phase;
  if (row.outcome === 'succeeded') return 'Succeeded';
  if (row.outcome === 'failed') return 'Failed';
  return 'Result pending';
}

function statusColor(status: string): 'blue' | 'green' | 'grey' | 'orange' | 'red' {
  if (status === 'Running' || status === 'Provisioning') return 'blue';
  if (status === 'Succeeded') return 'green';
  if (status === 'Failed') return 'red';
  if (status === 'Pending' || status === 'Creating') return 'orange';
  return 'grey';
}


function scenarioKey(row: KrknAIScenarioIndexRow): string {
  return `${row.generation}:${row.scenarioId}`;
}

function isBaselineScenario(scenario: KrknAIScenarioIndexRow): boolean {
  return scenario.scenarioId === 'baseline';
}


function parameterRows(parameters: unknown): Array<[string, unknown]> {
  if (Array.isArray(parameters)) {
    return parameters.map((parameter, index) => {
      if (parameter !== null && typeof parameter === 'object') {
        if ('name' in parameter && typeof parameter.name === 'string') {
          return [parameter.name, 'value' in parameter ? parameter.value : parameter];
        }
      }
      return [`Parameter ${index + 1}`, parameter];
    });
  }
  if (parameters !== null && typeof parameters === 'object') return Object.entries(parameters);
  return [];
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'Not available';
  return JSON.stringify(value) ?? 'Not available';
}

function ScenarioDetail({
  row,
  detail,
  loading,
  updating,
  error,
  onRetry,
  clusterName,
  runPhase,
  currentGeneration,
  completedGenerations,
}: {
  row: KrknAIScenarioIndexRow;
  detail: KrknAIScenarioDetail | null;
  loading: boolean;
  updating: boolean;
  error: string | null;
  onRetry: () => void;
  clusterName: string;
  runPhase: string;
  currentGeneration: number | null;
  completedGenerations: number | null;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const status = rowStatus(row);
  const resultTabsAvailable = detail !== null && status !== 'Result pending' && !ACTIVE_PHASES[status];
  const selectedTab = resultTabsAvailable ? activeTab : 0;
  const parameters = detail ? parameterRows(detail.parameters) : [];
  const childLogStatus = row.phase === 'Cancelled' ? 'Stopped'
    : row.phase ?? (row.outcome === 'succeeded' ? 'Succeeded' : row.outcome === 'failed' ? 'Failed' : 'Pending');
  const calculationPending = isCalculationPending(row, runPhase, currentGeneration, completedGenerations)
    || (ACTIVE_PHASES[runPhase] === true
      && row.fitnessState !== 'unfinalized'
      && detail?.fitnessResult.scores.some((score) => score.normalizedScore === null) === true);
  const finalizedTotal = isGenerationFinalized(row, completedGenerations)
    && detail?.fitnessState === 'final'
    ? detail.fitnessResult.fitnessScore
    : null;
  const visibleFitnessState = isGenerationFinalized(row, completedGenerations) && detail?.fitnessState === 'final'
    ? 'final'
    : row.fitnessState === 'unfinalized' || detail?.fitnessState === 'unfinalized'
      ? 'unfinalized'
      : calculationPending
        ? 'provisional'
        : 'Not finalized';
  return (
    <div className="krkn-ai-scenario-detail">
      <div className="krkn-ai-scenario-detail__heading">
        <div className="krkn-ai-scenario-detail__identity">
          <p className="krkn-ai-scenario-detail__identity-item">
            <span className="krkn-ai-scenario-detail__identity-key">Scenario run:</span> <code>{row.childRunName ?? 'Not created yet'}</code>
          </p>
          {row.jobId && <p className="krkn-ai-scenario-detail__identity-item"><span className="krkn-ai-scenario-detail__identity-key">Job ID:</span> <code>{row.jobId}</code></p>}
          {row.podName && <p className="krkn-ai-scenario-detail__identity-item"><span className="krkn-ai-scenario-detail__identity-key">Pod:</span> <code>{row.podName}</code></p>}
        </div>
        <div className="krkn-ai-scenario-detail__labels">
          <Label color={statusColor(status)} isCompact>{status}</Label>
          <Tooltip content="Refresh scenario details" position="top">
            <Button
              variant="plain"
              aria-label="Refresh scenario details"
              aria-busy={updating}
              onClick={onRetry}
              icon={<SyncAltIcon className={updating ? 'pf-m-spin' : undefined} />}
            />
          </Tooltip>
          {row.fitnessState && <Label isCompact color={visibleFitnessState === 'final' ? 'green' : visibleFitnessState === 'provisional' ? 'orange' : 'grey'}>Fitness {visibleFitnessState}</Label>}
        </div>
      </div>
      {loading && !detail && (
        <div className="krkn-ai-scenario-detail__loading" role="status" aria-live="polite">
          <Spinner size="lg" />
          <span>Loading scenario details…</span>
        </div>
      )}
      {updating && detail && (
        <div className="krkn-ai-scenario-detail__updating" role="status">
          <p>Result upload is updating. Showing the last committed scenario result.</p>
        </div>
      )}
      {error && (
        <div className="krkn-ai-scenario-detail__error" role="alert">
          <p>{error}</p>
        </div>
      )}

      <Tabs className="krkn-ai-scenario-detail__tabs" activeKey={selectedTab} onSelect={(_event, key) => setActiveTab(key as number)} mountOnEnter>
        <Tab eventKey={0} title={<TabTitleText>Logs</TabTitleText>}>
          {row.childRunName && row.jobId ? (
            <LogViewer
              scenarioRunName={row.childRunName}
              jobId={row.jobId}
              clusterName={clusterName}
              podName={row.podName ?? 'Waiting for scenario Pod'}
              status={childLogStatus}
              compact
            />
          ) : (
            <section className="krkn-ai-log-panel" aria-label="Scenario pod log">
              <h3>Scenario pod log</h3>
              <p className="krkn-ai-not-available">Child job logs are available when the operator reports a child run name and job ID.</p>
            </section>
          )}
        </Tab>
        {resultTabsAvailable && detail && [
            <Tab key="overview" eventKey={1} title={<TabTitleText>Overview</TabTitleText>}>
              <div className="krkn-ai-scenario-detail__metadata">
                <MetadataPanel
                  id={`krkn-ai-scenario-overview-${row.generation}-${row.scenarioId}`}
                  title="Scenario overview"
                  className="krkn-ai-scenario-detail__metadata-panel"
                  items={[
                    { label: 'Run type', value: isBaselineScenario(row) ? 'Baseline' : 'Generated scenario' },
                    { label: 'Generation', value: detail.generation + 1 },
                    { label: 'Scenario ID', value: detail.scenarioId },
                    { label: 'Scenario type', value: detail.scenarioType || row.scenarioType || 'Not available' },
                    { label: 'Origin', value: detail.origin || 'Not available' },
                    { label: 'Parent IDs', value: detail.parentIds.length > 0 ? detail.parentIds.join(', ') : 'Not available' },
                  ]}
                />
                <MetadataPanel
                  id={`krkn-ai-scenario-execution-${row.generation}-${row.scenarioId}`}
                  title="Execution"
                  className="krkn-ai-scenario-detail__metadata-panel"
                  items={[
                    { label: 'Duration', value: detail.durationSeconds == null ? 'Not available' : `${detail.durationSeconds.toLocaleString(undefined, { maximumFractionDigits: 2 })} seconds` },
                    { label: 'Return code', value: detail.returnCode ?? 'Not available' },
                    { label: 'Fitness state', value: visibleFitnessState },
                  ]}
                />
              </div>
              <section className="krkn-ai-scenario-detail__section" aria-labelledby={`krkn-ai-scenario-parameters-${row.generation}-${row.scenarioId}`}>
                <h3 id={`krkn-ai-scenario-parameters-${row.generation}-${row.scenarioId}`}>Scenario parameters</h3>
                {parameters.length > 0 ? (
                  <dl className="krkn-ai-scenario-detail__parameters">
                    {parameters.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{displayValue(value)}</dd></div>)}
                  </dl>
                ) : <p className="krkn-ai-not-available">Scenario parameters are not available.</p>}
              </section>
            </Tab>,
            <Tab key="fitness" eventKey={2} title={<TabTitleText>Fitness</TabTitleText>}>
              <section className="krkn-ai-scenario-detail__section" aria-labelledby={`krkn-ai-fitness-result-${row.generation}-${row.scenarioId}`}>
                <h3 id={`krkn-ai-fitness-result-${row.generation}-${row.scenarioId}`}>Fitness function result</h3>
                <p className="krkn-ai-scenario-detail__fitness-total">
                  <span>Total normalized fitness <small>(0–100)</small></span>
                  <strong>{finalizedTotal != null
                    ? `${formatFitness(finalizedTotal)} / 100`
                    : calculationPending
                      ? <CalculationStatus label="Calculating generation fitness" />
                      : detail.fitnessState === 'unfinalized' || row.fitnessState === 'unfinalized'
                        ? 'Not finalized'
                        : 'Not available'}</strong>
                </p>
                <MetadataPanel
                  id={`krkn-ai-scenario-fitness-summary-${row.generation}-${row.scenarioId}`}
                  title="Fitness component summary"
                  className="krkn-ai-scenario-detail__fitness-summary"
                  items={[
                    { label: 'Health-check failure score', value: detail.fitnessResult.healthCheckFailureScore == null ? 'Not available' : formatFitness(detail.fitnessResult.healthCheckFailureScore) },
                    { label: 'Health-check response-time score', value: detail.fitnessResult.healthCheckResponseTimeScore == null ? 'Not available' : formatFitness(detail.fitnessResult.healthCheckResponseTimeScore) },
                    { label: 'Krkn failure score', value: detail.fitnessResult.krknFailureScore == null ? 'Not available' : formatFitness(detail.fitnessResult.krknFailureScore) },
                  ]}
                />
                {detail.fitnessResult.scores.length > 0 ? (
                  <div className="krkn-ai-scenario-fitness-table-wrap" tabIndex={0} aria-label="Scrollable fitness score breakdown">
                    <table className="krkn-ai-scenario-fitness-table" aria-label="Measured fitness components">
                      <colgroup>
                        <col className="krkn-ai-scenario-fitness-table__query-column" />
                        <col className="krkn-ai-scenario-fitness-table__type-column" />
                        <col className="krkn-ai-scenario-fitness-table__score-column" />
                        <col className="krkn-ai-scenario-fitness-table__score-column" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th scope="col"><Tooltip content="Prometheus query used to measure this fitness component." position="top"><span tabIndex={0}>PromQL query</span></Tooltip></th>
                          <th scope="col"><Tooltip content="How the query is evaluated, such as a point or range query." position="top"><span tabIndex={0}>Query type</span></Tooltip></th>
                          <th scope="col"><Tooltip content="Score produced by the query before normalization." position="top"><span tabIndex={0}>Raw score</span></Tooltip></th>
                          <th scope="col"><Tooltip content="This is the fitness component's normalized value on a 0–1 scale." position="top"><span tabIndex={0}>Normalized score</span></Tooltip></th>
                        </tr>
                      </thead>
                      <tbody>{detail.fitnessResult.scores.map((score) => (
                        <tr key={score.id}>
                          <td className="krkn-ai-scenario-fitness-table__query">{score.query
                            ? <ClipboardCopy className="krkn-ai-scenario-query" variant="inline-compact" isCode isReadOnly isBlock hoverTip="Copy PromQL query" clickTip="PromQL query copied">{score.query}</ClipboardCopy>
                            : 'Not available'}</td>
                          <td>{score.queryType ?? 'Not available'}</td>
                          <td className="krkn-ai-scenario-fitness-table__number">{score.rawScore == null ? 'Not available' : formatFitness(score.rawScore)}</td>
                          <td className="krkn-ai-scenario-fitness-table__number">{score.normalizedScore !== null && detail.fitnessState === 'final' && isGenerationFinalized(row, completedGenerations)
                            ? formatFitness(score.normalizedScore)
                            : calculationPending
                              ? <CalculationStatus label="Calculating normalized score" />
                              : detail.fitnessState === 'unfinalized' || row.fitnessState === 'unfinalized'
                                ? 'Not finalized'
                                : 'Not available'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p className="krkn-ai-not-available">Per-component fitness scores are not available.</p>}
              </section>
            </Tab>,
            <Tab key="health-checks" eventKey={3} title={<TabTitleText>Health checks</TabTitleText>}>
              <section className="krkn-ai-scenario-detail__section" aria-labelledby={`krkn-ai-health-${row.generation}-${row.scenarioId}`}>
                <h3 id={`krkn-ai-health-${row.generation}-${row.scenarioId}`}>Health-check charts</h3>
                <p className="krkn-ai-scenario-detail__health-description">
                  Latency distribution of health-check endpoints during the test run.
                </p>
                {detail.healthChecks.length > 0
                  ? <ScenarioHealthCharts scenarioId={detail.scenarioId} samples={detail.healthChecks} />
                  : <p className="krkn-ai-not-available">No health-check samples have been committed for this scenario.</p>}
              </section>
            </Tab>,
        ]}
      </Tabs>
    </div>
  );
}

export function ScenarioExplorer({
  scenarios,
  pagination,
  page,
  loading,
  error,
  onPageChange,
  filters,
  configuredGenerations,
  onFiltersChange,
  selectedScenario,
  onSelect,
  onClose,
  detail,
  detailLoading,
  detailUpdating,
  detailError,
  onRetryDetail,
  clusterName,
  runPhase,
  currentGeneration,
  completedGenerations,
}: ScenarioExplorerProps) {
  const generationCount = Math.max(
    configuredGenerations ?? 0,
    completedGenerations ?? 0,
    currentGeneration == null ? 0 : currentGeneration + 1,
    scenarios.reduce((maximum, scenario) => Math.max(maximum, scenario.generation + 1), 0),
  );
  const generationOptions = useMemo(
    () => Array.from({ length: generationCount }, (_, generation) => generation),
    [generationCount],
  );
  const totalPages = pagination.totalPages;
  const visiblePage = page;
  return (
    <section className="krkn-ai-scenario-explorer" aria-labelledby="krkn-ai-scenario-explorer-heading">
      <div className="krkn-ai-scenario-explorer__heading">
        <div>
          <Title headingLevel="h2" size="xl"><span id="krkn-ai-scenario-explorer-heading">Scenario executions</span></Title>
          <p className="krkn-ai-scenario-explorer__intro">Observed scenario results and child-job status for this run.</p>
        </div>
        <span>{pagination.total} observed scenario rows</span>
      </div>
      <>
          <div className="krkn-ai-scenario-explorer__filters">
            <label htmlFor="krkn-ai-scenario-search">
              <span>Search scenarios</span>
              <input
                id="krkn-ai-scenario-search"
                type="search"
                value={filters.search}
                placeholder="ID or scenario name"
                onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
              />
            </label>
            <label htmlFor="krkn-ai-generation-filter">
              <span>Generation</span>
              <select
                id="krkn-ai-generation-filter"
                value={filters.generation ?? 'all'}
                onChange={(event) => onFiltersChange({
                  ...filters,
                  generation: event.target.value === 'all' ? null : Number(event.target.value),
                })}
              >
                <option value="all">All generations</option>
                {generationOptions.map((generation) => <option key={generation} value={generation}>Generation {generation + 1}</option>)}
              </select>
            </label>
            <label htmlFor="krkn-ai-type-filter">
              <span>Scenario type</span>
              <input
                id="krkn-ai-type-filter"
                type="text"
                value={filters.scenarioType}
                placeholder="All scenario types"
                onChange={(event) => onFiltersChange({ ...filters, scenarioType: event.target.value })}
              />
            </label>
          </div>
          <div className="krkn-ai-scenario-table-wrap" tabIndex={0} aria-label="Scrollable scenario executions table">
            <table className="krkn-ai-scenario-table" aria-label="Scenario executions">
              <caption>Observed scenario executions for this Krkn-AI run, page {visiblePage} of {Math.max(totalPages, 1)}</caption>
              <thead><tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" aria-sort={filters.sort === column.key ? (filters.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => {
                      if (filters.sort === column.key) {
                        onFiltersChange({ ...filters, direction: filters.direction === 'asc' ? 'desc' : 'asc' });
                      } else {
                        onFiltersChange({ ...filters, sort: column.key, direction: 'asc' });
                      }
                    }}>
                      {column.label}<span aria-hidden="true">{filters.sort === column.key ? (filters.direction === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                    </button>
                  </th>
                ))}
                <th scope="col">Actions</th>
              </tr></thead>
              <tbody>
                {scenarios.map((scenario) => {
                  const status = rowStatus(scenario);
                  const finalized = isGenerationFinalized(scenario, completedGenerations);
                  const calculationPending = isCalculationPending(scenario, runPhase, currentGeneration, completedGenerations);
                  const detailLabel = isBaselineScenario(scenario)
                    ? `View details for baseline scenario ${scenario.scenarioId}`
                    : `View details for generation ${scenario.generation + 1} scenario ${scenario.scenarioId}`;
                  return (
                    <tr
                      key={scenarioKey(scenario)}
                      className={status === 'Running' ? 'krkn-ai-scenario-table__row--running' : undefined}
                      tabIndex={0}
                      aria-label={isBaselineScenario(scenario) ? 'Open baseline scenario details' : `Open generation ${scenario.generation + 1} scenario ${scenario.scenarioId} details`}
                      onClick={() => onSelect(scenario)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect(scenario);
                        }
                      }}
                    >
                      <td>{isBaselineScenario(scenario) ? 'Baseline' : scenario.generation + 1}</td>
                      <th scope="row">{scenario.scenarioId}</th>
                      <td>{scenario.scenarioType ?? 'Not available yet'}</td>
                      <td>{finalized && scenario.fitnessScore != null
                        ? formatFitness(scenario.fitnessScore)
                        : calculationPending
                          ? <CalculationStatus label="Calculating generation fitness" />
                          : scenario.fitnessState === 'unfinalized'
                            ? 'Not finalized'
                            : 'Not available'}</td>
                      <td><Label color={statusColor(status)}>{status}</Label></td>
                      <td>{scenario.durationSeconds == null ? 'Not available yet' : `${scenario.durationSeconds.toLocaleString(undefined, { maximumFractionDigits: 2 })}s`}</td>
                      <td>
                        <Tooltip content={detailLabel} position="top">
                          <Button
                            variant="plain"
                            className="krkn-ai-scenario-table__view-action"
                            aria-label={detailLabel}
                            icon={<EyeIcon />}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelect(scenario);
                            }}
                          />
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {loading ? <p className="krkn-ai-scenario-table__empty" role="status">Loading scenario executions…</p>
              : !error && scenarios.length === 0 && <p className="krkn-ai-scenario-table__empty">No scenarios match the current filters.</p>}
          </div>
          {totalPages > 1 && (
            <div className="krkn-ai-pagination" aria-label="Scenario result pages">
              <Button variant="secondary" isDisabled={loading || visiblePage <= 1} onClick={() => onPageChange(visiblePage - 1)}>Previous</Button>
              <span>Page {visiblePage} of {totalPages}</span>
              <Button variant="secondary" isDisabled={loading || visiblePage >= totalPages} onClick={() => onPageChange(visiblePage + 1)}>Next</Button>
            </div>
          )}
      </>

      <Modal
        className="krkn-ai-scenario-modal"
        variant={ModalVariant.large}
        title={
          selectedScenario
            ? isBaselineScenario(selectedScenario)
              ? `Baseline scenario: ${selectedScenario.scenarioId}`
              : `Generation ${selectedScenario.generation + 1}, scenario ${selectedScenario.scenarioId}: ${selectedScenario.scenarioType ?? 'result pending'}`
            : 'Scenario details'
        }
        isOpen={selectedScenario !== null}
        onClose={onClose}
      >
        {selectedScenario && (
          <ScenarioDetail
            key={scenarioKey(selectedScenario)}
            row={selectedScenario}
            detail={detail}
            loading={detailLoading}
            updating={detailUpdating}
            error={detailError}
            onRetry={onRetryDetail}
            clusterName={clusterName}
            runPhase={runPhase}
            currentGeneration={currentGeneration}
            completedGenerations={completedGenerations}
          />
        )}
      </Modal>
    </section>
  );
}
