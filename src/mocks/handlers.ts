import { http, HttpResponse } from 'msw';
import { config } from '../config';

const BASE = config.apiBaseUrl;

const mockScenarioRuns = [
  {
    scenarioRunName: 'pod-disruption-run-01',
    scenarioName: 'pod-disruption',
    phase: 'Succeeded',
    totalTargets: 2,
    successfulJobs: 2,
    failedJobs: 0,
    runningJobs: 0,
    clusterJobs: [
      {
        providerName: 'aws',
        clusterName: 'staging-us-east-1',
        jobId: 'job-abc-001',
        podName: 'krkn-pod-disruption-abc',
        phase: 'Succeeded',
        startTime: '2026-07-02T10:00:00Z',
        completionTime: '2026-07-02T10:05:30Z',
        containerImage: 'quay.io/krkn-chaos/krkn-hub:latest',
      },
      {
        providerName: 'aws',
        clusterName: 'staging-eu-west-1',
        jobId: 'job-abc-002',
        podName: 'krkn-pod-disruption-def',
        phase: 'Succeeded',
        startTime: '2026-07-02T10:00:00Z',
        completionTime: '2026-07-02T10:04:45Z',
        containerImage: 'quay.io/krkn-chaos/krkn-hub:latest',
      },
    ],
    createdAt: '2026-07-02T10:00:00Z',
    ownerUserId: 'admin@preview.local',
    registryName: 'default',
  },
  {
    scenarioRunName: 'node-cpu-hog-run-02',
    scenarioName: 'node-cpu-hog',
    phase: 'Failed',
    totalTargets: 1,
    successfulJobs: 0,
    failedJobs: 1,
    runningJobs: 0,
    clusterJobs: [
      {
        providerName: 'gcp',
        clusterName: 'prod-us-central1',
        jobId: 'job-def-001',
        podName: 'krkn-node-cpu-hog-ghi',
        phase: 'Failed',
        startTime: '2026-07-02T09:30:00Z',
        completionTime: '2026-07-02T09:32:10Z',
        message: 'OOMKilled',
        containerImage: 'quay.io/krkn-chaos/krkn-hub:latest',
      },
    ],
    createdAt: '2026-07-02T09:30:00Z',
    ownerUserId: 'admin@preview.local',
    registryName: 'default',
  },
  {
    scenarioRunName: 'network-chaos-run-03',
    scenarioName: 'network-chaos',
    phase: 'Running',
    totalTargets: 1,
    successfulJobs: 0,
    failedJobs: 0,
    runningJobs: 1,
    clusterJobs: [
      {
        providerName: 'aws',
        clusterName: 'staging-us-east-1',
        jobId: 'job-ghi-001',
        podName: 'krkn-network-chaos-jkl',
        phase: 'Running',
        startTime: '2026-07-02T10:10:00Z',
        containerImage: 'quay.io/krkn-chaos/krkn-hub:latest',
      },
    ],
    createdAt: '2026-07-02T10:10:00Z',
    ownerUserId: 'admin@preview.local',
    registryName: 'default',
  },
];

