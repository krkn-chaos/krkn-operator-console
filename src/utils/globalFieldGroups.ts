import type { ScenarioField, FieldGroup } from '../types/api';

export interface GlobalFieldSection {
  key: string;
  title: string;
  fields: ScenarioField[];
}

/**
 * Groups global scenario fields into display sections using the groups returned
 * by the API. Each group's field list (variable names) is mapped back to full
 * ScenarioField objects. Fields not referenced by any group are collected into
 * a fallback "General" section at the top.
 */
export function groupGlobalFields(fields: ScenarioField[], groups: FieldGroup[]): GlobalFieldSection[] {
  if (groups.length === 0) {
    return fields.length > 0 ? [{ key: 'general', title: 'General', fields }] : [];
  }

  const fieldMap = new Map(fields.map(f => [f.variable, f]));
  const assigned = new Set<string>();

  const sections = groups
    .map(group => {
      const groupFields = group.fields
        .map(v => fieldMap.get(v))
        .filter((f): f is ScenarioField => f !== undefined);
      groupFields.forEach(f => assigned.add(f.variable));
      return { key: group.key, title: group.title, fields: groupFields };
    })
    .filter(s => s.fields.length > 0);

  const ungrouped = fields.filter(f => !assigned.has(f.variable));
  if (ungrouped.length > 0) {
    sections.push({ key: 'general', title: 'General', fields: ungrouped });
  }

  return sections.sort((a, b) =>
    a.key === 'general' ? -1 : b.key === 'general' ? 1 : 0
  );
}
