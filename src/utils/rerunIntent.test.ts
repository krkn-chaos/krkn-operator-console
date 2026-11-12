import { describe, expect, it } from 'vitest';
import { buildRerunIntent } from './rerunIntent';
import type { JobConfigResponse, ScenarioRunState } from '../types/api';

describe('buildRerunIntent', () => {
  it('retains the pinned workspace and PVC identities for replay', () => {
    const workspace = { name: 'shared', workspaceUid: 'workspace-uid', claimUid: 'pvc-uid' };
    const config: JobConfigResponse = {
      targetRequestId: 'target', targetClusters: { provider: ['cluster'] },
      scenario: { name: 'pod-scenarios', private: false },
      kubeconfigPath: '/home/krkn/.kube/config', environment: {}, workspace, rollbackEnabled: true,
    };
    const run = { scenarioName: 'pod-scenarios' } as ScenarioRunState;

    expect(buildRerunIntent(config, run).workspace).toEqual(workspace);
    expect(buildRerunIntent(config, run).rollbackEnabled).toBe(true);
  });
});
