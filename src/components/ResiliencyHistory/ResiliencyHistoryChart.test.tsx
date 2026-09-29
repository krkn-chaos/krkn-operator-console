import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResiliencyHistoryQueryResponse } from '../../types/api';
import { buildResiliencyHistoryCharts } from './resiliencyHistoryUtils';
import { ResiliencyHistoryChart } from './ResiliencyHistoryChart';

const history: ResiliencyHistoryQueryResponse = {
  clusters: {
    'cluster-a': {
      resilience: [{
        date: '2026-09-29T10:00:00Z',
        runId: 'run-1',
        runType: 'scenario-runs',
        score: 0,
        baseline: 0,
        configurationGroupId: 'config-1',
      }],
    },
  },
  configurationGroups: {
    resilience: { 'config-1': { runType: 'scenario-runs', representativeRunId: 'run-1', scenarioNames: ['pod-kill'] } },
  },
};

describe('ResiliencyHistoryChart', () => {
  it('renders an accessible responsive line chart and cluster legend', () => {
    const [chart] = buildResiliencyHistoryCharts(history, ['resilience'], ['cluster-a'], 'separate');
    render(<ResiliencyHistoryChart chart={chart} />);

    expect(screen.getByRole('heading', { name: 'resilience — pod-kill (configuration config-1)' })).toBeInTheDocument();
    expect(screen.getByText('cluster-a')).toBeInTheDocument();
    expect(document.querySelector('svg')).not.toBeNull();
  });

  it('renders an empty chart state when no points match a group', () => {
    const [chart] = buildResiliencyHistoryCharts(
      { clusters: {}, configurationGroups: {} },
      ['resilience'],
      ['cluster-a'],
      'separate',
    );
    render(<ResiliencyHistoryChart chart={chart} />);

    expect(screen.getByText('No scores for this selection')).toBeInTheDocument();
    expect(document.querySelector('.resiliency-history__chart-container')).toBeNull();
  });

  it('shows an accessible baseline key, including for a zero baseline', () => {
    const [chart] = buildResiliencyHistoryCharts(history, ['resilience'], ['cluster-a'], 'separate');
    render(<ResiliencyHistoryChart chart={chart} />);

    expect(screen.getByRole('list', { name: 'Baseline marker key' })).toBeInTheDocument();
    expect(screen.getByText('Met baseline: solid tick and connector')).toBeInTheDocument();
    expect(screen.getByText('Below baseline: dashed tick and connector')).toBeInTheDocument();
  });

  it('can hide baseline markers while keeping their tooltip in the chart data', () => {
    const [chart] = buildResiliencyHistoryCharts(history, ['resilience'], ['cluster-a'], 'separate');
    render(<ResiliencyHistoryChart chart={chart} showBaselines={false} />);

    expect(screen.queryByRole('list', { name: 'Baseline marker key' })).not.toBeInTheDocument();
    expect(chart.series[0].data[0].tooltip).toContain('Baseline: 0');
  });
});
