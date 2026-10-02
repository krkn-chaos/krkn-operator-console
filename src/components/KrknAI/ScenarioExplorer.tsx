import { useMemo, useState } from 'react';
import { Button, ClipboardCopy, Label, Modal, ModalVariant, Spinner, Title } from '@patternfly/react-core';
import { LogViewer } from '../LogViewer';
import { ScenarioHealthCharts } from './ScenarioHealthCharts';
import { MetadataPanel } from './MetadataPanel';
import './ScenarioDetail.css';
import type {
  KrknAIScenarioDetail,
  KrknAIScenarioIndexRow,
  KrknAIScenarioPagination,
} from '../../services/krknAiApi';


interface ScenarioExplorerProps {
  scenarios: KrknAIScenarioIndexRow[];
  pagination: KrknAIScenarioPagination;
  page: number;
  onPageChange: (page: number) => void;
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

type ScenarioSortKey = 'generation' | 'scenarioId' | 'scenarioType' | 'fitnessScore' | 'outcome' | 'durationSeconds';
type SortDirection = 'asc' | 'desc';

const columns: Array<{ key: ScenarioSortKey; label: string }> = [
  { key: 'generation', label: 'Generation' },
  { key: 'scenarioId', label: 'Scenario ID' },
  { key: 'scenarioType', label: 'Scenario name' },
  { key: 'fitnessScore', label: 'Fitness score (0–100)' },
  { key: 'outcome', label: 'Status' },
  { key: 'durationSeconds', label: 'Duration' },
];

const formatFitness = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 4 });
const ACTIVE_PHASES: Record<string, true> = { Pending: true, Provisioning: true, Running: true };

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

