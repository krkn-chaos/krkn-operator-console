import { describe, expect, it, vi } from 'vitest';
import { discoverClusterOptions, getClusterOptionSource } from './clusterParameterOptions';
import type { StringField } from '../types/api';

const field = (variable: string): StringField => ({
  name: variable.toLowerCase(), variable, short_description: variable,
  description: '', type: 'string', required: false,
});

describe('cluster parameter options', () => {
  it('uses only options available in every selected cluster', async () => {
    const runCommand = vi.fn(async (cluster: string, command: string) => {
      const names = command.includes('namespaces')
        ? cluster === 'first' ? ['default', 'shared'] : ['shared', 'other']
        : cluster === 'first' ? ['pod-a', 'pod-shared'] : ['pod-shared', 'pod-b'];
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
      uuid: 'test-uuid', clusterNames: ['first', 'second'], source: source!,
      namespaceExpression: '.*', runCommand, cache: new Map(),
      getNodeNames: async () => [],
    });
    expect(options).toEqual(['pod-shared']);
    expect(runCommand).toHaveBeenCalledWith('first', 'kubectl get pods -A -o json');
    expect(runCommand).not.toHaveBeenCalledWith('first', 'kubectl get pods -n default -o json');
  });

  it('queries an exact namespace without listing all namespaces', async () => {
    const runCommand = vi.fn(async () => ({
      stdout: JSON.stringify({ items: [{ metadata: { name: 'pod-a' } }] }),
      stderr: '', exitCode: 0,
    }));
    const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});

    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusterNames: ['first'], source: source!,
      namespaceExpression: 'team-a', runCommand, cache: new Map(),
      getNodeNames: async () => [],
    });

    expect(options).toEqual(['pod-a']);
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith('first', 'kubectl get pods -n team-a -o json');
  });

  it('lists each resource once across namespaces matching a regex', async () => {
    const runCommand = vi.fn(async (_cluster: string, command: string) => ({
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
      uuid: 'test-uuid', clusterNames: ['first'], source: source!,
      namespaceExpression: 'openshift-.*', runCommand, getNodeNames: async () => [], cache: new Map(),
    });

    expect(options).toEqual(['pod-a', 'pod-b']);
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand).toHaveBeenCalledWith('first', 'kubectl get pods -A -o json');
  });

  it('marks plural name fields as comma selections without reading description prose', () => {
    expect(getClusterOptionSource('node-scenarios', field('NODE_NAMES'), {})).toMatchObject({
      selectionMode: 'comma',
    });
    expect(getClusterOptionSource('pod-scenarios', field('POD_NAMES'), {})).toMatchObject({
      selectionMode: 'comma',
    });
  });

  it('maps node selectors to nodes without a namespace dependency', () => {
    const source = getClusterOptionSource('node-scenarios', field('LABEL_SELECTOR'), {});
    expect(source).toEqual({ resource: 'nodes', selection: 'label', namespaced: false });
  });

  it('leaves ambiguous selectors editable without unrelated suggestions', () => {
    expect(getClusterOptionSource('service-disruption-scenarios', field('LABEL_SELECTOR'), {})).toBeNull();
    expect(getClusterOptionSource('time-scenarios', field('OBJECT_NAME'), { OBJECT_TYPE: 'deployment' })).toBeNull();
  });
});
