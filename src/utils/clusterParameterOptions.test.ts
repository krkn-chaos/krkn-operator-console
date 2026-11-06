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
        stdout: JSON.stringify({ items: names.map((name) => ({ metadata: { name } })) }),
        stderr: '', exitCode: 0,
      };
    });
    const source = getClusterOptionSource('pod-scenarios', field('POD_NAME'), {});
    expect(source).not.toBeNull();
    const options = await discoverClusterOptions({
      uuid: 'test-uuid', clusterNames: ['first', 'second'], source: source!,
      namespaceExpression: '.*', runCommand, cache: new Map(),
    });
    expect(options).toEqual(['pod-shared']);
    expect(runCommand).toHaveBeenCalledWith('first', 'kubectl get pods -n shared -o json');
    expect(runCommand).not.toHaveBeenCalledWith('first', 'kubectl get pods -n default -o json');
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
