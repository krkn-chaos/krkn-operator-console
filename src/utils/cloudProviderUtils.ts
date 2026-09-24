import type { CloudCredential, CloudCredentialProvider } from '../types/api';

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
 * CLOUD_TYPE equivalent are omitted when the scenario does not list that value
 * in allowed_values — callers should leave CLOUD_TYPE untouched in that case.
 */
export const PROVIDER_TO_CLOUD_TYPE: Partial<Record<CloudCredentialProvider, string>> = {
  aws: 'aws',
  azure: 'azure',
  gcp: 'gcp',
  openstack: 'openstack',
  vmware: 'vmware',
  ibmcloud: 'ibmcloud',
  baremetal: 'bm',
};

interface EnumLikeField {
  type: string;
  allowed_values?: string;
  separator?: string;
  default?: string | number | boolean | null;
}

export type CloudCredentialAccessFilter = 'all' | 'public' | 'group';
export type CloudCredentialProviderFilter = 'all' | CloudCredentialProvider;

const PROVIDER_LABELS: Record<CloudCredentialProvider, string> = {
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  openstack: 'OpenStack',
  baremetal: 'Baremetal',
  vmware: 'VMware',
  ibmcloud: 'IBM Cloud',
};

function credentialAccessLabel(cred: CloudCredential): string {
  if (cred.availableToAll) {
    return 'All Users';
  }
  if (cred.groups && cred.groups.length > 0) {
    return cred.groups.join(', ');
  }
  return 'No groups';
}

