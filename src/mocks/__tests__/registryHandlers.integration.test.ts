import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../handlers';

const server = setupServer(...handlers);
const base = 'http://localhost:3000/api/v1';
const request = (path: string, method?: string, body?: unknown) => fetch(`${base}${path}`, body === undefined ? undefined : {
  method: method ?? 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('registry tag preview REST integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('round-trips non-secret image tags through admin and available registry responses, including clears', async () => {
    const name = 'private-image-tags-roundtrip';
    const tags = {
      aiOrchestratorTag: 'orchestrator-v1',
      aiResultUploaderTag: 'uploader-v2',
      workloadImageTags: {
        hog: 'hog-v1',
        tools: 'tools-v2',
        synFlood: 'syn-flood-v3',
        networkChaos: 'network-chaos-v4',
      },
    };
    const created = await request('/registries', 'POST', {
      name,
      registryUrl: 'registry.example.test',
      scenarioRepository: 'team/scenarios',
      authType: 'token',
      ...tags,
    });
    expect(created.status).toBe(201);
    expect(await (await request(`/registries/${name}`)).json()).toMatchObject({ name, ...tags });

    const available = await (await request('/registries/available')).json();
    const summary = available.registries.find((registry: { name: string }) => registry.name === name);
    expect(summary).toMatchObject({ name, ...tags });
    expect(summary).not.toHaveProperty('password');
    expect(summary).not.toHaveProperty('username');

    const updated = await request(`/registries/${name}`, 'PUT', {
      aiOrchestratorTag: '',
      aiResultUploaderTag: '',
      workloadImageTags: {},
    });
    expect(updated.status).toBe(200);
    expect(await (await request(`/registries/${name}`)).json()).toMatchObject({
      aiOrchestratorTag: '',
      aiResultUploaderTag: '',
      workloadImageTags: {},
    });
  });
});
