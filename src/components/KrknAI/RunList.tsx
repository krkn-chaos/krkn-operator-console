import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Label,
} from '@patternfly/react-core';
import type { KeyboardEvent } from 'react';
import type { KrknAIRunResource, KrknAIRunSummary } from '../../services/krknAiApi';
import { formatDateTime } from '../../utils/dateTime';
import { FitnessValue } from './FitnessValue';
import { ResultsDownloadButton } from './ResultsDownloadButton';

export interface KrknAIRunListEntry {
  resource: KrknAIRunResource;
  summary: KrknAIRunSummary | null;
  summaryError?: string;
  updating: boolean;
}

interface RunListProps {
  runs: KrknAIRunListEntry[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onCreate: () => void;
  onRefresh: () => void;
  onSelect: (run: KrknAIRunResource) => void;
}

function phaseColor(phase: string): 'blue' | 'cyan' | 'green' | 'grey' | 'red' {
  switch (phase) {
    case 'Provisioning': return 'cyan';
    case 'Running': return 'blue';
    case 'Succeeded': return 'green';
    case 'Failed': return 'red';
    default: return 'grey';
  }
}

function getClusterName(resource: KrknAIRunResource, summary: KrknAIRunSummary | null): string {
  if (summary?.cluster) return summary.cluster;
  return Object.values(resource.spec.targetClusters ?? {})[0]?.[0] ?? 'Not available';
}

export function RunList({
  runs,
  loading,
  refreshing,
  error,
  onCreate,
  onRefresh,
  onSelect,
}: RunListProps) {
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    run: KrknAIRunResource,
  ) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(run);
    }
  };

  return (
    <Card className="krkn-ai-run-list">
      <CardTitle>AI runs</CardTitle>
      <CardBody>
        <div className="krkn-ai-run-list__toolbar">
          <Button variant="secondary" onClick={onRefresh} isDisabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button className="krkn-ai-run-list__create" variant="primary" onClick={onCreate}>
            Create run
          </Button>
        </div>

        {error && <Alert variant="danger" title={error} isInline />}
        {loading && runs.length === 0 ? (
          <p role="status">Loading Krkn-AI runs…</p>
        ) : runs.length === 0 ? (
          <p className="krkn-ai-run-list__empty">No Krkn-AI runs found. Refresh to check for runs created elsewhere.</p>
        ) : (
          <div className="krkn-ai-run-list__table-wrap" style={{ overflowX: 'auto' }}>
            <table className="krkn-ai-run-list__table">
              <caption>Krkn-AI run progress</caption>
              <thead>
                <tr>
                  <th scope="col">Run</th>
                  <th scope="col">Cluster</th>
                  <th scope="col">Phase</th>
                  <th scope="col">Started</th>
                  <th scope="col">Best fitness (0–100)</th>
                  <th scope="col">Generations</th>
                  <th scope="col">Scenarios completed</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(({ resource, summary, summaryError, updating }) => {
                  const name = resource.metadata.name;
                  const phase = resource.status?.phase ?? 'Pending';
                  const createdAt = summary?.createdAt || resource.metadata.creationTimestamp;
                  const completed = summary?.completedGenerations;
                  const configured = summary?.configuredGenerations;
                  const currentGeneration = summary?.currentGeneration;
                  const calculatingGeneration = (phase === 'Pending' || phase === 'Provisioning' || phase === 'Running')
                    && currentGeneration != null && (completed == null || currentGeneration >= completed)
                    ? currentGeneration : null;
                  const generations = completed !== null && completed !== undefined
                    && configured !== null && configured !== undefined
                    ? `${completed} / ${configured}`
                    : 'Not available yet';

                  return (
                    <tr
                      key={name}
                      className="krkn-ai-run-list__row"
                      tabIndex={0}
                      aria-label={`Open run ${name}, ${phase}, cluster ${getClusterName(resource, summary)}`}
                      onClick={() => onSelect(resource)}
                      onKeyDown={(event) => handleRowKeyDown(event, resource)}
                    >
                      <th scope="row" className="krkn-ai-run-list__name-cell">
                        <span className="krkn-ai-run-list__run-name">{name}</span>
                        {updating && <span className="krkn-ai-run-list__updating" role="status">Updating committed results…</span>}
                        {summaryError && <span className="krkn-ai-run-list__error">{summaryError}</span>}
                      </th>
                      <td>{getClusterName(resource, summary)}</td>
                      <td><Label color={phaseColor(phase)}>{phase}</Label></td>
                      <td>{createdAt ? <time dateTime={createdAt}>{formatDateTime(createdAt)}</time> : 'Not available'}</td>
                      <td><FitnessValue value={summary?.bestFitness} calculatingGeneration={calculatingGeneration} /></td>
                      <td>{generations}</td>
                      <td>{summary?.completedScenarios ?? 'Not available yet'}</td>
                      <td>
                        <div className="krkn-ai-run-actions">
                        <Button
                          variant="secondary"
                          aria-label={`View run ${name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(resource);
                          }}
                        >
                          View run
                        </Button>
                          <ResultsDownloadButton runName={name} compact />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
