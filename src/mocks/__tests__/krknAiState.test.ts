import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDocument } from 'yaml';
import {
  createPreviewAiRun,
  deletePreviewAiRun,
  discoverPreviewConfig,
  getPreviewAiRun,
  listPreviewAiRuns,
  listPreviewAiChildren,
  resetPreviewAiState,
  savePreviewConfig,
  sortAndFilterPreviewScenarios,
  validatePreviewConfig,
} from '../krknAiState';

const targets = { 'preview-cluster': ['preview-cluster'] };

function savedFixture() {
  const discovery = discoverPreviewConfig(targets, 'robot-shop,shop');
  const result = savePreviewConfig({ name: 'preview-wizard', configYaml: discovery.configYaml, targetRequestId: 'preview-target', targetClusters: targets });
  if (!('configId' in result)) throw new Error('Expected the sanitized preview configuration to save.');
  return result;
}

describe('Krkn-AI preview state', () => {
  beforeEach(() => resetPreviewAiState());

  it('seeds truthful completed and running generations with usable logs', () => {
    const completed = getPreviewAiRun('preview-ai-completed');
    const active = getPreviewAiRun('preview-ai-running');
    expect(completed?.summary).toMatchObject({ phase: 'Succeeded', currentGeneration: null });
    const ordinary = completed!.scenarios.filter(row => row.scenarioId !== 'baseline');
    const scores = ordinary.map(row => row.fitnessScore!);
    expect(completed!.summary.completedScenarios).toBe(ordinary.length);
    expect(completed!.summary.bestFitness).toBe(Math.max(...scores));
    expect(completed!.summary.averageFitness).toBe(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    const children = listPreviewAiChildren();
    expect(new Set(children.map(child => child.run.scenarioRunName)).size).toBe(children.length);
    expect(completed?.orchestratorLogs.length).toBeGreaterThanOrEqual(200);
    expect(active?.summary.phase).toBe('Running');
    expect(active!.summary.completedGenerations).toBeLessThan(active!.summary.configuredGenerations!);
    const pending = active?.scenarios.find((scenario) => scenario.generation === 1 && active.details[`1:${scenario.scenarioId}`]);
    const pendingDetail = active?.details[`1:${pending?.scenarioId}`];
    expect(pending).toMatchObject({ fitnessScore: null, fitnessState: 'provisional' });
    expect(pendingDetail?.fitnessResult).toMatchObject({ fitnessScore: null, healthCheckFailureScore: null, healthCheckResponseTimeScore: null, krknFailureScore: null });
    expect(pendingDetail?.fitnessResult.scores[0]).toMatchObject({ normalizedScore: null, query: expect.any(String) });
  });

  it('discovers only pattern-matched namespaces and validates saved YAML values', () => {
    const discovery = discoverPreviewConfig(targets, 'robot-shop,shop');
    expect(discovery.error).toBeUndefined();
    const parsed = parseDocument(discovery.configYaml).toJS() as { cluster_components: { namespaces: Array<{ name: string }> }; fitness_function: { items: Array<{ query: string }> }; health_checks: { applications: Array<{ url: string }> } };
    expect(parsed.cluster_components.namespaces.map(({ name }) => name)).toEqual(['shop', 'robot-shop']);
    expect(parsed.fitness_function.items).toHaveLength(22);
    expect(parsed.health_checks.applications.every(({ url }) => url.endsWith('.example/health'))).toBe(true);
    expect(discoverPreviewConfig(targets, '[').error).toMatch(/regular expression/);
    expect(validatePreviewConfig(discovery.configYaml)).toEqual([]);
    expect(validatePreviewConfig('genetic: [')).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'configYaml' })]));
  });

  it('binds created runs to their saved config, progresses scores, filters results, and resets', () => {
    vi.useFakeTimers();
    try {
      const discovery = discoverPreviewConfig(targets, '^robot-shop$');
      const editedYaml = discovery.configYaml
        .split('namespace="robot-shop"').join('namespace="shop"')
        .replace('https://robot-shop.example/health', 'https://edited.example/health');
      const saved = savePreviewConfig({ name: 'edited-preview', configYaml: editedYaml, targetRequestId: 'preview-target', targetClusters: targets });
      if (!('configId' in saved)) throw new Error('Expected edited preview config to save.');
      const created = createPreviewAiRun({ name: 'edited-preview-run', configId: saved.configId, targetRequestId: 'preview-target', targetClusters: targets });
      expect(created).toMatchObject({ status: 201, run: { metadata: { name: 'edited-preview-run' }, spec: { configMapName: saved.fileName } } });
      const running = getPreviewAiRun('edited-preview-run');
      expect(running?.summary).toMatchObject({ phase: 'Running', currentGeneration: 0, completedGenerations: 0 });
      expect(running?.scenarios.every((row) => row.fitnessScore === null && row.fitnessState === 'provisional')).toBe(true);

      vi.advanceTimersByTime(5000);
      const firstCommit = getPreviewAiRun('edited-preview-run');
      expect(firstCommit?.summary).toMatchObject({ completedGenerations: 1, currentGeneration: 1 });
      const committedScores = firstCommit!.scenarios.filter((row) => row.generation === 0 && row.scenarioId !== 'baseline').map((row) => row.fitnessScore!);
      expect(firstCommit!.summary.bestFitness).toBe(Math.max(...committedScores));
      expect(firstCommit!.summary.completedScenarios).toBe(2);
      expect(Object.values(firstCommit?.details ?? {}).every((detail) => detail.fitnessResult.scores[0]?.query?.includes('namespace="shop"'))).toBe(true);
      expect(Object.values(firstCommit?.details ?? {}).some((detail) => detail.parameters instanceof Array && detail.parameters.some((parameter) => typeof parameter === 'object' && parameter !== null && 'value' in parameter && parameter.value === 'https://edited.example/health'))).toBe(true);
      expect(firstCommit?.scenarios.filter((row) => row.generation === 0 && row.scenarioId !== 'baseline').every((row) => row.fitnessState === 'final' && row.fitnessScore !== null)).toBe(true);
      expect(firstCommit?.scenarios.filter((row) => row.generation === 1).every((row) => row.fitnessScore === null)).toBe(true);
      const results = sortAndFilterPreviewScenarios(firstCommit!, new URLSearchParams('generation=0&search=pod-scenarios&page=1&limit=1&sort=scenarioId&direction=desc'));
      expect(results.pagination).toMatchObject({ page: 1, limit: 1, total: 1 });
      expect(results.scenarios).toHaveLength(1);

      vi.advanceTimersByTime(8000);
      expect(getPreviewAiRun('edited-preview-run')?.summary).toMatchObject({ phase: 'Succeeded', currentGeneration: null, completedGenerations: 2 });
      expect(deletePreviewAiRun('edited-preview-run')).toBe(true);
      expect(getPreviewAiRun('edited-preview-run')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
    resetPreviewAiState();
    expect(getPreviewAiRun('edited-preview-run')).toBeUndefined();
    expect(listPreviewAiRuns()).toHaveLength(2);
  });

  it('accepts duration-only budgets without adding a default generation count', () => {
    const discovery = discoverPreviewConfig(targets, '^robot-shop$');
    const document = parseDocument(discovery.configYaml);
    document.setIn(['genetic', 'generations'], null);
    document.setIn(['genetic', 'duration'], 20);
    const configYaml = document.toString();
    expect(validatePreviewConfig(configYaml)).toEqual([]);
    const saved = savePreviewConfig({ name: 'duration-preview', configYaml, targetRequestId: 'preview-target', targetClusters: targets });
    if (!('configId' in saved)) throw new Error('Duration configuration should save.');
    expect(createPreviewAiRun({ name: 'duration-preview', configId: saved.configId, targetRequestId: 'preview-target', targetClusters: targets }).status).toBe(201);
    expect(getPreviewAiRun('duration-preview')?.summary.configuredGenerations).toBeNull();
  });

  it('returns conflicts and target/config binding errors instead of creating misleading runs', () => {
    const saved = savedFixture();
    expect(createPreviewAiRun({ name: 'preview-ai-completed', configId: saved.configId, targetRequestId: 'preview-target', targetClusters: targets }).status).toBe(409);
    expect(createPreviewAiRun({ name: 'missing-config-run', configId: 'preview-ai-config-missing', targetRequestId: 'preview-target', targetClusters: targets }).status).toBe(404);
    expect(createPreviewAiRun({ name: 'bad-binding-run', configId: saved.configId, targetRequestId: 'wrong-target', targetClusters: targets })).toMatchObject({ status: 422, errors: [expect.objectContaining({ path: 'targetRequestId' })] });
  });
});
