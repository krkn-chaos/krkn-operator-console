import { ws } from 'msw';

// Mock data for WebSocket updates (matches REST mock data shapes)
const mockScenarioRunUpdate = {
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
};

const mockGraphRunUpdate = {
  name: 'resilience-test-staging',
  namespace: 'krkn-operator-system',
  creationTimestamp: '2026-07-02T10:05:00Z',
  phase: 'Running',
  ownerUserId: 'admin@preview.local',
  targetRequestId: 'target-002',
  summary: { totalNodes: 3, completedNodes: 1, runningNodes: 1, failedNodes: 0, pendingNodes: 1 },
  startTime: '2026-07-02T10:05:00Z',
};

const mockDashboardUpdate = {
  totalActiveRuns: 2,
  totalActiveClusters: 2,
  totalClusters: 3,
  clusterRuns: {
    'staging-us-east-1': ['network-chaos-run-03'],
    'prod-us-central1': [],
    'staging-eu-west-1': [],
  },
};

// ws.link() handlers — each intercepts WebSocket connections to the matching URL pattern

const runsWs = ws.link('*/api/v2/ws/runs');
const graphrunsWs = ws.link('*/api/v2/ws/graphruns');
const dashboardWs = ws.link('*/api/v2/ws/dashboard/active-runs');
const logsWs = ws.link('*/api/v2/ws/scenarios/run/*/jobs/*/logs*');

const runsHandler = runsWs.addEventListener('connection', ({ client }) => {
  client.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.action === 'subscribe') {
        // Send an initial update after a short delay
        setTimeout(() => {
          client.send(JSON.stringify({
            resource: 'run',
            id: mockScenarioRunUpdate.scenarioRunName,
            event: 'updated',
            data: mockScenarioRunUpdate,
          }));
        }, 500);

        // Send periodic updates every 5 seconds
        const interval = setInterval(() => {
          client.send(JSON.stringify({
            resource: 'run',
            id: mockScenarioRunUpdate.scenarioRunName,
            event: 'updated',
            data: {
              ...mockScenarioRunUpdate,
              runningJobs: Math.random() > 0.5 ? 1 : 0,
              successfulJobs: Math.random() > 0.5 ? 1 : 0,
            },
          }));
        }, 5000);

        client.addEventListener('close', () => clearInterval(interval));
      }
    } catch {
      // ignore non-JSON messages
    }
  });
});

const graphrunsHandler = graphrunsWs.addEventListener('connection', ({ client }) => {
  client.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.action === 'subscribe') {
        setTimeout(() => {
          client.send(JSON.stringify({
            resource: 'graphrun',
            id: mockGraphRunUpdate.name,
            event: 'updated',
            data: mockGraphRunUpdate,
          }));
        }, 500);

        const interval = setInterval(() => {
          const completedNodes = Math.min(3, mockGraphRunUpdate.summary.completedNodes + Math.floor(Math.random() * 2));
          client.send(JSON.stringify({
            resource: 'graphrun',
            id: mockGraphRunUpdate.name,
            event: 'updated',
            data: {
              ...mockGraphRunUpdate,
              summary: {
                ...mockGraphRunUpdate.summary,
                completedNodes,
                runningNodes: Math.max(0, 3 - completedNodes),
              },
            },
          }));
        }, 5000);

        client.addEventListener('close', () => clearInterval(interval));
      }
    } catch {
      // ignore
    }
  });
});

const dashboardHandler = dashboardWs.addEventListener('connection', ({ client }) => {
  client.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.action === 'subscribe') {
        setTimeout(() => {
          client.send(JSON.stringify({
            resource: 'dashboard',
            id: 'active-runs',
            event: 'updated',
            data: mockDashboardUpdate,
          }));
        }, 500);

        const interval = setInterval(() => {
          client.send(JSON.stringify({
            resource: 'dashboard',
            id: 'active-runs',
            event: 'updated',
            data: {
              ...mockDashboardUpdate,
              totalActiveRuns: Math.floor(Math.random() * 4),
            },
          }));
        }, 5000);

        client.addEventListener('close', () => clearInterval(interval));
      }
    } catch {
      // ignore
    }
  });
});

const logsHandler = logsWs.addEventListener('connection', ({ client }) => {
  const mockLines = [
    'time="2026-07-02T10:10:01Z" level=info msg="Starting chaos scenario"',
    'time="2026-07-02T10:10:02Z" level=info msg="Connecting to target cluster staging-us-east-1"',
    'time="2026-07-02T10:10:03Z" level=info msg="Target pods identified: 3"',
    'time="2026-07-02T10:10:04Z" level=info msg="Injecting network latency: 200ms"',
    'time="2026-07-02T10:10:05Z" level=info msg="Monitoring pod health..."',
    '\x1b[32mtime="2026-07-02T10:10:10Z" level=info msg="All pods recovered successfully"\x1b[0m',
    'time="2026-07-02T10:10:11Z" level=info msg="Scenario complete"',
  ];

  let lineIndex = 0;
  const interval = setInterval(() => {
    if (lineIndex < mockLines.length) {
      client.send(mockLines[lineIndex]);
      lineIndex++;
    } else {
      clearInterval(interval);
    }
  }, 800);

  client.addEventListener('close', () => clearInterval(interval));
});

export const websocketHandlers = [runsHandler, graphrunsHandler, dashboardHandler, logsHandler];
