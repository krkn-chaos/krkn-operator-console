/**
 * scenarioCategory - Maps a chaos scenario name to a display category so the
 * scenarios list can show a scope/type label (e.g. "Pod & Container", "Network")
 * without the user reading the full description.
 *
 * The taxonomy mirrors the official krkn docs, which group every scenario into
 * six `data-category` sections (krkn-website: content/en/docs/scenarios/_index.md):
 *   pod-container | node-cluster | network | application-service | storage-data | system-time
 *
 * Scenario names come from the krkn-hub registry (image tags = repo folder names).
 * We match known names exactly, then fall back to keyword rules so new/custom
 * scenarios still get a sensible label instead of nothing.
 */

import type { LabelProps } from '@patternfly/react-core';

export type ScenarioCategoryKey =
  | 'pod-container'
  | 'node-cluster'
  | 'network'
  | 'application-service'
  | 'storage-data'
  | 'system-time'
  | 'other';

export interface ScenarioCategory {
  key: ScenarioCategoryKey;
  label: string;
  color: NonNullable<LabelProps['color']>;
}

const CATEGORIES: Record<ScenarioCategoryKey, ScenarioCategory> = {
  'pod-container': { key: 'pod-container', label: 'Pod & Container', color: 'blue' },
  'node-cluster': { key: 'node-cluster', label: 'Node & Cluster', color: 'purple' },
  network: { key: 'network', label: 'Network', color: 'cyan' },
  'application-service': { key: 'application-service', label: 'Application', color: 'green' },
  'storage-data': { key: 'storage-data', label: 'Storage', color: 'orange' },
  'system-time': { key: 'system-time', label: 'Time', color: 'gold' },
  other: { key: 'other', label: 'Other', color: 'grey' },
};

// Display order for filters/legends (mirrors the docs section order; "other" last).
export const ALL_CATEGORIES: ScenarioCategory[] = [
  CATEGORIES['pod-container'],
  CATEGORIES['node-cluster'],
  CATEGORIES.network,
  CATEGORIES['application-service'],
  CATEGORIES['storage-data'],
  CATEGORIES['system-time'],
  CATEGORIES.other,
];

// Exact krkn-hub scenario name → category (authoritative; matches the docs grouping).
const EXACT: Record<string, ScenarioCategoryKey> = {
  'pod-scenarios': 'pod-container',
  'container-scenarios': 'pod-container',
  'kubevirt-outage': 'pod-container',
  'node-scenarios': 'node-cluster',
  'node-scenarios-bm': 'node-cluster',
  'node-cpu-hog': 'node-cluster',
  'node-io-hog': 'node-cluster',
  'node-memory-hog': 'node-cluster',
  'node-interface-down': 'node-cluster',
  'power-outages': 'node-cluster',
  'zone-outages': 'node-cluster',
  'network-chaos': 'network',
  'pod-network-chaos': 'network',
  'pod-network-filter': 'network',
  'node-network-filter': 'network',
  'application-outages': 'application-service',
  'service-disruption-scenarios': 'application-service',
  'service-hijacking': 'application-service',
  'syn-flood': 'application-service',
  'http-load': 'application-service',
  'pvc-scenario': 'storage-data',
  'time-scenarios': 'system-time',
};

// Ordered keyword fallback for names not in EXACT. Order matters: `network` is
// checked before `node`/`pod` so "pod-network-*"/"node-network-*" read as Network,
// matching how the docs place them.
const KEYWORD_RULES: Array<[RegExp, ScenarioCategoryKey]> = [
  [/network|dns|packet|interface/, 'network'],
  [/hog|node|zone|power|cluster|baremetal|etcd/, 'node-cluster'],
  [/pod|container|kubevirt|\bvm\b/, 'pod-container'],
  [/application|service|http|syn|load|hijack/, 'application-service'],
  [/pvc|storage|volume|throttle|data/, 'storage-data'],
  [/time|clock|ntp|skew/, 'system-time'],
];

/**
 * Resolve the category for a scenario name. Never throws; unknown names get the
 * "Other" category.
 */
export function getScenarioCategory(scenarioName: string): ScenarioCategory {
  const name = (scenarioName || '').toLowerCase().trim();

  const exact = EXACT[name];
  if (exact) return CATEGORIES[exact];

  for (const [pattern, key] of KEYWORD_RULES) {
    if (pattern.test(name)) return CATEGORIES[key];
  }

  return CATEGORIES.other;
}
