import type { CloudCredentialProvider } from '../types/api';

export const CLOUD_ENV_VAR_PREFIXES = ['AWS_', 'AZURE_', 'OS_', 'GOOGLE_', 'BMC_', 'VSPHERE_', 'IBMC_'] as const;

export const CLOUD_DISABLED_FIELDS = [
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION',
  'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_SUBSCRIPTION_ID',
  'OS_AUTH_URL', 'OS_USERNAME', 'OS_PASSWORD', 'OS_PROJECT_NAME', 'OS_DOMAIN_NAME',
  'BMC_USER', 'BMC_PASSWORD', 'BMC_ADDR',
  'VSPHERE_IP', 'VSPHERE_USERNAME', 'VSPHERE_PASSWORD',
  'IBMC_URL', 'IBMC_APIKEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'CLOUD_TYPE',
] as const;

export function isCloudEnvVar(key: string): boolean {
  return key === 'CLOUD_TYPE' || CLOUD_ENV_VAR_PREFIXES.some(p => key.startsWith(p));
}

export function hasCloudFields(fields: Array<{ variable?: string | null }>): boolean {
  return fields.some(
    (f) => f.variable != null && (
      f.variable === 'CLOUD_TYPE' ||
      CLOUD_ENV_VAR_PREFIXES.some(p => f.variable!.startsWith(p))
    )
  );
}

/**
 * Returns the list of cloud field variable names to disable when a saved
 * cloud credential is applied, or an empty array when none is applied.
 *
 * Centralizes the "is a credential currently applied" check so callers that
 * render cloud fields in different sections (required, optional, global)
 * stay consistent.
 */
export function getCloudDisabledFields(appliedCloudCredName: string): string[] {
  return appliedCloudCredName ? [...CLOUD_DISABLED_FIELDS] : [];
}

/**
 * Maps a saved cloud credential's provider to the value a scenario's
 * CLOUD_TYPE enum field expects (krkn-hub convention). Providers with no
 * CLOUD_TYPE equivalent (e.g. openstack, which these scenarios don't support)
 * are omitted — callers should leave CLOUD_TYPE untouched in that case.
 */
export const PROVIDER_TO_CLOUD_TYPE: Partial<Record<CloudCredentialProvider, string>> = {
  aws: 'aws',
  azure: 'azure',
  gcp: 'gcp',
  vmware: 'vmware',
  ibmcloud: 'ibmcloud',
  baremetal: 'bm',
};

interface EnumLikeField {
  type: string;
  allowed_values?: string;
  separator?: string;
}

function isValidEnumValue(field: EnumLikeField, value: string): boolean {
  if (field.type !== 'enum') return true;
  if (!field.allowed_values || !field.separator) return true;
  return field.allowed_values.split(field.separator).map((v) => v.trim()).includes(value);
}

/**
 * Resolves the CLOUD_TYPE value to set when a saved cloud credential is applied,
 * given the scenario's own CLOUD_TYPE field definition (so we never force a value
 * the scenario doesn't actually support). Returns undefined when the credential's
 * provider has no CLOUD_TYPE equivalent, the scenario has no CLOUD_TYPE field, or
 * the mapped value isn't in that field's allowed_values.
 */
export function resolveCloudTypeForProvider<T extends EnumLikeField>(
  provider: CloudCredentialProvider,
  cloudTypeField: T | undefined
): string | undefined {
  const target = PROVIDER_TO_CLOUD_TYPE[provider];
  if (!target || !cloudTypeField) return undefined;
  return isValidEnumValue(cloudTypeField, target) ? target : undefined;
}

/** Matches a field variable name to the provider-specific fields for a given CLOUD_TYPE value. */
const CLOUD_TYPE_FIELD_MATCHERS: Record<string, (variable: string) => boolean> = {
  aws: (v) => v.startsWith('AWS_'),
  azure: (v) => v.startsWith('AZURE_'),
  gcp: (v) => v.startsWith('GOOGLE_'),
  vmware: (v) => v.startsWith('VSPHERE_'),
  ibmcloud: (v) => v.startsWith('IBMC_'),
  ibmcloudpower: (v) => v.startsWith('IBMC_'),
  bm: (v) => v.startsWith('BMC_') || v === 'DISKS',
};

function isCloudProviderSpecificField(variable: string): boolean {
  return variable !== 'CLOUD_TYPE' && (isCloudEnvVar(variable) || variable === 'DISKS');
}

/**
 * Filters out cloud-provider fields that don't match the currently active
 * CLOUD_TYPE so a scenario doesn't show all 7 providers' credential fields
 * at once. Non-provider-specific fields (and CLOUD_TYPE itself) always pass
 * through. When cloudType is unset or unrecognized, every field passes
 * through unchanged (fail-safe — never hides fields we can't confidently place).
 */
export function filterFieldsByCloudType<T extends { variable: string }>(
  fields: T[],
  cloudType: string | undefined
): T[] {
  const matcher = cloudType ? CLOUD_TYPE_FIELD_MATCHERS[cloudType] : undefined;
  if (!matcher) return fields;
  return fields.filter((f) => !isCloudProviderSpecificField(f.variable) || matcher(f.variable));
}
