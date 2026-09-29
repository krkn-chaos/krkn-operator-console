import { beforeEach, describe, expect, it, vi } from 'vitest';
import { graphRunsApi } from '../../services/graphRunsApi';
import { operatorApi } from '../../services/operatorApi';
import { configCache } from '../scenarioConfigCache';
import { buildResiliencyHistoryCharts } from './resiliencyHistoryUtils';
import { buildResiliencyHistoryPdf } from './resiliencyHistoryReport';

const queryResult = {
  clusters: {
    'cluster-a': {
      resilience: [{
        date: '2026-09-29T10:00:00Z',
        runId: 'run-1',
        runType: 'scenario-runs',
        score: 87,
        baseline: 85,
        configurationGroupId: 'scenario-runs/run-1',
      }],
      reliability: [{
        date: '2026-09-29T11:00:00Z',
        runId: 'graph-1',
        runType: 'graph-runs',
        score: 91,
        configurationGroupId: 'graph-runs/graph-1',
      }],
    },
  },
  configurationGroups: {
    resilience: {
      'scenario-runs/run-1': {
        runType: 'scenario-runs',
        representativeRunId: 'run-1',
        scenarioNames: ['pod-kill'],
      },
    },
    reliability: {
      'graph-runs/graph-1': {
        runType: 'graph-runs',
        representativeRunId: 'graph-1',
        scenarioNames: ['cpu-workflow'],
      },
    },
  },
};

describe('resiliency history PDF report', () => {
  beforeEach(() => {
    configCache.clear();
  });

  it('builds paginated overview, chart, and configuration pages with secrets redacted', async () => {
    vi.spyOn(operatorApi, 'getScenarioRunConfig').mockResolvedValue({
      targetRequestId: 'target-1',
      targetClusters: { 'krkn-operator': ['cluster-a'] },
      scenarioName: 'pod-kill',
      kubeconfigPath: '/unused',
      environment: { DURATION: '60', API_PASSWORD: 'report-secret' },
    });
    vi.spyOn(graphRunsApi, 'getGraphRunConfig').mockResolvedValue({
      targetRequestId: 'target-2',
      targetClusters: { 'krkn-operator': ['cluster-a'] },
      graph: {
        'cpu-node': {
          scenario: { name: 'node-cpu-hog', private: false },
          env: { DURATION: '90', API_TOKEN: 'graph-secret' },
        },
      },
      maxRetries: 2,
    });
    const categories = ['resilience', 'reliability'];
    const charts = buildResiliencyHistoryCharts(queryResult, categories, ['cluster-a'], 'separate');
    const pdf = await buildResiliencyHistoryPdf({
      queryResult,
      categories,
      clusters: ['cluster-a'],
      charts,
      chartMode: 'separate',
      showBaselines: true,
      queriedAt: 'Sep 29, 2026, 10:01 AM',
      reportGeneratedAt: 'Sep 29, 2026, 10:02 AM',
    });
    const pages = (pdf.internal as unknown as { pages: string[][] }).pages;
    const pdfText = pages.flat(2).join('\n');
    expect(pdf.getNumberOfPages()).toBe(4);
    expect(pdfText).toContain('Latest score snapshot');
    expect(pdfText).toContain('Score trends');
    expect(pdfText).toContain('Target clusters');
    expect(pdfText).toContain('DURATION');
    expect(pdfText).toContain('Workflow nodes');
    expect(pdfText).toContain('[redacted]');
    expect(pdfText).not.toContain('report-secret');
    expect(pdfText).not.toContain('graph-secret');
  });
});
