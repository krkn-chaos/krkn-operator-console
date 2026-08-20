import { http, HttpResponse } from 'msw';
import { config } from '../config';
import type { GrafanaDashboard, VisualizeConfig } from '../types/api';

const BASE = config.apiBaseUrl;

/**
 * Mock handlers for krkn-visualize (Grafana dashboards).
 *
 * Preview mode has no target cluster or Grafana, so these handlers stand in
 * for the operator's visualize API and for the embedded dashboard frames.
 * The mock instance's Grafana URL points at the console's own origin: the
 * service worker then also serves the `/d/:uid/:slug` frame requests, which
 * keeps the whole Visualize tab demoable offline.
 *
 * The dashboard catalog mirrors the Kubernetes-focused set installed by
 * krkn-visualize (the templates/k8s and templates/General dashboards from
 * krkn-chaos/visualize), with the Grafana folders the syncer creates.
 */

// In node handler tests there is no window; use the origin those tests fetch.
const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

/** The single mock krkn-visualize instance shown in the console. */
export const mockVisualizeInstance: VisualizeConfig = {
  name: 'mock-visualize',
  targetCluster: 'mock-cluster',
  namespace: 'krkn-visualize',
  status: 'Ready',
  grafanaUrl: APP_ORIGIN,
  createdAt: '2026-11-01T12:00:00Z',
  createdBy: 'preview',
};

/** Kubernetes-focused dashboards, matching the upstream krkn-visualize catalog. */
export const mockVisualizeDashboards: GrafanaDashboard[] = [
  {
    uid: 'k8s-perf',
    title: 'k8s Performance dashboard',
    url: '/d/k8s-perf/k8s-performance-dashboard',
    folderTitle: 'k8s',
    type: 'dash-db',
  },
  {
    uid: 'networking-dashboard',
    title: 'Networking',
    url: '/d/networking-dashboard/networking',
    folderTitle: 'k8s',
    type: 'dash-db',
  },
  {
    uid: 'node-overview',
    title: 'Node Overview',
    url: '/d/node-overview/node-overview',
    folderTitle: 'General',
    type: 'dash-db',
  },
  {
    uid: 'pod-perf',
    title: 'Pod Performance',
    url: '/d/pod-perf/pod-performance',
    folderTitle: 'General',
    type: 'dash-db',
  },
  {
    uid: 'ocp-performance',
    title: 'Openshift Performance',
    url: '/d/ocp-performance/openshift-performance',
    folderTitle: 'General',
    type: 'dash-db',
  },
  {
    uid: 'pvc-utilization',
    title: 'PVC Utilization',
    url: '/d/pvc-utilization/pvc-utilization',
    folderTitle: 'General',
    type: 'dash-db',
  },
  {
    uid: 'service-health',
    title: 'OpenShift Service Health',
    url: '/d/service-health/openshift-service-health',
    folderTitle: 'General',
    type: 'dash-db',
  },
  {
    uid: 'etcd-on-cluster-dashboard',
    title: 'etcd-cluster-info dashboard',
    url: '/d/etcd-on-cluster-dashboard/etcd-cluster-info-dashboard',
    folderTitle: 'General',
    type: 'dash-db',
  },
  {
    uid: 'kubevirt-perf',
    title: 'KubeVirt Performance',
    url: '/d/kubevirt-perf/kubevirt-performance',
    folderTitle: 'General',
    type: 'dash-db',
  },
  {
    uid: 'ovn-dashboard',
    title: 'OVN-Monitoring-dashboard',
    url: '/d/ovn-dashboard/ovn-monitoring-dashboard',
    folderTitle: 'General',
    type: 'dash-db',
  },
  {
    uid: 'api-performance-overview',
    title: 'API Performance Dashboard',
    url: '/d/api-performance-overview/api-performance-dashboard',
    folderTitle: 'General',
    type: 'dash-db',
  },
];

const mockLogs = [
  '=== krkn-visualize Deployment Status ===',
  '',
  'Instance: mock-visualize',
  'Target Cluster: mock-cluster',
  'Namespace: krkn-visualize',
  'Status: Ready',
  '',
  '=== Grafana Resources ===',
  '',
  '✓ Deployment: 1/1 replicas ready',
  '✓ Service: 10.0.0.1 (ClusterIP)',
  '✓ Route: mock-visualize.apps.mock-cluster.example.com',
  '',
  '=== Access Grafana ===',
  '',
  'URL: http://mock-visualize.apps.mock-cluster.example.com',
  'Username: admin',
  'Password: <configured-password>',
].join('\n');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the stand-in page served for embedded dashboard frames. It mimics
 * a Grafana dashboard in kiosk mode — dark theme, a toolbar with the time
 * range picker and variable chips, and a grid of placeholder panels — so the
 * Visualize tab's embedding flow can be reviewed without a real Grafana.
 */
