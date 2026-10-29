import { describe, expect, it } from 'vitest';
import { sortByLabel } from './sortByLabel';

describe('sortByLabel', () => {
  it('sorts case-insensitively with natural numeric ordering without mutating input', () => {
    const labels = ['item10', 'BETA', 'alpha', 'Item2'];

    expect(sortByLabel(labels, (label) => label)).toEqual(['alpha', 'BETA', 'Item2', 'item10']);
    expect(labels).toEqual(['item10', 'BETA', 'alpha', 'Item2']);
  });
});
