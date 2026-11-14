import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../handlers';
import { graphRunsApi } from '../../services';
import { loadGraphRunReplay } from '../../utils/graphRunReplay';

const server = setupServer(...handlers);
const categoryAssociationUrl =
  'http://localhost:3000/api/v2/categories/cluster-reliability/entities/graph-runs/resilience-test-staging';

describe('graph run config mock handler', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns the payload the operator rebuilds from the graph run spec', async () => {
    await fetch(categoryAssociationUrl, { method: 'PUT' });
    try {
      const [config, detail] = await Promise.all([
        graphRunsApi.getGraphRunConfig('resilience-test-staging'),
        graphRunsApi.getGraphRun('resilience-test-staging'),
      ]);

      expect(Object.keys(config.graph)).toEqual(['node-drain', 'pod-delete', 'io-stress']);
      expect(config).toEqual({
        graph: detail.spec.graph,
        targetRequestId: 'target-002',
        targetClusters: { 'krkn-operator': ['staging-eu-west-1'] },
        maxRetries: 3,
        categories: ['cluster-reliability'],
      });
    } finally {
      await fetch(categoryAssociationUrl, { method: 'DELETE' });
    }
  });

  it('builds the Chaos Studio replay workflow for a mock graph run', async () => {
    const { workflow } = await loadGraphRunReplay('chaos-workflow-daily');

    expect(workflow.nodes.map((node) => [node.nodeId, node.config?.scenarioName])).toEqual([
      ['pod-kill', 'pod-kill'],
      ['net-chaos', 'net-chaos'],
      ['cpu-hog', 'cpu-hog'],
      ['time-skew', 'time-skew'],
    ]);
    expect(workflow.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ['pod-kill', 'net-chaos'],
      ['pod-kill', 'cpu-hog'],
      ['net-chaos', 'time-skew'],
    ]);
  });

  it.each(['missing-run', 'constructor'])('returns 404 for the unknown graph run %s, like the operator', async (graphRunName) => {
    await expect(graphRunsApi.getGraphRunConfig(graphRunName)).rejects.toMatchObject({
      status: 404,
      message: `GraphRun '${graphRunName}' not found`,
    });
  });
});
