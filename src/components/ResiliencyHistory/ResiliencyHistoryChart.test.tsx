import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(document.querySelector('.resiliency-history__chart-stage')).toBeNull();
  });

  it('shows an accessible baseline key, including for a zero baseline', () => {
    const [chart] = buildResiliencyHistoryCharts(history, ['resilience'], ['cluster-a'], 'separate');
    render(<ResiliencyHistoryChart chart={chart} />);

    expect(screen.getByRole('list', { name: 'Baseline marker key' })).toBeInTheDocument();
    expect(screen.getByText('Met baseline')).toBeInTheDocument();
    expect(screen.getByText('Below baseline')).toBeInTheDocument();
  });

  it('can hide baseline markers while keeping their tooltip in the chart data', () => {
    const [chart] = buildResiliencyHistoryCharts(history, ['resilience'], ['cluster-a'], 'separate');
    render(<ResiliencyHistoryChart chart={chart} showBaselines={false} />);

    expect(screen.queryByRole('list', { name: 'Baseline marker key' })).not.toBeInTheDocument();
    expect(chart.series[0].data[0].tooltip).toContain('Baseline 0');
  });

  it('keeps the horizontal target tick solid when the score is below baseline', () => {
    const belowBaselineHistory = {
      ...history,
      clusters: {
        'cluster-a': {
          resilience: [{ ...history.clusters['cluster-a'].resilience[0], score: 60, baseline: 75 }],
        },
      },
    };
    const [chart] = buildResiliencyHistoryCharts(belowBaselineHistory, ['resilience'], ['cluster-a'], 'separate');
    const { container } = render(<ResiliencyHistoryChart chart={chart} />);

    expect(container.querySelector('.resiliency-history__baseline-tick')).not.toHaveAttribute('stroke-dasharray');
    expect(container.querySelector('.resiliency-history__baseline-connector.is-below')).toHaveAttribute('stroke-dasharray', '3 3');
  });

  it('zooms with controls, resets the full view, and shows a short point tooltip', async () => {
    const user = userEvent.setup();
    const [chart] = buildResiliencyHistoryCharts(history, ['resilience'], ['cluster-a'], 'separate');
    const { container } = render(<ResiliencyHistoryChart chart={chart} />);
    const svg = container.querySelector('svg')!;

    expect(svg).toHaveAttribute('data-zoomed', 'false');
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(svg).toHaveAttribute('data-zoomed', 'true');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(svg).toHaveAttribute('data-zoomed', 'false');
    fireEvent.wheel(svg, { deltaY: -120, clientX: 300, clientY: 120 });
    expect(svg).toHaveAttribute('data-zoomed', 'true');

    fireEvent.mouseEnter(container.querySelector('[data-run-id="run-1"]')!);
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('Baseline 0');
    expect(tooltip).toHaveTextContent('Met baseline');
    expect(tooltip).toHaveTextContent('run-1');
    expect(tooltip).not.toHaveTextContent('Configuration group');
  });
});
