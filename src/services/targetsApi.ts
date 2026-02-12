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
    try {
      const response = await fetch(`${API_BASE}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Targets API endpoint not available. Make sure the backend is running.');
      }

      if (!response.ok) {
        try {
          const error: ErrorResponse = await response.json();
          throw new Error(error.message || 'Failed to create target');
        } catch (parseError) {
          throw new Error(`Failed to create target (HTTP ${response.status})`);
        }
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to connect to targets API');
    }
  }

  /**
   * List all target clusters
   */
  async listTargets(): Promise<TargetResponse[]> {
    try {
      const response = await fetch(`${API_BASE}/targets`);

      // Check if response is JSON FIRST, before any parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Targets API returned non-JSON response:', contentType);
        throw new Error('Targets API endpoint not available. Make sure the backend is running.');
      }

      if (!response.ok) {
        try {
          const error: ErrorResponse = await response.json();
          throw new Error(error.message || 'Failed to list targets');
        } catch (parseError) {
          throw new Error(`Failed to list targets (HTTP ${response.status})`);
        }
      }

      const data: ListTargetsResponse = await response.json();
      return data.targets || [];
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to connect to targets API');
    }
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
