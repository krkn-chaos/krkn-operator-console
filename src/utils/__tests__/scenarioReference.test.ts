import { describe, expect, it } from 'vitest';
import { createScenarioReference, validateScenarioReference } from '../scenarioReference';

describe('scenario references', () => {
  it('creates a public reference without a registry', () => {
    expect(createScenarioReference(' pod-delete ', false)).toEqual({
      name: 'pod-delete',
      private: false,
    });
  });

  it('creates a private reference with an opaque registry name', () => {
    expect(createScenarioReference('pod-delete', true, 'team-registry')).toEqual({
      name: 'pod-delete',
      private: true,
      registryName: 'team-registry',
    });
  });

  it.each([
    ['', false, undefined, 'Scenario name is required'],
    ['pod-delete', true, undefined, 'A private scenario requires an accessible registry'],
    ['pod-delete', false, 'team-registry', 'Public scenarios cannot specify a registry'],
  ])('rejects invalid references', (name, isPrivate, registryName, message) => {
    expect(() => createScenarioReference(name, isPrivate, registryName)).toThrow(message);
  });

  it('reports validation errors without throwing', () => {
    expect(validateScenarioReference({ name: 'pod-delete', private: true })).toBe(
      'A private scenario requires an accessible registry',
    );
  });
});
