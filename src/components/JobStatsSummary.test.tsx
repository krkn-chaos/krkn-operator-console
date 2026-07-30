import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JobStatsSummary } from './JobStatsSummary';
import type { UnifiedRunItem } from './JobsList';
import type { ScenarioRunState, ScenarioRunPhase } from '../types/api';

function makeScenarioItem(
  phase: ScenarioRunPhase,
  jobs: { total: number; succeeded: number; failed: number; running?: number },
): UnifiedRunItem {
  return {
    type: 'scenario',
    run: {
      phase,
      totalTargets: jobs.total,
      successfulJobs: jobs.succeeded,
      failedJobs: jobs.failed,
      runningJobs: jobs.running ?? 0,
    } as ScenarioRunState,
  };
}

function makeGraphItem(
  phase: ScenarioRunPhase,
  nodes: Array<{ phase: ScenarioRunPhase; total: number; succeeded: number; failed: number; running?: number }>,
): UnifiedRunItem {
  return {
    type: 'graph',
    graphRunName: `graph-${phase}`,
    nodes: nodes.map(n => ({
      phase: n.phase,
      totalTargets: n.total,
      successfulJobs: n.succeeded,
      failedJobs: n.failed,
      runningJobs: n.running ?? 0,
    })) as ScenarioRunState[],
    phase,
    createdAt: '2026-01-01T00:00:00Z',
    summary: { totalNodes: nodes.length, completedNodes: 0, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
  };
}

describe('JobStatsSummary', () => {
  it('renders all 4 stat cards with labels', () => {
    render(<JobStatsSummary unifiedRuns={[]} />);
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
  });

  it('renders sub-text descriptions in card footers', () => {
    render(<JobStatsSummary unifiedRuns={[]} />);
    expect(screen.getByText('Total number of jobs across all scenario runs')).toBeInTheDocument();
    expect(screen.getByText('Exit code 0')).toBeInTheDocument();
    expect(screen.getByText('Non-zero or unknown exit')).toBeInTheDocument();
    expect(screen.getByText('Percentage of jobs that succeeded')).toBeInTheDocument();
  });

  it('shows all zeros and N/A when empty', () => {
    render(<JobStatsSummary unifiedRuns={[]} />);
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(3);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('aggregates job counts from a single scenario run', () => {
    const runs = [makeScenarioItem('Succeeded', { total: 5, succeeded: 4, failed: 1 })];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('aggregates job counts across multiple scenario runs', () => {
    const runs = [
      makeScenarioItem('Succeeded', { total: 3, succeeded: 3, failed: 0 }),
      makeScenarioItem('Failed', { total: 2, succeeded: 0, failed: 2 }),
    ];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });

  it('aggregates jobs from graph run nodes', () => {
    const runs = [
      makeGraphItem('Succeeded', [
        { phase: 'Succeeded', total: 4, succeeded: 3, failed: 1 },
        { phase: 'Succeeded', total: 2, succeeded: 2, failed: 0 },
      ]),
    ];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('83.3%')).toBeInTheDocument();
  });

  it('handles mixed graph and scenario items', () => {
    const runs = [
      makeGraphItem('Succeeded', [
        { phase: 'Succeeded', total: 3, succeeded: 3, failed: 0 },
      ]),
      makeScenarioItem('Failed', { total: 2, succeeded: 0, failed: 2 }),
    ];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });

  it('shows N/A pass rate when no jobs have completed', () => {
    const runs = [makeScenarioItem('Running', { total: 3, succeeded: 0, failed: 0, running: 3 })];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('computes pass rate from completed jobs only, excluding running', () => {
    const runs = [makeScenarioItem('Running', { total: 5, succeeded: 2, failed: 1, running: 2 })];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('falls back to graph run summary when nodes are empty', () => {
    const runs: UnifiedRunItem[] = [{
      type: 'graph',
      graphRunName: 'graph-running',
      nodes: [],
      phase: 'Running',
      createdAt: '2026-01-01T00:00:00Z',
      summary: { totalNodes: 3, completedNodes: 2, runningNodes: 1, failedNodes: 1, pendingNodes: 0 },
    }];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('uses node data over summary when nodes are present', () => {
    const runs: UnifiedRunItem[] = [{
      type: 'graph',
      graphRunName: 'graph-with-nodes',
      nodes: [
        { phase: 'Succeeded', totalTargets: 4, successfulJobs: 3, failedJobs: 1, runningJobs: 0 } as ScenarioRunState,
      ],
      phase: 'Succeeded',
      createdAt: '2026-01-01T00:00:00Z',
      summary: { totalNodes: 5, completedNodes: 5, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
    }];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
