import { BaseApiClient } from '../utils/apiClient';
import type {
  ProviderInfo,
  ListProvidersResponse,
  UpdateProviderStatusRequest,
  UpdateProviderStatusResponse,
  CreateProviderConfigResponse,
  GetProviderConfigResponse,
  SubmitProviderConfigRequest,
  SubmitProviderConfigResponse,
  ProviderErrorResponse,
} from '../types/provider';

const API_BASE = '/api/v1';

class ProvidersApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }
  /**
   * GET /providers
   * List all registered providers with their active status
   */
  async listProviders(): Promise<ProviderInfo[]> {
    const data = await this.fetchJson<ListProvidersResponse>('/providers');
    return data.providers || [];
  }

  /**
   * PATCH /providers/{name}
   * Activate or deactivate a provider
   */
  async updateProviderStatus(name: string, active: boolean): Promise<UpdateProviderStatusResponse> {
    const requestBody: UpdateProviderStatusRequest = { active };
    return this.fetchJson<UpdateProviderStatusResponse>(`/providers/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(requestBody),
    });
  }

  /**
   * POST /provider-config
   * Create a new provider config request
   * Returns UUID for polling
   */
  async createProviderConfigRequest(): Promise<string> {
    const data = await this.fetchJson<CreateProviderConfigResponse>('/provider-config', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return data.uuid;
  }

  /**
   * GET /provider-config/{uuid}
   * Get provider config status - returns response with status code and optional data
   * Returns: 202 = Accepted (pending), 200 = OK (completed with data)
   */
  async getProviderConfigStatus(uuid: string): Promise<{ status: number; data?: GetProviderConfigResponse }> {
    const response = await this.fetch(`/provider-config/${encodeURIComponent(uuid)}`);
    const status = response.status;

    // If status is 200 (completed), read and return the data immediately
    if (status === 200) {
      try {
        const text = await response.text();
        if (text && text.trim().length > 0) {
          const data = JSON.parse(text);
          return { status, data };
        }
      } catch (error) {
        console.error('Failed to parse provider config data from status check:', error);
      }
    }

    // If status is 202 (pending), just return the status
    return { status };
  }

  /**
   * GET /provider-config/{uuid}
   * Get provider config data when status is 200 OK
   */
  async getProviderConfig(uuid: string): Promise<GetProviderConfigResponse> {
    const response = await this.fetch(`/provider-config/${encodeURIComponent(uuid)}`);

    console.log('getProviderConfig response status:', response.status);
    console.log('getProviderConfig response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      try {
        const error: ProviderErrorResponse = await response.json();
        throw new Error(error.message || 'Failed to get provider config');
      } catch (parseError) {
        throw new Error(`Failed to get provider config (HTTP ${response.status})`);
      }
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    console.log('Response content-type:', contentType);

    const text = await response.text();
    console.log('Response body (raw text):', text);
    console.log('Response body length:', text.length);

    if (!text || text.trim().length === 0) {
      throw new Error('Empty response body from provider config API');
    }

    try {
      const data = JSON.parse(text);
      console.log('Parsed provider config data:', data);
      return data;
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      console.error('Response text was:', text);
      throw new Error('Invalid JSON in provider config response');
    }
  }

  /**
   * POST /provider-config/{uuid}
   * Submit provider configuration values
   */
  async submitProviderConfig(
    uuid: string,
    providerName: string,
    values: { [key: string]: string | number | boolean }
  ): Promise<SubmitProviderConfigResponse> {
    // Convert all values to strings as required by API
    const stringValues: { [key: string]: string } = {};
    Object.entries(values).forEach(([key, value]) => {
      stringValues[key] = String(value);
    });

    const requestBody: SubmitProviderConfigRequest = {
      provider_name: providerName,
      values: stringValues,
    };

    return this.fetchJson<SubmitProviderConfigResponse>(`/provider-config/${encodeURIComponent(uuid)}`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }
}

// Export singleton instance
export const providersApi = new ProvidersApi();
