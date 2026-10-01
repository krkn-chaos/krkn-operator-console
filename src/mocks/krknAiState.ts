import { parseDocument, stringify } from 'yaml';
import fixture from './fixtures/krknAiResults.json';
import { validateConfigDraft, createEditableConfigDraft } from '../components/KrknAI/configModel';
import { scenarioTypeOptions } from '../components/KrknAI/configModel';
import type { ScenarioRunStatusResponse } from '../types/api';
import type { KrknAIScenarioDetail, KrknAIScenarioIndexRow, KrknAIRunResource, KrknAIRunSummary } from '../services/krknAiApi';
import type { NamespaceComponent } from '../components/KrknAI/types';

import type { EditableConfigDraft } from '../components/KrknAI/configModel';

export interface PreviewKrknAIRun {
  resource: KrknAIRunResource;
  summary: KrknAIRunSummary;
  scenarios: KrknAIScenarioIndexRow[];
  details: Record<string, KrknAIScenarioDetail>;
  configYaml: string;
  orchestratorLogs: string[];
  scenarioLogs: Record<string, string[]>;
}

interface SavedConfig {
  configId: string;
  fileId: string;
  fileName: string;
  configYaml: string;
  targetRequestId: string;
  targetClusters: Record<string, string[]>;
}
interface RunState extends PreviewKrknAIRun {
  startedAt: number | null;
  seeded: boolean;
  configuredGenerations: number;
  populationSize: number;
  fitnessItems: Array<{ id: number; query: string; type: string; weight: number }>;
  healthChecks: Array<{ name: string; url: string; statusCode: number }>;
  scenarioTypes: string[];
}
interface SeedFixture {
  createdAt: string;
  configuredGenerations: number;
  populationSize: number;
  bestFitness: number;
  averageFitness: number;
  baselineFitness: number;
  fitnessProgression: Array<{ generation: number; best: number; average: number }>;
  fitnessItems: Array<{ id: number; query: string; type: string; weight: number }>;
  scenarios: KrknAIScenarioDetail[];
}
const seedFixture = fixture as unknown as SeedFixture;

const namespacesAvailable = ['shop', 'robot-shop', 'default', 'kube-system'];
const runs = new Map<string, RunState>();
const configs = new Map<string, SavedConfig>();
const configFiles = new Map<string, SavedConfig>();
let nextId = 1;
const clone = <T,>(value: T): T => structuredClone(value);
const keyOf = (generation: number, scenarioId: string) => `${generation}:${scenarioId}`;
const scenarioSortValue: Record<string, (row: KrknAIScenarioIndexRow) => string | number | null | undefined> = {
  generation: (row) => row.generation,
  scenarioId: (row) => row.scenarioId,
  scenarioType: (row) => row.scenarioType,
  fitnessScore: (row) => row.fitnessScore,
  outcome: (row) => row.outcome,
  durationSeconds: (row) => row.durationSeconds,
};

function fixtureConfigYaml(): string {
  const fitnessItems = seedFixture.fitnessItems;
  const enabledTypes = new Set(seedFixture.scenarios.filter((scenario) => scenario.scenarioType !== 'dummy-scenario').map((scenario) => scenario.scenarioType));
  const namespaces: NamespaceComponent[] = [
    { name: 'robot-shop', disabled: false, pods: [{ name: 'preview-pod', disabled: false, labels: { app: 'robot-shop' }, containers: [{ name: 'preview-container', disabled: false }] }], services: [{ name: 'preview-service', disabled: false }], pvcs: [] },
    { name: 'shop', disabled: false, pods: [{ name: 'preview-pod', disabled: false, labels: { app: 'shop' }, containers: [{ name: 'preview-container', disabled: false }] }], services: [{ name: 'preview-service', disabled: false }], pvcs: [] },
  ];
  return stringify({
    kubeconfig_file_path: '/input/preview-kubeconfig',
    seed: 42,
    wait_duration: 0,
    algorithm: 'genetic',
    baseline: { enable: true, duration: 30 },
    scenario: Object.fromEntries(scenarioTypeOptions.map(({ configKey }) => [configKey, { enable: enabledTypes.has(configKey) }])),
    genetic: { generations: seedFixture.configuredGenerations, population_size: seedFixture.populationSize, mutation_rate: 0.7, scenario_mutation_rate: 0.6, crossover_rate: 0.6, composition_rate: 0, selection_strategy: 'tournament', tournament_size: 2, population_injection_rate: 0, population_injection_size: 1 },
    cluster_components: { namespaces, nodes: [] },
    health_checks: { stop_watcher_on_failure: false, stop_timeout: 5, applications: [
      { name: 'rs', url: 'https://robot-shop.example/health', status_code: 200, timeout: 5, interval: 5 },
      { name: 'payment', url: 'https://shop.example/health', status_code: 200, timeout: 5, interval: 5 },
    ] },
    fitness_function: { include_krkn_failure: true, include_health_check_failure: true, include_health_check_response_time: true, items: fitnessItems },
  });
}

