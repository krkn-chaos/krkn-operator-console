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
    const failure = screen.getByRole('img', { name: /shop at 1 seconds: failed health check, no response .*recorded value -1.*Connection timed out/ });
    const start = Number(horizontalAxis.getAttribute('x1'));
    const end = Number(horizontalAxis.getAttribute('x2'));
    expect(Number(failure.querySelector('circle')?.getAttribute('cx'))).toBeCloseTo(start + (end - start) / 3);
    expect(Number(failure.querySelector('circle')?.getAttribute('cy'))).toBeGreaterThan(bottom);
  });

  it('shows all-failed measurements without inventing a zero-latency series', () => {
    render(<ScenarioHealthCharts scenarioId="9" samples={[sample(0, -1, false), sample(2, -1, false)]} />);
    expect(latencyChart().querySelector('.krkn-ai-health-chart__line')?.getAttribute('d')).toBe('');
    expect(screen.getByRole('img', { name: /shop at 0 seconds: failed health check/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /shop at 2 seconds: failed health check/ })).toBeInTheDocument();
    latencyChart().querySelectorAll('circle').forEach(circle => {
      expect(Number.isFinite(Number(circle.getAttribute('cx')))).toBe(true);
      expect(Number.isFinite(Number(circle.getAttribute('cy')))).toBe(true);
    });
  });

  it('retains measured latency for HTTP failures and valid zero-latency samples', () => {
    render(<ScenarioHealthCharts scenarioId="9" samples={[sample(0, 0), sample(1, 0.25, false), sample(2, 0.1)]} />);
    const path = latencyChart().querySelector('.krkn-ai-health-chart__line')?.getAttribute('d') ?? '';
    expect(path.match(/M/g)).toHaveLength(1);
    expect(path.match(/L/g)).toHaveLength(2);
    expect(latencyChart().querySelector('.krkn-ai-health-chart__failure')).toBeNull();
    expect(screen.getByText('shop at 1 seconds: 0.25 seconds, failed check, HTTP 503')).toBeInTheDocument();
  });
});
