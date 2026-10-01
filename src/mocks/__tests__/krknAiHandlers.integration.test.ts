import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../handlers';
import { resetPreviewAiState } from '../krknAiState';

const server = setupServer(...handlers);
const base = 'http://localhost:3000/api/v1';
const request = (path: string, body?: unknown) => fetch(`${base}${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('Krkn-AI preview REST integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => resetPreviewAiState());
  afterEach(() => { vi.useRealTimers(); server.resetHandlers(); resetPreviewAiState(); });
  afterAll(() => server.close());

  it('creates a target-bound run and only publishes generation scores after its commit', async () => {
    vi.useFakeTimers();
    const target = { targetRequestId: 'mock-target-001', targetClusters: { 'krkn-operator': ['staging-us-east-1'] } };
    const discovery = await request('/krkn-ai/discoveries', { ...target, namespacePattern: '^robot-shop$' });
    expect(discovery.status).toBe(200);
    const { configYaml } = await discovery.json();
    expect((await request('/krkn-ai/configs/validate', { configYaml })).status).toBe(200);
    const saved = await request('/krkn-ai/configs', { ...target, name: 'http-preview-config', configYaml });
    expect(saved.status).toBe(201);
    const { configId } = await saved.json();
    const created = await request('/krkn-ai/runs', { ...target, name: 'http-preview-run', configId });
    expect(created.status).toBe(201);
    const { metadata } = await created.json();
    expect(metadata.name).toBe('http-preview-run');
    const before = await (await request('/krkn-ai/runs/http-preview-run/results/scenarios')).json();
    expect(before.scenarios.every((row: { fitnessScore: number | null }) => row.fitnessScore === null)).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    const first = await (await request('/krkn-ai/runs/http-preview-run/results/summary')).json();
    expect(first.completedGenerations).toBe(1);
    const index = await (await request('/krkn-ai/runs/http-preview-run/results/scenarios')).json();
    expect(index.scenarios.find((row: { generation: number; scenarioId: string }) => row.generation === 0 && row.scenarioId !== 'baseline').fitnessScore).not.toBeNull();
    expect(index.scenarios.find((row: { generation: number }) => row.generation === 1).fitnessScore).toBeNull();
    expect((await request('/krkn-ai/runs/unknown-preview-run')).status).toBe(404);
    const duplicate = await request('/krkn-ai/runs', { ...target, name: 'http-preview-run', configId });
    expect(duplicate.status).toBe(409);
  });

  it('serves ZIP bytes and keeps original preview file routes available', async () => {
    const archive = await request('/krkn-ai/runs/preview-ai-completed/results/download');
    expect(archive.headers.get('Content-Type')).toContain('application/zip');
    const bytes = new Uint8Array(await archive.arrayBuffer());
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const originalFile = await request('/files/file-001');
    expect((await originalFile.json()).fileName).toBe('kubeconfig-staging');
    const missingAIFile = await request('/files/preview-ai-config-missing');
    expect(missingAIFile.status).toBe(404);
    const children = await (await request('/scenarios/run?labelSelector=krkn.dev%2Fai-run%3Dpreview-ai-completed')).json();
    expect(children.scenarioRuns.every((row: { scenarioRunName: string }) => row.scenarioRunName.startsWith('preview-ai-child-preview-ai-completed-'))).toBe(true);
  });
});