function scenarioDetails(): { scenarios: KrknAIScenarioIndexRow[]; details: Record<string, KrknAIScenarioDetail>; logs: Record<string, string[]> } {
  const data = seedFixture.scenarios;
  const scenarios = data.map((detail) => ({
    generation: detail.generation,
    scenarioId: detail.scenarioId,
    scenarioType: detail.scenarioType,
    outcome: detail.returnCode === 0 ? 'succeeded' : 'failed',
    durationSeconds: detail.durationSeconds,
    fitnessScore: detail.fitnessResult.fitnessScore,
    fitnessState: 'final',
    childRunName: `preview-ai-child-seed-${detail.generation}-${detail.scenarioId}`,
    phase: detail.returnCode === 0 ? 'Succeeded' : 'Failed',
    jobId: `preview-ai-job-seed-${detail.generation}-${detail.scenarioId}`,
    podName: `preview-ai-pod-${detail.generation}-${detail.scenarioId}`,
  }));
  const details: Record<string, KrknAIScenarioDetail> = {};
  const logs: Record<string, string[]> = {};
  for (const detail of data) {
    const safe = clone(detail);
    safe.command = `Preview-only: ${safe.scenarioType} scenario`;
    details[keyOf(safe.generation, safe.scenarioId)] = safe;
    logs[keyOf(safe.generation, safe.scenarioId)] = Array.from({ length: 24 }, (_, index) => `[preview] ${safe.scenarioType} scenario ${safe.scenarioId}: ${['Preparing sanitized targets', 'Applying simulated disruption', 'Collecting preview measurements', 'Committing result'][index % 4]}`);
  }
  return { scenarios, details, logs };
}

