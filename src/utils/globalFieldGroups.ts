import type { ScenarioField } from '../types/api';

export interface GlobalFieldSection {
  key: string;
  title: string;
  fields: ScenarioField[];
}

const SECTIONS = [
  {
    key: 'prometheus',
    title: 'Prometheus',
    prefixes: [
      'PROMETHEUS_',
      'CAPTURE_METRICS',
      'ENABLE_ALERTS',
      'CHECK_CRITICAL_ALERTS',
      'ALERTS_PATH',
      'METRICS_PATH',
    ],
  },
  { key: 'elasticsearch', title: 'Elasticsearch', prefixes: ['ES_', 'ENABLE_ES'] },
  { key: 'cerberus', title: 'Cerberus', prefixes: ['CERBERUS_'] },
  { key: 'kubevirt', title: 'KubeVirt Checks', prefixes: ['KUBE_VIRT_'] },
  { key: 'health_check', title: 'Health Checks', prefixes: ['HEALTH_CHECK_'] },
  { key: 'resiliency', title: 'Resiliency Score', prefixes: ['RESILIENCY_', 'DISABLE_RESILIENCY_'] },
  { key: 'telemetry', title: 'Telemetry', prefixes: ['TELEMETRY_'] },
];

/**
 * Groups global scenario fields into named sections based on variable name prefixes.
 * Fields that don't match any known prefix are placed in a "General" section at the top.
 */
export function groupGlobalFields(fields: ScenarioField[]): GlobalFieldSection[] {
  const named: GlobalFieldSection[] = [];
  const assigned = new Set<string>();

  for (const section of SECTIONS) {
    const sectionFields = fields.filter(f =>
      section.prefixes.some(prefix =>
        f.variable === prefix || f.variable.startsWith(prefix)
      )
    );
    if (sectionFields.length > 0) {
      named.push({ key: section.key, title: section.title, fields: sectionFields });
      sectionFields.forEach(f => assigned.add(f.variable));
    }
  }

  const general = fields.filter(f => !assigned.has(f.variable));
  const result: GlobalFieldSection[] = [];

  if (general.length > 0) {
    result.push({ key: 'general', title: 'General', fields: general });
  }

  return result.concat(named);
}