const mockGraphRuns = [
  {
    name: 'chaos-workflow-daily',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T08:00:00Z',
    phase: 'Completed',
    ownerUserId: 'admin@preview.local',
    targetRequestId: 'target-001',
    summary: { totalNodes: 4, completedNodes: 4, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
    startTime: '2026-07-02T08:00:00Z',
    completionTime: '2026-07-02T08:25:00Z',
  },
  {
    name: 'resilience-test-staging',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T10:05:00Z',
    phase: 'Running',
    ownerUserId: 'admin@preview.local',
    targetRequestId: 'target-002',
    summary: { totalNodes: 3, completedNodes: 1, runningNodes: 1, failedNodes: 0, pendingNodes: 1 },
    startTime: '2026-07-02T10:05:00Z',
  },
];

const mockClusters = {
  targetData: {
    'krkn-operator': [
      { 'cluster-name': 'staging-us-east-1', 'cluster-api-url': 'https://api.staging-east.example.com:6443' },
      { 'cluster-name': 'staging-eu-west-1', 'cluster-api-url': 'https://api.staging-west.example.com:6443' },
      { 'cluster-name': 'prod-us-central1', 'cluster-api-url': 'https://api.prod.example.com:6443' },
    ],
  },
  status: 'ready',
};

const mockUsers = [
  { userId: 'admin@preview.local', name: 'Preview', surname: 'User', role: 'admin', organization: 'Krkn', active: true, created: '2026-06-01T00:00:00Z', lastLogin: '2026-07-08T10:00:00Z' },
  { userId: 'user1@preview.local', name: 'Alice', surname: 'Engineer', role: 'user', organization: 'Krkn', active: true, created: '2026-06-15T00:00:00Z', lastLogin: '2026-07-07T14:00:00Z' },
];

const mockGroups = [
  { name: 'chaos-engineers', description: 'Chaos engineering team', createdAt: '2026-06-01T00:00:00Z', memberCount: 2, clusterPermissions: { 'https://api.staging-east.example.com:6443': { actions: ['view', 'run', 'cancel'] } } },
  { name: 'platform-team', description: 'Platform engineering', createdAt: '2026-06-10T00:00:00Z', memberCount: 1, clusterPermissions: {} },
];

const mockRegistries = [
  { name: 'default', registryUrl: 'quay.io', scenarioRepository: 'krkn-chaos/krkn-hub', authType: 'anonymous', description: 'Default krkn scenario registry', skipTls: false, insecure: false, groups: [], availableToAll: true, createdAt: '2026-06-01T00:00:00Z' },
];

const mockProviders = [
  { name: 'aws', active: true, lastHeartbeat: '2026-07-08T10:00:00Z' },
  { name: 'gcp', active: true, lastHeartbeat: '2026-07-08T09:55:00Z' },
  { name: 'azure', active: false, lastHeartbeat: null },
];

const mockTargets = [
  { uuid: 'target-001', clusterName: 'staging-us-east-1', clusterAPIURL: 'https://api.staging-east.example.com:6443', secretType: 'kubeconfig', ready: true, createdAt: '2026-07-01T12:00:00Z', operatorSource: 'krkn-operator' },
  { uuid: 'target-002', clusterName: 'staging-eu-west-1', clusterAPIURL: 'https://api.staging-west.example.com:6443', secretType: 'kubeconfig', ready: true, createdAt: '2026-07-01T12:00:00Z', operatorSource: 'krkn-operator' },
  { uuid: 'target-003', clusterName: 'prod-us-central1', clusterAPIURL: 'https://api.prod.example.com:6443', secretType: 'token', ready: true, createdAt: '2026-06-30T08:00:00Z', operatorSource: 'krkn-operator' },
];

const mockScenarios = [
  { name: 'pod-disruption', description: 'Disrupts pods in target namespaces' },
  { name: 'node-cpu-hog', description: 'Stresses CPU on target nodes' },
  { name: 'network-chaos', description: 'Introduces network latency and packet loss' },
  { name: 'container-kill', description: 'Kills containers in target pods' },
  { name: 'time-skew', description: 'Skews system time on target nodes' },
];

const mockFiles = [
  { name: 'kubeconfig-staging', fileType: 'kubeconfig', content: 'apiVersion: v1\nclusters: []', createdAt: '2026-06-20T00:00:00Z', groups: ['chaos-engineers'] },
];

const mockFileTypes = [
  { name: 'kubeconfig', description: 'Kubernetes configuration file', extension: '.yaml', createdAt: '2026-06-01T00:00:00Z' },
  { name: 'env', description: 'Environment variables file', extension: '.env', createdAt: '2026-06-01T00:00:00Z' },
];

function b64(s: string) { return btoa(s); }

export const handlers = [
  // ─── AUTH ───
  http.get(`${BASE}/auth/is-registered`, () =>
    HttpResponse.json({ registered: true }),
  ),
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({
      token: 'mock-preview-jwt-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      userId: 'admin@preview.local',
      role: 'admin',
      name: 'Preview',
      surname: 'User',
      organization: 'Krkn',
    }),
  ),
  http.post(`${BASE}/auth/register`, () =>
    HttpResponse.json({ message: 'User registered successfully', userId: 'admin@preview.local', role: 'admin' }),
  ),

  // ─── TARGET CREATION & POLLING ───
  http.post(`${BASE}/targets`, () =>
    HttpResponse.json({ uuid: 'mock-target-001' }),
  ),
  http.get(`${BASE}/targets/:uuid`, () =>
    new HttpResponse(null, { status: 200 }),
  ),
  http.delete(`${BASE}/targets/:uuid`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── CLUSTERS ───
  http.get(`${BASE}/clusters`, () => HttpResponse.json(mockClusters)),
  http.get(`${BASE}/nodes`, () =>
    HttpResponse.json({ nodes: [
      { name: 'ip-10-0-1-100.ec2.internal', status: 'Ready', roles: 'worker', version: 'v1.28.4' },
      { name: 'ip-10-0-1-101.ec2.internal', status: 'Ready', roles: 'master', version: 'v1.28.4' },
    ]}),
  ),

  // ─── SCENARIOS ───
  http.post(`${BASE}/scenarios`, () =>
    HttpResponse.json({ scenarios: mockScenarios }),
  ),
  http.post(`${BASE}/scenarios/detail/:scenarioName`, ({ params }) =>
    HttpResponse.json({
      title: params.scenarioName,
      name: params.scenarioName,
      description: `Chaos scenario: ${params.scenarioName}`,
      digest: 'sha256:mock',
      fields: [
        { name: 'namespace', type: 'string', required: true, description: 'Target namespace', default: 'default' },
        { name: 'duration', type: 'integer', required: false, description: 'Duration in seconds', default: 60 },
        { name: 'label_selector', type: 'string', required: false, description: 'Pod label selector', default: '' },
      ],
    }),
  ),
  http.post(`${BASE}/scenarios/globals/:scenarioName`, () =>
    HttpResponse.json({
      fields: [
        { name: 'iterations', type: 'integer', required: false, description: 'Number of iterations', default: 1 },
        { name: 'daemon_mode', type: 'boolean', required: false, description: 'Run in daemon mode', default: false },
      ],
    }),
  ),

  // ─── SCENARIO RUNS ───
  http.get(`${BASE}/scenarios/run`, () =>
    HttpResponse.json({ scenarioRuns: mockScenarioRuns }),
  ),
  http.post(`${BASE}/scenarios/run`, () =>
    HttpResponse.json({
      scenarioRunName: 'preview-run-' + Date.now().toString(36),
      message: 'Scenario run created',
      targetClusters: ['staging-us-east-1'],
      totalTargets: 1,
    }),
  ),
  http.get(`${BASE}/scenarios/run/:scenarioRunName`, ({ params }) => {
    const run = mockScenarioRuns.find((r) => r.scenarioRunName === params.scenarioRunName);
    return run ? HttpResponse.json(run) : HttpResponse.json(mockScenarioRuns[0]);
  }),
  http.delete(`${BASE}/scenarios/run/:scenarioRunName`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
  http.delete(`${BASE}/scenarios/run/jobs/:jobId`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── GRAPH RUNS ───
  http.get(`${BASE}/graphruns`, () => HttpResponse.json(mockGraphRuns)),
  http.get(`${BASE}/graphruns/:name`, ({ params }) => {
    const run = mockGraphRuns.find((r) => r.name === params.name);
    return HttpResponse.json(run || mockGraphRuns[0]);
  }),
  http.post(`${BASE}/graphruns`, () =>
    HttpResponse.json({
      name: 'preview-graph-' + Date.now().toString(36),
      namespace: 'krkn-operator-system',
      phase: 'Pending',
      summary: { totalNodes: 0, completedNodes: 0, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
    }),
  ),
  http.delete(`${BASE}/graphruns/:name`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── DASHBOARD ───
  http.get(`${BASE}/dashboard/active-runs`, () =>
    HttpResponse.json({
      totalActiveRuns: 2,
      totalActiveClusters: 2,
      totalClusters: 3,
      clusterRuns: {
        'staging-us-east-1': ['network-chaos-run-03'],
        'prod-us-central1': [],
        'staging-eu-west-1': [],
      },
    }),
  ),

  // ─── OPERATOR TARGETS (CRUD) ───
  http.get(`${BASE}/operator/targets`, () =>
    HttpResponse.json({ targets: mockTargets }),
  ),
  http.get(`${BASE}/operator/targets/:uuid`, ({ params }) => {
    const t = mockTargets.find((x) => x.uuid === params.uuid);
    return HttpResponse.json(t || mockTargets[0]);
  }),
  http.post(`${BASE}/operator/targets`, () =>
    HttpResponse.json({ success: true, message: 'Target created' }),
  ),
  http.put(`${BASE}/operator/targets/:uuid`, () =>
    HttpResponse.json({ success: true, message: 'Target updated' }),
  ),
  http.delete(`${BASE}/operator/targets/:uuid`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── USERS (CRUD) ───
  http.get(`${BASE}/users`, () =>
    HttpResponse.json({ users: mockUsers }),
  ),
  http.get(`${BASE}/users/:userId`, ({ params }) => {
    const u = mockUsers.find((x) => x.userId === params.userId);
    return HttpResponse.json(u || mockUsers[0]);
  }),
  http.post(`${BASE}/users`, () =>
    HttpResponse.json({ success: true, message: 'User created' }),
  ),
  http.patch(`${BASE}/users/:userId/password`, () =>
    HttpResponse.json({ success: true, message: 'Password changed' }),
  ),
  http.patch(`${BASE}/users/:userId`, () =>
    HttpResponse.json({ success: true, message: 'User updated' }),
  ),
  http.delete(`${BASE}/users/:userId`, () =>
    HttpResponse.json({ success: true, message: 'User deleted' }),
  ),

  // ─── GROUPS (CRUD) ───
  http.get(`${BASE}/groups`, () =>
    HttpResponse.json({ groups: mockGroups }),
  ),
  http.get(`${BASE}/groups/:groupName/members`, () =>
    HttpResponse.json({
      members: [
        { userId: 'admin@preview.local', name: 'Preview', surname: 'User', role: 'admin', joinedAt: '2026-06-01T00:00:00Z' },
        { userId: 'user1@preview.local', name: 'Alice', surname: 'Engineer', role: 'user', joinedAt: '2026-06-15T00:00:00Z' },
      ],
    }),
  ),
  http.get(`${BASE}/groups/:groupName`, ({ params }) => {
    const g = mockGroups.find((x) => x.name === params.groupName);
    return HttpResponse.json(g || mockGroups[0]);
  }),
  http.post(`${BASE}/groups`, () =>
    HttpResponse.json({ success: true, message: 'Group created' }),
  ),
  http.patch(`${BASE}/groups/:groupName`, () =>
    HttpResponse.json({ success: true, message: 'Group updated' }),
  ),
  http.delete(`${BASE}/groups/:groupName`, () =>
    HttpResponse.json({ success: true, message: 'Group deleted' }),
  ),
  http.post(`${BASE}/groups/:groupName/members`, () =>
    HttpResponse.json({ success: true, message: 'Member added' }),
  ),
  http.delete(`${BASE}/groups/:groupName/members/:userId`, () =>
    HttpResponse.json({ success: true, message: 'Member removed' }),
  ),

  // ─── REGISTRIES (CRUD) ───
  http.get(`${BASE}/registries`, () =>
    HttpResponse.json({ registries: mockRegistries }),
  ),
  http.get(`${BASE}/registries/available`, () =>
    HttpResponse.json({
      registries: [
        { name: 'default', registryUrl: 'quay.io', scenarioRepository: 'krkn-chaos/krkn-hub', description: 'Default krkn scenario registry' },
      ],
    }),
  ),
  http.get(`${BASE}/registries/:name`, ({ params }) => {
    const r = mockRegistries.find((x) => x.name === params.name);
    return HttpResponse.json(r || mockRegistries[0]);
  }),
  http.post(`${BASE}/registries`, () =>
    HttpResponse.json({ success: true, message: 'Registry created' }),
  ),
  http.put(`${BASE}/registries/:name`, () =>
    HttpResponse.json({ success: true, message: 'Registry updated' }),
  ),
  http.delete(`${BASE}/registries/:name`, () =>
    HttpResponse.json({ success: true, message: 'Registry deleted' }),
  ),

  // ─── PROVIDERS ───
  http.get(`${BASE}/providers`, () =>
    HttpResponse.json({ providers: mockProviders }),
  ),
  http.patch(`${BASE}/providers/:name`, () =>
    HttpResponse.json({ success: true, message: 'Provider updated' }),
  ),
  http.post(`${BASE}/provider-config`, () =>
    HttpResponse.json({ uuid: 'mock-provider-config-001' }),
  ),
  http.get(`${BASE}/provider-config/:uuid`, () =>
    HttpResponse.json({
      uuid: 'mock-provider-config-001',
      status: 'Completed',
      config_data: {
        aws: {
          'config-schema': JSON.stringify((() => {
            const groups = [
              { name: 'ACM_SECRET_GROUP', short_description: 'ACM/OCM Secret Selection', description: 'Select secrets for direct API connection to managed clusters.', variable: 'ACM_SECRET_GROUP', type: 'group', required: 'false', secret: 'false' },
              { name: 'ACM_USE_PROXY_GROUP', short_description: 'Cluster Proxy Configuration', description: 'Enable cluster proxy connection for managed clusters. Activating proxy overrides the secret selection.', variable: 'ACM_USE_PROXY_GROUP', type: 'group', required: 'false', secret: 'false' },
            ];
            const clusterNames = [
              'local-cluster', ...Array.from({ length: 30 }, (_, i) => `managed-cluster-${i + 1}`)
            ];
            const secrets = clusterNames.map(c => {
              const varName = c.replace(/-/g, '_').toUpperCase();
              return { name: `ACM_SECRET_${varName}`, short_description: `Secret for ${c}`, description: `Select the secret for ${c} authentication.`, variable: `ACM_SECRET_${varName}`, default: 'application-manager', separator: ',', allowed_values: 'application-manager,klusterlet-addon-workmgr-log', mutually_excludes: `ACM_USE_PROXY_${varName}`, group: 'ACM_SECRET_GROUP', type: 'enum', required: true, secret: false };
            });
            const proxies = clusterNames.map((c, i) => {
              const varName = c.replace(/-/g, '_').toUpperCase();
              return { name: `ACM_USE_PROXY_${varName}`, short_description: `Proxy mode for ${c}`, description: `Enable cluster proxy for ${c} instead of direct API access.`, variable: `ACM_USE_PROXY_${varName}`, default: i % 3 === 0 ? 'true' : 'false', separator: ',', allowed_values: 'true,false', mutually_excludes: `ACM_SECRET_${varName}`, group: 'ACM_USE_PROXY_GROUP', type: 'enum', required: false, secret: false };
            });
            return [...groups, ...secrets, ...proxies];
          })()),
          'config-map': 'krkn-acm-config',
          namespace: 'krkn-operator-system',
        },
      },
    }),
  ),
  http.post(`${BASE}/provider-config/:uuid`, () =>
    HttpResponse.json({ success: true, message: 'Configuration saved' }),
  ),

  // ─── FILES (CRUD) ───
  http.get(`${BASE}/files/available`, () =>
    HttpResponse.json({ files: mockFiles }),
  ),
  http.get(`${BASE}/files`, () =>
    HttpResponse.json({ files: mockFiles }),
  ),
  http.get(`${BASE}/files/:name`, ({ params }) => {
    const f = mockFiles.find((x) => x.name === params.name);
    return HttpResponse.json(f || mockFiles[0]);
  }),
  http.post(`${BASE}/files`, () =>
    HttpResponse.json({ success: true, name: 'new-file', message: 'File created' }),
  ),
  http.put(`${BASE}/files/:name`, () =>
    HttpResponse.json({ success: true, message: 'File updated' }),
  ),
  http.delete(`${BASE}/files/:name`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── FILE TYPES (CRUD) ───
  http.get(`${BASE}/file-types`, () =>
    HttpResponse.json({ fileTypes: mockFileTypes }),
  ),
  http.get(`${BASE}/file-types/:name`, ({ params }) => {
    const ft = mockFileTypes.find((x) => x.name === params.name);
    return HttpResponse.json(ft || mockFileTypes[0]);
  }),
  http.post(`${BASE}/file-types`, () =>
    HttpResponse.json({ success: true, message: 'File type created' }),
  ),
  http.put(`${BASE}/file-types/:name`, () =>
    HttpResponse.json({ success: true, message: 'File type updated' }),
  ),
  http.delete(`${BASE}/file-types/:name`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── TERMINAL ───
  http.post(`${BASE}/terminal`, () =>
    HttpResponse.json({
      stdout_base64: b64('Preview mode: commands are simulated.\n$ oc get pods\nNAME                    READY   STATUS    RESTARTS   AGE\nkrkn-operator-0         1/1     Running   0          2d\n'),
      stderr_base64: b64(''),
      exit_code: 0,
    }),
  ),
  http.get(`${BASE}/terminal/available-commands`, () =>
    HttpResponse.json({
      commands: ['oc', 'kubectl', 'curl', 'cat', 'echo', 'grep'],
      blockedFlags: ['--kubeconfig', '--token', '--exec'],
    }),
  ),

  // ─── CATCH-ALL ───
  http.all(`${BASE}/*`, ({ request }) => {
    if (request.method === 'GET') return HttpResponse.json({});
    if (request.method === 'DELETE') return new HttpResponse(null, { status: 204 });
    return HttpResponse.json({ success: true });
  }),
];
