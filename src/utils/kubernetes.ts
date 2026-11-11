/**
 * Kubernetes label values are limited to 63 characters and may contain
 * alphanumeric characters, '-', '_' and '.', with alphanumeric edges.
 */
export function isValidKubernetesLabelValue(value: string): boolean {
  return value.length <= 63 && /^[A-Za-z0-9](?:[-A-Za-z0-9_.]*[A-Za-z0-9])?$/.test(value);
}