function seedRun(name: string, phase: 'Succeeded' | 'Running'): RunState {
  const yaml = fixtureConfigYaml();
  const configMapName = `preview-ai-config-${name}.yaml`;
  const createdAt = seedFixture.createdAt;
  const source = scenarioDetails();
  const completedGenerations = phase === 'Succeeded' ? seedFixture.configuredGenerations : Math.min(1, seedFixture.configuredGenerations);
  const currentGeneration = phase === 'Succeeded' ? null : completedGenerations;
  const scenarios = source.scenarios.map((row) => {
    const complete = row.scenarioId === 'baseline' || row.generation < completedGenerations;
    return { ...row, childRunName: `preview-ai-child-${name}-${row.generation}-${row.scenarioId}`, jobId: `preview-ai-job-${name}-${row.generation}-${row.scenarioId}`, podName: `preview-ai-pod-${name}-${row.generation}-${row.scenarioId}`, ...(complete ? {} : { fitnessScore: null, fitnessState: 'provisional', outcome: 'Running', phase: 'Running' }) };
  });
  const details = Object.fromEntries(Object.entries(source.details).map(([key, detail]) => {
    const pending = detail.generation >= completedGenerations && detail.scenarioId !== 'baseline';
    return [key, pending ? {
      ...detail, returnCode: null, durationSeconds: null, fitnessState: 'provisional',
      fitnessResult: { ...detail.fitnessResult, fitnessScore: null, healthCheckFailureScore: null, healthCheckResponseTimeScore: null, krknFailureScore: null, scores: detail.fitnessResult.scores.map((score) => ({ ...score, normalizedScore: null })) },
      healthChecks: [],
    } : detail];
  }));
  const refs = scenarios.map((row) => row.childRunName!).filter((_, index) => index < completedGenerations * seedFixture.populationSize + 1);
  const resource: KrknAIRunResource = {
    apiVersion: 'krkn.dev/v1alpha1', kind: 'KrknAIRun',
    metadata: { name, uid: `preview-ai-${name}`, creationTimestamp: createdAt },
    spec: { targetRequestId: 'preview-ai-target', targetClusters: { 'preview-operator': ['preview-cluster'] }, configMapName, configMapKey: configMapName, orchestratorImage: 'quay.io/krkn-chaos/krkn:preview' },
    status: { phase, orchestratorPodName: `preview-ai-${name}-orchestrator`, startTime: createdAt, ...(phase === 'Succeeded' ? { completionTime: createdAt } : {}), scenarioRunRefs: refs },
  };
  const progression = seedFixture.fitnessProgression.slice(0, completedGenerations).map((entry) => ({ ...entry }));
  const summary: KrknAIRunSummary = {
    name, phase, createdAt, cluster: 'preview-cluster', orchestratorPodName: resource.status.orchestratorPodName!, failureReason: '', artifactStatus: phase === 'Succeeded' ? 'succeeded' : 'in_progress',
    currentGeneration, completedGenerations, completedScenarios: scenarios.filter((row) => row.scenarioId !== 'baseline' && (row.phase === 'Succeeded' || row.phase === 'Failed')).length,
    configuredGenerations: seedFixture.configuredGenerations, populationSize: seedFixture.populationSize,
    bestFitness: phase === 'Succeeded' ? seedFixture.bestFitness : progression[progression.length - 1]?.best ?? null,
    averageFitness: phase === 'Succeeded' ? seedFixture.averageFitness : progression[progression.length - 1]?.average ?? null,
    baselineFitness: completedGenerations > 0 ? seedFixture.baselineFitness : null,
    fitnessProgression: progression,
  };
  const orchestratorLogs = Array.from({ length: phase === 'Succeeded' ? 240 : 30 }, (_, index) => `[preview] ${new Date(Date.parse(createdAt) + index * 1000).toISOString()} ${index === 0 ? 'Starting Krkn-AI preview run' : phase === 'Succeeded' ? 'Completed-run output' : 'Running preview'}: deterministic event ${index + 1}`);
  const committedScenarioLogs = Object.fromEntries(Object.entries(source.logs).map(([key, lines]) => {
    const generation = Number(key.split(':')[0]);
    return [key, generation < completedGenerations || key.endsWith(':baseline') ? lines : [
      '[preview] Preparing the current scenario',
      '[preview] Collecting simulated measurements',
      '[preview] Fitness remains pending until the entire generation completes',
    ]];
  }));
  return {
    resource, summary, scenarios, details, configYaml: yaml, orchestratorLogs, scenarioLogs: committedScenarioLogs,
    startedAt: null, seeded: true, configuredGenerations: seedFixture.configuredGenerations, populationSize: seedFixture.populationSize,
    fitnessItems: seedFixture.fitnessItems, healthChecks: [], scenarioTypes: [],
  };
}

function buildState(): void {
  runs.clear(); configs.clear(); configFiles.clear(); nextId = 1;
  for (const name of ['preview-ai-completed', 'preview-ai-running']) {
    const run = seedRun(name, name === 'preview-ai-completed' ? 'Succeeded' : 'Running');
    const fileId = `preview-ai-config-file-${name}`;
    const saved: SavedConfig = { configId: `preview-ai-config-id-${name}`, fileId, fileName: run.resource.spec.configMapName!, configYaml: run.configYaml, targetRequestId: run.resource.spec.targetRequestId, targetClusters: clone(run.resource.spec.targetClusters) };
    configFiles.set(fileId, saved);
    runs.set(name, run);
  }
}

