import type {
  CreateTargetRequest,
  UpdateTargetRequest,
  TargetResponse,
  ListTargetsResponse,
  TargetOperationResponse,
  ErrorResponse,
} from '../types/api';

const API_BASE = '/api/v1/operator';

class TargetsApi {
  /**
   * Create a new target cluster
   */
  async createTarget(data: CreateTargetRequest): Promise<TargetOperationResponse> {
    const response = await fetch(`${API_BASE}/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || 'Failed to create target');
    }

    return await response.json();
  }

  /**
   * List all target clusters
   */
  async listTargets(): Promise<TargetResponse[]> {
    const response = await fetch(`${API_BASE}/targets`);

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || 'Failed to list targets');
    }

    const data: ListTargetsResponse = await response.json();
    return data.targets;
  }

  /**
   * Get a specific target by UUID
   */
  async getTarget(uuid: string): Promise<TargetResponse> {
    const response = await fetch(`${API_BASE}/targets/${uuid}`);

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || 'Failed to get target');
    }

    return await response.json();
  }

  /**
   * Update an existing target
   */
  async updateTarget(uuid: string, data: UpdateTargetRequest): Promise<TargetOperationResponse> {
    const response = await fetch(`${API_BASE}/targets/${uuid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || 'Failed to update target');
    }

    return await response.json();
  }

  /**
   * Delete a target cluster
   */
  async deleteTarget(uuid: string): Promise<TargetOperationResponse> {
    const response = await fetch(`${API_BASE}/targets/${uuid}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || 'Failed to delete target');
    }

    return await response.json();
  }
}

export const targetsApi = new TargetsApi();
