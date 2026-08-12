import { http, HttpResponse } from 'msw';
import { config } from '../config';

const BASE = config.apiBaseUrl;

// ─── SCENARIO RUNS ───

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

// ─── GRAPH RUNS (list view — GraphRunState) ───

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
    resiliencyScoreEnabled: true,
    resiliencyScoreBaseline: 80.0,
    resiliencyScores: [
      {
        clusterName: 'staging-us-east-1',
        calculated: 87.5,
        baseline: 80.0,
        status: 'pass',
        message: 'Score 87.5 meets baseline 80.0',
        nodeContributions: { 'pod-kill': 95.0, 'net-chaos': 72.3, 'cpu-hog': 88.1, 'time-skew': 94.5 },
      },
    ],
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
    resiliencyScoreEnabled: true,
    resiliencyScoreBaseline: 90.0,
    resiliencyScores: [
      { clusterName: 'staging-eu-west-1', calculated: -1, baseline: 90.0, status: 'pass', message: '' },
    ],
  },
  {
    name: 'multi-cluster-resilience',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T11:00:00Z',
    phase: 'Completed',
    ownerUserId: 'admin@preview.local',
    targetRequestId: 'target-003',
    summary: { totalNodes: 2, completedNodes: 2, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
    startTime: '2026-07-02T11:00:00Z',
    completionTime: '2026-07-02T11:20:00Z',
    resiliencyScoreEnabled: true,
    resiliencyScoreBaseline: 85.0,
    resiliencyScores: [
      { clusterName: 'staging-us-east-1', calculated: 91.2, baseline: 85.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'pod-kill-mc': 93.0, 'net-chaos-mc': 89.4 } },
      { clusterName: 'staging-eu-west-1', calculated: 78.5, baseline: 85.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'pod-kill-mc': 85.0, 'net-chaos-mc': 72.0 } },
    ],
  },
  {
    name: 'large-fleet-resilience',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T12:00:00Z',
    phase: 'Completed',
    ownerUserId: 'admin@preview.local',
    targetRequestId: 'target-003',
    summary: { totalNodes: 3, completedNodes: 3, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
    startTime: '2026-07-02T12:00:00Z',
    completionTime: '2026-07-02T12:30:00Z',
    resiliencyScoreEnabled: true,
    resiliencyScoreBaseline: 80.0,
    resiliencyScores: [
      { clusterName: 'prod-us-east-1', calculated: 95.2, baseline: 80.0, status: 'pass', message: 'Excellent', nodeContributions: { 'pod-kill-lg': 97.0, 'net-chaos-lg': 93.0, 'cpu-hog-lg': 95.5 } },
      { clusterName: 'prod-us-west-2', calculated: 88.1, baseline: 80.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'pod-kill-lg': 91.0, 'net-chaos-lg': 85.0, 'cpu-hog-lg': 88.2 } },
      { clusterName: 'prod-eu-central-1', calculated: 72.4, baseline: 80.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'pod-kill-lg': 78.0, 'net-chaos-lg': 65.0, 'cpu-hog-lg': 74.2 } },
      { clusterName: 'prod-eu-west-1', calculated: 91.0, baseline: 80.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'pod-kill-lg': 94.0, 'net-chaos-lg': 88.0, 'cpu-hog-lg': 91.0 } },
      { clusterName: 'prod-ap-southeast-1', calculated: 66.3, baseline: 80.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'pod-kill-lg': 72.0, 'net-chaos-lg': 58.0, 'cpu-hog-lg': 69.0 } },
      { clusterName: 'prod-ap-northeast-1', calculated: 84.7, baseline: 80.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'pod-kill-lg': 88.0, 'net-chaos-lg': 80.0, 'cpu-hog-lg': 86.0 } },
      { clusterName: 'staging-us-east-1', calculated: 78.9, baseline: 80.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'pod-kill-lg': 82.0, 'net-chaos-lg': 74.0, 'cpu-hog-lg': 80.8 } },
      { clusterName: 'staging-eu-west-1', calculated: 93.5, baseline: 80.0, status: 'pass', message: 'Excellent', nodeContributions: { 'pod-kill-lg': 96.0, 'net-chaos-lg': 91.0, 'cpu-hog-lg': 93.5 } },
    ],
  },
];

// ─── GRAPH RUNS (detail view — GraphRunDetail with spec/status) ───