function commitScenario(run: RunState, row: KrknAIScenarioIndexRow): void {
  const key = keyOf(row.generation, row.scenarioId);
  const detail = run.details[key];
  if (!detail) return;
  const score = row.scenarioId === 'baseline' ? 20 : Math.min(95, 35 + row.generation * 11 + run.fitnessItems.length);
  row.fitnessScore = score;
  row.fitnessState = 'final';
  row.outcome = 'succeeded';
  row.phase = 'Succeeded';
  row.durationSeconds = 12;
  detail.returnCode = 0;
  detail.durationSeconds = 12;
  detail.fitnessState = 'final';
  detail.fitnessResult.fitnessScore = score;
  detail.fitnessResult.healthCheckFailureScore = 0;
  detail.fitnessResult.healthCheckResponseTimeScore = 0.1;
  detail.fitnessResult.krknFailureScore = 0;
  detail.fitnessResult.scores = run.fitnessItems.map((item, index) => ({
    id: item.id, rawScore: index + row.generation, normalizedScore: Math.min(1, 0.2 + index * 0.05 + row.generation * 0.1), query: item.query, queryType: item.type,
  }));
  detail.healthChecks = run.healthChecks.map((check, index) => ({
    application: check.name, timestamp: new Date(Date.parse(run.summary.createdAt) + row.generation * 60_000 + index * 1000).toISOString(),
    elapsedSeconds: index, responseTimeSeconds: 0.01 + index * 0.002, statusCode: check.statusCode, success: true,
  }));
  run.scenarioLogs[key] = Array.from({ length: 24 }, (_, line) => `[preview] ${row.scenarioType} ${row.scenarioId}: ${['Initialized mock scenario', `Using namespace ${detail.parameters instanceof Array ? String(detail.parameters[0]?.value ?? 'preview') : 'preview'}`, 'Recorded simulated metrics', 'Scenario completed'][line % 4]}`);
}

function progress(run: RunState): void {
  if (run.seeded || run.startedAt === null || run.summary.phase !== 'Running') return;
  const elapsed = Date.now() - run.startedAt;
  const previouslyCompleted = run.summary.completedGenerations ?? 0;
  const completed = Math.min(run.configuredGenerations, elapsed < 5000 ? 0 : 1 + Math.floor((elapsed - 5000) / 8000));
  if (completed >= run.configuredGenerations) {
    run.summary.phase = 'Succeeded'; run.resource.status.phase = 'Succeeded'; run.summary.artifactStatus = 'succeeded';
    run.resource.status.completionTime = new Date().toISOString(); run.summary.currentGeneration = null;
  } else {
    run.summary.currentGeneration = completed;
  }
  run.summary.completedGenerations = completed;
  for (let generation = previouslyCompleted; generation < completed; generation += 1) {
    const committedAt = new Date(run.startedAt + 5000 + generation * 8000).toISOString();
    run.orchestratorLogs.push(`[preview] ${committedAt} Committed generation ${generation}: simulated fitness measurements are final.`);
  }
  for (const row of run.scenarios) {
    if (row.generation < completed && row.phase !== 'Succeeded') commitScenario(run, row);
    else if (row.generation >= completed) {
      const phase = row.generation === completed ? 'Running' : 'Pending';
      row.fitnessScore = null; row.fitnessState = 'provisional'; row.outcome = phase; row.phase = phase;
      const detail = run.details[keyOf(row.generation, row.scenarioId)];
      if (detail) { detail.fitnessState = 'provisional'; detail.fitnessResult.fitnessScore = null; detail.fitnessResult.scores.forEach((score) => { score.normalizedScore = null; }); }
    }
  }
  run.summary.completedScenarios = run.scenarios.filter((row) => row.scenarioId !== 'baseline' && row.phase === 'Succeeded').length;
  if (completed > 0) {
    const committed = run.scenarios.filter((row) => row.scenarioId !== 'baseline' && row.fitnessScore != null && row.generation < completed);
    const progression = Array.from({ length: completed }, (_, generation) => {
      const scores = committed.filter((row) => row.generation === generation).map((row) => row.fitnessScore!);
      return { generation, best: Math.max(...scores), average: scores.reduce((sum, score) => sum + score, 0) / scores.length };
    });
    run.summary.fitnessProgression = progression;
    run.summary.bestFitness = Math.max(...committed.map((row) => row.fitnessScore!));
    const baseline = run.scenarios.find((row) => row.scenarioId === 'baseline');
    run.summary.baselineFitness = baseline?.fitnessScore ?? null;
    run.summary.averageFitness = committed.reduce((sum, row) => sum + row.fitnessScore!, 0) / committed.length;
  } else {
    run.summary.fitnessProgression = []; run.summary.bestFitness = null; run.summary.averageFitness = null;
  }
}

