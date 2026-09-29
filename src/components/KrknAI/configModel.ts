import { isMap, isSeq, parseDocument } from 'yaml';
import type { Document } from 'yaml';
import type { ClusterComponents } from './types';

export const scenarioTypeOptions = [
  { id: 'application-outages', label: 'Application outages', configKey: 'application-outages' },
  { id: 'pod-scenarios', label: 'Pod scenarios', configKey: 'pod-scenarios' },
  { id: 'container-scenarios', label: 'Container scenarios', configKey: 'container-scenarios' },
  { id: 'node-cpu-hog', label: 'Node CPU hog', configKey: 'node-cpu-hog' },
  { id: 'node-memory-hog', label: 'Node memory hog', configKey: 'node-memory-hog' },
  { id: 'node-io-hog', label: 'Node I/O hog', configKey: 'node-io-hog' },
  { id: 'time-scenarios', label: 'Time scenarios', configKey: 'time-scenarios' },
  { id: 'network-scenarios', label: 'Network scenarios', configKey: 'network-scenarios' },
  { id: 'dns-outage', label: 'DNS outage', configKey: 'dns-outage' },
  { id: 'syn-flood', label: 'SYN flood', configKey: 'syn-flood' },
  { id: 'pvc-scenarios', label: 'PVC scenarios', configKey: 'pvc-scenarios' },
  { id: 'kubevirt-scenarios', label: 'KubeVirt scenarios', configKey: 'kubevirt-scenarios' },
  { id: 'storage-throttle', label: 'Storage throttle', configKey: 'storage-throttle' },
  { id: 'service-disruption', label: 'Service disruption', configKey: 'service-disruption' },
] as const;

export type ScenarioType = (typeof scenarioTypeOptions)[number]['id'];
export type ScenarioFlags = Record<ScenarioType, boolean>;
export type FitnessValueType = 'point' | 'range';

export interface FitnessItemDraft {
  key: number;
  id: string;
  title: string;
  query: string;
  type: FitnessValueType;
  weight: string;
}

export interface HealthCheckDraft {
  key: number;
  name: string;
  url: string;
  statusCode: string;
  timeout: string;
  interval: string;
}

export interface GeneticSettingsDraft {
  duration: string;
  generations: string;
  populationSize: string;
  mutationRate: string;
  scenarioMutationRate: string;
  crossoverRate: string;
  compositionRate: string;
  selectionStrategy: string;
  tournamentSize: string;
  populationInjectionRate: string;
  populationInjectionSize: string;
}

export interface EditableConfigDraft {
  seed: string;
  waitDuration: string;
  baselineEnabled: boolean;
  baselineDuration: string;
  scenarioFlags: ScenarioFlags;
  genetic: GeneticSettingsDraft;
  healthChecks: HealthCheckDraft[];
  stopWatcherOnFailure: boolean;
  stopTimeout: string;
  includeKrknFailure: boolean;
  includeHealthCheckFailure: boolean;
  includeHealthCheckResponseTime: boolean;
  fitnessItems: FitnessItemDraft[];
  clusterComponents: ClusterComponents;
  resultNameFormat: string;
  graphNameFormat: string;
  logNameFormat: string;
}

export type ConfigValidationErrors = Record<string, string>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function documentValue(document: Document, path: Array<string | number>): unknown {
  const value = document.getIn(path, true);
  if (value && typeof value === 'object' && 'toJSON' in value && typeof value.toJSON === 'function') return value.toJSON();
  return value;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value);
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: string, optional = false): number | null {
  if (optional && value.trim() === '') return null;
  return Number(value);
}

function componentData(value: unknown): ClusterComponents {
  const components = record(value);
  const namespaces = list(components.namespaces).map((entry) => {
    const namespace = record(entry);
    return {
      ...namespace,
      name: text(namespace.name),
      disabled: bool(namespace.disabled),
      pods: list(namespace.pods).map((podValue) => {
        const pod = record(podValue);
        return {
          ...pod,
          name: text(pod.name),
          disabled: bool(pod.disabled),
          labels: record(pod.labels) as Record<string, string>,
          containers: list(pod.containers).map((containerValue) => {
            const container = record(containerValue);
            return { ...container, name: text(container.name), disabled: bool(container.disabled) };
          }),
        };
      }),
      services: list(namespace.services).map((item) => {
        const component = record(item);
        return { ...component, name: text(component.name), disabled: bool(component.disabled) };
      }),
      pvcs: list(namespace.pvcs).map((item) => {
        const component = record(item);
        return { ...component, name: text(component.name), disabled: bool(component.disabled) };
      }),
    };
  });
  const nodes = list(components.nodes).map((nodeValue) => {
    const node = record(nodeValue);
    return { ...node, name: text(node.name), disabled: bool(node.disabled), labels: record(node.labels) as Record<string, string> };
  });
  return { ...components, namespaces, nodes } as ClusterComponents;
}

