const optionLabelCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/** Returns a copy of items sorted by their display label. */
export function sortByLabel<T>(items: readonly T[], getLabel: (item: T) => string): T[] {
  return [...items].sort((left, right) => optionLabelCollator.compare(getLabel(left), getLabel(right)));
}
