import { BaseApiClient } from '../utils/apiClient';
import type {
  ElasticsearchConfig,
  CreateElasticsearchConfigRequest,
  UpdateElasticsearchConfigRequest,
  ListElasticsearchConfigsResponse,
  ElasticsearchConfigOperationResponse,
  QueryTelemetryResponse,
  QueryAlertsResponse,
  InlineElasticsearchConnection,
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

  /**
   * Queries telemetry using an ephemeral inline connection instead of a saved
   * config. The supplied credentials are sent for this request only and are
   * never persisted server-side. Intended for users (including non-admins) who
   * have no saved config but need to connect to an ES cluster ad hoc.
   */
  async queryTelemetryInline(
    inline: InlineElasticsearchConnection,
    size?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<QueryTelemetryResponse> {
    return this.fetchJson<QueryTelemetryResponse>('/elasticsearch-query', {
      method: 'POST',
      body: JSON.stringify({ inline, size, startDate, endDate }),
    });
  }

  /** Queries raw documents from the alerts index of a saved config. */
  async queryAlerts(
    configName: string,
    size?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<QueryAlertsResponse> {
    return this.fetchJson<QueryAlertsResponse>('/elasticsearch-alerts-query', {
      method: 'POST',
      body: JSON.stringify({ configName, size, startDate, endDate }),
    });
  }
}

export const elasticsearchApi = new ElasticsearchApi();