export function createEditableConfigDraft(configYaml: string): { document: Document; draft: EditableConfigDraft } {
  const parsed = parseDocument(configYaml);
  if (parsed.errors.length) throw new Error(parsed.errors.map((error) => error.message).join('; '));
  if (!isMap(parsed.contents)) throw new Error('Discovered configuration must be a YAML mapping.');
  const raw = record(parsed.toJS());
  const baseline = record(raw.baseline);
  const genetic = record(raw.genetic);
  const fitness = record(raw.fitness_function);
  const health = record(raw.health_checks);
  const output = record(raw.output);
  const scenario = record(raw.scenario);
  const scenarioFlags = Object.fromEntries(scenarioTypeOptions.map((option) => {
    const scenarioConfig = record(scenario[option.configKey]);
    return [option.id, bool(scenarioConfig.enable)];
  })) as ScenarioFlags;
  const fitnessItems = list(fitness.items).map((entry, key) => {
    const item = record(entry);
    return {
      key,
      id: text(item.id, String(key)),
      title: text(item.name ?? item.title, `Fitness item ${key + 1}`),
      query: text(item.query),
      type: item.type === 'range' ? 'range' as const : 'point' as const,
      weight: text(item.weight, '1'),
    };
  });
  const legacyQuery = text(fitness.query).trim();
  const legacyType = fitness.type === 'range' ? 'range' : 'point';
  if (legacyQuery && !fitnessItems.some((item) => item.query.trim() === legacyQuery && item.type === legacyType)) {
    const nextId = fitnessItems.reduce(
      (maximum, item) => Math.max(maximum, Number.isFinite(Number(item.id)) ? Number(item.id) : -1),
      -1,
    ) + 1;
    const nextKey = fitnessItems.reduce((maximum, item) => Math.max(maximum, item.key), -1) + 1;
    fitnessItems.push({
      key: nextKey,
      id: String(nextId),
      title: 'Default fitness query',
      query: legacyQuery,
      type: legacyType,
      weight: '1',
    });
  }
  const healthChecks = list(health.applications).map((entry, key) => {
    const check = record(entry);
    return {
      key,
      name: text(check.name, `Application ${key + 1}`),
      url: text(check.url),
      statusCode: text(check.status_code, '200'),
      timeout: text(check.timeout, '5'),
      interval: text(check.interval, '5'),
    };
  });
  const draft: EditableConfigDraft = {
    seed: text(raw.seed),
    waitDuration: text(raw.wait_duration, '0'),
    baselineEnabled: bool(baseline.enable, true),
    baselineDuration: text(baseline.duration, '120'),
    scenarioFlags,
    genetic: {
      duration: text(genetic.duration),
      generations: text(genetic.generations, text(genetic.duration).trim() ? '' : '20'),
      populationSize: text(genetic.population_size, '10'),
      mutationRate: text(genetic.mutation_rate, '0.7'),
      scenarioMutationRate: text(genetic.scenario_mutation_rate, '0.6'),
      crossoverRate: text(genetic.crossover_rate, '0.6'),
      compositionRate: text(genetic.composition_rate, '0'),
      selectionStrategy: text(genetic.selection_strategy, 'tournament'),
      tournamentSize: text(genetic.tournament_size, '6'),
      populationInjectionRate: text(genetic.population_injection_rate, '0'),
      populationInjectionSize: text(genetic.population_injection_size, '2'),
    },
    healthChecks,
    stopWatcherOnFailure: bool(health.stop_watcher_on_failure),
    stopTimeout: text(health.stop_timeout, '5'),
    includeKrknFailure: bool(fitness.include_krkn_failure, true),
    includeHealthCheckFailure: bool(fitness.include_health_check_failure, true),
    includeHealthCheckResponseTime: bool(fitness.include_health_check_response_time, true),
    fitnessItems,
    clusterComponents: componentData(raw.cluster_components),
    resultNameFormat: text(output.result_name_fmt, 'scenario_%s.yaml'),
    graphNameFormat: text(output.graph_name_fmt, 'scenario_%s.png'),
    logNameFormat: text(output.log_name_fmt, 'scenario_%s.log'),
  };

  // Keep every supported scenario visible even when discovery disabled it.
  for (const option of scenarioTypeOptions) {
    if (!parsed.hasIn(['scenario', option.configKey])) parsed.setIn(['scenario', option.configKey], parsed.createNode({ enable: false }));
  }
  return { document: parsed, draft };
}