/** Filters and sorts the Settings cloud-credentials list by search/provider/access. */
export function filterCloudCredentials(
  credentials: CloudCredential[],
  options: {
    search: string;
    provider: CloudCredentialProviderFilter;
    access: CloudCredentialAccessFilter;
    sortDirection: 'asc' | 'desc';
  }
): CloudCredential[] {
  const query = options.search.trim().toLowerCase();

  const filtered = credentials.filter((cred) => {
    if (options.provider !== 'all' && cred.provider !== options.provider) {
      return false;
    }

    if (options.access === 'public' && !cred.availableToAll) {
      return false;
    }

    if (options.access === 'group' && (cred.availableToAll || !cred.groups?.length)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      cred.name,
      cred.description ?? '',
      PROVIDER_LABELS[cred.provider] ?? cred.provider,
      credentialAccessLabel(cred),
      ...(cred.groups ?? []),
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    const cmp = a.name.localeCompare(b.name);
    return options.sortDirection === 'asc' ? cmp : -cmp;
  });
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
  openstack: (v) => v.startsWith('OS_'),
  vmware: (v) => v.startsWith('VSPHERE_'),
  ibmcloud: (v) => v === 'IBMC_URL' || v === 'IBMC_APIKEY',
  ibmcloudpower: (v) => v.startsWith('IBMC_'),
  bm: (v) => v.startsWith('BMC_') || v === 'DISKS',
};

/** Labels like "[*IBM Cloud only*]" in krkn-hub scenario field definitions. */
const CLOUD_TYPE_DESCRIPTION_TAGS: Record<string, readonly string[]> = {
  aws: ['AWS only'],
  azure: ['Azure only'],
  gcp: ['GCP only'],
  openstack: ['OpenStack only'],
  vmware: ['VSphere only'],
  ibmcloud: ['IBM Cloud only'],
  ibmcloudpower: ['IBM Power Cloud only', 'IBM Cloud only'],
  bm: ['Bare Metal only'],
};

const PROVIDER_TAG_RE = /\[\*([^*]+)\*\]/gi;

function getFieldProviderTags(shortDescription: string | undefined): string[] {
  if (!shortDescription) return [];
  const tags: string[] = [];
  for (const match of shortDescription.matchAll(PROVIDER_TAG_RE)) {
    tags.push(match[1].trim());
  }
  return tags;
}

function descriptionMatchesCloudType(shortDescription: string | undefined, cloudType: string): boolean | undefined {
  const tags = getFieldProviderTags(shortDescription);
  if (tags.length === 0) return undefined;

  const allowedTags = CLOUD_TYPE_DESCRIPTION_TAGS[cloudType];
  if (!allowedTags) return false;

  const normalizedAllowed = allowedTags.map((t) => t.toLowerCase());
  return tags.some((tag) => normalizedAllowed.includes(tag.toLowerCase()));
}

/**
 * Returns true when a scenario field belongs to the active CLOUD_TYPE provider.
 * Non-cloud fields (no env-var prefix and no "[*Provider only*]" tag) always match.
 */
export function fieldMatchesCloudType(
  field: { variable: string; short_description?: string },
  cloudType: string
): boolean {
  if (field.variable === 'CLOUD_TYPE') {
    return true;
  }

  const tagMatch = descriptionMatchesCloudType(field.short_description, cloudType);
  if (tagMatch !== undefined) {
    return tagMatch;
  }

  if (isCloudProviderSpecificField(field.variable)) {
    const matcher = CLOUD_TYPE_FIELD_MATCHERS[cloudType];
    return matcher ? matcher(field.variable) : false;
  }

  return true;
}

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
export function filterFieldsByCloudType<T extends { variable: string; short_description?: string }>(
  fields: T[],
  cloudType: string | undefined,
  options: { hideCloudTypeWhenCredentialApplied?: boolean; appliedCloudCredName?: string } = {}
): T[] {
  if (!cloudType) return fields;

  // Fail-safe: unrecognized cloud types must not hide fields we cannot place.
  const knownCloudType =
    cloudType in CLOUD_TYPE_FIELD_MATCHERS || cloudType in CLOUD_TYPE_DESCRIPTION_TAGS;
  if (!knownCloudType) {
    return fields;
  }

  return fields.filter((f) => {
    if (options.hideCloudTypeWhenCredentialApplied && options.appliedCloudCredName && f.variable === 'CLOUD_TYPE') {
      return false;
    }
    return fieldMatchesCloudType(f, cloudType);
  });
}

/**
 * Resolves which CLOUD_TYPE drives optional-parameter filtering.
 * Saved credentials take precedence; otherwise use the form value or the
 * scenario field default (e.g. node-scenarios defaults to "aws").
 */
export function resolveEffectiveCloudType(
  cloudTypeField: EnumLikeField | undefined,
  options: {
    credentialCloudType?: string;
    formCloudType?: string | number | boolean | null;
  } = {}
): string | undefined {
  if (options.credentialCloudType) {
    return options.credentialCloudType;
  }

  const rawFormValue = options.formCloudType;
  if (rawFormValue !== undefined && rawFormValue !== null && rawFormValue !== '') {
    const asString = String(rawFormValue);
    if (cloudTypeField && !isValidEnumValue(cloudTypeField, asString)) {
      return undefined;
    }
    return asString;
  }

  const defaultValue = cloudTypeField?.default;
  if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
    const asString = String(defaultValue);
    if (cloudTypeField && !isValidEnumValue(cloudTypeField, asString)) {
      return undefined;
    }
    return asString;
  }

  return undefined;
}

/** Like filterFieldsByCloudType but preserves group headers that still have visible members. */
export function filterScenarioFieldsByCloudType<T extends { variable: string; type: string; group?: string; short_description?: string }>(
  fields: T[],
  cloudType: string | undefined,
  options: { hideCloudTypeWhenCredentialApplied?: boolean; appliedCloudCredName?: string } = {}
): T[] {
  const visibleValueFields = filterFieldsByCloudType(
    fields.filter((f) => f.type !== 'group'),
    cloudType,
    options
  );
  const visibleVars = new Set(visibleValueFields.map((f) => f.variable));

  return fields.filter((f) => {
    if (f.type === 'group') {
      return fields.some((member) => member.group === f.variable && visibleVars.has(member.variable));
    }
    return visibleVars.has(f.variable);
  });
}
