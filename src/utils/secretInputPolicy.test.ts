import { describe, expect, it } from 'vitest';
import { secretInvalidationWarning, willClearScenarioSecrets } from './secretInputPolicy';

describe('secret input invalidation', () => {
  const saved = { URL: 'https://service.example', TOKEN_A: 'stored', TOKEN_B: 'stored' };
  const secretFields = { TOKEN_A: true, TOKEN_B: true };

  it('keeps sibling secrets when only one secret changes', () => {
    expect(willClearScenarioSecrets(saved, { URL: saved.URL, TOKEN_A: 'new' }, secretFields)).toBe(false);
  });

  it('clears only the edited scenario or node when cleartext changes', () => {
    expect(willClearScenarioSecrets(saved, { URL: 'https://other.example' }, secretFields)).toBe(true);
  });

  it('does not warn when no saved secret exists', () => {
    expect(willClearScenarioSecrets({ URL: 'old' }, { URL: 'new' }, { TOKEN_A: false })).toBe(false);
  });

  it('warns when another executable setting changes', () => {
    expect(willClearScenarioSecrets(saved, { URL: saved.URL }, secretFields, true)).toBe(true);
  });

  it('names only the affected node in the workflow message', () => {
    expect(secretInvalidationWarning('node').title).toContain('Other nodes are unaffected');
    expect(secretInvalidationWarning('scenario').title).not.toContain('Other nodes');
  });
});