export function updateConfigDocument(document: Document, draft: EditableConfigDraft): string {
  const set = (path: Array<string | number>, value: unknown) => document.setIn(path, value);
  set(['seed'], numberValue(draft.seed, true));
  set(['wait_duration'], numberValue(draft.waitDuration));
  set(['baseline', 'enable'], draft.baselineEnabled);
  set(['baseline', 'duration'], numberValue(draft.baselineDuration));
  set(['algorithm'], 'genetic');
  for (const option of scenarioTypeOptions) set(['scenario', option.configKey, 'enable'], draft.scenarioFlags[option.id]);

  const genetic = draft.genetic;
  const geneticFields: Array<[keyof GeneticSettingsDraft, string, boolean]> = [
    ['duration', 'duration', true], ['generations', 'generations', true], ['populationSize', 'population_size', false],
    ['mutationRate', 'mutation_rate', false], ['scenarioMutationRate', 'scenario_mutation_rate', false],
    ['crossoverRate', 'crossover_rate', false], ['compositionRate', 'composition_rate', false],
    ['selectionStrategy', 'selection_strategy', false], ['tournamentSize', 'tournament_size', false],
    ['populationInjectionRate', 'population_injection_rate', false], ['populationInjectionSize', 'population_injection_size', false],
  ];
  for (const [draftKey, yamlKey, optional] of geneticFields) {
    const value = genetic[draftKey];
    set(['genetic', yamlKey], draftKey === 'selectionStrategy' ? value : numberValue(value, optional));
  }

  set(['health_checks', 'stop_watcher_on_failure'], draft.stopWatcherOnFailure);
  set(['health_checks', 'stop_timeout'], numberValue(draft.stopTimeout));
  const updateSequence = (path: Array<string | number>, rows: Array<Record<string, unknown>>) => {
    let sequence = document.getIn(path, true);
    if (!isSeq(sequence)) {
      document.setIn(path, document.createNode([]));
      sequence = document.getIn(path, true);
    }
    if (!isSeq(sequence)) return;
    rows.forEach((row, index) => {
      if (index < sequence.items.length) {
        for (const [key, value] of Object.entries(row)) document.setIn([...path, index, key], value);
      } else {
        sequence.add(document.createNode(row));
      }
    });
    while (sequence.items.length > rows.length) sequence.delete(sequence.items.length - 1);
  };
  const healthRows = draft.healthChecks.map((check, index) => ({
    ...record(documentValue(document, ['health_checks', 'applications', index])),
    name: check.name,
    url: check.url,
    status_code: numberValue(check.statusCode),
    timeout: numberValue(check.timeout),
    interval: numberValue(check.interval),
  }));
  updateSequence(['health_checks', 'applications'], healthRows);

  document.deleteIn(['fitness_function', 'query']);
  document.deleteIn(['fitness_function', 'type']);
  set(['fitness_function', 'include_krkn_failure'], draft.includeKrknFailure);
  set(['fitness_function', 'include_health_check_failure'], draft.includeHealthCheckFailure);
  set(['fitness_function', 'include_health_check_response_time'], draft.includeHealthCheckResponseTime);
  const fitnessRows = draft.fitnessItems.map((item, index) => ({
    ...record(documentValue(document, ['fitness_function', 'items', index])),
    id: numberValue(item.id),
    query: item.query,
    type: item.type,
    weight: numberValue(item.weight),
  }));
  updateSequence(['fitness_function', 'items'], fitnessRows);
  set(['output', 'result_name_fmt'], draft.resultNameFormat);
  set(['output', 'graph_name_fmt'], draft.graphNameFormat);
  set(['output', 'log_name_fmt'], draft.logNameFormat);
  set(['allow_dangerous_scenarios'], draft.scenarioFlags['service-disruption']);

  const edited = draft.clusterComponents;
  const updateDisabled = (path: Array<string | number>, disabled: boolean) => set(['cluster_components', ...path, 'disabled'], disabled);
  edited.namespaces.forEach((namespace, namespaceIndex) => {
    updateDisabled(['namespaces', namespaceIndex], namespace.disabled ?? false);
    namespace.pods.forEach((pod, podIndex) => {
      updateDisabled(['namespaces', namespaceIndex, 'pods', podIndex], pod.disabled ?? false);
      pod.containers.forEach((container, containerIndex) => updateDisabled(['namespaces', namespaceIndex, 'pods', podIndex, 'containers', containerIndex], container.disabled ?? false));
    });
    namespace.services.forEach((service, componentIndex) => updateDisabled(['namespaces', namespaceIndex, 'services', componentIndex], service.disabled ?? false));
    namespace.pvcs.forEach((pvc, componentIndex) => updateDisabled(['namespaces', namespaceIndex, 'pvcs', componentIndex], pvc.disabled ?? false));
    namespace.vmis?.forEach((vmi, componentIndex) => updateDisabled(['namespaces', namespaceIndex, 'vmis', componentIndex], vmi.disabled ?? false));
  });
  edited.nodes.forEach((node, index) => updateDisabled(['nodes', index], node.disabled ?? false));
  return document.toString();
}

