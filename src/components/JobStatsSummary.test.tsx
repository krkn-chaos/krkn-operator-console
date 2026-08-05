import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JobStatsSummary } from './JobStatsSummary';
import type { UnifiedRunItem } from './JobsList';
import type { ClusterJobPhase, ScenarioRunState } from '../types/api';

function makeClusterJob(phase: ClusterJobPhase) {
  return {
    providerName: 'krkn-operator',
    clusterName: 'cluster-1',
    jobId: `job-${phase}-${Math.random()}`,
    podName: 'pod-1',
    phase,
  };
}

function makeScenarioRun(clusterJobPhases: ClusterJobPhase[]): ScenarioRunState {
  return {
    scenarioRunName: 'run-1',
    scenarioName: 'scenario-1',
    phase: 'Succeeded',
    totalTargets: clusterJobPhases.length,
    successfulJobs: clusterJobPhases.filter(p => p === 'Succeeded').length,
    failedJobs: clusterJobPhases.filter(p => p === 'Failed').length,
    runningJobs: clusterJobPhases.filter(p => p === 'Running').length,
    clusterJobs: clusterJobPhases.map(makeClusterJob),
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function makeScenarioItem(clusterJobPhases: ClusterJobPhase[]): UnifiedRunItem {
  return { type: 'scenario', run: makeScenarioRun(clusterJobPhases) };
}

function makeGraphItem(nodeJobPhases: ClusterJobPhase[][]): UnifiedRunItem {
  const allPhases = nodeJobPhases.flat();
  return {
    type: 'graph',
    graphRunName: 'graph-1',
    nodes: nodeJobPhases.map(phases => makeScenarioRun(phases)),
    phase: 'Succeeded',
    createdAt: '2026-01-01T00:00:00Z',
    summary: {
      totalNodes: allPhases.length,
      completedNodes: allPhases.filter(p => p === 'Succeeded').length,
      runningNodes: allPhases.filter(p => p === 'Running').length,
      failedNodes: allPhases.filter(p => p === 'Failed').length,
      pendingNodes: allPhases.filter(p => p === 'Pending').length,
    },
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
    expect(screen.getByText('Total cluster jobs across all runs')).toBeInTheDocument();
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

  it('counts cluster jobs from a single scenario run', () => {
    const runs = [makeScenarioItem(['Succeeded', 'Succeeded', 'Failed'])];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('counts cluster jobs across multiple scenario runs', () => {
    const runs = [
      makeScenarioItem(['Succeeded']),
      makeScenarioItem(['Failed', 'Failed']),
    ];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  it('counts cluster jobs from graph nodes', () => {
    const runs = [
      makeGraphItem([
        ['Succeeded', 'Failed'],
        ['Succeeded', 'Succeeded'],
      ]),
    ];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('handles multi-target standalone run', () => {
    const runs = [makeScenarioItem(['Succeeded', 'Failed', 'Succeeded'])];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('handles graph with multiple nodes', () => {
    const runs = [
      makeGraphItem([
        ['Succeeded'],
        ['Failed'],
        ['Succeeded', 'Succeeded'],
      ]),
    ];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('handles mixed graph and scenario items', () => {
    const runs = [
      makeGraphItem([['Succeeded', 'Succeeded']]),
      makeScenarioItem(['Failed']),
    ];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('shows 100% pass rate when all jobs succeeded', () => {
    const runs = [
      makeScenarioItem(['Succeeded']),
      makeGraphItem([['Succeeded', 'Succeeded']]),
    ];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('does not count Pending or Running jobs as failed', () => {
    const runs = [makeScenarioItem(['Succeeded', 'Pending', 'Running'])];
    render(<JobStatsSummary unifiedRuns={runs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
