import type { ScenarioField } from '../types/api';

const SECRET_VARIABLE_RE = /password|secret/i;

/**
 * Returns true when a field's value must be masked in both form inputs and
 * configuration previews.  Checks the schema-provided `secret` flag first;
 * falls back to matching common secret variable-name patterns so that fields
 * authored without `secret: true` (e.g. ES_PASSWORD) are still protected.
 */
export function isSecretField(field: Pick<ScenarioField, 'secret' | 'variable'>): boolean {
  return !!field.secret || SECRET_VARIABLE_RE.test(field.variable);
}
