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
  it('reads structured pod items without terminal command output', async () => {
    const listResources = vi.fn(async (_cluster, resource: string, _namespace?: string, _allNamespaces?: boolean) => ({
      items: resource === 'namespaces'
        ? [{ metadata: { name: 'team-a' } }]
        : [{ metadata: { name: 'pod-a', namespace: 'team-a', labels: { app: 'web' } } }],
    }));
    const source = getClusterOptionSource('pod-scenarios', field('POD_LABEL'), {});

    const options = await discoverClusterOptions({
      uuid: 'target-1', clusters: [{ operatorName: 'operator-a', clusterName: 'shared' }], source: source!,
      namespaceExpression: 'team-.*', listResources, cache: new Map(),
    });

    expect(options).toEqual(['app=web']);
    expect(listResources).toHaveBeenCalledWith({ operatorName: 'operator-a', clusterName: 'shared' }, 'pods', undefined, true);
  });

  it('uses same resource reader for node names', async () => {
    const listResources = vi.fn(async () => ({ items: [{ metadata: { name: 'worker-a' } }] }));
    const source = getClusterOptionSource('node-scenarios', field('NODE_NAME'), {});

    const options = await discoverClusterOptions({
      uuid: 'target-1', clusters: [{ operatorName: 'operator-a', clusterName: 'shared' }], source: source!,
      listResources, cache: new Map(),
    });

    expect(options).toEqual(['worker-a']);
    expect(listResources).toHaveBeenCalledWith({ operatorName: 'operator-a', clusterName: 'shared' }, 'nodes', undefined, false);
  });

  it('uses only options available in every selected cluster', async () => {
    const listResources = vi.fn(async (cluster: { clusterName: string }, resource: string) => {
      const names = resource === 'namespaces'
        ? cluster.clusterName === 'first' ? ['default', 'shared'] : ['shared', 'other']
        : cluster.clusterName === 'first' ? ['pod-a', 'pod-shared'] : ['pod-shared', 'pod-b'];
      return {
        items: names.map((name) => ({ metadata: {
          name, ...(resource === 'namespaces' ? {} : { namespace: 'shared' }),
        } })),
      };
    });
    const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});
    expect(source).not.toBeNull();
    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusters: [{ operatorName: 'provider', clusterName: 'first' }, { operatorName: 'provider', clusterName: 'second' }], source: source!,
      namespaceExpression: '.*', listResources, cache: new Map(),
    });
    expect(options).toEqual(['pod-shared']);
    expect(listResources).toHaveBeenCalledWith({ operatorName: 'provider', clusterName: 'first' }, 'pods', undefined, true);
    expect(listResources).not.toHaveBeenCalledWith({ operatorName: 'provider', clusterName: 'first' }, 'pods', 'default', false);
  });

  it('keeps same-name clusters from different providers distinct', async () => {
    const listResources = vi.fn(async (cluster: { operatorName: string }) => ({
      items: ['shared', cluster.operatorName].map((name) => ({ metadata: { name } })),
    }));
    const clusters = [
      { operatorName: 'provider-a', clusterName: 'same' },
      { operatorName: 'provider-b', clusterName: 'same' },
    ];
    const source = getClusterOptionSource('pod-scenarios', field('NAMESPACE'), {});
    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusters, source: source!, listResources, cache: new Map(),
    });

    expect(options).toEqual(['shared']);
    expect(listResources).toHaveBeenCalledTimes(2);
  });

  it('queries an exact namespace without listing all namespaces', async () => {
    const listResources = vi.fn(async () => ({
      items: [{ metadata: { name: 'pod-a' } }],
    }));
    const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});

    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusters: [{ operatorName: 'provider', clusterName: 'first' }], source: source!,
      namespaceExpression: 'team-a', listResources, cache: new Map(),
    });

    expect(options).toEqual(['pod-a']);
    expect(listResources).toHaveBeenCalledTimes(1);
    expect(listResources).toHaveBeenCalledWith({ operatorName: 'provider', clusterName: 'first' }, 'pods', 'team-a', false);
  });

  it('lists each resource once across namespaces matching a regex', async () => {
    const listResources = vi.fn(async (_cluster: { clusterName: string }, resource: string) => ({
      items: resource === 'namespaces'
        ? ['openshift-a', 'openshift-b', 'default'].map((name) => ({ metadata: { name } }))
        : [
          { metadata: { name: 'pod-a', namespace: 'openshift-a' } },
          { metadata: { name: 'pod-b', namespace: 'openshift-b' } },
          { metadata: { name: 'other', namespace: 'default' } },
        ],
    }));
    const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});

    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusters: [{ operatorName: 'provider', clusterName: 'first' }], source: source!,
      namespaceExpression: 'openshift-.*', listResources, cache: new Map(),
    });

    expect(options).toEqual(['pod-a', 'pod-b']);
    expect(listResources).toHaveBeenCalledTimes(2);
    expect(listResources).toHaveBeenCalledWith({ operatorName: 'provider', clusterName: 'first' }, 'pods', undefined, true);
  });

  it('reuses resolved lists across namespace expressions until TTL and bypasses them on refresh', async () => {
    vi.useFakeTimers();
    try {
      const listResources = vi.fn(async (_cluster: { clusterName: string }, resource: string) => ({
        items: resource === 'namespaces'
          ? ['team-a', 'team-b'].map((name) => ({ metadata: { name } }))
          : [
            { metadata: { name: 'pod-a', namespace: 'team-a' } },
            { metadata: { name: 'pod-b', namespace: 'team-b' } },
          ],
      }));
      const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});
      const cache = new Map();
      const discover = (namespaceExpression: string, refresh = false) => discoverClusterOptions({
        uuid: 'test-uuid', clusters: [{ operatorName: 'provider', clusterName: 'first' }], source: source!,
        namespaceExpression, listResources, cache, refresh,
      });

      expect(await discover('team-a.*')).toEqual(['pod-a']);
      expect(await discover('team-b.*')).toEqual(['pod-b']);
      expect(listResources).toHaveBeenCalledTimes(2);

      expect(await discover('team-a.*', true)).toEqual(['pod-a']);
      expect(listResources).toHaveBeenCalledTimes(4);

      await vi.advanceTimersByTimeAsync(30_001);
      expect(await discover('team-b.*')).toEqual(['pod-b']);
      expect(listResources).toHaveBeenCalledTimes(6);
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
