/**
 * File type helpers.
 *
 * The operator stores a file type as a Kubernetes label, normalizing it to
 * lowercase, replacing unsupported characters with dashes, and limiting it to
 * 63 characters. The console applies the same normalization before sending so
 * the value the user sees is the value that gets stored.
 */
const FILE_TYPE_MAX_LENGTH = 63;

/** Normalize a file type the way the operator does before storing it. */
export function normalizeFileType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, FILE_TYPE_MAX_LENGTH)
    .replace(/[^a-z0-9]+$/, '');
}

/** An empty type means "untyped" and is valid; anything else must keep a letter or number. */
export function isValidFileType(value: string): boolean {
  if (!value.trim()) return true;
  return normalizeFileType(value).length > 0;
}
