import { useMemo, useState } from 'react';
import { Button, ClipboardCopy, Label, Modal, ModalVariant, Title } from '@patternfly/react-core';
import { LogViewer } from '../LogViewer';
import { ScenarioHealthCharts } from './ScenarioHealthCharts';
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
}

type ScenarioSortKey = 'generation' | 'scenarioId' | 'scenarioType' | 'fitnessScore' | 'outcome' | 'durationSeconds';
type SortDirection = 'asc' | 'desc';

const columns: Array<{ key: ScenarioSortKey; label: string }> = [
  { key: 'generation', label: 'Generation' },
  { key: 'scenarioId', label: 'Scenario ID' },
  { key: 'scenarioType', label: 'Scenario name' },
  { key: 'fitnessScore', label: 'Fitness score' },
  { key: 'outcome', label: 'Status' },
  { key: 'durationSeconds', label: 'Duration' },
];

const formatFitness = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 4 });

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

function sortValue(row: KrknAIScenarioIndexRow, key: ScenarioSortKey): string | number | null {
  switch (key) {
    case 'generation': return row.generation;
    case 'scenarioId': return row.scenarioId;
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
}: {
  row: KrknAIScenarioIndexRow;
  detail: KrknAIScenarioDetail | null;
  loading: boolean;
  updating: boolean;
  error: string | null;
  onRetry: () => void;
  clusterName: string;
}) {
  const status = rowStatus(row);
  const parameters = detail ? parameterRows(detail.parameters) : [];
  const childLogStatus = row.phase === 'Cancelled' ? 'Stopped'
    : row.phase ?? (row.outcome === 'succeeded' ? 'Succeeded' : row.outcome === 'failed' ? 'Failed' : 'Pending');

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
          {row.fitnessState && <Label color={row.fitnessState === 'final' ? 'green' : 'orange'}>Fitness {row.fitnessState}</Label>}
        </div>
      </div>

      {updating && <p className="krkn-ai-run-detail__updating">Result upload is updating. Showing the last committed scenario result.</p>}
      {error && (
        <div className="krkn-ai-scenario-detail__error" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={onRetry}>Retry scenario details</Button>
        </div>
      )}
      {loading && !detail && <p role="status">Loading committed scenario details…</p>}
      {!detail && !loading && !error && (
        <p className="krkn-ai-not-available">The scenario result has not been committed yet. Child run status and logs remain available below.</p>
      )}

      {detail && (
        <>
          <dl className="krkn-ai-scenario-detail__summary">
            <div><dt>Generation</dt><dd>{detail.generation + 1}</dd></div>
            <div><dt>Scenario ID</dt><dd>{detail.scenarioId}</dd></div>
            <div><dt>Scenario type</dt><dd>{detail.scenarioType || row.scenarioType || 'Not available'}</dd></div>
            <div><dt>Duration</dt><dd>{detail.durationSeconds == null ? 'Not available' : `${detail.durationSeconds.toLocaleString(undefined, { maximumFractionDigits: 2 })} seconds`}</dd></div>
            <div><dt>Return code</dt><dd>{detail.returnCode ?? 'Not available'}</dd></div>
            <div><dt>Fitness state</dt><dd>{detail.fitnessState}</dd></div>
            {detail.origin && <div><dt>Origin</dt><dd>{detail.origin}</dd></div>}
            {detail.parentIds.length > 0 && <div><dt>Parent IDs</dt><dd>{detail.parentIds.join(', ')}</dd></div>}
          </dl>

          <section className="krkn-ai-scenario-detail__section" aria-labelledby={`krkn-ai-run-config-${row.generation}-${row.scenarioId}`}>
            <h3 id={`krkn-ai-run-config-${row.generation}-${row.scenarioId}`}>Scenario run configuration</h3>
            {parameters.length > 0 ? (
              <dl className="krkn-ai-scenario-detail__parameters">
                {parameters.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{displayValue(value)}</dd></div>)}
              </dl>
            ) : <p className="krkn-ai-not-available">Scenario parameters are not available.</p>}
            <div className="krkn-ai-scenario-detail__command">
              <h4>Scenario command</h4>
              {detail.command
                ? <ClipboardCopy className="krkn-ai-scenario-command" variant="inline-compact" isCode isReadOnly isBlock hoverTip="Copy scenario command" clickTip="Scenario command copied">{detail.command}</ClipboardCopy>
                : <p className="krkn-ai-not-available">Command is not available.</p>}
            </div>
          </section>

          <section className="krkn-ai-scenario-detail__section" aria-labelledby={`krkn-ai-fitness-result-${row.generation}-${row.scenarioId}`}>
            <h3 id={`krkn-ai-fitness-result-${row.generation}-${row.scenarioId}`}>Fitness function result</h3>
            <p className="krkn-ai-scenario-detail__fitness-total">
              Total recorded fitness: <strong>{detail.fitnessResult.fitnessScore == null ? 'Not available' : `${formatFitness(detail.fitnessResult.fitnessScore)} fitness units`}</strong>
            </p>
            <dl className="krkn-ai-scenario-detail__metrics">
              <div><dt>Health-check failure score</dt><dd>{detail.fitnessResult.healthCheckFailureScore == null ? 'Not available' : formatFitness(detail.fitnessResult.healthCheckFailureScore)}</dd></div>
              <div><dt>Health-check response-time score</dt><dd>{detail.fitnessResult.healthCheckResponseTimeScore == null ? 'Not available' : formatFitness(detail.fitnessResult.healthCheckResponseTimeScore)}</dd></div>
              <div><dt>Krkn failure score</dt><dd>{detail.fitnessResult.krknFailureScore == null ? 'Not available' : formatFitness(detail.fitnessResult.krknFailureScore)}</dd></div>
            </dl>
            {detail.fitnessResult.scores.length > 0 ? (
              <table className="krkn-ai-scenario-table" aria-label="Measured fitness components">
                <thead><tr><th>Component ID</th><th>Fitness</th><th>Weighted</th><th>Normalized</th></tr></thead>
                <tbody>{detail.fitnessResult.scores.map((score) => (
                  <tr key={score.id}>
                    <td>{score.id}</td>
                    <td>{score.fitnessScore == null ? 'Not available' : formatFitness(score.fitnessScore)}</td>
                    <td>{score.weightedScore == null ? 'Not available' : formatFitness(score.weightedScore)}</td>
                    <td>{score.normalizedScore == null ? 'Not available' : formatFitness(score.normalizedScore)}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <p className="krkn-ai-not-available">Per-component fitness scores are not available.</p>}
          </section>

          <section className="krkn-ai-scenario-detail__section" aria-labelledby={`krkn-ai-health-${row.generation}-${row.scenarioId}`}>
            <h3 id={`krkn-ai-health-${row.generation}-${row.scenarioId}`}>Measured health-check samples</h3>
            {detail.healthChecks.length > 0 ? (
              <>
                <ScenarioHealthCharts scenarioId={detail.scenarioId} samples={detail.healthChecks} />
                <table className="krkn-ai-scenario-table" aria-label="Measured health-check samples">
                  <thead><tr><th>Application</th><th>Timestamp</th><th>Elapsed</th><th>Response time</th><th>Status code</th><th>Success</th><th>Error</th></tr></thead>
                  <tbody>{detail.healthChecks.map((sample, index) => (
                    <tr key={`${sample.application}-${sample.timestamp}-${index}`}>
                      <td>{sample.application}</td>
                      <td>{sample.timestamp}</td>
                      <td>{sample.elapsedSeconds == null ? 'Not available' : `${sample.elapsedSeconds.toLocaleString()}s`}</td>
                      <td>{sample.responseTimeSeconds == null ? 'Not available' : `${sample.responseTimeSeconds.toLocaleString()}s`}</td>
                      <td>{sample.statusCode ?? 'Not recorded'}</td>
                      <td>{sample.success === null ? 'Not recorded' : sample.success ? 'Yes' : 'No'}</td>
                      <td>{sample.error || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </>
            ) : <p className="krkn-ai-not-available">No health-check samples have been committed for this scenario.</p>}
          </section>
          <p>Scenario log artifact: <code>{detail.logPath || 'Not available'}</code></p>
        </>
      )}

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
              </tr></thead>
              <tbody>
                {visibleScenarios.map((scenario) => {
                  const status = rowStatus(scenario);
                  return (
                    <tr
                      key={scenarioKey(scenario)}
                      className={status === 'Running' ? 'krkn-ai-scenario-table__row--running' : undefined}
                      tabIndex={0}
                      aria-label={`Open generation ${scenario.generation + 1} scenario ${scenario.scenarioId} details`}
                      onClick={() => onSelect(scenario)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect(scenario);
                        }
                      }}
                    >
                      <td>{scenario.generation + 1}</td>
                      <th scope="row">{scenario.scenarioId}</th>
                      <td>{scenario.scenarioType ?? 'Not available yet'}</td>
                      <td>
                        {scenario.fitnessScore == null
                          ? <span className="krkn-ai-pending-value">Not available yet</span>
                          : <>{formatFitness(scenario.fitnessScore)}{scenario.fitnessState === 'provisional' && <span className="krkn-ai-pending-value"> (provisional)</span>}</>}
                      </td>
                      <td><Label color={statusColor(status)}>{status}</Label></td>
                      <td>{scenario.durationSeconds == null ? 'Not available yet' : `${scenario.durationSeconds.toLocaleString(undefined, { maximumFractionDigits: 2 })}s`}</td>
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
        title={selectedScenario ? `Generation ${selectedScenario.generation + 1}, scenario ${selectedScenario.scenarioId}: ${selectedScenario.scenarioType ?? 'result pending'}` : 'Scenario details'}
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
          />
        )}
      </Modal>
    </section>
  );
}