const mockGraphRunDetails: Record<string, object> = {
  'chaos-workflow-daily': {
    name: 'chaos-workflow-daily',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T08:00:00Z',
    spec: {
      graph: {
        'pod-kill': { name: 'pod-kill', image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios' },
        'net-chaos': { name: 'net-chaos', image: 'quay.io/krkn-chaos/krkn-hub:network-chaos', depends_on: 'pod-kill' },
        'cpu-hog': { name: 'cpu-hog', image: 'quay.io/krkn-chaos/krkn-hub:cpu-hog', depends_on: 'pod-kill' },
        'time-skew': { name: 'time-skew', image: 'quay.io/krkn-chaos/krkn-hub:time-skew', depends_on: 'net-chaos' },
      },
      targetRequestId: 'target-001',
      targetClusters: { 'krkn-operator': ['staging-us-east-1'] },
      ownerUserId: 'admin@preview.local',
      resiliencyScoreEnabled: true,
      resiliencyMountPath: '/etc/krkn/metrics.yaml',
      resiliencyScoreBaseline: 80.0,
    },
    status: {
      phase: 'Completed',
      summary: { totalNodes: 4, completedNodes: 4, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
      nodeStatuses: [
        { nodeId: 'pod-kill', nodeName: 'pod-kill', phase: 'Completed', scenarioRunRef: 'sr-pod-kill-001', startTime: '2026-07-02T08:00:00Z', completionTime: '2026-07-02T08:05:00Z', resiliencyScores: [{ clusterName: 'staging-us-east-1', score: 95.0 }], resiliencyScoreAvg: 95.0 },
        { nodeId: 'net-chaos', nodeName: 'net-chaos', phase: 'Completed', scenarioRunRef: 'sr-net-chaos-001', startTime: '2026-07-02T08:05:00Z', completionTime: '2026-07-02T08:12:00Z', dependsOn: ['pod-kill'], resiliencyScores: [{ clusterName: 'staging-us-east-1', score: 72.3 }], resiliencyScoreAvg: 72.3 },
        { nodeId: 'cpu-hog', nodeName: 'cpu-hog', phase: 'Completed', scenarioRunRef: 'sr-cpu-hog-001', startTime: '2026-07-02T08:05:00Z', completionTime: '2026-07-02T08:18:00Z', dependsOn: ['pod-kill'], resiliencyScores: [{ clusterName: 'staging-us-east-1', score: 88.1 }], resiliencyScoreAvg: 88.1 },
        { nodeId: 'time-skew', nodeName: 'time-skew', phase: 'Completed', scenarioRunRef: 'sr-time-skew-001', startTime: '2026-07-02T08:12:00Z', completionTime: '2026-07-02T08:25:00Z', dependsOn: ['net-chaos'], resiliencyScores: [{ clusterName: 'staging-us-east-1', score: 94.5 }], resiliencyScoreAvg: 94.5 },
      ],
      resolvedLevels: [['pod-kill'], ['net-chaos', 'cpu-hog'], ['time-skew']],
      startTime: '2026-07-02T08:00:00Z',
      completionTime: '2026-07-02T08:25:00Z',
      resiliencyScores: [{ clusterName: 'staging-us-east-1', calculated: 87.5, baseline: 80.0, status: 'pass', message: 'Score 87.5 meets baseline 80.0', nodeContributions: { 'pod-kill': 95.0, 'net-chaos': 72.3, 'cpu-hog': 88.1, 'time-skew': 94.5 } }],
    },
  },
  'resilience-test-staging': {
    name: 'resilience-test-staging',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T10:05:00Z',
    spec: {
      graph: {
        'node-drain': { name: 'node-drain', image: 'quay.io/krkn-chaos/krkn-hub:node-scenarios' },
        'pod-delete': { name: 'pod-delete', image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios', depends_on: 'node-drain' },
        'io-stress': { name: 'io-stress', image: 'quay.io/krkn-chaos/krkn-hub:io-hog', depends_on: 'node-drain' },
      },
      targetRequestId: 'target-002',
      targetClusters: { 'krkn-operator': ['staging-eu-west-1'] },
      ownerUserId: 'admin@preview.local',
      resiliencyScoreEnabled: true,
      resiliencyMountPath: '/etc/krkn/metrics.yaml',
      resiliencyScoreBaseline: 90.0,
    },
    status: {
      phase: 'Running',
      summary: { totalNodes: 3, completedNodes: 1, runningNodes: 1, failedNodes: 0, pendingNodes: 1 },
      nodeStatuses: [
        { nodeId: 'node-drain', nodeName: 'node-drain', phase: 'Completed', scenarioRunRef: 'sr-node-drain-001', startTime: '2026-07-02T10:05:00Z', completionTime: '2026-07-02T10:15:00Z', resiliencyScores: [{ clusterName: 'staging-eu-west-1', score: 82.0 }], resiliencyScoreAvg: 82.0 },
        { nodeId: 'pod-delete', nodeName: 'pod-delete', phase: 'Running', scenarioRunRef: 'sr-pod-delete-001', startTime: '2026-07-02T10:15:00Z', dependsOn: ['node-drain'] },
        { nodeId: 'io-stress', nodeName: 'io-stress', phase: 'Pending', dependsOn: ['node-drain'] },
      ],
      resolvedLevels: [['node-drain'], ['pod-delete', 'io-stress']],
      startTime: '2026-07-02T10:05:00Z',
      resiliencyScores: [
        { clusterName: 'staging-eu-west-1', calculated: -1, baseline: 90.0, status: 'pass', message: '' },
      ],
    },
  },
  'large-fleet-resilience': {
    name: 'large-fleet-resilience',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T12:00:00Z',
    spec: {
      graph: {
        'pod-kill-lg': { name: 'pod-kill', image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios' },
        'net-chaos-lg': { name: 'net-chaos', image: 'quay.io/krkn-chaos/krkn-hub:network-chaos', depends_on: 'pod-kill-lg' },
        'cpu-hog-lg': { name: 'cpu-hog', image: 'quay.io/krkn-chaos/krkn-hub:cpu-hog', depends_on: 'pod-kill-lg' },
      },
      targetRequestId: 'target-003',
      targetClusters: { 'krkn-operator': ['prod-us-east-1', 'prod-us-west-2', 'prod-eu-central-1', 'prod-eu-west-1', 'prod-ap-southeast-1', 'prod-ap-northeast-1', 'staging-us-east-1', 'staging-eu-west-1'] },
      ownerUserId: 'admin@preview.local',
      resiliencyScoreEnabled: true,
      resiliencyMountPath: '/etc/krkn/metrics.yaml',
      resiliencyScoreBaseline: 80.0,
    },
    status: {
      phase: 'Completed',
      summary: { totalNodes: 3, completedNodes: 3, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
      nodeStatuses: [
        { nodeId: 'pod-kill-lg', nodeName: 'pod-kill', phase: 'Completed', scenarioRunRef: 'sr-pod-kill-lg-001', startTime: '2026-07-02T12:00:00Z', completionTime: '2026-07-02T12:08:00Z', resiliencyScores: [{ clusterName: 'prod-us-east-1', score: 97.0 }, { clusterName: 'prod-us-west-2', score: 91.0 }, { clusterName: 'prod-eu-central-1', score: 78.0 }, { clusterName: 'prod-eu-west-1', score: 94.0 }, { clusterName: 'prod-ap-southeast-1', score: 72.0 }, { clusterName: 'prod-ap-northeast-1', score: 88.0 }, { clusterName: 'staging-us-east-1', score: 82.0 }, { clusterName: 'staging-eu-west-1', score: 96.0 }], resiliencyScoreAvg: 87.3 },
        { nodeId: 'net-chaos-lg', nodeName: 'net-chaos', phase: 'Completed', scenarioRunRef: 'sr-net-chaos-lg-001', startTime: '2026-07-02T12:08:00Z', completionTime: '2026-07-02T12:20:00Z', dependsOn: ['pod-kill-lg'], resiliencyScores: [{ clusterName: 'prod-us-east-1', score: 93.0 }, { clusterName: 'prod-us-west-2', score: 85.0 }, { clusterName: 'prod-eu-central-1', score: 65.0 }, { clusterName: 'prod-eu-west-1', score: 88.0 }, { clusterName: 'prod-ap-southeast-1', score: 58.0 }, { clusterName: 'prod-ap-northeast-1', score: 80.0 }, { clusterName: 'staging-us-east-1', score: 74.0 }, { clusterName: 'staging-eu-west-1', score: 91.0 }], resiliencyScoreAvg: 79.3 },
        { nodeId: 'cpu-hog-lg', nodeName: 'cpu-hog', phase: 'Completed', scenarioRunRef: 'sr-cpu-hog-lg-001', startTime: '2026-07-02T12:08:00Z', completionTime: '2026-07-02T12:25:00Z', dependsOn: ['pod-kill-lg'], resiliencyScores: [{ clusterName: 'prod-us-east-1', score: 95.5 }, { clusterName: 'prod-us-west-2', score: 88.2 }, { clusterName: 'prod-eu-central-1', score: 74.2 }, { clusterName: 'prod-eu-west-1', score: 91.0 }, { clusterName: 'prod-ap-southeast-1', score: 69.0 }, { clusterName: 'prod-ap-northeast-1', score: 86.0 }, { clusterName: 'staging-us-east-1', score: 80.8 }, { clusterName: 'staging-eu-west-1', score: 93.5 }], resiliencyScoreAvg: 84.8 },
      ],
      resolvedLevels: [['pod-kill-lg'], ['net-chaos-lg', 'cpu-hog-lg']],
      startTime: '2026-07-02T12:00:00Z',
      completionTime: '2026-07-02T12:30:00Z',
      resiliencyScores: [
        { clusterName: 'prod-us-east-1', calculated: 95.2, baseline: 80.0, status: 'pass', message: 'Excellent', nodeContributions: { 'pod-kill-lg': 97.0, 'net-chaos-lg': 93.0, 'cpu-hog-lg': 95.5 } },
        { clusterName: 'prod-us-west-2', calculated: 88.1, baseline: 80.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'pod-kill-lg': 91.0, 'net-chaos-lg': 85.0, 'cpu-hog-lg': 88.2 } },
        { clusterName: 'prod-eu-central-1', calculated: 72.4, baseline: 80.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'pod-kill-lg': 78.0, 'net-chaos-lg': 65.0, 'cpu-hog-lg': 74.2 } },
        { clusterName: 'prod-eu-west-1', calculated: 91.0, baseline: 80.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'pod-kill-lg': 94.0, 'net-chaos-lg': 88.0, 'cpu-hog-lg': 91.0 } },
        { clusterName: 'prod-ap-southeast-1', calculated: 66.3, baseline: 80.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'pod-kill-lg': 72.0, 'net-chaos-lg': 58.0, 'cpu-hog-lg': 69.0 } },
        { clusterName: 'prod-ap-northeast-1', calculated: 84.7, baseline: 80.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'pod-kill-lg': 88.0, 'net-chaos-lg': 80.0, 'cpu-hog-lg': 86.0 } },
        { clusterName: 'staging-us-east-1', calculated: 78.9, baseline: 80.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'pod-kill-lg': 82.0, 'net-chaos-lg': 74.0, 'cpu-hog-lg': 80.8 } },
        { clusterName: 'staging-eu-west-1', calculated: 93.5, baseline: 80.0, status: 'pass', message: 'Excellent', nodeContributions: { 'pod-kill-lg': 96.0, 'net-chaos-lg': 91.0, 'cpu-hog-lg': 93.5 } },
      ],
    },
  },
  'multi-cluster-resilience': {
    name: 'multi-cluster-resilience',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2026-07-02T11:00:00Z',
    spec: {
      graph: {
        'pod-kill-mc': { name: 'pod-kill', image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios' },
        'net-chaos-mc': { name: 'net-chaos', image: 'quay.io/krkn-chaos/krkn-hub:network-chaos', depends_on: 'pod-kill-mc' },
      },
      targetRequestId: 'target-003',
      targetClusters: { 'krkn-operator': ['staging-us-east-1', 'staging-eu-west-1'] },
      ownerUserId: 'admin@preview.local',
      resiliencyScoreEnabled: true,
      resiliencyMountPath: '/etc/krkn/metrics.yaml',
      resiliencyScoreBaseline: 85.0,
    },
    status: {
      phase: 'Completed',
      summary: { totalNodes: 2, completedNodes: 2, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
      nodeStatuses: [
        {
          nodeId: 'pod-kill-mc', nodeName: 'pod-kill', phase: 'Completed', scenarioRunRef: 'sr-pod-kill-mc-001',
          startTime: '2026-07-02T11:00:00Z', completionTime: '2026-07-02T11:08:00Z',
          resiliencyScores: [{ clusterName: 'staging-us-east-1', score: 93.0 }, { clusterName: 'staging-eu-west-1', score: 85.0 }],
          resiliencyScoreAvg: 89.0,
        },
        {
          nodeId: 'net-chaos-mc', nodeName: 'net-chaos', phase: 'Completed', scenarioRunRef: 'sr-net-chaos-mc-001',
          startTime: '2026-07-02T11:08:00Z', completionTime: '2026-07-02T11:20:00Z', dependsOn: ['pod-kill-mc'],
          resiliencyScores: [{ clusterName: 'staging-us-east-1', score: 89.4 }, { clusterName: 'staging-eu-west-1', score: 72.0 }],
          resiliencyScoreAvg: 80.7,
        },
      ],
      resolvedLevels: [['pod-kill-mc'], ['net-chaos-mc']],
      startTime: '2026-07-02T11:00:00Z',
      completionTime: '2026-07-02T11:20:00Z',
      resiliencyScores: [
        { clusterName: 'staging-us-east-1', calculated: 91.2, baseline: 85.0, status: 'pass', message: 'Meets baseline', nodeContributions: { 'pod-kill-mc': 93.0, 'net-chaos-mc': 89.4 } },
        { clusterName: 'staging-eu-west-1', calculated: 78.5, baseline: 85.0, status: 'fail', message: 'Below baseline', nodeContributions: { 'pod-kill-mc': 85.0, 'net-chaos-mc': 72.0 } },
      ],
    },
  },
};

// ─── CLUSTERS ───

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

// ─── USERS ───

const mockUsers = [
  { userId: 'admin@preview.local', name: 'Preview', surname: 'User', role: 'admin', organization: 'Krkn', active: true, created: '2026-06-01T00:00:00Z', lastLogin: '2026-07-08T10:00:00Z' },
  { userId: 'user1@preview.local', name: 'Alice', surname: 'Engineer', role: 'user', organization: 'Krkn', active: true, created: '2026-06-15T00:00:00Z', lastLogin: '2026-07-07T14:00:00Z' },
];

// ─── GROUPS ───

const mockGroups = [
  { name: 'chaos-engineers', description: 'Chaos engineering team', createdAt: '2026-06-01T00:00:00Z', memberCount: 2, clusterPermissions: { 'https://api.staging-east.example.com:6443': { actions: ['view', 'run', 'cancel'] } } },
  { name: 'platform-team', description: 'Platform engineering', createdAt: '2026-06-10T00:00:00Z', memberCount: 1, clusterPermissions: {} },
];

// ─── REGISTRIES ───

const mockRegistries = [
  { name: 'default', registryUrl: 'quay.io', scenarioRepository: 'krkn-chaos/krkn-hub', authType: 'token', description: 'Default krkn scenario registry', skipTls: false, insecure: false, groups: [], availableToAll: true, createdAt: '2026-06-01T00:00:00Z' },
];

// ─── PROVIDERS ───

const mockProviders = [
  { name: 'aws', active: true, lastHeartbeat: '2026-07-08T10:00:00Z' },
  { name: 'gcp', active: true, lastHeartbeat: '2026-07-08T09:55:00Z' },
  { name: 'azure', active: false, lastHeartbeat: null },
];

// ─── TARGETS ───

const mockTargets = [
  { uuid: 'target-001', clusterName: 'staging-us-east-1', clusterAPIURL: 'https://api.staging-east.example.com:6443', secretType: 'kubeconfig', ready: true, createdAt: '2026-07-01T12:00:00Z' },
  { uuid: 'target-002', clusterName: 'staging-eu-west-1', clusterAPIURL: 'https://api.staging-west.example.com:6443', secretType: 'kubeconfig', ready: true, createdAt: '2026-07-01T12:00:00Z' },
  { uuid: 'target-003', clusterName: 'prod-us-central1', clusterAPIURL: 'https://api.prod.example.com:6443', secretType: 'token', ready: true, createdAt: '2026-06-30T08:00:00Z' },
];

// ─── SCENARIOS (ScenarioTag) ───

const mockScenarios = [
  { name: 'pod-disruption', description: 'Disrupts pods in target namespaces' },
  { name: 'node-cpu-hog', description: 'Stresses CPU on target nodes' },
  { name: 'network-chaos', description: 'Introduces network latency and packet loss' },
  { name: 'container-kill', description: 'Kills containers in target pods' },
  { name: 'time-skew', description: 'Skews system time on target nodes' },
  { name: 'node-scenarios', description: 'Node-level chaos scenarios requiring cloud provider credentials' },
];

// ─── FILES (FileInfo for listings) ───

const mockFiles = [
  { fileId: 'file-001', fileName: 'kubeconfig-staging', availableToAll: false, groups: ['chaos-engineers'], fileType: 'kubeconfig', filePurpose: 'file' },
  { fileId: 'file-002', fileName: 'metrics.yaml', description: 'Prometheus metrics config', availableToAll: true, fileType: 'yaml', filePurpose: 'file' },
  { fileId: 'file-003', fileName: 'workflow.json', workflowName: 'chaos-daily-suite', description: 'Daily chaos workflow', availableToAll: true, filePurpose: 'workflow-template' },
  { fileId: 'file-004', fileName: 'alerts-custom.yaml', description: 'Custom alerting rules', availableToAll: false, groups: ['platform-team'], fileType: 'yaml', filePurpose: 'file' },
];

// ─── FILE TYPES (FileTypeResponse) ───

const mockFileTypes = [
  { name: 'kubeconfig', color: '#0066CC', icon: '', usageCount: 1, createdAt: '2026-06-01T00:00:00Z' },
  { name: 'yaml', color: '#CB7832', icon: '', usageCount: 2, createdAt: '2026-06-01T00:00:00Z' },
];

// ─── WORKFLOWS (WorkflowInfo for listings) ───

const mockWorkflows = [
  { workflowId: 'wf-001', workflowName: 'chaos-daily-suite', description: 'Daily chaos workflow for staging', nodeCount: 4 },
  { workflowId: 'wf-002', workflowName: 'resilience-quick-check', description: 'Quick resilience validation', nodeCount: 2 },
];

const mockWorkflowDetail = {
  workflowId: 'wf-001',
  workflowName: 'chaos-daily-suite',
  description: 'Daily chaos workflow for staging',
  availableToAll: true,
  graph: {
    'node-1': { name: 'pod-disruption', env: { NAMESPACE: 'default' } },
    'node-2': { name: 'node-cpu-hog', env: {}, depends_on: 'node-1' },
  },
  studioLayout: {
    edges: [{ source: 'node-1', target: 'node-2' }],
    nextNodeNumber: 3,
    nodes: [
      { nodeId: 'node-1', position: { x: 100, y: 200 }, status: 'configured' },
      { nodeId: 'node-2', position: { x: 400, y: 200 }, status: 'configured' },
    ],
  },
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T08:00:00Z',
  createdBy: 'admin@preview.local',
};

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
    HttpResponse.json({ uuid: 'mock-target-001', message: 'Target created' }),
  ),
  http.get(`${BASE}/targets/:uuid`, () =>
    new HttpResponse(null, { status: 200 }),
  ),
  http.delete(`${BASE}/targets/:uuid`, ({ params }) =>
    HttpResponse.json({ uuid: params.uuid as string, message: 'Target deleted' }),
  ),

  // ─── CLUSTERS ───
  http.get(`${BASE}/clusters`, () => HttpResponse.json(mockClusters)),
  http.get(`${BASE}/nodes`, () =>
    HttpResponse.json({ nodes: ['ip-10-0-1-100.ec2.internal', 'ip-10-0-1-101.ec2.internal'] }),
  ),

  // ─── SCENARIOS ───
  http.post(`${BASE}/scenarios`, () =>
    HttpResponse.json({ scenarios: mockScenarios }),
  ),
  http.post(`${BASE}/scenarios/detail/:scenarioName`, ({ params }) => {
    const name = params.scenarioName as string;
    return HttpResponse.json({
      name,
      title: name,
      description: `Chaos scenario: ${name}`,
      fields: [
        { name: 'namespace', short_description: 'Target namespace', description: 'Kubernetes namespace to target', variable: 'NAMESPACE', type: 'string', required: true, default: 'default' },
        { name: 'duration', short_description: 'Duration in seconds', description: 'How long the chaos should run', variable: 'DURATION', type: 'number', required: false, default: '60' },
        { name: 'label_selector', short_description: 'Pod selector', description: 'Label selector for target pods', variable: 'LABEL_SELECTOR', type: 'string', required: false, default: '' },
      ],
    });
  }),
  http.post(`${BASE}/scenarios/globals/:scenarioName`, ({ params }) => {
    const name = params.scenarioName as string;
    return HttpResponse.json({
      name,
      title: `${name} globals`,
      description: `Global configuration for ${name}`,
      fields: [
        { name: 'iterations', short_description: 'Number of iterations', description: 'Number of iterations to run', variable: 'ITERATIONS', type: 'number', required: false, default: '1' },
        { name: 'daemon_mode', short_description: 'Daemon mode', description: 'Run in daemon mode', variable: 'DAEMON_MODE', type: 'boolean', required: false, default: 'false' },
      ],
    });
  }),

  // ─── SCENARIO RUNS ───
  http.get(`${BASE}/scenarios/run`, () =>
    HttpResponse.json({
      scenarioRuns: mockScenarioRuns,
      pagination: { page: 1, limit: 20, total: mockScenarioRuns.length, totalPages: 1 },
    }),
  ),
  http.post(`${BASE}/scenarios/run`, () =>
    HttpResponse.json({
      scenarioRunName: 'preview-run-' + Date.now().toString(36),
      targetClusters: { 'krkn-operator': ['staging-us-east-1'] },
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
    const detail = mockGraphRunDetails[params.name as string];
    if (detail) return HttpResponse.json(detail);
    const run = mockGraphRuns.find((r) => r.name === params.name);
    return HttpResponse.json(run || mockGraphRuns[0]);
  }),
  http.post(`${BASE}/graphruns`, () => {
    const name = 'preview-graph-' + Date.now().toString(36);
    return HttpResponse.json({
      name,
      namespace: 'krkn-operator-system',
      creationTimestamp: new Date().toISOString(),
      spec: {
        graph: {},
        targetRequestId: 'target-001',
        targetClusters: { 'krkn-operator': ['staging-us-east-1'] },
        ownerUserId: 'admin@preview.local',
      },
      status: {
        phase: 'Pending',
        summary: { totalNodes: 0, completedNodes: 0, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
        nodeStatuses: [],
        resolvedLevels: [],
      },
    });
  }),
  http.delete(`${BASE}/graphruns/:name`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── DASHBOARD ───
  http.get(`${BASE}/dashboard/active-runs`, () =>
    HttpResponse.json({
      totalActiveRuns: 2,
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
    HttpResponse.json({ uuid: 'mock-target-new', message: 'Target created' }),
  ),
  http.put(`${BASE}/operator/targets/:uuid`, ({ params }) =>
    HttpResponse.json({ uuid: params.uuid as string, message: 'Target updated' }),
  ),
  http.delete(`${BASE}/operator/targets/:uuid`, ({ params }) =>
    HttpResponse.json({ uuid: params.uuid as string, message: 'Target deleted' }),
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
    HttpResponse.json({ userId: 'new-user@preview.local', message: 'User created' }),
  ),
  http.patch(`${BASE}/users/:userId/password`, () =>
    HttpResponse.json({ userId: 'admin@preview.local', message: 'Password changed' }),
  ),
  http.patch(`${BASE}/users/:userId`, ({ params }) =>
    HttpResponse.json({ userId: params.userId as string, message: 'User updated' }),
  ),
  http.delete(`${BASE}/users/:userId`, ({ params }) =>
    HttpResponse.json({ userId: params.userId as string, message: 'User deleted' }),
  ),

  // ─── GROUPS (CRUD) ───
  http.get(`${BASE}/groups`, () =>
    HttpResponse.json({ groups: mockGroups }),
  ),
  http.get(`${BASE}/groups/:groupName/members`, () =>
    HttpResponse.json({
      members: [
        { userId: 'admin@preview.local', name: 'Preview', surname: 'User', role: 'admin' },
        { userId: 'user1@preview.local', name: 'Alice', surname: 'Engineer', role: 'user' },
      ],
    }),
  ),
  http.get(`${BASE}/groups/:groupName`, ({ params }) => {
    const g = mockGroups.find((x) => x.name === params.groupName);
    return HttpResponse.json(g || mockGroups[0]);
  }),
  http.post(`${BASE}/groups`, () =>
    HttpResponse.json({ name: 'new-group', message: 'Group created' }),
  ),
  http.patch(`${BASE}/groups/:groupName`, ({ params }) =>
    HttpResponse.json({ name: params.groupName as string, message: 'Group updated' }),
  ),
  http.delete(`${BASE}/groups/:groupName`, ({ params }) =>
    HttpResponse.json({ name: params.groupName as string, message: 'Group deleted' }),
  ),
  http.post(`${BASE}/groups/:groupName/members`, ({ params }) =>
    HttpResponse.json({ groupName: params.groupName as string, userId: 'new-member@preview.local', message: 'Member added' }),
  ),
  http.delete(`${BASE}/groups/:groupName/members/:userId`, ({ params }) =>
    HttpResponse.json({ groupName: params.groupName as string, userId: params.userId as string, message: 'Member removed' }),
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
    HttpResponse.json({ name: 'new-registry', message: 'Registry created' }),
  ),
  http.put(`${BASE}/registries/:name`, ({ params }) =>
    HttpResponse.json({ name: params.name as string, message: 'Registry updated' }),
  ),
  http.delete(`${BASE}/registries/:name`, ({ params }) =>
    HttpResponse.json({ name: params.name as string, message: 'Registry deleted' }),
  ),

  // ─── PROVIDERS ───
  http.get(`${BASE}/providers`, () =>
    HttpResponse.json({ providers: mockProviders }),
  ),
  http.patch(`${BASE}/providers/:name`, ({ params }) =>
    HttpResponse.json({ message: 'Provider updated', name: params.name as string, active: true }),
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
              { name: 'ACM_USE_PROXY_GROUP', short_description: 'Cluster Proxy Configuration', description: 'Enable cluster proxy connection for managed clusters.', variable: 'ACM_USE_PROXY_GROUP', type: 'group', required: 'false', secret: 'false' },
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
  http.get(`${BASE}/files/:fileId`, ({ params }) => {
    const f = mockFiles.find((x) => x.fileId === params.fileId);
    const base = f || mockFiles[0];
    return HttpResponse.json({ ...base, content: '# Mock file content\nkey: value\n' });
  }),
  http.post(`${BASE}/files`, () =>
    HttpResponse.json({ message: 'File created', fileId: 'file-new-' + Date.now().toString(36) }),
  ),
  http.put(`${BASE}/files/:fileId`, ({ params }) =>
    HttpResponse.json({ message: 'File updated', fileId: params.fileId as string }),
  ),
  http.delete(`${BASE}/files/:fileId`, () =>
    HttpResponse.json({ message: 'File deleted' }),
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
    HttpResponse.json({ message: 'File type created', name: 'new-type' }),
  ),
  http.put(`${BASE}/file-types/:name`, () =>
    HttpResponse.json({ message: 'File type updated' }),
  ),
  http.delete(`${BASE}/file-types/:name`, () =>
    HttpResponse.json({ message: 'File type deleted' }),
  ),

  // ─── WORKFLOWS (CRUD) ───
  http.get(`${BASE}/workflows/available`, () =>
    HttpResponse.json({ workflows: mockWorkflows }),
  ),
  http.get(`${BASE}/workflows/:workflowId`, ({ params }) => {
    if (params.workflowId === 'wf-001') return HttpResponse.json(mockWorkflowDetail);
    return HttpResponse.json({ ...mockWorkflowDetail, workflowId: params.workflowId, workflowName: 'loaded-workflow' });
  }),
  http.post(`${BASE}/workflows`, () =>
    HttpResponse.json({ message: 'Workflow created', workflowId: 'wf-new-' + Date.now().toString(36) }),
  ),
  http.put(`${BASE}/workflows/:workflowId`, ({ params }) =>
    HttpResponse.json({ message: 'Workflow updated', workflowId: params.workflowId as string }),
  ),
  http.delete(`${BASE}/workflows/:workflowId`, () =>
    HttpResponse.json({ message: 'Workflow deleted' }),
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
      commands: [
        { name: 'oc', description: 'OpenShift CLI', subcommands: [{ name: 'get', description: 'Get resources' }, { name: 'describe', description: 'Describe resources' }] },
        { name: 'kubectl', description: 'Kubernetes CLI', subcommands: [{ name: 'get', description: 'Get resources' }, { name: 'logs', description: 'View logs' }] },
        { name: 'curl', description: 'HTTP client', subcommands: [] },
        { name: 'cat', description: 'Display file contents', subcommands: [] },
        { name: 'echo', description: 'Print text', subcommands: [] },
        { name: 'grep', description: 'Search text', subcommands: [] },
      ],
    }),
  ),

  // ─── CATCH-ALL ───
  http.all(`${BASE}/*`, ({ request }) => {
    if (request.method === 'GET') return HttpResponse.json({});
    if (request.method === 'DELETE') return new HttpResponse(null, { status: 204 });
    return HttpResponse.json({ success: true });
  }),
];
