import { describe, expect, it } from 'vitest';
import { buildRerunIntent } from './rerunIntent';
import type { JobConfigResponse, ScenarioRunState } from '../types/api';

describe('buildRerunIntent', () => {
  const config: JobConfigResponse = {
    targetRequestId: 'target', targetClusters: { provider: ['cluster'] },
    scenario: { name: 'pod-scenarios', private: false },
    kubeconfigPath: '/home/krkn/.kube/config',
  };
  const run = { scenarioName: 'pod-scenarios' } as ScenarioRunState;

  it('retains the pinned workspace and PVC identities for replay', () => {
    const workspace = { name: 'shared', workspaceUid: 'workspace-uid', claimUid: 'pvc-uid' };
    const intent = buildRerunIntent({ ...config, workspace, rollbackEnabled: true }, run);

    expect(intent.workspace).toEqual(workspace);
    expect(intent.rollbackEnabled).toBe(true);
  });

  it.each([
    ['the saved variables', { NAMESPACE: 'default' }, { NAMESPACE: 'default' }],
    ['an empty map when the saved config has none', undefined, {}],
  ])('carries %s as the environment', (_case, environment, expected) => {
    expect(buildRerunIntent({ ...config, environment }, run).environment).toEqual(expected);
  });
});