function renderMockDashboardPage(dashboard: GrafanaDashboard | undefined, uid: string): string {
  const title = dashboard?.title ?? `Dashboard ${uid}`;
  const folder = dashboard?.folderTitle ?? 'General';

  const panels = [
    { title: 'CPU Utilization', bars: [35, 48, 42, 60, 55, 72, 66, 80] },
    { title: 'Memory Usage', bars: [50, 46, 58, 54, 62, 60, 71, 68] },
    { title: 'Pod Restarts', bars: [12, 8, 14, 6, 9, 11, 5, 7] },
    { title: 'Network Throughput', bars: [40, 55, 48, 63, 70, 58, 75, 82] },
    { title: 'Disk I/O', bars: [25, 30, 28, 38, 33, 42, 36, 45] },
    { title: 'Node Readiness', bars: [90, 90, 88, 90, 90, 92, 90, 90] },
  ]
    .map(
      (panel) => `
        <div class="panel">
          <div class="panel-title">${escapeHtml(panel.title)}</div>
          <div class="panel-body">
            ${panel.bars.map((h) => `<div class="bar" style="height:${h}%"></div>`).join('')}
          </div>
        </div>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; font-family: Inter, system-ui, sans-serif; background: #111217; color: #d8d8da;
  }
  .toolbar {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
    padding: 8px 16px; background: #181b1f; border-bottom: 1px solid #2c3235;
  }
  .title { font-weight: 600; }
  .badge {
    margin-left: 8px; padding: 1px 8px; border-radius: 999px; font-size: 12px;
    background: #2c4a63; color: #9ecbff;
  }
  .controls { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .chip {
    padding: 2px 10px; border: 1px solid #3c4246; border-radius: 4px; background: #22252a;
  }
  .variables { display: flex; gap: 8px; flex-wrap: wrap; padding: 8px 16px; font-size: 13px; }
  .var { padding: 2px 10px; border: 1px solid #3c4246; border-radius: 4px; background: #1b1e23; }
  .var b { color: #fff; font-weight: 600; }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px; padding: 16px;
  }
  .panel { background: #181b1f; border: 1px solid #2c3235; border-radius: 4px; }
  .panel-title { padding: 8px 12px 0; font-size: 13px; color: #b6b6b9; }
  .panel-body {
    display: flex; align-items: flex-end; gap: 6px; height: 120px; padding: 12px;
  }
  .bar { flex: 1; background: linear-gradient(180deg, #6cb6ff 0%, #3d7dc8 100%); border-radius: 2px 2px 0 0; }
  .note { padding: 0 16px 16px; font-size: 12px; color: #7b7b80; }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="title">${escapeHtml(title)}<span class="badge">krkn-visualize mock</span></span>
    <span class="controls">
      <span class="chip">Last 1 hour</span>
      <span class="chip">Refresh: 30s</span>
    </span>
  </div>
  <div class="variables">
    <span class="var">Datasource: <b>Cluster Prometheus</b></span>
    <span class="var">cluster: <b>mock-cluster</b></span>
    <span class="var">folder: <b>${escapeHtml(folder)}</b></span>
  </div>
  <div class="grid">${panels}</div>
  <div class="note">Placeholder panels served by the console preview mocks — no live Grafana behind this frame.</div>
</body>
</html>`;
}

export const visualizeHandlers = [
  // List instances
  http.get(`${BASE}/visualize`, () =>
    HttpResponse.json({
      instances: [mockVisualizeInstance],
      total: 1,
    })
  ),

  // Get a specific instance
  http.get(`${BASE}/visualize/:name`, ({ params }) => {
    if (params.name !== mockVisualizeInstance.name) {
      return HttpResponse.json({ error: 'not_found', message: 'Instance not found' }, { status: 404 });
    }
    return HttpResponse.json(mockVisualizeInstance);
  }),

  // Instance status
  http.get(`${BASE}/visualize/:name/status`, ({ params }) => {
    if (params.name !== mockVisualizeInstance.name) {
      return HttpResponse.json({ error: 'not_found', message: 'Instance not found' }, { status: 404 });
    }
    return HttpResponse.json({
      status: mockVisualizeInstance.status,
      grafanaUrl: mockVisualizeInstance.grafanaUrl,
    });
  }),

  // Dashboards installed in the instance's Grafana
  http.get(`${BASE}/visualize/:name/dashboards`, ({ params }) => {
    if (params.name !== mockVisualizeInstance.name) {
      return HttpResponse.json({ error: 'not_found', message: 'Instance not found' }, { status: 404 });
    }
    return HttpResponse.json({
      dashboards: mockVisualizeDashboards,
      total: mockVisualizeDashboards.length,
    });
  }),

  // Installation logs
  http.get(`${BASE}/visualize/:name/logs`, ({ params }) => {
    if (params.name !== mockVisualizeInstance.name) {
      return HttpResponse.json({ error: 'not_found', message: 'Instance not found' }, { status: 404 });
    }
    return HttpResponse.json({ logs: mockLogs, status: mockVisualizeInstance.status });
  }),

  // Install a new instance (accepted; the mock stays with the single instance)
  http.post(`${BASE}/visualize`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    return HttpResponse.json(
      {
        message: 'krkn-visualize installation started',
        name: body?.name ?? 'mock-visualize',
      },
      { status: 201 }
    );
  }),

  // Delete an instance
  http.delete(`${BASE}/visualize/:name`, ({ params }) =>
    HttpResponse.json({
      message: `krkn-visualize instance '${String(params.name)}' deletion started`,
    })
  ),

  // Embedded dashboard frame. The Visualize page iframes
  // `${grafanaUrl}${dashboard.url}?kiosk=1&scenes=1&orgId=1`; because the mock
  // Grafana URL is the console origin, the service worker serves the frame.
  http.get(`${APP_ORIGIN}/d/:uid/:slug`, ({ params }) =>
    new HttpResponse(
      renderMockDashboardPage(
        mockVisualizeDashboards.find((d) => d.uid === params.uid),
        String(params.uid)
      ),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  ),
];
