import { describe, expect, it, vi } from 'vitest';
import { discoverClusterOptions, getClusterOptionSource } from './clusterParameterOptions';
import type { StringField } from '../types/api';
import scenarioGlobals from '../../misc/scenario_globals.json';
import nodeScenario from '../../misc/scenario_detail.json';

const field = (variable: string): StringField => ({
  name: variable.toLowerCase(), variable, short_description: variable,
  description: '', type: 'string', required: false,
});

describe('cluster parameter options', () => {
  it('uses only options available in every selected cluster', async () => {
    const runCommand = vi.fn(async (cluster: { clusterName: string }, command: string) => {
      const names = command.includes('namespaces')
        ? cluster.clusterName === 'first' ? ['default', 'shared'] : ['shared', 'other']
        : cluster.clusterName === 'first' ? ['pod-a', 'pod-shared'] : ['pod-shared', 'pod-b'];
      return {
        stdout: JSON.stringify({ items: names.map((name) => ({ metadata: {
          name, ...(command.includes('namespaces') ? {} : { namespace: 'shared' }),
        } })) }),
        stderr: '', exitCode: 0,
      };
    });
    const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});
    expect(source).not.toBeNull();
    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusters: [{ operatorName: 'provider', clusterName: 'first' }, { operatorName: 'provider', clusterName: 'second' }], source: source!,
      namespaceExpression: '.*', runCommand, cache: new Map(),
      getNodeNames: async () => [],
    });
    expect(options).toEqual(['pod-shared']);
    expect(runCommand).toHaveBeenCalledWith({ operatorName: 'provider', clusterName: 'first' }, 'kubectl get pods -A -o json');
    expect(runCommand).not.toHaveBeenCalledWith({ operatorName: 'provider', clusterName: 'first' }, 'kubectl get pods -n default -o json');
  });

  it('keeps same-name clusters from different providers distinct', async () => {
    const runCommand = vi.fn(async (cluster: { operatorName: string }) => ({
      stdout: JSON.stringify({ items: ['shared', cluster.operatorName].map((name) => ({ metadata: { name } })) }),
      stderr: '', exitCode: 0,
    }));
    const clusters = [
      { operatorName: 'provider-a', clusterName: 'same' },
      { operatorName: 'provider-b', clusterName: 'same' },
    ];
    const source = getClusterOptionSource('pod-scenarios', field('NAMESPACE'), {});
    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusters, source: source!, runCommand, cache: new Map(), getNodeNames: async () => [],
    });

    expect(options).toEqual(['shared']);
    expect(runCommand).toHaveBeenCalledTimes(2);
  });

  it('queries an exact namespace without listing all namespaces', async () => {
    const runCommand = vi.fn(async () => ({
      stdout: JSON.stringify({ items: [{ metadata: { name: 'pod-a' } }] }),
      stderr: '', exitCode: 0,
    }));
    const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});

    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusters: [{ operatorName: 'provider', clusterName: 'first' }], source: source!,
      namespaceExpression: 'team-a', runCommand, cache: new Map(),
      getNodeNames: async () => [],
    });

    expect(options).toEqual(['pod-a']);
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith({ operatorName: 'provider', clusterName: 'first' }, 'kubectl get pods -n team-a -o json');
  });

  it('lists each resource once across namespaces matching a regex', async () => {
    const runCommand = vi.fn(async (_cluster: { clusterName: string }, command: string) => ({
      stdout: JSON.stringify({ items: command.includes('namespaces')
        ? ['openshift-a', 'openshift-b', 'default'].map((name) => ({ metadata: { name } }))
        : [
          { metadata: { name: 'pod-a', namespace: 'openshift-a' } },
          { metadata: { name: 'pod-b', namespace: 'openshift-b' } },
          { metadata: { name: 'other', namespace: 'default' } },
        ] }),
      stderr: '', exitCode: 0,
    }));
    const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});

    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusters: [{ operatorName: 'provider', clusterName: 'first' }], source: source!,
      namespaceExpression: 'openshift-.*', runCommand, getNodeNames: async () => [], cache: new Map(),
    });

    expect(options).toEqual(['pod-a', 'pod-b']);
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand).toHaveBeenCalledWith({ operatorName: 'provider', clusterName: 'first' }, 'kubectl get pods -A -o json');
  });

  it('reuses resolved lists across namespace expressions until TTL and bypasses them on refresh', async () => {
    vi.useFakeTimers();
    try {
      const runCommand = vi.fn(async (_cluster: { clusterName: string }, command: string) => ({
        stdout: JSON.stringify({ items: command.includes('namespaces')
          ? ['team-a', 'team-b'].map((name) => ({ metadata: { name } }))
          : [
            { metadata: { name: 'pod-a', namespace: 'team-a' } },
            { metadata: { name: 'pod-b', namespace: 'team-b' } },
          ] }),
        stderr: '', exitCode: 0,
      }));
      const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});
      const cache = new Map();
      const discover = (namespaceExpression: string, refresh = false) => discoverClusterOptions({
        uuid: 'test-uuid', clusters: [{ operatorName: 'provider', clusterName: 'first' }], source: source!,
        namespaceExpression, runCommand, getNodeNames: async () => [], cache, refresh,
      });

      expect(await discover('team-a.*')).toEqual(['pod-a']);
      expect(await discover('team-b.*')).toEqual(['pod-b']);
      expect(runCommand).toHaveBeenCalledTimes(2);

      expect(await discover('team-a.*', true)).toEqual(['pod-a']);
      expect(runCommand).toHaveBeenCalledTimes(4);

      await vi.advanceTimersByTimeAsync(30_001);
      expect(await discover('team-b.*')).toEqual(['pod-b']);
      expect(runCommand).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses comma selection for node-scenarios NODE_NAME and keeps plural field modes', () => {
    const nodeNameField = nodeScenario.fields.find((entry) => entry.variable === 'NODE_NAME');
    expect(nodeNameField).toBeDefined();
    expect(getClusterOptionSource(nodeScenario.name, { ...nodeNameField!, type: 'string' }, {})).toMatchObject({
      resource: 'nodes', selectionMode: 'comma',
    });
    expect(getClusterOptionSource('node-scenarios', field('NODE_NAMES'), {})).toMatchObject({
      selectionMode: 'list',
    });
    expect(getClusterOptionSource('pod-scenarios', field('POD_NAMES'), {})).toMatchObject({
      selectionMode: 'comma',
    });
  });

  it('maps node selectors to nodes without a namespace dependency', () => {
    const source = getClusterOptionSource('node-scenarios', field('LABEL_SELECTOR'), {});
    expect(source).toEqual({ resource: 'nodes', selection: 'label', namespaced: false });
  });

  it.each(['vmi-outage', 'kubevirt-outage'])('discovers KubeVirt names from global metadata for %s', (scenario) => {
    const kubeVirtNameField = scenarioGlobals.fields.find((entry) => entry.variable === 'KUBE_VIRT_NAME');
    expect(kubeVirtNameField).toBeDefined();

    expect(getClusterOptionSource(scenario, field(kubeVirtNameField!.variable), {})).toEqual({
      resource: 'vmi', selection: 'name', namespaced: true,
    });
  });

  it('uses list selections for pod and node OBJECT_NAME in time-scenarios', () => {
    expect(getClusterOptionSource('time-scenarios', field('OBJECT_NAME'), { OBJECT_TYPE: 'pod' })).toMatchObject({
      resource: 'pods', selectionMode: 'list',
    });
    expect(getClusterOptionSource('time-scenarios', field('OBJECT_NAME'), { OBJECT_TYPE: 'node' })).toMatchObject({
      resource: 'nodes', selectionMode: 'list',
    });
  });

  it('leaves ambiguous selectors editable without unrelated suggestions', () => {
    expect(getClusterOptionSource('service-disruption-scenarios', field('LABEL_SELECTOR'), {})).toBeNull();
    expect(getClusterOptionSource('time-scenarios', field('OBJECT_NAME'), { OBJECT_TYPE: 'deployment' })).toBeNull();
  });
});
