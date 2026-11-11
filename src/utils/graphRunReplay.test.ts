import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetGraphRunConfig = vi.fn();
const mockGetGraphRun = vi.fn();
const mockGetScenarios = vi.fn();
const mockListAvailableCredentials = vi.fn();

vi.mock('../services', () => ({
  graphRunsApi: {
    getGraphRunConfig: (...args: unknown[]) => mockGetGraphRunConfig(...args),
    getGraphRun: (...args: unknown[]) => mockGetGraphRun(...args),
  },
  operatorApi: {
    getScenarios: (...args: unknown[]) => mockGetScenarios(...args),
  },
  cloudCredentialsApi: {
    listAvailable: (...args: unknown[]) => mockListAvailableCredentials(...args),
  },
}));

const { loadGraphRunReplay } = await import('./graphRunReplay');

describe('loadGraphRunReplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAvailableCredentials.mockResolvedValue([]);
  });

  it('converts the saved graph and carries its categories into a Studio workflow', async () => {
    mockGetGraphRunConfig.mockResolvedValue({
      graph: {
        'node-1': {
          scenario: { name: 'pod-kill', private: true, registryName: 'private-registry' },
          image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios',
          cloudCredentialRef: 'aws-credential',
          env: { NAMESPACE: 'default' },
        },
        'node-2': {
          name: 'network-chaos',
          image: 'quay.io/krkn-chaos/krkn-hub:network-chaos',
          depends_on: 'node-1',
        },
        _comment: { name: 'comment', depends_on: 'node-1' },
      },
      categories: ['resilience', 'network'],
      cloudCredentialRef: 'aws-graph',
    });
    mockGetGraphRun.mockResolvedValue({
      spec: {
        resiliencyScoreEnabled: true,
        resiliencyScoreBaseline: 80,
        resiliencyMountPath: '/metrics.yaml',
      },
    });
    mockGetScenarios.mockResolvedValue({ scenarios: [{ name: 'pod-kill', signature_status: 'signed' }] });
    mockListAvailableCredentials.mockResolvedValue([{ name: 'aws-graph', provider: 'aws' }]);

    const replay = await loadGraphRunReplay('workflow-run-1');

    expect(mockGetGraphRunConfig).toHaveBeenCalledWith('workflow-run-1');
    expect(mockGetGraphRun).toHaveBeenCalledWith('workflow-run-1');
    expect(replay.categories).toEqual(['resilience', 'network']);
    expect(replay.workflow.nodes).toHaveLength(2);
    expect(replay.workflow.nodes[0]).toMatchObject({
      nodeId: 'node-1',
      status: 'configured',
      config: {
        registryType: 'private',
        registryConfig: { registryName: 'private-registry' },
        scenarioName: 'pod-kill',
        signature_status: 'signed',
        cloudCredentialRef: 'aws-credential',
        scenarioFormValues: { NAMESPACE: 'default' },
      },
    });
    expect(replay.workflow.edges).toEqual([
      { id: 'node-1-node-2', source: 'node-1', target: 'node-2' },
    ]);
    expect(replay.workflow.nextNodeNumber).toBe(3);
    expect(replay.workflow.resiliencyScoreConfig).toEqual({ baseline: 80, mountPath: '/metrics.yaml' });
    expect(replay.workflow.cloudCredentialRef).toBe('aws-graph');
  });

  it('omits an unavailable graph-level credential during replay', async () => {
    mockGetGraphRunConfig.mockResolvedValue({ graph: {}, cloudCredentialRef: 'removed-credential' });
    mockGetGraphRun.mockResolvedValue({ spec: { resiliencyScoreEnabled: false } });

    const replay = await loadGraphRunReplay('workflow-run-removed-credential');

    expect(replay.workflow.cloudCredentialRef).toBeUndefined();
  });

  it('keeps replay available when signature metadata cannot be loaded', async () => {
    mockGetGraphRunConfig.mockResolvedValue({
      graph: {
        'node-1': {
          scenario: { name: 'pod-kill', signature_status: 'unsigned' },
          image: 'krkn-hub:pod-kill',
        },
      },
    });
    mockGetGraphRun.mockResolvedValue({ spec: { resiliencyScoreEnabled: false } });
    mockGetScenarios.mockRejectedValue(new Error('Registry unavailable'));

    const replay = await loadGraphRunReplay('workflow-run-2');

    expect(replay.workflow.nodes[0]?.config?.signature_status).toBe('unsigned');
    expect(replay.categories).toEqual([]);
    expect(replay.workflow.resiliencyScoreConfig).toBeUndefined();
  });
});
