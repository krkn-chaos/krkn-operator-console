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
