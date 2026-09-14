import { describe, it, expect } from 'vitest';
import { isScenarioBlocked } from './blockedScenarios';

describe('isScenarioBlocked', () => {
  // Cloud credential support (krkn-operator-console#91 / krkn-operator#71) unblocked
  // node-scenarios*, zone-outages, and power-outages — nothing is blocked by default now.
  it.each([
    ['node-scenarios-bm is allowed', 'node-scenarios-bm', false],
    ['node-scenarios is allowed', 'node-scenarios', false],
    ['zone-outages is allowed', 'zone-outages', false],
    ['power-outages is allowed', 'power-outages', false],
    ['node-cpu-hog is allowed', 'node-cpu-hog', false],
    ['node-drain is allowed', 'node-drain', false],
    ["bare 'node' is not blocked", 'node', false],
    ['pod-disruption is allowed', 'pod-disruption', false],
    ['network-chaos is allowed', 'network-chaos', false],
    ['container-kill is allowed', 'container-kill', false],
  ])('%s', (_label, scenario, expected) => {
    expect(isScenarioBlocked(scenario)).toBe(expected);
  });
});
