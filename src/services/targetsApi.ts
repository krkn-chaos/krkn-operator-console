import { BaseApiClient } from '../utils/apiClient';
import type {
  CreateTargetRequest,
  UpdateTargetRequest,
  TargetResponse,
  ListTargetsResponse,
  TargetOperationResponse,
} from '../types/api';

import { config } from '../config';

const API_BASE = `${config.apiBaseUrl}/operator`;

class TargetsApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }
  /**
   * Create a new target cluster
   */
  async createTarget(data: CreateTargetRequest): Promise<TargetOperationResponse> {
    return this.fetchJson<TargetOperationResponse>('/targets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * List all target clusters
   */
  async listTargets(): Promise<TargetResponse[]> {
    const data = await this.fetchJson<ListTargetsResponse>('/targets');
    return data.targets || [];
  }

  /**
   * Get a specific target by UUID
   */
  async getTarget(uuid: string): Promise<TargetResponse> {
    return this.fetchJson<TargetResponse>(`/targets/${uuid}`);
  }

  /**
   * Update an existing target
   */
  async updateTarget(uuid: string, data: UpdateTargetRequest): Promise<TargetOperationResponse> {
    return this.fetchJson<TargetOperationResponse>(`/targets/${uuid}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a target cluster
   */
  async deleteTarget(uuid: string): Promise<TargetOperationResponse> {
    return this.fetchJson<TargetOperationResponse>(`/targets/${uuid}`, {
      method: 'DELETE',
    });
  }
}

export const targetsApi = new TargetsApi();
