export interface DiscoveryOptions {
  namespacePattern: string;
  podLabelPattern: string;
  nodeLabelPattern: string;
}

export type DiscoveryOptionErrors = Partial<Record<keyof DiscoveryOptions, string>>;

export const defaultDiscoveryOptions: DiscoveryOptions = {
  namespacePattern: '.*',
  podLabelPattern: '.*',
  nodeLabelPattern: '.*',
};

function validatePattern(pattern: string): string | undefined {
  const parts = pattern.trim().split(',').map((part) => part.trim()).filter(Boolean);
  try {
    for (const part of parts) {
      const source = part.startsWith('!') ? part.slice(1) : part;
      if (source && source !== '*') new RegExp(`^(?:${source})$`);
    }
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid regular expression.';
  }
  return undefined;
}

export function validateDiscoveryOptions(options: DiscoveryOptions): DiscoveryOptionErrors {
  const errors: DiscoveryOptionErrors = {};
  for (const [field, label] of [
    ['namespacePattern', 'Namespace'],
    ['podLabelPattern', 'Pod label-key'],
    ['nodeLabelPattern', 'Node label-key'],
  ] as const) {
    const error = validatePattern(options[field]);
    if (error) errors[field] = `${label} pattern is invalid: ${error}`;
  }
  return errors;
}
