import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../handlers';
import { mockVisualizeDashboards, mockVisualizeInstance } from '../visualizeHandlers';

const server = setupServer(...handlers);

// visualizeHandlers resolves the mock Grafana origin without a window in
// node; tests must fetch that same origin for the frame handler to match.
const APP_ORIGIN = 'http://localhost:3000';

describe('visualize mock handlers', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists the mock krkn-visualize instance', async () => {
    const res = await fetch('http://localhost:3000/api/v1/visualize');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.instances).toEqual([mockVisualizeInstance]);
  });

  it('lists the Kubernetes dashboards for the mock instance', async () => {
    const res = await fetch(`http://localhost:3000/api/v1/visualize/${mockVisualizeInstance.name}/dashboards`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(mockVisualizeDashboards.length);
    const uids = body.dashboards.map((d: { uid: string }) => d.uid);
    expect(uids).toContain('k8s-perf');
    expect(uids).toContain('node-overview');
    // Dashboards carry the Grafana folder so the console picker can group them.
    const k8sPerf = body.dashboards.find((d: { uid: string }) => d.uid === 'k8s-perf');
    expect(k8sPerf.folderTitle).toBe('k8s');
    expect(k8sPerf.url).toMatch(/^\/d\/k8s-perf\//);
  });

  it('returns 404 for dashboards of an unknown instance', async () => {
    const res = await fetch('http://localhost:3000/api/v1/visualize/does-not-exist/dashboards');
    expect(res.status).toBe(404);
  });

  it('serves an HTML stand-in page for embedded dashboard frames', async () => {
    const res = await fetch(`${APP_ORIGIN}/d/k8s-perf/k8s-performance-dashboard?kiosk=1&scenes=1&orgId=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('k8s Performance dashboard');
    expect(html).toContain('krkn-visualize mock');
  });

  it('serves the stand-in page for unknown dashboard uids too', async () => {
    const res = await fetch(`${APP_ORIGIN}/d/unknown-uid/anything?kiosk=1`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Dashboard unknown-uid');
  });

  it('accepts install and delete requests', async () => {
    const created = await fetch('http://localhost:3000/api/v1/visualize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-instance', targetClusters: ['mock-cluster'], grafanaPassword: 'x' }),
    });
    expect(created.status).toBe(201);
    expect((await created.json()).name).toBe('new-instance');

    const deleted = await fetch(`http://localhost:3000/api/v1/visualize/${mockVisualizeInstance.name}`, {
      method: 'DELETE',
    });
    expect(deleted.status).toBe(200);
    expect((await deleted.json()).message).toContain('deletion started');
  });
});
