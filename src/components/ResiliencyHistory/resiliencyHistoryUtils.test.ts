import { describe, expect, it } from 'vitest';
import type { ResiliencyHistoryDataPoint, ResiliencyHistoryQueryResponse } from '../../types/api';
import {
  buildResiliencyHistoryCharts,
  formatResiliencyHistoryTooltip,
} from './resiliencyHistoryUtils';

const point = (
  overrides: Partial<ResiliencyHistoryDataPoint> & Pick<ResiliencyHistoryDataPoint, 'runId' | 'configurationGroupId'>,
): ResiliencyHistoryDataPoint => ({
  date: '2026-09-29T10:00:00Z',
  runType: 'scenario-runs',
  score: 75,
  ...overrides,
});

const history: ResiliencyHistoryQueryResponse = {
  clusters: {
    'cluster-a': {
      alpha: [
        point({ runId: 'alpha-later', configurationGroupId: 'shared', date: '2026-09-30T10:00:00Z', score: 0, providerName: 'aws' }),
        point({ runId: 'alpha-earlier', configurationGroupId: 'shared', date: '2026-09-28T10:00:00Z', score: 82 }),
        point({ runId: 'alpha-other', configurationGroupId: 'alpha-only', score: 93 }),
      ],
      beta: [point({ runId: 'beta-run', configurationGroupId: 'shared', score: 61 })],
    },
    'cluster-b': {
      alpha: [point({ runId: 'alpha-cluster-b', configurationGroupId: 'shared', score: 77 })],
      beta: [],
    },
  },
  configurationGroups: {
    alpha: {
      shared: { runType: 'scenario-runs', representativeRunId: 'alpha-later', scenarioNames: ['pod-kill', 'network-delay'] },
      'alpha-only': { runType: 'graph-runs', representativeRunId: 'alpha-other', scenarioNames: ['node-a', 'node-b'] },
    },
    beta: {
      shared: { runType: 'graph-runs', representativeRunId: 'beta-run', scenarioNames: ['cpu-hog'] },
    },
  },
};

