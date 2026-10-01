import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScenarioHealthCharts } from './ScenarioHealthCharts';
import type { KrknAIScenarioHealthCheck } from '../../services/krknAiApi';

function sample(elapsedSeconds: number, responseTimeSeconds: number, success = true): KrknAIScenarioHealthCheck {
  return {
    application: 'shop', timestamp: '2026-10-01T10:00:00Z', elapsedSeconds, responseTimeSeconds,
    success, statusCode: success ? 200 : responseTimeSeconds < 0 ? -1 : 503,
    error: responseTimeSeconds < 0 ? 'Connection timed out' : undefined,
  };
}

function latencyChart() {
  return screen.getByRole('img', { name: 'Measured health-check response time by application for scenario 9' });
}

describe('ScenarioHealthCharts', () => {
  it('breaks the latency line at failed measurements and preserves failure time and error', () => {
    render(<ScenarioHealthCharts scenarioId="9" samples={[sample(3, 0.5), sample(1, -1, false), sample(0, 0.2), sample(2, 0.4)]} />);
    const chart = latencyChart();
    const line = chart.querySelector('.krkn-ai-health-chart__line');
    const path = line?.getAttribute('d') ?? '';
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path.match(/L/g)).toHaveLength(1);
    const circles = Array.from(line?.parentElement?.querySelectorAll(':scope > circle') ?? []);
    const [verticalAxis, horizontalAxis] = Array.from(chart.querySelectorAll('.krkn-ai-health-chart__axis'));
    const top = Number(verticalAxis.getAttribute('y1'));
    const bottom = Number(horizontalAxis.getAttribute('y1'));
    expect(circles).toHaveLength(3);
    circles.forEach(circle => {
      expect(Number(circle.getAttribute('cy'))).toBeGreaterThanOrEqual(top);
      expect(Number(circle.getAttribute('cy'))).toBeLessThanOrEqual(bottom);
    });
    const failure = chart.querySelector('.krkn-ai-health-chart__failure');
    expect(failure?.getAttribute('aria-label')).toMatch(/shop\. Elapsed: 1 seconds.*Error: Connection timed out/);
    const start = Number(horizontalAxis.getAttribute('x1'));
    const end = Number(horizontalAxis.getAttribute('x2'));
    expect(Number(failure?.querySelector('circle')?.getAttribute('cx'))).toBeCloseTo(start + (end - start) / 3);
    expect(Number(failure?.querySelector('circle')?.getAttribute('cy'))).toBeGreaterThan(bottom);
  });

  it('shows all-failed measurements without inventing a zero-latency series', () => {
    render(<ScenarioHealthCharts scenarioId="9" samples={[sample(0, -1, false), sample(2, -1, false)]} />);
    expect(latencyChart().querySelector('.krkn-ai-health-chart__line')?.getAttribute('d')).toBe('');
    const outcomes = document.querySelectorAll('.krkn-ai-health-chart__heatmap-sample');
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0].getAttribute('aria-label')).toMatch(/Elapsed: 0 seconds.*no response/);
    expect(outcomes[1].getAttribute('aria-label')).toMatch(/Elapsed: 2 seconds.*no response/);
    latencyChart().querySelectorAll('circle').forEach(circle => {
      expect(Number.isFinite(Number(circle.getAttribute('cx')))).toBe(true);
      expect(Number.isFinite(Number(circle.getAttribute('cy')))).toBe(true);
    });
  });

  it('retains measured latency for HTTP failures and valid zero-latency samples', () => {
    render(<ScenarioHealthCharts scenarioId="9" samples={[sample(0, 0), { ...sample(1, 0.25, false), timestamp: '2026-10-01T10:01:02Z', error: 'Bad gateway' }, sample(2, 0.1)]} />);
    const path = latencyChart().querySelector('.krkn-ai-health-chart__line')?.getAttribute('d') ?? '';
    expect(path.match(/M/g)).toHaveLength(1);
    expect(path.match(/L/g)).toHaveLength(2);
    expect(latencyChart().querySelector('.krkn-ai-health-chart__failure')).toBeNull();
    const outcome = document.querySelector('.krkn-ai-health-chart__heatmap-sample[aria-label*="Elapsed: 1 seconds"]');
    expect(outcome?.getAttribute('aria-label')).toMatch(/Timestamp: 2026-10-01T10:01:02Z\. Status: HTTP 503\. Outcome: failure\. Error: Bad gateway\. Latency: 0\.25 seconds/);
  });

  it('preserves dense samples in a horizontally scrollable outcome plot', () => {
    const samples = Array.from({ length: 240 }, (_, index) => ({
      ...sample(index, 0.2),
      timestamp: new Date(Date.UTC(2026, 9, 1, 10, 0, index)).toISOString(),
    }));
    render(<ScenarioHealthCharts scenarioId="9" samples={samples} />);
    const plot = document.querySelector('.krkn-ai-health-chart__heatmap-plot');
    expect(plot?.querySelectorAll('.krkn-ai-health-chart__heatmap-sample')).toHaveLength(240);
    expect(Number(plot?.getAttribute('width'))).toBeGreaterThan(860);
  });

  it('places samples from different polling intervals at the same elapsed position', () => {
    const samples = [
      { ...sample(0, 0.2), application: 'fast', timestamp: '2026-10-01T10:00:00Z' },
      { ...sample(2, 0.2), application: 'fast', timestamp: '2026-10-01T10:00:02Z' },
      { ...sample(4, 0.2), application: 'fast', timestamp: '2026-10-01T10:00:04Z' },
      { ...sample(0, 0.2), application: 'slow', timestamp: '2026-10-01T10:00:00Z' },
      { ...sample(4, 0.2), application: 'slow', timestamp: '2026-10-01T10:00:04Z' },
      { ...sample(8, 0.2), application: 'slow', timestamp: '2026-10-01T10:00:08Z' },
    ];
    render(<ScenarioHealthCharts scenarioId="9" samples={samples} />);
    const fastAtFour = screen.getByRole('img', { name: /fast\. Elapsed: 4 seconds/ }).querySelector('rect');
    const slowAtFour = screen.getByRole('img', { name: /slow\. Elapsed: 4 seconds/ }).querySelector('rect');
    expect(fastAtFour?.getAttribute('x')).toBe(slowAtFour?.getAttribute('x'));
  });

  it('does not inflate the scroll width for small timing offsets between applications', () => {
    const samples = [0, 2, 4, 6].flatMap(seconds => [
      { ...sample(seconds, 0.2), application: 'first' },
      { ...sample(seconds, 0.2), application: 'second' },
    ]);
    const { rerender } = render(<ScenarioHealthCharts scenarioId="9" samples={samples} />);
    const originalWidth = Number(document.querySelector('.krkn-ai-health-chart__heatmap-plot')?.getAttribute('width'));
    rerender(<ScenarioHealthCharts scenarioId="9" samples={samples.map(row => row.application === 'second' ? { ...row, elapsedSeconds: row.elapsedSeconds! + 0.001 } : row)} />);
    const shiftedPlot = document.querySelector('.krkn-ai-health-chart__heatmap-plot');
    expect(Number(shiftedPlot?.getAttribute('width'))).toBeLessThan(originalWidth * 1.01);
    expect(shiftedPlot?.querySelectorAll('.krkn-ai-health-chart__heatmap-sample')).toHaveLength(8);
  });
});
