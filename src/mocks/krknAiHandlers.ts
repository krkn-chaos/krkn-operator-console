import { http, HttpResponse } from 'msw';
import { config } from '../config';
import {
  createPreviewAiRun,
  deletePreviewAiRun,
  discoverPreviewConfig,
  getPreviewAiConfigFile,
  getPreviewAiRun,
  listPreviewAiConfigFiles,
  listPreviewAiRuns,
  savePreviewConfig,
  sortAndFilterPreviewScenarios,
  validatePreviewConfig,
} from './krknAiState';

const BASE = config.apiBaseUrl;
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}
function stringField(value: unknown): string { return typeof value === 'string' ? value : ''; }
function clustersField(value: unknown): Record<string, string[]> {
  const clusters: Record<string, string[]> = {};
  for (const [cluster, namespaces] of Object.entries(record(value))) {
    if (Array.isArray(namespaces) && namespaces.every((entry) => typeof entry === 'string')) clusters[cluster] = namespaces;
  }
  return clusters;
}
async function requestBody(request: Request): Promise<JsonRecord> {
  try { return record(await request.json()); } catch { return {}; }
}
function errorResponse(status: number, message: string, errors?: Array<{ path: string; message: string }>) {
  return HttpResponse.json({ message, ...(errors ? { errors } : {}) }, { status });
}

export const krknAiHandlers = [
  http.get(`${BASE}/krkn-ai/status`, () => HttpResponse.json({ enabled: true })),
  http.get(`${BASE}/krkn-ai/runs`, () => HttpResponse.json(listPreviewAiRuns().map((run) => run.resource))),
  http.post(`${BASE}/krkn-ai/discoveries`, async ({ request }) => {
    const body = await requestBody(request);
    const targetClusters = clustersField(body.targetClusters);
    const hasSelectedCluster = Object.values(targetClusters).some((clusters) => clusters.length > 0);
    if (!stringField(body.targetRequestId) || !hasSelectedCluster) {
      return errorResponse(422, 'A target request and at least one selected cluster are required.', [
        ...(!stringField(body.targetRequestId) ? [{ path: 'targetRequestId', message: 'Target request ID is required.' }] : []),
        ...(!hasSelectedCluster ? [{ path: 'targetClusters', message: 'Select at least one cluster.' }] : []),
      ]);
    }
    const discovery = discoverPreviewConfig(targetClusters, stringField(body.namespacePattern));
    if (discovery.error) return errorResponse(422, discovery.error, [{ path: 'namespacePattern', message: discovery.error }]);
    return HttpResponse.json({ configYaml: discovery.configYaml, warnings: discovery.warnings });
  }),
  http.post(`${BASE}/krkn-ai/configs/validate`, async ({ request }) => {
    const body = await requestBody(request);
    const errors = validatePreviewConfig(stringField(body.configYaml));
    if (errors.length) return errorResponse(422, 'Krkn-AI configuration validation failed.', errors);
    return HttpResponse.json({ valid: true });
  }),
  http.post(`${BASE}/krkn-ai/configs`, async ({ request }) => {
    const body = await requestBody(request);
    const result = savePreviewConfig({
      name: stringField(body.name), configYaml: stringField(body.configYaml), targetRequestId: stringField(body.targetRequestId), targetClusters: clustersField(body.targetClusters),
    });
    if ('errors' in result) return errorResponse(422, 'Krkn-AI configuration could not be saved.', result.errors);
    return HttpResponse.json({ configId: result.configId }, { status: 201 });
  }),
  http.post(`${BASE}/krkn-ai/runs`, async ({ request }) => {
    const body = await requestBody(request);
    const result = createPreviewAiRun({ name: stringField(body.name), configId: stringField(body.configId), targetRequestId: stringField(body.targetRequestId), targetClusters: clustersField(body.targetClusters) });
    if (!result.run) return errorResponse(result.status, result.message ?? 'Krkn-AI run could not be created.', result.errors);
    return HttpResponse.json(result.run, { status: result.status });
  }),
  http.get(`${BASE}/krkn-ai/runs/:name`, ({ params }) => {
    const run = getPreviewAiRun(String(params.name));
    return run ? HttpResponse.json(run.resource) : errorResponse(404, `Krkn-AI run ${String(params.name)} was not found.`);
  }),
  http.delete(`${BASE}/krkn-ai/runs/:name`, ({ params }) => {
    const name = String(params.name);
    return deletePreviewAiRun(name) ? new HttpResponse(null, { status: 204 }) : errorResponse(404, `Krkn-AI run ${name} was not found.`);
  }),
  http.get(`${BASE}/krkn-ai/runs/:name/results/summary`, ({ params }) => {
    const run = getPreviewAiRun(String(params.name));
    return run ? HttpResponse.json(run.summary) : errorResponse(404, `Krkn-AI run ${String(params.name)} was not found.`);
  }),
  http.get(`${BASE}/krkn-ai/runs/:name/results/scenarios`, ({ params, request }) => {
    const run = getPreviewAiRun(String(params.name));
    if (!run) return errorResponse(404, `Krkn-AI run ${String(params.name)} was not found.`);
    const result = sortAndFilterPreviewScenarios(run, new URL(request.url).searchParams);
    return HttpResponse.json(result);
  }),
  http.get(`${BASE}/krkn-ai/runs/:name/results/scenarios/:generation/:scenarioId`, ({ params }) => {
    const run = getPreviewAiRun(String(params.name));
    if (!run) return errorResponse(404, `Krkn-AI run ${String(params.name)} was not found.`);
    const key = `${String(params.generation)}:${String(params.scenarioId)}`;
    const detail = run.details[key];
    return detail ? HttpResponse.json(detail) : errorResponse(404, `Scenario ${key} was not found in run ${String(params.name)}.`);
  }),
  http.get(`${BASE}/files/available`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    if (query.get('filePurpose') !== 'krkn-ai-config') return undefined;
    return HttpResponse.json({ files: listPreviewAiConfigFiles() });
  }),
  http.get(`${BASE}/files/:fileId`, ({ params }) => {
    const file = getPreviewAiConfigFile(String(params.fileId));
    if (file) return HttpResponse.json(file);
    return String(params.fileId).startsWith('preview-ai-config-') ? errorResponse(404, 'Preview configuration file was not found.') : undefined;
  }),
];