describe('resiliency history chart data', () => {
  it('creates one chart for each category-scoped configuration group in separate mode', () => {
    const charts = buildResiliencyHistoryCharts(history, ['alpha', 'beta'], ['cluster-a', 'cluster-b'], 'separate');

    expect(charts).toHaveLength(3);
    const alphaShared = charts.find((chart) => chart.categoryName === 'alpha' && chart.configurationGroupId === 'shared')!;
    expect(alphaShared.title).toContain('pod-kill, network-delay');
    expect(alphaShared.series.map((series) => series.clusterName)).toEqual(['cluster-a', 'cluster-b']);
    expect(alphaShared.series[0].data.map((item) => item.y)).toEqual([82, 0]);
    expect(alphaShared.series[0].data[0].x).toBeLessThan(alphaShared.series[0].data[1].x);

    const betaShared = charts.find((chart) => chart.categoryName === 'beta')!;
    expect(betaShared.title).toContain('cpu-hog');
    expect(betaShared.title).not.toContain('pod-kill');
  });

  it('keeps categories separate when configuration groups are collapsed', () => {
    const charts = buildResiliencyHistoryCharts(history, ['alpha', 'beta'], ['cluster-a', 'cluster-b'], 'collapsed');

    expect(charts).toHaveLength(2);
    expect(charts.map((chart) => chart.categoryName)).toEqual(['alpha', 'beta']);
    expect(charts.every((chart) => chart.isMixedConfiguration)).toBe(true);
    expect(charts[0].series[0].data.map((item) => item.y)).toEqual([82, 93, 0]);
    expect(charts[1].series[0].data).toHaveLength(1);
  });

  it('preserves per-run baselines in separate and collapsed chart models, including zero', () => {
    const baselineHistory: ResiliencyHistoryQueryResponse = {
      ...history,
      clusters: {
        ...history.clusters,
        'cluster-a': {
          ...history.clusters['cluster-a'],
          alpha: [
            point({ runId: 'baseline-zero', configurationGroupId: 'shared', score: 0, baseline: 0 }),
            point({ runId: 'baseline-fail', configurationGroupId: 'alpha-only', score: 60, baseline: 75 }),
          ],
        },
        'cluster-b': {
          ...history.clusters['cluster-b'],
          alpha: [point({ runId: 'cluster-b-baseline', configurationGroupId: 'shared', score: 77, baseline: 70 })],
        },
      },
    };

    const separate = buildResiliencyHistoryCharts(baselineHistory, ['alpha'], ['cluster-a', 'cluster-b'], 'separate');
    const zeroPoint = separate.find((chart) => chart.configurationGroupId === 'shared')!.series[0].data[0];
    const failingPoint = separate.find((chart) => chart.configurationGroupId === 'alpha-only')!.series[0].data[0];
    expect(zeroPoint.baseline).toBe(0);
    expect(zeroPoint.tooltip).toContain('Baseline: 0');
    expect(zeroPoint.tooltip).toContain('Score-baseline delta: +0');
    expect(zeroPoint.tooltip).toContain('Result: Met baseline');
    expect(separate.find((chart) => chart.configurationGroupId === 'shared')!.series[1].data[0].baseline).toBe(70);
    expect(failingPoint.baseline).toBe(75);
    expect(failingPoint.tooltip).toContain('Score-baseline delta: -15');
    expect(failingPoint.tooltip).toContain('Result: Below baseline');

    const collapsed = buildResiliencyHistoryCharts(baselineHistory, ['alpha'], ['cluster-a'], 'collapsed');
    expect(collapsed[0].series[0].data.map((item) => item.baseline)).toEqual([0, 75]);
    const collapsedAcrossClusters = buildResiliencyHistoryCharts(
      baselineHistory,
      ['alpha'],
      ['cluster-a', 'cluster-b'],
      'collapsed',
    );
    expect(collapsedAcrossClusters[0].series[1].data[0].baseline).toBe(70);
  });

  it('leaves points without a baseline unmarked and omits comparison tooltip details', () => {
    const [chart] = buildResiliencyHistoryCharts(history, ['beta'], ['cluster-a'], 'separate');
    const [betaPoint] = chart.series[0].data;
    expect(betaPoint).not.toHaveProperty('baseline');
    expect(betaPoint.tooltip).not.toContain('Baseline:');
    expect(betaPoint.tooltip).not.toContain('Result:');
  });

  it('creates a visible empty chart model for selected categories with no history', () => {
    const charts = buildResiliencyHistoryCharts(
      { clusters: {}, configurationGroups: {} },
      ['empty-category'],
      ['cluster-a'],
      'separate',
    );

    expect(charts).toHaveLength(1);
    expect(charts[0].hasData).toBe(false);
    expect(charts[0].series).toEqual([{ clusterName: 'cluster-a', data: [] }]);
  });

  it('formats tooltips with score, run, provider, category, and configuration details', () => {
    const label = formatResiliencyHistoryTooltip(
      point({
        runId: 'run-1',
        configurationGroupId: 'config-1',
        score: 0,
        providerName: 'aws',
      }),
      'cluster-a',
      'alpha',
      { runType: 'scenario-runs', representativeRunId: 'run-1', scenarioNames: ['pod-kill'] },
    );

    expect(label).toContain('Score: 0');
    expect(label).toContain('Cluster: cluster-a');
    expect(label).toContain('Category: alpha');
    expect(label).toContain('Run: run-1');
    expect(label).toContain('Run type: scenario-runs');
    expect(label).toContain('Provider: aws');
    expect(label).toContain('Configuration group: config-1');
    expect(label).toContain('Scenarios: pod-kill');
  });

  it('formats a baseline tooltip without dropping run metadata', () => {
    const label = formatResiliencyHistoryTooltip(
      point({ runId: 'run-with-baseline', configurationGroupId: 'config-1', score: 70, baseline: 80 }),
      'cluster-a',
      'alpha',
    );

    expect(label).toContain('Baseline: 80');
    expect(label).toContain('Score-baseline delta: -10');
    expect(label).toContain('Result: Below baseline');
    expect(label).toContain('Run: run-with-baseline');
    expect(label).toContain('Configuration group: config-1');
  });
});
