import { BaseApiClient } from '../utils/apiClient';
import type {
  VisualizeConfig,
  CreateVisualizeRequest,
  ListVisualizeResponse,
  VisualizeOperationResponse,
  VisualizeLogsResponse,
} from '../types/api';

const API_BASE = '/api/v1';

/**
 * API client for krkn-visualize (Grafana visualization) management.
 * Provides methods to install, list, and manage krkn-visualize instances on target clusters.
 */
class VisualizeApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  /**
   * List all krkn-visualize instances across clusters
   */
  async listInstances(): Promise<VisualizeConfig[]> {
    const data = await this.fetchJson<ListVisualizeResponse>('/visualize');
    return data.instances || [];
  }

  /**
   * Get details of a specific krkn-visualize instance
   * @param name - Instance name
   */
  async getInstance(name: string): Promise<VisualizeConfig> {
    return this.fetchJson<VisualizeConfig>(`/visualize/${encodeURIComponent(name)}`);
  }

  /**
   * Create/install a new krkn-visualize instance
   * @param data - Installation configuration
   */
  async createInstance(data: CreateVisualizeRequest): Promise<VisualizeOperationResponse> {
    return this.fetchJson<VisualizeOperationResponse>('/visualize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a krkn-visualize instance
   * @param name - Instance name
   */
  async deleteInstance(name: string): Promise<VisualizeOperationResponse> {
    return this.fetchJson<VisualizeOperationResponse>(`/visualize/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get installation status of a krkn-visualize instance
   * @param name - Instance name
   */
  async getStatus(name: string): Promise<Pick<VisualizeConfig, 'status' | 'grafanaUrl' | 'errorMessage'>> {
    return this.fetchJson(`/visualize/${encodeURIComponent(name)}/status`);
  }

  /**
   * Get installation logs for a krkn-visualize instance
   * @param name - Instance name
   */
  async getLogs(name: string): Promise<VisualizeLogsResponse> {
    return this.fetchJson<VisualizeLogsResponse>(`/visualize/${encodeURIComponent(name)}/logs`);
  }
}

export const visualizeApi = new VisualizeApi();
