import { BaseApiClient } from '../utils/apiClient';
import type {
  ElasticsearchConfig,
  CreateElasticsearchConfigRequest,
  UpdateElasticsearchConfigRequest,
  ListElasticsearchConfigsResponse,
  ElasticsearchConfigOperationResponse,
  QueryTelemetryResponse,
} from '../types/api';

const API_BASE = '/api/v1';

class ElasticsearchApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  async listConfigs(): Promise<ElasticsearchConfig[]> {
    const data = await this.fetchJson<ListElasticsearchConfigsResponse>('/elasticsearch-configs');
    return data.configs || [];
  }

  async getConfig(name: string): Promise<ElasticsearchConfig> {
    return this.fetchJson<ElasticsearchConfig>(`/elasticsearch-configs/${encodeURIComponent(name)}`);
  }

  async createConfig(data: CreateElasticsearchConfigRequest): Promise<ElasticsearchConfigOperationResponse> {
    return this.fetchJson<ElasticsearchConfigOperationResponse>('/elasticsearch-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateConfig(name: string, data: UpdateElasticsearchConfigRequest): Promise<ElasticsearchConfigOperationResponse> {
    return this.fetchJson<ElasticsearchConfigOperationResponse>(`/elasticsearch-configs/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteConfig(name: string): Promise<ElasticsearchConfigOperationResponse> {
    return this.fetchJson<ElasticsearchConfigOperationResponse>(`/elasticsearch-configs/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Queries telemetry documents from the telemetry index of a saved config.
   * Credentials are resolved server-side from the named config; only the config
   * name (and optional result size) are sent.
   */
  async queryTelemetry(
    configName: string,
    size?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<QueryTelemetryResponse> {
    return this.fetchJson<QueryTelemetryResponse>('/elasticsearch-query', {
      method: 'POST',
      body: JSON.stringify({ configName, size, startDate, endDate }),
    });
  }
}

export const elasticsearchApi = new ElasticsearchApi();
