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
  resiliencyScoreEnabled: true,
  resiliencyScores: [
    { clusterName: 'staging-us-east-1', score: 85.2 },
  ],
};

const mockJobsSnapshot = {
  jobs: [
    {
      type: 'scenarioRun',
      name: 'network-chaos-run-03',
      createdAt: '2026-07-02T10:10:00Z',
      scenarioRun: mockScenarioRunUpdate,
    },
    {
      type: 'scenarioRun',
      name: 'node-cpu-hog-run-02',
      createdAt: '2026-07-02T09:30:00Z',
      scenarioRun: {
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
            jobId: 'job-failed-001',
            podName: 'krkn-node-cpu-hog-ghi',
            phase: 'Failed',
            startTime: '2026-07-02T09:30:00Z',
            completionTime: '2026-07-02T09:32:10Z',
            message: 'OOMKilled: scenario container exited with status 137',
            containerImage: 'quay.io/krkn-chaos/krkn-hub:latest',
          },
        ],
        ownerUserId: 'admin@preview.local',
        registryName: 'default',
        resiliencyScoreEnabled: true,
        resiliencyScores: [{ clusterName: 'prod-us-central1', score: 62.1 }],
      },
    },
    {
      type: 'graphRun',
      name: 'chaos-workflow-daily',
      createdAt: '2026-07-02T08:00:00Z',
      graphRun: {
        name: 'chaos-workflow-daily',
        namespace: 'krkn-operator-system',
        creationTimestamp: '2026-07-02T08:00:00Z',
        phase: 'Completed',
        ownerUserId: 'admin@preview.local',
        targetRequestId: 'target-001',
        summary: { totalNodes: 4, completedNodes: 4, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
        startTime: '2026-07-02T08:00:00Z',
        completionTime: '2026-07-02T08:25:00Z',
        resiliencyScoreEnabled: true,
        resiliencyScoreBaseline: 80.0,
        resiliencyScores: [
          {
            clusterName: 'staging-us-east-1',
            calculated: 87.5,
            baseline: 80.0,
            status: 'pass',
            message: 'Score 87.5 meets baseline 80.0',
          },
          {
            clusterName: 'staging-eu-west-1',
            calculated: 82.0,
            baseline: 80.0,
            status: 'pass',
            message: 'Score 82.0 meets baseline 80.0',
          },
        ],
      },
    },
  ],
  pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
  stats: { totalJobs: 3, succeededJobs: 1, failedJobs: 1 },
};

const mockGraphRunUpdate = {
  name: 'resilience-test-staging',
  namespace: 'krkn-operator-system',
  creationTimestamp: '2026-07-02T10:05:00Z',
  phase: 'Completed',
  ownerUserId: 'admin@preview.local',
  targetRequestId: 'target-002',
  summary: { totalNodes: 3, completedNodes: 3, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
  startTime: '2026-07-02T10:05:00Z',
  completionTime: '2026-07-02T10:25:00Z',
  resiliencyScoreEnabled: true,
  resiliencyScoreBaseline: 90.0,
  resiliencyScores: undefined as undefined | object[],
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

export function getMockLogLines(jobId: string): string[] {
  if (jobId === 'job-failed-001') {
    return [
      'time="2026-07-02T09:30:01Z" level=info msg="Starting node CPU hog scenario"',
      'time="2026-07-02T09:30:02Z" level=info msg="Connecting to target cluster prod-us-central1"',
      'time="2026-07-02T09:30:03Z" level=info msg="Applying CPU stress to worker nodes"',
      'time="2026-07-02T09:32:10Z" level=error msg="Scenario container terminated: OOMKilled"',
      'time="2026-07-02T09:32:10Z" level=error msg="Process exited with status 137"',
    ];
  }

  return [
    'time="2026-07-02T10:10:01Z" level=info msg="Starting chaos scenario"',
    'time="2026-07-02T10:10:02Z" level=info msg="Connecting to target cluster staging-us-east-1"',
    'time="2026-07-02T10:10:03Z" level=info msg="Target pods identified: 3"',
    'time="2026-07-02T10:10:04Z" level=info msg="Injecting network latency: 200ms"',
    'time="2026-07-02T10:10:05Z" level=info msg="Monitoring pod health..."',
    '\x1b[32mtime="2026-07-02T10:10:10Z" level=info msg="All pods recovered successfully"\x1b[0m',
    'time="2026-07-02T10:10:11Z" level=info msg="Scenario complete"',
  ];
}

type RunsSubscription = 'jobs' | 'run' | 'run-detail';

export function createRunsMessage(
  resource: string,
  scenarioRun = mockScenarioRunUpdate,
  runId = scenarioRun.scenarioRunName,
) {
  if (resource === 'jobs') {
    return {
      resource: 'jobs',
      event: 'snapshot',
      data: mockJobsSnapshot,
      pagination: mockJobsSnapshot.pagination,
      stats: mockJobsSnapshot.stats,
    };
  }

  if (resource === 'run' || resource === 'run-detail') {
    return {
      resource,
      id: runId,
      event: 'updated',
      data: resource === 'run-detail' ? { ...scenarioRun, scenarioRunName: runId } : scenarioRun,
    };
  }

  return null;
}

const runsHandler = runsWs.addEventListener('connection', ({ client }) => {
  client.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.action === 'subscribe' && (['jobs', 'run', 'run-detail'] as RunsSubscription[]).includes(msg.resource)) {
        const sendUpdate = () => {
          const message = createRunsMessage(msg.resource, undefined, msg.ids?.[0]);
          if (message) client.send(JSON.stringify(message));
        };

        setTimeout(sendUpdate, 500);

        const interval = setInterval(() => {
          if (msg.resource === 'jobs') {
            sendUpdate();
            return;
          }

          sendUpdate();
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
          client.send(JSON.stringify({
            resource: 'graphrun',
            id: mockGraphRunUpdate.name,
            event: 'updated',
            data: {
              ...mockGraphRunUpdate,
               summary: mockGraphRunUpdate.summary,
               completionTime: mockGraphRunUpdate.completionTime,
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
  const isFailedJob = (client as unknown as { url?: string }).url?.includes('job-failed-001') === true;
  const mockLines = getMockLogLines(isFailedJob ? 'job-failed-001' : 'job-ghi-001');

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
