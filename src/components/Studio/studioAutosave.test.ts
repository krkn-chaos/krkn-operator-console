import { beforeEach, describe, expect, it } from 'vitest';
import { clearAutosave, loadAutosave, saveAutosave } from './studioAutosave';
import type { StudioAutosave } from '../../types/api';

const workflow = { nodes: [], edges: [], nextNodeNumber: 1 };

describe('studioAutosave', () => {
  beforeEach(() => clearAutosave());

  it('persists category selection independently from the workflow graph', () => {
    const autosave: StudioAutosave = {
      workflow,
      categories: ['network', 'reliability'],
      timestamp: 123,
      version: '1.0',
    };

    saveAutosave(autosave);

    expect(loadAutosave()).toEqual(autosave);
    expect(loadAutosave()?.workflow).toEqual(workflow);
    expect(loadAutosave()?.categories).toEqual(['network', 'reliability']);
  });

  it('continues to load legacy autosaves without categories as an empty selection', () => {
    localStorage.setItem('chaos-studio-autosave', JSON.stringify({
      workflow,
      timestamp: 456,
      version: '1.0',
    }));

    const autosave = loadAutosave();

    expect(autosave?.workflow).toEqual(workflow);
    expect(autosave?.categories).toBeUndefined();
  });
});
