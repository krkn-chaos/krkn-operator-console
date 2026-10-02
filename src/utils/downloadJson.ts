/**
 * Trigger a browser download of a value serialized as pretty-printed JSON.
 *
 * Creates an object URL from a Blob, clicks a temporary anchor, then revokes the
 * URL. Shared by Chaos Studio export and the Job-page graph-run export so the
 * download behavior stays consistent in one place.
 *
 * @param data - Any JSON-serializable value.
 * @param filename - Suggested download filename (e.g. `chaos-workflow-123.json`).
 *
 * @example
 * ```ts
 * downloadJson({ graph, studioLayout }, `chaos-workflow-${Date.now()}.json`);
 * ```
 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