function previewSnapshot(run: RunState): PreviewKrknAIRun {
  const details = Object.fromEntries(Object.entries(run.details)
    .filter(([, detail]) => detail.returnCode !== null
      || detail.healthChecks.length > 0
      || detail.fitnessResult.scores.some((score) => score.rawScore !== null))
    .map(([key, detail]) => [key, clone(detail)]));
  return {
    resource: clone(run.resource),
    summary: clone(run.summary),
    scenarios: clone(run.scenarios),
    details,
    configYaml: run.configYaml,
    orchestratorLogs: [...run.orchestratorLogs],
    scenarioLogs: clone(run.scenarioLogs),
  };
}

export function getPreviewAiRun(name: string): PreviewKrknAIRun | undefined {
  const run = runs.get(name);
  if (!run) return undefined;
  progress(run);
  return previewSnapshot(run);
}
export function listPreviewAiRuns(): PreviewKrknAIRun[] {
  for (const run of runs.values()) progress(run);
  return [...runs.values()].map(previewSnapshot);
}
export function listPreviewAiChildren(): Array<{ parentRunName: string; run: ScenarioRunStatusResponse }> {
  const children: Array<{ parentRunName: string; run: ScenarioRunStatusResponse }> = [];
  for (const state of runs.values()) {
    progress(state);
    for (const row of state.scenarios) {
      if (!row.childRunName) continue;
      const phase = row.phase === 'Succeeded' || row.phase === 'Failed' || row.phase === 'Running' ? row.phase : 'Pending';
      const targetClusters = state.resource.spec.targetClusters;
      const jobId = row.jobId ?? `preview-ai-job-${row.generation}-${row.scenarioId}`;
      const childPodName = row.podName ?? `preview-ai-pod-${row.generation}-${row.scenarioId}`;
      children.push({ parentRunName: state.resource.metadata.name, run: {
        scenarioRunName: row.childRunName, phase, scenarioName: row.scenarioType ?? 'preview-scenario',
        totalTargets: 1, successfulJobs: phase === 'Succeeded' ? 1 : 0, failedJobs: phase === 'Failed' ? 1 : 0, runningJobs: phase === 'Running' ? 1 : 0,
        clusterJobs: [{
          providerName: Object.keys(targetClusters)[0] ?? 'preview-operator',
          clusterName: Object.values(targetClusters).flat()[0] ?? state.summary.cluster,
          jobId, podName: childPodName, phase, startTime: state.summary.createdAt,
          ...(phase === 'Succeeded' || phase === 'Failed' ? { completionTime: state.summary.createdAt } : {}),
        }],
        creationTimestamp: state.summary.createdAt,
      } });
    }
  }
  return children;
}
export function resetPreviewAiState(): void { buildState(); }

export function previewAvailableNamespaces(targetClusters: Record<string, string[]>, pattern = ''): string[] {
  if (!Object.values(targetClusters).some((selected) => selected.length > 0)) return [];
  const patterns = pattern ? pattern.split(',') : [];
  let matchers: RegExp[] = [];
  try { matchers = patterns.map((entry) => new RegExp(entry)); } catch { return []; }
  const candidates = pattern ? namespacesAvailable : ['shop', 'robot-shop'];
  return candidates.filter((namespace) => {
    if (matchers.length === 0) return true;
    return matchers.some((matcher) => {
      matcher.lastIndex = 0;
      return matcher.test(namespace);
    });
  });
}
export function discoverPreviewConfig(targetClusters: Record<string, string[]>, namespacePattern = ''): { configYaml: string; warnings: string[]; error?: string } {
  if (namespacePattern) {
    try { new RegExp(namespacePattern); } catch { return { configYaml: '', warnings: [], error: 'Namespace pattern is not a valid regular expression.' }; }
  }
  const selectedNamespaces = previewAvailableNamespaces(targetClusters, namespacePattern);
  const document = parseDocument(fixtureConfigYaml());
  const components: NamespaceComponent[] = selectedNamespaces.map((name) => ({
    name, disabled: false,
    pods: [{ name: `preview-${name}-pod`, disabled: false, labels: { app: name }, containers: [{ name: 'preview-container', disabled: false }] }],
    services: [{ name: `preview-${name}-service`, disabled: false }], pvcs: [],
  }));
  document.setIn(['cluster_components', 'namespaces'], document.createNode(components));
  const namespaceSelector = selectedNamespaces.length === 1
    ? `namespace="${selectedNamespaces[0]}"`
    : `namespace=~"(${selectedNamespaces.join('|')})"`;
  const yaml = document.toString().split('namespace="robot-shop"').join(namespaceSelector);
  return { configYaml: yaml, warnings: selectedNamespaces.length ? ['Discovery and all measurements are simulated for this static preview.'] : ['No namespaces matched the selected cluster and namespace pattern.'] };
}

