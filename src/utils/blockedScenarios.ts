const BLOCKED_PREFIXES = ['node-scenarios'];
const BLOCKED_EXACT = new Set(['zone-outages', 'power-outages']);

export function isScenarioBlocked(name: string): boolean {
  if (BLOCKED_EXACT.has(name)) return true;
  return BLOCKED_PREFIXES.some((prefix) => name.startsWith(prefix));
}
