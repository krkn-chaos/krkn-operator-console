// These scenarios were blocked pending cloud provider credential support (krkn-operator#43).
// That support shipped in krkn-operator-console#91 / krkn-operator#71 — the "Load Cloud
// Credential" selector now detects and injects credentials for node/zone/power outage
// scenarios, so nothing needs to be blocked here anymore. Kept as an empty allowlist-style
// helper so a future scenario can be gated the same way without re-plumbing call sites.
const BLOCKED_PREFIXES: string[] = [];
const BLOCKED_EXACT = new Set<string>([]);

export function isScenarioBlocked(name: string): boolean {
  if (BLOCKED_EXACT.has(name)) return true;
  return BLOCKED_PREFIXES.some((prefix) => name.startsWith(prefix));
}