function previewDraft(yaml: string): EditableConfigDraft {
  const { document, draft } = createEditableConfigDraft(yaml);
  if (document.getIn(['genetic', 'generations']) === null) draft.genetic.generations = '';
  if (document.getIn(['genetic', 'duration']) === null) draft.genetic.duration = '';
  return draft;
}

function yamlIssues(yaml: string): Array<{ path: string; message: string }> {
  let parsed;
  try { parsed = parseDocument(yaml); } catch (error) { return [{ path: 'configYaml', message: error instanceof Error ? error.message : 'Invalid YAML.' }]; }
  if (parsed.errors.length) return parsed.errors.map((error) => ({ path: 'configYaml', message: error.message }));
  if (!parsed.contents || typeof parsed.toJS() !== 'object' || Array.isArray(parsed.toJS())) return [{ path: 'configYaml', message: 'Configuration must be a YAML mapping.' }];
  try {
    const draft = previewDraft(yaml);
    const errors = validateConfigDraft(draft);
    if (!Object.values(draft.scenarioFlags).some(Boolean)) errors.scenario = 'Enable at least one scenario type.';
    if (!draft.clusterComponents.namespaces.some((namespace) => !namespace.disabled)) errors['cluster_components.namespaces'] = 'Select at least one discovered namespace.';
    return Object.entries(errors).map(([path, message]) => ({ path, message }));
  } catch (error) {
    return [{ path: 'configYaml', message: error instanceof Error ? error.message : 'Invalid configuration.' }];
  }
}
export function validatePreviewConfig(yaml: string): Array<{ path: string; message: string }> { return yamlIssues(yaml); }
export function savePreviewConfig(input: { name: string; configYaml: string; targetRequestId: string; targetClusters: Record<string, string[]> }): SavedConfig | { errors: Array<{ path: string; message: string }> } {
  const errors = yamlIssues(input.configYaml);
  if (!input.name?.trim()) errors.push({ path: 'name', message: 'Configuration name is required.' });
  if (!input.targetRequestId) errors.push({ path: 'targetRequestId', message: 'Target request ID is required.' });
  if (!Object.values(input.targetClusters ?? {}).some((names) => Array.isArray(names) && names.length)) errors.push({ path: 'targetClusters', message: 'Select at least one target cluster.' });
  if (errors.length) return { errors };
  const id = nextId++;
  const safeName = input.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || `config-${id}`;
  const saved: SavedConfig = {
    configId: `preview-ai-config-id-${id}`, fileId: `preview-ai-config-file-${id}`,
    fileName: `preview-ai-config-${safeName}-${id}.yaml`, configYaml: input.configYaml,
    targetRequestId: input.targetRequestId, targetClusters: clone(input.targetClusters),
  };
  configs.set(saved.configId, saved); configFiles.set(saved.fileId, saved);
  return clone(saved);
}
export function getPreviewAiConfigFile(fileId: string): { fileId: string; fileName: string; content: string; description: string; availableToAll: boolean; filePurpose: string } | undefined {
  const saved = configFiles.get(fileId);
  return saved ? { fileId, fileName: saved.fileName, content: saved.configYaml, description: 'Preview-only Krkn-AI configuration', availableToAll: false, filePurpose: 'krkn-ai-config' } : undefined;
}
export function listPreviewAiConfigFiles(): Array<{ fileId: string; fileName: string; description: string; availableToAll: boolean; filePurpose: string }> {
  return [...configFiles.values()].map((saved) => ({ fileId: saved.fileId, fileName: saved.fileName, description: 'Preview-only Krkn-AI configuration', availableToAll: false, filePurpose: 'krkn-ai-config' }));
}

