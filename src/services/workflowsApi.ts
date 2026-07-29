import { config } from '../config';
import { BaseApiClient } from '../utils/apiClient';
import type {
  AvailableWorkflowsResponse,
  WorkflowResponse,
  CreateWorkflowRequest,
  CreateWorkflowResponse,
  UpdateWorkflowRequest,
  UpdateWorkflowResponse,
  DeleteWorkflowResponse,
} from '../types/api';

class WorkflowsApiClient extends BaseApiClient {
  constructor() {
    super(config.apiBaseUrl);
  }

  async getAvailableWorkflows(): Promise<AvailableWorkflowsResponse> {
    return this.fetchJson<AvailableWorkflowsResponse>('/workflows/available');
  }

  async getWorkflow(workflowId: string): Promise<WorkflowResponse> {
    return this.fetchJson<WorkflowResponse>(`/workflows/${encodeURIComponent(workflowId)}`);
  }

  async createWorkflow(request: CreateWorkflowRequest): Promise<CreateWorkflowResponse> {
    return this.fetchJson<CreateWorkflowResponse>('/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async updateWorkflow(workflowId: string, request: UpdateWorkflowRequest): Promise<UpdateWorkflowResponse> {
    return this.fetchJson<UpdateWorkflowResponse>(`/workflows/${encodeURIComponent(workflowId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async deleteWorkflow(workflowId: string): Promise<DeleteWorkflowResponse> {
    return this.fetchJson<DeleteWorkflowResponse>(`/workflows/${encodeURIComponent(workflowId)}`, {
      method: 'DELETE',
    });
  }
}

export const workflowsApi = new WorkflowsApiClient();
