/** Whether a persisted secret input has a value; values are never sent to the UI. */
export type SecretFieldState = Record<string, boolean>;

/**
 * A cleartext execution change invalidates every existing secret for this one
 * scenario or workflow node. Secret-only edits leave sibling secrets intact.
 */
export function willClearScenarioSecrets(
  previous: Record<string, string>,
  next: Record<string, string>,
  secretFields: SecretFieldState,
  otherExecutionFieldsChanged = false,
): boolean {
  if (!Object.values(secretFields).some(Boolean)) return false;
  if (otherExecutionFieldsChanged) return true;

  const cleartextKeys = new Set([
    ...Object.keys(previous),
    ...Object.keys(next),
  ].filter(key => !(key in secretFields)));
  return [...cleartextKeys].some(key => (previous[key] ?? '') !== (next[key] ?? ''));
}

export function secretInvalidationWarning(subject: 'node' | 'scenario'): { title: string; explanation: string } {
  return {
    title: subject === 'node'
      ? 'Changing this setting will clear the saved secrets for this node. Other nodes are unaffected. Continue?'
      : 'Changing this setting will clear the saved secrets for this scenario. Continue?',
    explanation: 'This prevents the updated configuration from reusing credentials with unintended settings.',
  };
}
