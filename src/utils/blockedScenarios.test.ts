import { describe, it, expect } from 'vitest';
import { isScenarioBlocked } from './blockedScenarios';

describe('isScenarioBlocked', () => {
  it.each([
    ['node-scenarios prefix blocks node-scenarios-bm', 'node-scenarios-bm', true],
    ['node-scenarios prefix blocks node-scenarios', 'node-scenarios', true],
    ['exact match blocks zone-outages', 'zone-outages', true],
    ['exact match blocks power-outages', 'power-outages', true],
    ['node- alone is now allowed', 'node-cpu-hog', false],
    ['node-drain is now allowed', 'node-drain', false],
    ["bare 'node' is not blocked", 'node', false],
    ['pod-disruption is allowed', 'pod-disruption', false],
    ['network-chaos is allowed', 'network-chaos', false],
    ['container-kill is allowed', 'container-kill', false],
  ])('%s', (_label, scenario, expected) => {
    expect(isScenarioBlocked(scenario)).toBe(expected);
  });
});