export function createPreviewAiRun(input: { name: string; configId: string; targetRequestId: string; targetClusters: Record<string, string[]> }): { run?: KrknAIRunResource; status: number; message?: string; errors?: Array<{ path: string; message: string }> } {
  const name = input.name.trim();
  if (!name) return { status: 422, message: 'Run name is required.', errors: [{ path: 'name', message: 'Run name is required.' }] };
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) return { status: 422, message: 'Run name must be a DNS label of at most 63 lowercase characters.', errors: [{ path: 'name', message: 'Use a DNS label: lowercase letters, numbers, and hyphens; start and end with a letter or number.' }] };
  if (runs.has(name)) return { status: 409, message: `Krkn-AI run ${name} already exists.` };
  const config = configs.get(input.configId);
  if (!config) return { status: 404, message: `Saved configuration ${input.configId || '(missing)'} was not found.` };
  const errors: Array<{ path: string; message: string }> = [];
  if (input.targetRequestId !== config.targetRequestId) errors.push({ path: 'targetRequestId', message: 'Target request does not match the saved configuration.' });
  const requestedClusters = Object.entries(input.targetClusters).sort(([left], [right]) => left.localeCompare(right)).map(([cluster, selected]) => [cluster, [...selected].sort()]);
  const savedClusters = Object.entries(config.targetClusters).sort(([left], [right]) => left.localeCompare(right)).map(([cluster, selected]) => [cluster, [...selected].sort()]);
  if (JSON.stringify(requestedClusters) !== JSON.stringify(savedClusters)) errors.push({ path: 'targetClusters', message: 'Target clusters do not match the saved configuration.' });
  if (errors.length) return { status: 422, message: 'Run target binding is invalid.', errors };
  const draft = previewDraft(config.configYaml);
  const generationBudget = draft.genetic.generations.trim() ? Number(draft.genetic.generations) : Math.max(1, Math.ceil(Number(draft.genetic.duration) / 10));
  const generations = Math.max(1, generationBudget);
  const population = Number(draft.genetic.populationSize);
  const enabledTypes = scenarioTypeOptions.filter((option) => draft.scenarioFlags[option.id]).map((option) => option.configKey);
  const types = enabledTypes;
  const targetNamespace = draft.clusterComponents.namespaces.find((namespace) => !namespace.disabled)?.name ?? 'robot-shop';
  const items = draft.fitnessItems.map((item) => ({ id: Number(item.id), query: item.query, type: item.type, weight: Number(item.weight) }));
  const rows: KrknAIScenarioIndexRow[] = [];
  const details: Record<string, KrknAIScenarioDetail> = {};
  const scenarioLogs: Record<string, string[]> = {};
  const addPendingScenario = (generation: number, scenarioId: string, scenarioType: string) => {
    const key = keyOf(generation, scenarioId);
    const phase = generation === 0 ? 'Running' : 'Pending';
    rows.push({ generation, scenarioId, scenarioType, outcome: phase, durationSeconds: null, fitnessScore: null, fitnessState: 'provisional', childRunName: `preview-ai-child-${name}-${generation}-${scenarioId}`, phase, jobId: `preview-ai-job-${name}-${generation}-${scenarioId}`, podName: `preview-ai-pod-${generation}-${scenarioId}` });
    details[key] = {
      generation, scenarioId, scenarioType, parameters: [{ name: 'namespace', value: targetNamespace }, ...draft.healthChecks.map((check) => ({ name: `health-check:${check.name}`, value: check.url }))], command: `Preview-only: run ${scenarioType}`, origin: 'preview', parentIds: [], durationSeconds: null, returnCode: null,
      fitnessResult: { fitnessScore: null, scores: items.map((item) => ({ id: item.id, rawScore: null, normalizedScore: null, query: item.query, queryType: item.type })), healthCheckFailureScore: null, healthCheckResponseTimeScore: null, krknFailureScore: null },
      healthChecks: [], logPath: `preview/${generation}/${scenarioId}.log`, fitnessState: 'provisional',
    };
  };
  if (draft.baselineEnabled) addPendingScenario(0, 'baseline', 'dummy-scenario');
  for (let index = 0; index < generations * population; index += 1) {
    const generation = Math.floor(index / population);
    addPendingScenario(generation, String(index), types[index % types.length]);
  }
  const createdAt = new Date().toISOString();
  const resource: KrknAIRunResource = { apiVersion: 'krkn.dev/v1alpha1', kind: 'KrknAIRun', metadata: { name, uid: `preview-ai-${name}`, creationTimestamp: createdAt }, spec: { targetRequestId: config.targetRequestId, targetClusters: clone(config.targetClusters), configMapName: config.fileName, configMapKey: config.fileName, orchestratorImage: 'quay.io/krkn-chaos/krkn:preview' }, status: { phase: 'Running', orchestratorPodName: `preview-ai-${name}-orchestrator`, startTime: createdAt, scenarioRunRefs: rows.map((row) => row.childRunName!) } };
  const summary: KrknAIRunSummary = { name, phase: 'Running', createdAt, cluster: Object.values(config.targetClusters).flat()[0] ?? 'preview-cluster', orchestratorPodName: resource.status.orchestratorPodName!, failureReason: '', artifactStatus: 'in_progress', currentGeneration: 0, completedGenerations: 0, completedScenarios: 0, configuredGenerations: draft.genetic.generations.trim() ? generations : null, populationSize: population, bestFitness: null, averageFitness: null, baselineFitness: null, fitnessProgression: [] };
  const orchestratorLogs = Array.from({ length: 32 }, (_, line) => `[preview] ${createdAt} ${name}: ${['Accepted saved configuration', `Prepared ${types.length} enabled scenario type(s)`, `Configured ${generations} generation(s) with population ${population}`, 'Waiting for next simulated progress checkpoint'][line % 4]}`);
  runs.set(name, { resource, summary, scenarios: rows, details, configYaml: config.configYaml, orchestratorLogs, scenarioLogs, startedAt: Date.now(), seeded: false, configuredGenerations: generations, populationSize: population, fitnessItems: items, healthChecks: draft.healthChecks.map((check) => ({ name: check.name, url: check.url, statusCode: Number(check.statusCode) })), scenarioTypes: types });
  return { status: 201, run: clone(resource) };
}
export function deletePreviewAiRun(name: string): boolean { return runs.delete(name); }
export function sortAndFilterPreviewScenarios(run: PreviewKrknAIRun, params: URLSearchParams): { scenarios: KrknAIScenarioIndexRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } } {
  let rows = [...run.scenarios];
  const generation = params.get('generation');
  if (generation !== null && generation !== '') rows = rows.filter((row) => row.generation === Number(generation));
  const type = params.get('scenarioType');
  if (type) rows = rows.filter((row) => row.scenarioType === type);
  const search = params.get('search')?.toLowerCase();
  if (search) rows = rows.filter((row) => [row.scenarioId, row.scenarioType, row.outcome].some((value) => value?.toLowerCase().includes(search)));
  const sortDirection = params.get('direction') === 'desc' ? -1 : 1;
  const sortValue = scenarioSortValue[params.get('sort') ?? 'generation'] ?? scenarioSortValue.generation;
  rows.sort((left, right) => {
    const a = sortValue(left); const b = sortValue(right);
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
    if (b === null || b === undefined) return -1;
    const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });
    return comparison * sortDirection || left.generation - right.generation || left.scenarioId.localeCompare(right.scenarioId, undefined, { numeric: true });
  });
  const requestedPage = Number(params.get('page'));
  const requestedLimit = Number(params.get('limit'));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.max(1, Math.floor(requestedLimit)) : 20;
  const total = rows.length;
  return { scenarios: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

buildState();
