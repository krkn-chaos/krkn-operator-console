import type { ScenarioField } from '../types/api';
import { isCloudEnvVar } from './cloudProviderUtils';

const SECRET_VARIABLE_RE = /password|secret|apikey|access_key/i;

/** Mask shown for secret values and server-injected credential fields. */
export const MASKED_VALUE_DISPLAY = '••••••••';

/**
 * Returns true when a field's value must be masked in both form inputs and
 * configuration previews.  Checks the schema-provided `secret` flag first;
 * falls back to matching common secret variable-name patterns so that fields
 * authored without `secret: true` (e.g. ES_PASSWORD) are still protected.
 */
export function isSecretField(field: Pick<ScenarioField, 'secret' | 'variable'>): boolean {
  return !!field.secret || SECRET_VARIABLE_RE.test(field.variable);
}

export interface ServerInjectedFieldContext {
  appliedCloudCredName?: string;
  appliedEsConfigName?: string;
}

/** True when the operator injects this field from a saved credential/config. */
export function isServerInjectedField(
  fieldVariable: string,
  ctx: ServerInjectedFieldContext
): boolean {
  if (ctx.appliedCloudCredName && isCloudEnvVar(fieldVariable)) {
    return true;
  }
  if (ctx.appliedEsConfigName && fieldVariable === 'ES_PASSWORD') {
    return true;
  }
  return false;
}

/**
 * Resolves the value shown in configuration preview tables. Server-injected
 * fields with no client-side value display as masked instead of "(empty)".
 */
export function getFieldPreviewDisplayValue(
  field: Pick<ScenarioField, 'secret' | 'variable' | 'default' | 'type'>,
  value: unknown,
  ctx: ServerInjectedFieldContext = {}
): string {
  const isEmpty = value === undefined || value === null || value === '';

  if (isEmpty && isServerInjectedField(field.variable, ctx)) {
    return MASKED_VALUE_DISPLAY;
  }

  if (isEmpty) {
    return field.default?.toString() || '(empty)';
  }

  if (isSecretField(field)) {
    return MASKED_VALUE_DISPLAY;
  }

  if (field.type === 'file' || field.type === 'file_base64') {
    return (value as File)?.name || String(value);
  }

  return String(value);
}

/** Placeholder for disabled inputs whose values are injected server-side. */
export function getInjectedFieldPlaceholder(
  fieldVariable: string,
  isFieldDisabled: boolean,
  externallyDisabledFields: readonly string[]
): string | undefined {
  if (isFieldDisabled && externallyDisabledFields.includes(fieldVariable)) {
    return MASKED_VALUE_DISPLAY;
  }
  return undefined;
}
