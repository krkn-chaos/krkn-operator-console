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
   * name (and optional paging/filter criteria) are sent. size is the page size
   * and page is the 1-based page number used for server-side pagination.
   *
   * @example
   * // Second page of 20, filtered to two categories.
   * const res = await elasticsearchApi.queryTelemetry(
   *   'prod-es',
   *   20,
   *   2,
   *   '2025-01-01',
   *   '2025-01-02',
   *   { scenario_type: ['pod_disruption_scenarios'], cloud_type: ['aws'] },
   * );
   * console.log(res.total, res.documents.length, res.facets?.cloud_type);
   */
  async queryTelemetry(
    configName: string,
    size?: number,
    page?: number,
    startDate?: string,
    endDate?: string,
    filters?: Record<string, string[]>,
  ): Promise<QueryTelemetryResponse> {
    return this.fetchJson<QueryTelemetryResponse>('/elasticsearch-query', {
      method: 'POST',
      body: JSON.stringify({ configName, size, page, startDate, endDate, filters }),
    });
  }

  /**
   * Queries telemetry using an ephemeral inline connection instead of a saved
   * config. The supplied credentials are sent for this request only and are
   * never persisted server-side. Intended for users (including non-admins) who
   * have no saved config but need to connect to an ES cluster ad hoc. size is the
   * page size and page is the 1-based page number used for server-side pagination.
   *
   * @example
   * // Ad hoc connection, second page of 20, filtered to two categories.
   * const res = await elasticsearchApi.queryTelemetryInline(
   *   {
   *     host: 'https://es.example.com',
   *     port: 9200,
   *     username: 'user',
   *     password: 'secret',
   *     telemetryIndex: 'krkn-telemetry',
   *   },
   *   20,
   *   2,
   *   '2025-01-01',
   *   '2025-01-02',
   *   { scenario_type: ['pod_disruption_scenarios'], cloud_type: ['aws'] },
   * );
   * console.log(res.total, res.documents.length, res.facets?.cloud_type);
   */
  async queryTelemetryInline(
    inline: InlineElasticsearchConnection,
    size?: number,
    page?: number,
    startDate?: string,
    endDate?: string,
    filters?: Record<string, string[]>,
  ): Promise<QueryTelemetryResponse> {
    return this.fetchJson<QueryTelemetryResponse>('/elasticsearch-query', {
      method: 'POST',
      body: JSON.stringify({ inline, size, page, startDate, endDate, filters }),
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
