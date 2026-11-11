export interface ElasticsearchFieldFilter {
  key: string;
  value: string;
}

export function collectFieldPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectFieldPaths(item, `${prefix}[${index}]`));
  }
  if (value === null || typeof value !== 'object') return prefix ? [prefix] : [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...collectFieldPaths(child, path)];
  });
}

export function getFieldValue(value: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = value;
  for (let index = 0; index < parts.length; index += 1) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    const record = current as Record<string, unknown>;
    const remainingPath = parts.slice(index).join('.');
    if (Object.prototype.hasOwnProperty.call(record, remainingPath)) return record[remainingPath];
    current = record[parts[index]];
  }
  return current;
}

export function matchesFieldFilters(value: unknown, filters: ElasticsearchFieldFilter[]): boolean {
  return filters.filter(filter => filter.key).every(filter => {
    const fieldValue = getFieldValue(value, filter.key);
    if (fieldValue === undefined) return false;
    const needle = filter.value.trim().toLowerCase();
    return needle === '' || JSON.stringify(fieldValue).toLowerCase().includes(needle);
  });
}
