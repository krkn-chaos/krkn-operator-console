import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AvailableWorkflowsResponse,
  WorkflowResponse,
  CreateWorkflowRequest,
  CreateWorkflowResponse,
  UpdateWorkflowRequest,
  UpdateWorkflowResponse,
  DeleteWorkflowResponse,
} from '../../types/api';

const mockFetchJson = vi.fn();

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
    },
  };
});

const { workflowsApi } = await import('../workflowsApi');

describe('workflowsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableWorkflows', () => {
    it('should call /workflows/available', async () => {
      const mockResponse: AvailableWorkflowsResponse = {
        workflows: [
          { workflowId: 'w1', workflowName: 'workflow-a' },
          { workflowId: 'w2', workflowName: 'workflow-b', description: 'Test' },
        ],
      };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await workflowsApi.getAvailableWorkflows();

      expect(mockFetchJson).toHaveBeenCalledWith('/workflows/available');
      expect(result).toEqual(mockResponse);
    });

    it('should throw on API failure', async () => {
      mockFetchJson.mockRejectedValue(new Error('Unauthorized'));

      await expect(workflowsApi.getAvailableWorkflows()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getWorkflow', () => {
    it('should fetch workflow by ID', async () => {
      const mockResponse: WorkflowResponse = {
        workflowId: 'w1',
        workflowName: 'my-workflow',
        graph: { 'node-1': { image: 'img', volumes: {}, env: {} } },
        availableToAll: true,
      };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await workflowsApi.getWorkflow('w1');

      expect(mockFetchJson).toHaveBeenCalledWith('/workflows/w1');
      expect(result).toEqual(mockResponse);
    });

    it('should encode special characters in workflow ID', async () => {
      mockFetchJson.mockResolvedValue({ workflowId: 'w/1' });

      await workflowsApi.getWorkflow('w/1');

      expect(mockFetchJson).toHaveBeenCalledWith('/workflows/w%2F1');
    });

    it('should throw 404 when workflow not found', async () => {
      mockFetchJson.mockRejectedValue(new Error('Workflow not found'));

      await expect(workflowsApi.getWorkflow('nonexistent')).rejects.toThrow('Workflow not found');
    });
  });

  describe('createWorkflow', () => {
    it('should POST to /workflows with correct body', async () => {
      const request: CreateWorkflowRequest = {
        workflowName: 'new-workflow',
        graph: { 'node-1': { image: 'img', volumes: {}, env: {} } },
        description: 'A new workflow',
        availableToAll: true,
      };

      const mockResponse: CreateWorkflowResponse = {
        message: 'Workflow created',
        workflowId: 'w-new',
      };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await workflowsApi.createWorkflow(request);

      expect(mockFetchJson).toHaveBeenCalledWith('/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw on validation error', async () => {
      mockFetchJson.mockRejectedValue(new Error('workflowName is required'));

      const request: CreateWorkflowRequest = {
        workflowName: '',
        graph: {},
        availableToAll: true,
      };

      await expect(workflowsApi.createWorkflow(request)).rejects.toThrow('workflowName is required');
    });
  });

  describe('updateWorkflow', () => {
    it('should PUT to /workflows/{id} with correct body', async () => {
      const request: UpdateWorkflowRequest = {
        workflowName: 'updated-workflow',
        graph: { 'node-1': { image: 'img', volumes: {}, env: {} } },
        availableToAll: false,
        groups: ['team-a'],
      };

      const mockResponse: UpdateWorkflowResponse = {
        message: 'Workflow updated',
        workflowId: 'w1',
      };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await workflowsApi.updateWorkflow('w1', request);

      expect(mockFetchJson).toHaveBeenCalledWith('/workflows/w1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should encode special characters in workflow ID', async () => {
      const request: UpdateWorkflowRequest = {
        workflowName: 'test',
        graph: {},
        availableToAll: true,
      };
      mockFetchJson.mockResolvedValue({ message: 'ok', workflowId: 'w/1' });

      await workflowsApi.updateWorkflow('w/1', request);

      expect(mockFetchJson).toHaveBeenCalledWith('/workflows/w%2F1', expect.objectContaining({
        method: 'PUT',
      }));
    });

    it('should throw on API failure', async () => {
      mockFetchJson.mockRejectedValue(new Error('Not found'));

      const request: UpdateWorkflowRequest = {
        workflowName: 'test',
        graph: {},
        availableToAll: true,
      };

      await expect(workflowsApi.updateWorkflow('nonexistent', request)).rejects.toThrow('Not found');
    });
  });

  describe('deleteWorkflow', () => {
    it('should DELETE /workflows/{id}', async () => {
      const mockResponse: DeleteWorkflowResponse = { message: 'Workflow deleted' };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await workflowsApi.deleteWorkflow('w1');

      expect(mockFetchJson).toHaveBeenCalledWith('/workflows/w1', {
        method: 'DELETE',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should encode special characters in workflow ID', async () => {
      mockFetchJson.mockResolvedValue({ message: 'ok' });

      await workflowsApi.deleteWorkflow('w/1');

      expect(mockFetchJson).toHaveBeenCalledWith('/workflows/w%2F1', {
        method: 'DELETE',
      });
    });

    it('should throw 404 when workflow not found', async () => {
      mockFetchJson.mockRejectedValue(new Error('Workflow not found'));

      await expect(workflowsApi.deleteWorkflow('nonexistent')).rejects.toThrow('Workflow not found');
    });

    it('should throw 403 when unauthorized', async () => {
      mockFetchJson.mockRejectedValue(new Error('Forbidden'));

      await expect(workflowsApi.deleteWorkflow('w1')).rejects.toThrow('Forbidden');
    });
  });
});
