import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GraphRunListItem,
  GraphRunDetail,
  CreateGraphRunRequest,
  GraphScenarioNode,
} from '../../types/api';

// Mock BaseApiClient's fetchJson and fetch methods - must be declared before mock
const mockFetchJson = vi.fn();
const mockFetch = vi.fn();

vi.mock('../../utils/apiClient', () => {
  return {
    BaseApiClient: class {
      protected baseUrl: string;
      constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
      }
      protected fetchJson(...args: unknown[]) {
        return mockFetchJson(...args);
      }
      protected fetch(...args: unknown[]) {
        return mockFetch(...args);
      }
    },
  };
});

// Import after mocking
const { graphRunsApi } = await import('../graphRunsApi');

describe('graphRunsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listGraphRuns', () => {
    it('should return list of graph runs without filters', async () => {
      const mockGraphRuns: GraphRunListItem[] = [
        {
          name: 'graphrun-abc123',
          namespace: 'krkn-operator',
          creationTimestamp: '2026-05-25T10:00:00Z',
          phase: 'Running',
          ownerUserId: 'user1@example.com',
          targetRequestId: 'target-123',
          summary: {
            totalNodes: 5,
            completedNodes: 2,
            runningNodes: 1,
            failedNodes: 0,
            pendingNodes: 2,
          },
          startTime: '2026-05-25T10:01:00Z',
        },
        {
          name: 'graphrun-def456',
          namespace: 'krkn-operator',
          creationTimestamp: '2026-05-25T09:00:00Z',
          phase: 'Completed',
          ownerUserId: 'user2@example.com',
          targetRequestId: 'target-456',
          summary: {
            totalNodes: 3,
            completedNodes: 3,
            runningNodes: 0,
            failedNodes: 0,
            pendingNodes: 0,
          },
          startTime: '2026-05-25T09:01:00Z',
          completionTime: '2026-05-25T09:15:00Z',
        },
      ];

      mockFetchJson.mockResolvedValue(mockGraphRuns);

      const result = await graphRunsApi.listGraphRuns();

      expect(mockFetchJson).toHaveBeenCalledWith('/graphruns');
      expect(result).toEqual(mockGraphRuns);
    });

    it('should filter by ownerUserId when provided', async () => {
      const mockGraphRuns: GraphRunListItem[] = [
        {
          name: 'graphrun-abc123',
          namespace: 'krkn-operator',
          creationTimestamp: '2026-05-25T10:00:00Z',
          phase: 'Running',
          ownerUserId: 'user1@example.com',
          targetRequestId: 'target-123',
          summary: {
            totalNodes: 5,
            completedNodes: 2,
            runningNodes: 1,
            failedNodes: 0,
            pendingNodes: 2,
          },
        },
      ];

      mockFetchJson.mockResolvedValue(mockGraphRuns);

      const result = await graphRunsApi.listGraphRuns({ ownerUserId: 'user1@example.com' });

      expect(mockFetchJson).toHaveBeenCalledWith('/graphruns?ownerUserId=user1%40example.com');
      expect(result).toEqual(mockGraphRuns);
    });

    it('should throw error on API failure', async () => {
      const errorMessage = 'Failed to list graph runs';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      await expect(graphRunsApi.listGraphRuns()).rejects.toThrow(errorMessage);
    });
  });

  describe('getGraphRun', () => {
    it('should fetch specific graph run by name', async () => {
      const mockGraphRun: GraphRunDetail = {
        name: 'graphrun-abc123',
        namespace: 'krkn-operator',
        creationTimestamp: '2026-05-25T10:00:00Z',
        spec: {
          graph: {
            'node1': {
              name: 'pod-scenarios',
              image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios',
              env: { SCENARIO_TYPE: 'pod_delete' },
            },
            'node2': {
              name: 'network-chaos',
              image: 'quay.io/krkn-chaos/krkn-hub:network-chaos',
              depends_on: 'node1',
            },
          },
          targetRequestId: 'target-123',
          targetClusters: {
            'krkn-operator': ['cluster1', 'cluster2'],
          },
          ownerUserId: 'user1@example.com',
        },
        status: {
          phase: 'Running',
          summary: {
            totalNodes: 2,
            completedNodes: 1,
            runningNodes: 1,
            failedNodes: 0,
            pendingNodes: 0,
          },
          nodeStatuses: [
            {
              nodeId: 'node1',
              nodeName: 'pod-scenarios',
              phase: 'Completed',
              scenarioRunRef: 'scenariorun-xyz',
              startTime: '2026-05-25T10:01:00Z',
              completionTime: '2026-05-25T10:05:00Z',
              dependsOn: [],
            },
            {
              nodeId: 'node2',
              nodeName: 'network-chaos',
              phase: 'Running',
              scenarioRunRef: 'scenariorun-abc',
              startTime: '2026-05-25T10:06:00Z',
              dependsOn: ['node1'],
            },
          ],
          resolvedLevels: [['node1'], ['node2']],
          startTime: '2026-05-25T10:01:00Z',
        },
      };

      mockFetchJson.mockResolvedValue(mockGraphRun);

      const result = await graphRunsApi.getGraphRun('graphrun-abc123');

      expect(mockFetchJson).toHaveBeenCalledWith('/graphruns/graphrun-abc123');
      expect(result).toEqual(mockGraphRun);
    });

    it('should encode special characters in graph run name', async () => {
      mockFetchJson.mockResolvedValue({} as GraphRunDetail);

      await graphRunsApi.getGraphRun('graphrun-test/special');

      expect(mockFetchJson).toHaveBeenCalledWith('/graphruns/graphrun-test%2Fspecial');
    });

    it('should throw error when graph run not found', async () => {
      mockFetchJson.mockRejectedValue(new Error('HTTP 404'));

      await expect(graphRunsApi.getGraphRun('nonexistent')).rejects.toThrow('HTTP 404');
    });
  });

  describe('createGraphRun', () => {
    it('should create graph run with valid data', async () => {
      const createRequest: CreateGraphRunRequest = {
        graph: {
          'node1': {
            name: 'pod-scenarios',
            image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios',
            env: { SCENARIO_TYPE: 'pod_delete' },
          },
          'node2': {
            name: 'network-chaos',
            image: 'quay.io/krkn-chaos/krkn-hub:network-chaos',
            depends_on: 'node1',
          },
        },
        targetRequestId: 'target-123',
        targetClusters: {
          'krkn-operator': ['cluster1', 'cluster2'],
        },
      };

      const mockResponse: GraphRunDetail = {
        name: 'graphrun-abc123',
        namespace: 'krkn-operator',
        creationTimestamp: '2026-05-25T10:00:00Z',
        spec: {
          ...createRequest,
          ownerUserId: 'user1@example.com',
        },
        status: {
          phase: 'Pending',
          summary: {
            totalNodes: 2,
            completedNodes: 0,
            runningNodes: 0,
            failedNodes: 0,
            pendingNodes: 2,
          },
          nodeStatuses: [],
          resolvedLevels: [],
        },
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await graphRunsApi.createGraphRun(createRequest);

      expect(mockFetchJson).toHaveBeenCalledWith('/graphruns', {
        method: 'POST',
        body: JSON.stringify(createRequest),
        headers: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle validation errors', async () => {
      const invalidRequest: CreateGraphRunRequest = {
        graph: {},
        targetRequestId: '',
        targetClusters: {},
      };

      mockFetchJson.mockRejectedValue(new Error('graph is required and cannot be empty'));

      await expect(graphRunsApi.createGraphRun(invalidRequest)).rejects.toThrow(
        'graph is required and cannot be empty'
      );
    });

    it('should pass custom headers when provided', async () => {
      const createRequest: CreateGraphRunRequest = {
        graph: {
          'node1': { name: 'test', image: 'test:latest' },
        },
        targetRequestId: 'target-123',
        targetClusters: {
          'krkn-operator': ['cluster1'],
        },
      };

      const customHeaders = {
        'X-Resiliency-Score': 'true',
        'X-Resiliency-Baseline': '9.0',
        'X-Resiliency-Mount-Path': '/etc/krkn/metrics.yaml',
      };

      const mockResponse: GraphRunDetail = {
        name: 'graphrun-abc123',
        namespace: 'krkn-operator',
        creationTimestamp: '2026-05-25T10:00:00Z',
        spec: {
          ...createRequest,
          ownerUserId: 'user1@example.com',
        },
        status: {
          phase: 'Pending',
          summary: {
            totalNodes: 1,
            completedNodes: 0,
            runningNodes: 0,
            failedNodes: 0,
            pendingNodes: 1,
          },
          nodeStatuses: [],
          resolvedLevels: [],
        },
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await graphRunsApi.createGraphRun(createRequest, customHeaders);

      expect(mockFetchJson).toHaveBeenCalledWith('/graphruns', {
        method: 'POST',
        body: JSON.stringify(createRequest),
        headers: customHeaders,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle permission errors', async () => {
      const createRequest: CreateGraphRunRequest = {
        graph: {
          'node1': { name: 'test', image: 'test:latest' },
        },
        targetRequestId: 'target-123',
        targetClusters: {
          'krkn-operator': ['cluster1'],
        },
      };

      mockFetchJson.mockRejectedValue(new Error('HTTP 403: Forbidden'));

      await expect(graphRunsApi.createGraphRun(createRequest)).rejects.toThrow('HTTP 403');
    });
  });

  describe('deleteGraphRun', () => {
    it('should delete graph run successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      await graphRunsApi.deleteGraphRun('graphrun-abc123');

      expect(mockFetch).toHaveBeenCalledWith('/graphruns/graphrun-abc123', {
        method: 'DELETE',
      });
    });

    it('should throw error on 404 not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue({ message: 'Graph run not found' }),
      });

      await expect(graphRunsApi.deleteGraphRun('nonexistent')).rejects.toThrow('Graph run not found');
    });

    it('should throw error on 403 forbidden', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: vi.fn().mockResolvedValue({ message: 'You can only delete your own graph runs' }),
      });

      await expect(graphRunsApi.deleteGraphRun('graphrun-abc123')).rejects.toThrow(
        'You can only delete your own graph runs'
      );
    });

    it('should handle JSON parsing failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      await expect(graphRunsApi.deleteGraphRun('graphrun-abc123')).rejects.toThrow('HTTP 500');
    });
  });

  describe('validateGraph', () => {
    it('should return no errors for valid graph', () => {
      const validGraph: { [key: string]: GraphScenarioNode } = {
        'node1': {
          name: 'pod-scenarios',
          image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios',
        },
        'node2': {
          name: 'network-chaos',
          image: 'quay.io/krkn-chaos/krkn-hub:network-chaos',
          depends_on: 'node1',
        },
      };

      const errors = graphRunsApi.validateGraph(validGraph);

      expect(errors).toEqual([]);
    });

    it('should return error for empty graph', () => {
      const errors = graphRunsApi.validateGraph({});

      expect(errors).toContain('Graph cannot be empty');
    });

    it('should return error for node without name or image', () => {
      const invalidGraph: { [key: string]: GraphScenarioNode } = {
        'node1': {
          env: { FOO: 'bar' },
        },
      };

      const errors = graphRunsApi.validateGraph(invalidGraph);

      expect(errors).toContain("Node 'node1' must have either name or image");
    });

    it('should return error for invalid depends_on reference', () => {
      const invalidGraph: { [key: string]: GraphScenarioNode } = {
        'node1': {
          name: 'test',
          image: 'test:latest',
          depends_on: 'nonexistent',
        },
      };

      const errors = graphRunsApi.validateGraph(invalidGraph);

      expect(errors).toContain("Node 'node1' depends on non-existent node 'nonexistent'");
    });

    it('should return error for self-dependency', () => {
      const invalidGraph: { [key: string]: GraphScenarioNode } = {
        'node1': {
          name: 'test',
          image: 'test:latest',
          depends_on: 'node1',
        },
      };

      const errors = graphRunsApi.validateGraph(invalidGraph);

      expect(errors).toContain("Node 'node1' cannot depend on itself");
    });

    it('should detect circular dependencies', () => {
      const circularGraph: { [key: string]: GraphScenarioNode } = {
        'node1': {
          name: 'test1',
          image: 'test:latest',
          depends_on: 'node3',
        },
        'node2': {
          name: 'test2',
          image: 'test:latest',
          depends_on: 'node1',
        },
        'node3': {
          name: 'test3',
          image: 'test:latest',
          depends_on: 'node2',
        },
      };

      const errors = graphRunsApi.validateGraph(circularGraph);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Circular dependency detected'))).toBe(true);
    });

    it('should allow valid chain of dependencies', () => {
      const validChain: { [key: string]: GraphScenarioNode } = {
        'node1': {
          name: 'first',
          image: 'test:latest',
        },
        'node2': {
          name: 'second',
          image: 'test:latest',
          depends_on: 'node1',
        },
        'node3': {
          name: 'third',
          image: 'test:latest',
          depends_on: 'node2',
        },
      };

      const errors = graphRunsApi.validateGraph(validChain);

      expect(errors).toEqual([]);
    });
  });
});
