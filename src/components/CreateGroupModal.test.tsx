import { describe, expect, it } from 'vitest';
import {
  checkDuplicateClusters,
  checkRunOrCancelWithoutView,
} from './createGroupValidation';
import type { ClusterPermissions, TargetResponse } from '../types/api';

describe('CreateGroupModal permission validation', () => {
  it('ignores malformed permissions while detecting run and cancel warnings', () => {
    const permissions = {
      malformed: {},
      runnable: { actions: ['run'] },
      cancellable: { actions: ['cancel'] },
      valid: { actions: ['view', 'run', 'cancel'] },
    } as ClusterPermissions;

    expect(checkRunOrCancelWithoutView(permissions)).toEqual({
      hasIssue: true,
      missingPermissions: ['Run', 'Cancel'],
    });
  });

  it('ignores malformed permissions while detecting duplicate selected clusters', () => {
    const duplicateUrl = 'https://api.example.com';
    const targets: TargetResponse[] = [
      {
        uuid: 'target-1',
        clusterName: 'cluster-a',
        clusterAPIURL: duplicateUrl,
        secretType: 'token',
        ready: true,
        operatorSource: 'operator-a',
      },
      {
        uuid: 'target-2',
        clusterName: 'cluster-b',
        clusterAPIURL: duplicateUrl,
        secretType: 'token',
        ready: true,
        operatorSource: 'operator-b',
      },
    ];
    const permissions = {
      malformed: {},
      [duplicateUrl]: { actions: ['view'] },
    } as ClusterPermissions;

    expect(checkDuplicateClusters(permissions, targets)).toEqual({
      hasDuplicates: true,
      duplicates: [`${duplicateUrl}: cluster-a (operator-a), cluster-b (operator-b)`],
    });
  });
});
