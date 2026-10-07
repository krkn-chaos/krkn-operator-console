import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ScenarioHealthCharts } from './ScenarioHealthCharts';
import type { KrknAIScenarioHealthCheck } from '../../services/krknAiApi';

function sample(
  elapsedSeconds: number | null,
  responseTimeSeconds: number | null,
  success: boolean | null = true,
  overrides: Partial<KrknAIScenarioHealthCheck> = {},
): KrknAIScenarioHealthCheck {
  return {
    application: 'shop', timestamp: '2026-10-01T10:00:00Z', elapsedSeconds, responseTimeSeconds,
    success, statusCode: success ? 200 : responseTimeSeconds === null || responseTimeSeconds < 0 ? null : 404,
    error: responseTimeSeconds === null || responseTimeSeconds < 0 ? 'Connection timed out' : undefined,
    ...overrides,
  };
}

function latencyChart() {
  return screen.getByRole('img', { name: 'Measured health-check response time by application for scenario 9' });
}

describe('ScenarioHealthCharts', () => {
  it('filters both plots while retaining application colors and allows clearing and restoring selection', async () => {
    const user = userEvent.setup();
    const readings = [
      sample(0, 0.02, true, { application: 'shop' }),
      sample(1, 0.03, true, { application: 'shop' }),
      sample(0, 0.4, false, { application: 'ratings' }),
    ];
    const { rerender } = render(<ScenarioHealthCharts scenarioId="9" samples={readings} />);
    const ratingsColor = latencyChart().querySelectorAll('circle')[2].getAttribute('style');
    await user.click(screen.getByRole('checkbox', { name: 'shop' }));
    expect(latencyChart().querySelectorAll('circle')).toHaveLength(1);
    expect(latencyChart().querySelector('circle')?.getAttribute('style')).toBe(ratingsColor);
    const outcomes = screen.getByRole('group', { name: 'Measured health-check outcome samples for scenario 9' });
    expect(within(outcomes).getAllByRole('img').map((cell) => cell.getAttribute('aria-label')))
      .toEqual([expect.stringContaining('ratings.')]);
    rerender(<ScenarioHealthCharts scenarioId="9" samples={[...readings, sample(1, 0.5, true, { application: 'ratings' })]} />);
    expect(screen.getByRole('checkbox', { name: 'shop' })).not.toBeChecked();
    expect(latencyChart().querySelectorAll('circle')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('img', { name: /Measured health-check response time/ })).toBeNull();
    expect(screen.getByText('Select a health-check application to display its measurements.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(latencyChart().querySelectorAll('circle')).toHaveLength(4);
    await user.click(screen.getByRole('checkbox', { name: 'shop' }));
    rerender(<ScenarioHealthCharts scenarioId="10" samples={readings} />);
    expect(screen.getByRole('checkbox', { name: 'shop' })).toBeChecked();
  });

  it('breaks latency paths for missing and invalid readings while retaining measured HTTP 404 latency', () => {
    const readings = [
      sample(0, 0.02),
      sample(1, 0.03, false, { statusCode: 404, error: 'Not found' }),
      sample(2, null, false),
      sample(3, 0.04),
      sample(4, -1, false),
      sample(5, 0.05),
      sample(6, Number.NaN),
      sample(7, 0.06),
    ];
    render(<ScenarioHealthCharts scenarioId="9" samples={readings} />);
    const chart = latencyChart();
    const path = chart.querySelector('.krkn-ai-health-chart__line')?.getAttribute('d') ?? '';
    expect(path.match(/M/g)).toHaveLength(4);
    expect(path.match(/L/g)).toHaveLength(1);
    expect(chart.querySelectorAll(':scope circle')).toHaveLength(5);
    expect(chart.querySelector('.krkn-ai-health-chart__failure')).toBeNull();
    expect(chart.querySelector('.krkn-ai-health-chart__failure-lane')).toBeNull();
    expect(document.querySelector('.krkn-ai-health-chart__failure-note')).toBeNull();
    expect(screen.getByText('shop (3 failed)')).toBeTruthy();
    const outcome404 = screen.getByRole('img', { name: /Status: HTTP 404\. Outcome: failure\. Error: Not found\. Latency: 0\.03 seconds/ });
    expect(outcome404.querySelector('rect')?.getAttribute('class')).toContain('failure');
    expect(screen.getByRole('img', { name: /no response \(recorded value -1 seconds\)/ })).toBeTruthy();
  });

  it('scales to measured positive latency and keeps all-zero and empty-latency plots finite', () => {
    const { rerender } = render(<ScenarioHealthCharts scenarioId="9" samples={[sample(0, 0.01), sample(1, 0.02)]} />);
    const chart = latencyChart();
    const [small, large] = Array.from(chart.querySelectorAll(':scope circle'));
    expect(Math.abs(Number(small.getAttribute('cy')) - Number(large.getAttribute('cy')))).toBeGreaterThan(50);

    rerender(<ScenarioHealthCharts scenarioId="9" samples={[sample(0, 0), sample(1, 0)]} />);
    latencyChart().querySelectorAll('*').forEach((element) => {
      for (const attribute of ['x', 'x1', 'x2', 'y', 'y1', 'y2', 'cx', 'cy']) {
        const value = element.getAttribute(attribute);
        if (value !== null) expect(Number.isFinite(Number(value))).toBe(true);
      }
    });
    rerender(<ScenarioHealthCharts scenarioId="9" samples={[sample(null, null, false)]} />);
    expect(latencyChart().querySelector('.krkn-ai-health-chart__line')?.getAttribute('d')).toBe('');
    expect(document.querySelectorAll('.krkn-ai-health-chart__heatmap-sample')).toHaveLength(1);
  });

  it('renders ordered contiguous cells per service without aligning duplicates or unequal rows', () => {
    const samples = [
      sample(8, 0.2, true, { application: 'fast', timestamp: '2026-10-01T10:00:02Z', statusCode: 201 }),
      sample(null, null, null, { application: 'slow', timestamp: '2026-10-01T10:00:01Z', statusCode: null }),
      sample(4, 0.2, true, { application: 'fast', timestamp: '2026-10-01T10:00:01Z', statusCode: 202 }),
      sample(4, 0.2, false, { application: 'fast', timestamp: '2026-10-01T10:00:01Z', statusCode: 404 }),
      sample(12, 0.2, true, { application: 'slow', timestamp: '2026-10-01T10:00:03Z', statusCode: 204 }),
    ];
    render(<ScenarioHealthCharts scenarioId="9" samples={samples} />);
    const plot = screen.getByRole('group', { name: 'Measured health-check outcome samples for scenario 9' });
    const outcomeSamples = Array.from(plot.querySelectorAll('.krkn-ai-health-chart__heatmap-sample'));
    expect(outcomeSamples).toHaveLength(5);
    const fastCells = outcomeSamples.filter((cell) => cell.getAttribute('aria-label')?.startsWith('fast.'));
    const slowCells = outcomeSamples.filter((cell) => cell.getAttribute('aria-label')?.startsWith('slow.'));
    expect(fastCells.map((cell) => cell.querySelector('text')?.textContent)).toEqual(['202', '404', '201']);
    const cellWidth = Number(fastCells[0].querySelector('rect')?.getAttribute('width'));
    expect(fastCells.map((cell) => Number(cell.querySelector('rect')?.getAttribute('x')))).toEqual([0, cellWidth, cellWidth * 2]);
    expect(slowCells.map((cell) => Number(cell.querySelector('rect')?.getAttribute('x')))).toEqual([0, cellWidth]);
    expect(slowCells[0].getAttribute('aria-label')).toContain('Elapsed: not recorded');
    expect(plot.querySelector('.krkn-ai-health-chart__heatmap-tick')).toBeNull();
    expect(plot.querySelector('.krkn-ai-health-chart__axis-label')).toBeNull();
  });


  it('uses natural cell widths for sparse health-check samples', () => {
    render(<ScenarioHealthCharts scenarioId="9" samples={[sample(0, 0.2), sample(1, 0.3)]} />);
    const plot = screen.getByRole('group', { name: 'Measured health-check outcome samples for scenario 9' });

    expect(plot.getAttribute('viewBox')).toBe('0 0 96 38');
    expect(plot.querySelector('rect')).toHaveAttribute('width', '48');
    expect(plot.getAttribute('style')).toContain('width: 96px');
  });

  it('preserves every dense record in adjacent overflow cells', () => {
    const samples = Array.from({ length: 240 }, (_, index) => sample(index, 0.02, true, {
      timestamp: new Date(Date.UTC(2026, 9, 1, 10, 0, index)).toISOString(),
    }));
    render(<ScenarioHealthCharts scenarioId="9" samples={samples} />);
    const plot = screen.getByRole('group', { name: 'Measured health-check outcome samples for scenario 9' });
    const cells = Array.from(plot.querySelectorAll('.krkn-ai-health-chart__heatmap-sample'));
    expect(cells).toHaveLength(240);
    expect(Number(plot.getAttribute('viewBox')?.split(' ')[2])).toBe(240 * 32);
    expect(cells.slice(0, 3).map((cell) => Number(cell.querySelector('rect')?.getAttribute('x')))).toEqual([0, 32, 64]);
    expect(plot.closest('.krkn-ai-health-chart__heatmap-scroll')).toBeTruthy();
    expect(within(plot).getAllByRole('img')).toHaveLength(240);
  });
});