function numericError(value: string, label: string, options: { min?: number; integer?: boolean; optional?: boolean } = {}): string | undefined {
  if (options.optional && value.trim() === '') return undefined;
  if (!value.trim()) return `Enter a valid ${label}.`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `Enter a valid ${label}.`;
  if (options.integer && !Number.isInteger(parsed)) return `${label} must be a whole number.`;
  if (options.min !== undefined && parsed < options.min) return `${label} must be at least ${options.min}.`;
  return undefined;
}

export function validateConfigDraft(draft: EditableConfigDraft): ConfigValidationErrors {
  const errors: ConfigValidationErrors = {};
  const add = (field: string, error: string | undefined) => { if (error) errors[field] = error; };
  const genetic = draft.genetic;
  add('seed', numericError(draft.seed, 'Seed', { integer: true, optional: true }));
  add('waitDuration', numericError(draft.waitDuration, 'Wait duration', { min: 0, integer: true }));
  add('baselineDuration', numericError(draft.baselineDuration, 'Baseline duration', { min: 1, integer: true }));
  const hasDuration = !!genetic.duration.trim();
  const hasGenerations = !!genetic.generations.trim();
  if (hasDuration && hasGenerations) {
    const error = 'Set either generations or duration, not both.';
    errors.generations = error;
    errors['genetic.duration'] = error;
  } else if (!hasDuration && !hasGenerations) {
    errors.generations = 'Set a generation count or duration.';
  } else if (hasDuration) {
    add('genetic.duration', numericError(genetic.duration, 'Genetic duration', { min: 1, integer: true }));
  } else {
    add('generations', numericError(genetic.generations, 'Generations', { min: 1, integer: true }));
  }
  add('populationSize', numericError(genetic.populationSize, 'Population size', { min: 2, integer: true }));
  for (const [field, label] of [['mutationRate', 'Mutation rate'], ['scenarioMutationRate', 'Scenario mutation rate'], ['crossoverRate', 'Crossover rate'], ['populationInjectionRate', 'Population injection rate']] as const) {
    add(`genetic.${field}`, numericError(genetic[field], label, { min: 0 }));
    if (Number(genetic[field]) > 1) errors[`genetic.${field}`] = `${label} must be at most 1.`;
  }
  add('genetic.compositionRate', Number(genetic.compositionRate) === 0 ? undefined : 'Composition rate must be zero for operator runs.');
  add('genetic.selectionStrategy', ['roulette', 'tournament'].includes(genetic.selectionStrategy) ? undefined : 'Choose roulette or tournament.');
  if (genetic.selectionStrategy === 'tournament') {
    add('genetic.tournamentSize', numericError(genetic.tournamentSize, 'Tournament size', { min: 1, integer: true }));
  }
  add('genetic.populationInjectionSize', numericError(genetic.populationInjectionSize, 'Population injection size', { min: 1, integer: true }));
  add('stopTimeout', numericError(draft.stopTimeout, 'Health-check stop timeout', { min: 0 }));
  if (draft.fitnessItems.length === 0) errors.fitnessItems = 'Add at least one fitness item.';
  for (const item of draft.fitnessItems) {
    const key = `fitnessItem.${item.key}`;
    add(`${key}.id`, numericError(item.id, 'Item ID', { integer: true }));
    add(`${key}.weight`, numericError(item.weight, 'Weight', { min: 0 }));
    if (!item.query.trim()) errors[`${key}.query`] = 'PromQL query is required.';
  }
  for (const check of draft.healthChecks) {
    const key = `healthCheck.${check.key}`;
    try {
      if (!['http:', 'https:'].includes(new URL(check.url).protocol)) errors[`${key}.url`] = 'Enter an HTTP or HTTPS URL.';
    } catch {
      errors[`${key}.url`] = 'Enter a complete HTTP or HTTPS URL.';
    }
    add(`${key}.statusCode`, numericError(check.statusCode, 'Expected status code', { integer: true }));
    add(`${key}.timeout`, numericError(check.timeout, 'Health-check timeout', { integer: true }));
    add(`${key}.interval`, numericError(check.interval, 'Health-check interval', { integer: true }));
  }
  for (const [field, value, label] of [
    ['resultNameFormat', draft.resultNameFormat, 'Result filename format'],
    ['graphNameFormat', draft.graphNameFormat, 'Graph filename format'],
    ['logNameFormat', draft.logNameFormat, 'Log filename format'],
  ] as const) if (!value.includes('%s')) errors[field] = `${label} must include the %s scenario placeholder.`;
  return errors;
}