function CalculationStatus({ children }: { children: string }) {
  return (
    <span className="krkn-ai-fitness-calculating" role="status">
      <Spinner size="sm" aria-label="Calculating fitness" />
      <span>{children}</span>
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

function sortValue(row: KrknAIScenarioIndexRow, key: ScenarioSortKey): string | number | null {
  switch (key) {
    case 'generation': return row.generation;
    case 'scenarioId': return row.scenarioId === 'baseline' ? '' : row.scenarioId;
    case 'scenarioType': return row.scenarioType ?? null;
    case 'fitnessScore': return row.fitnessScore ?? null;
    case 'outcome': return rowStatus(row);
    case 'durationSeconds': return row.durationSeconds ?? null;
  }
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
  if (loading && !detail) {
    return (
      <div className="krkn-ai-scenario-detail__loading" role="status" aria-live="polite">
        <Spinner size="lg" />
        <span>Loading committed scenario details…</span>
      </div>
    );
  }

  const status = rowStatus(row);
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
        <div>
          <p className="krkn-ai-scenario-detail__pod">
            Scenario run: <code>{row.childRunName ?? 'Not created yet'}</code>
          </p>
          {row.jobId && <p>Job ID: <code>{row.jobId}</code></p>}
          {row.podName && <p>Pod: <code>{row.podName}</code></p>}
        </div>
        <div className="krkn-ai-scenario-detail__labels">
          <Label color={statusColor(status)}>{status}</Label>
          {row.fitnessState && <Label color={visibleFitnessState === 'final' ? 'green' : visibleFitnessState === 'provisional' ? 'orange' : 'grey'}>Fitness {visibleFitnessState}</Label>}
        </div>
      </div>

      {updating && (
        <div className="krkn-ai-scenario-detail__updating" role="status">
          <p>{detail ? 'Result upload is updating. Showing the last committed scenario result.' : 'The scenario result is not committed yet. Will retry when run results refresh.'}</p>
          {!detail && <Button variant="secondary" onClick={onRetry}>Retry scenario details</Button>}
        </div>
      )}
      {error && (
        <div className="krkn-ai-scenario-detail__error" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={onRetry}>Retry scenario details</Button>
        </div>
      )}
      {!detail && !loading && !error && !updating && (
        <div className="krkn-ai-scenario-detail__uncommitted" role="status">
          <p>The scenario result has not been committed yet. Child run status and logs remain available below.</p>
          <Button variant="secondary" onClick={onRetry}>Retry scenario details</Button>
        </div>
      )}

      {detail && (
        <>
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

          <section className="krkn-ai-scenario-detail__section" aria-labelledby={`krkn-ai-fitness-result-${row.generation}-${row.scenarioId}`}>
            <h3 id={`krkn-ai-fitness-result-${row.generation}-${row.scenarioId}`}>Fitness function result</h3>
            <p className="krkn-ai-scenario-detail__fitness-total">
              <span>Total normalized fitness <small>(0–100)</small></span>
              <strong>{finalizedTotal != null
                ? `${formatFitness(finalizedTotal)} / 100`
                : calculationPending
                  ? <CalculationStatus>Calculating this generation’s fitness…</CalculationStatus>
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
                  <thead><tr><th scope="col">PromQL query</th><th scope="col">Query type</th><th scope="col">Raw score</th><th scope="col">Normalized score (0–1)</th></tr></thead>
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
                          ? <CalculationStatus>Normalization is pending…</CalculationStatus>
                          : detail.fitnessState === 'unfinalized' || row.fitnessState === 'unfinalized'
                            ? 'Not finalized'
                            : 'Not available'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="krkn-ai-not-available">Per-component fitness scores are not available.</p>}
          </section>

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

          <section className="krkn-ai-scenario-detail__section" aria-labelledby={`krkn-ai-health-${row.generation}-${row.scenarioId}`}>
            <h3 id={`krkn-ai-health-${row.generation}-${row.scenarioId}`}>Health-check charts</h3>
            {detail.healthChecks.length > 0
              ? <ScenarioHealthCharts scenarioId={detail.scenarioId} samples={detail.healthChecks} />
              : <p className="krkn-ai-not-available">No health-check samples have been committed for this scenario.</p>}
          </section>
        </>
      )}

      {!detail && (
        row.childRunName && row.jobId ? (
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
        )
      )}
    </div>
  );
}

export function ScenarioExplorer({
  scenarios,
  pagination,
  page,
  onPageChange,
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
  const [sortKey, setSortKey] = useState<ScenarioSortKey>('generation');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [search, setSearch] = useState('');
  const [generationFilter, setGenerationFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const generationOptions = useMemo(() => [...new Set(scenarios.map((scenario) => scenario.generation))].sort((left, right) => left - right), [scenarios]);
  const typeOptions = useMemo(() => [...new Set(scenarios.map((scenario) => scenario.scenarioType).filter((value): value is string => Boolean(value)))].sort(), [scenarios]);
  const visibleScenarios = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = scenarios.filter((scenario) => {
      const matchesSearch = normalizedSearch === ''
        || scenario.scenarioId.toLowerCase().includes(normalizedSearch)
        || (scenario.scenarioType ?? '').toLowerCase().includes(normalizedSearch);
      const matchesGeneration = generationFilter === 'all' || scenario.generation === Number(generationFilter);
      const matchesType = typeFilter === 'all' || scenario.scenarioType === typeFilter;
      return matchesSearch && matchesGeneration && matchesType;
    });
    return filtered.sort((left, right) => {
      const leftValue = sortValue(left, sortKey);
      const rightValue = sortValue(right, sortKey);
      const comparison = leftValue == null ? (rightValue == null ? 0 : 1)
        : rightValue == null ? -1
          : typeof leftValue === 'number' && typeof rightValue === 'number'
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
      if (comparison !== 0) return sortDirection === 'asc' ? comparison : -comparison;
      if (sortKey === 'generation' && (left.scenarioId === 'baseline') !== (right.scenarioId === 'baseline')) {
        const baselineFirst = left.scenarioId === 'baseline';
        return sortDirection === 'asc' ? (baselineFirst ? -1 : 1) : (baselineFirst ? 1 : -1);
      }
      return left.generation - right.generation || left.scenarioId.localeCompare(right.scenarioId, undefined, { numeric: true });
    });
  }, [generationFilter, scenarios, search, sortDirection, sortKey, typeFilter]);

  return (
    <section className="krkn-ai-scenario-explorer" aria-labelledby="krkn-ai-scenario-explorer-heading">
      <div className="krkn-ai-scenario-explorer__heading">
        <div>
          <Title headingLevel="h2" size="xl"><span id="krkn-ai-scenario-explorer-heading">Scenario executions</span></Title>
          <p className="krkn-ai-scenario-explorer__intro">Observed scenario results and child-job status for this run.</p>
        </div>
        <span>{pagination.total} observed scenario rows</span>
      </div>
      {scenarios.length === 0 ? (
        <p className="krkn-ai-not-available">Scenario results are not available yet. Child job status appears after the operator creates a scenario run.</p>
      ) : (
        <>
          <div className="krkn-ai-scenario-explorer__filters">
            <label htmlFor="krkn-ai-scenario-search">
              <span>Search scenarios</span>
              <input id="krkn-ai-scenario-search" type="search" value={search} placeholder="ID or scenario name" onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label htmlFor="krkn-ai-generation-filter">
              <span>Generation</span>
              <select id="krkn-ai-generation-filter" value={generationFilter} onChange={(event) => setGenerationFilter(event.target.value)}>
                <option value="all">All generations</option>
                {generationOptions.map((generation) => <option key={generation} value={generation}>Generation {generation + 1}</option>)}
              </select>
            </label>
            <label htmlFor="krkn-ai-type-filter">
              <span>Scenario type</span>
              <select id="krkn-ai-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All scenario types</option>
                {typeOptions.map((scenarioType) => <option key={scenarioType} value={scenarioType}>{scenarioType}</option>)}
              </select>
            </label>
          </div>
          <div className="krkn-ai-scenario-table-wrap" tabIndex={0} aria-label="Scrollable scenario executions table">
            <table className="krkn-ai-scenario-table" aria-label="Scenario executions">
              <caption>Observed scenario executions for this Krkn-AI run, page {page} of {Math.max(pagination.totalPages, 1)}</caption>
              <thead><tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" aria-sort={sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => {
                      if (sortKey === column.key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
                      else { setSortKey(column.key); setSortDirection('asc'); }
                    }}>
                      {column.label}<span aria-hidden="true">{sortKey === column.key ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                    </button>
                  </th>
                ))}
                <th scope="col">Actions</th>
              </tr></thead>
              <tbody>
                {visibleScenarios.map((scenario) => {
                  const status = rowStatus(scenario);
                  const finalized = isGenerationFinalized(scenario, completedGenerations);
                  const calculationPending = isCalculationPending(scenario, runPhase, currentGeneration, completedGenerations);
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
                          ? <CalculationStatus>Calculating generation fitness…</CalculationStatus>
                          : scenario.fitnessState === 'unfinalized'
                            ? 'Not finalized'
                            : 'Not available'}</td>
                      <td><Label color={statusColor(status)}>{status}</Label></td>
                      <td>{scenario.durationSeconds == null ? 'Not available yet' : `${scenario.durationSeconds.toLocaleString(undefined, { maximumFractionDigits: 2 })}s`}</td>
                      <td>
                        <Button
                          variant="secondary"
                          aria-label={isBaselineScenario(scenario)
                            ? `View details for baseline scenario ${scenario.scenarioId}`
                            : `View details for generation ${scenario.generation + 1} scenario ${scenario.scenarioId}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(scenario);
                          }}
                        >
                          View details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleScenarios.length === 0 && <p className="krkn-ai-scenario-table__empty">No scenarios match the current filters.</p>}
          </div>
          {pagination.totalPages > 1 && (
            <div className="krkn-ai-pagination" aria-label="Scenario result pages">
              <Button variant="secondary" isDisabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
              <span>Page {page} of {pagination.totalPages}</span>
              <Button variant="secondary" isDisabled={page >= pagination.totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      <Modal
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
