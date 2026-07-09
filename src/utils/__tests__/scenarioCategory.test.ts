import { describe, it, expect } from 'vitest';
import { getScenarioCategory } from '../scenarioCategory';

describe('getScenarioCategory', () => {
  it('maps known krkn-hub scenarios to the docs taxonomy', () => {
    const cases: Array<[string, string]> = [
      ['pod-scenarios', 'Pod & Container'],
      ['container-scenarios', 'Pod & Container'],
      ['kubevirt-outage', 'Pod & Container'],
      ['node-scenarios', 'Node & Cluster'],
      ['node-cpu-hog', 'Node & Cluster'],
      ['zone-outages', 'Node & Cluster'],
      ['power-outages', 'Node & Cluster'],
      ['network-chaos', 'Network'],
      ['pod-network-chaos', 'Network'], // pod-network is Network per the docs, not Pod
      ['application-outages', 'Application'],
      ['syn-flood', 'Application'],
      ['pvc-scenario', 'Storage'],
      ['time-scenarios', 'Time'],
    ];
    for (const [name, label] of cases) {
      expect(getScenarioCategory(name).label, name).toBe(label);
    }
  });

  it('is case-insensitive and tolerant of a registry prefix', () => {
    expect(getScenarioCategory('POD-SCENARIOS').label).toBe('Pod & Container');
  });

  it('falls back on keywords for unknown names, network before pod/node', () => {
    expect(getScenarioCategory('custom-node-network-thing').label).toBe('Network');
    expect(getScenarioCategory('some-new-node-hog').label).toBe('Node & Cluster');
    expect(getScenarioCategory('brand-new-pod-thing').label).toBe('Pod & Container');
  });

  it('returns Other for anything unrecognized', () => {
    expect(getScenarioCategory('totally-unknown-xyz').label).toBe('Other');
    expect(getScenarioCategory('').label).toBe('Other');
  });
});
