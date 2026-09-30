import { describe, expect, it } from 'vitest';
import { getStudioRecoveryState } from './studioRecovery';

const workflow = { nodes: [], edges: [], nextNodeNumber: 1 };

describe('getStudioRecoveryState', () => {
  it('restores categories together with the autosaved workflow', () => {
    expect(getStudioRecoveryState({
      workflow,
      categories: ['network', 'reliability'],
    })).toEqual({ workflow, categories: ['network', 'reliability'] });
  });

  it('defaults legacy autosaves without categories to an empty selection', () => {
    expect(getStudioRecoveryState({ workflow })).toEqual({
      workflow,
      categories: [],
    });
  });
});
