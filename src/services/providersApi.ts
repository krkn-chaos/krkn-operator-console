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

class ProvidersApi {
  /**
   * GET /providers
   * List all registered providers with their active status
   */
  async listProviders(): Promise<ProviderInfo[]> {
    try {
      const response = await fetch(`${API_BASE}/providers`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Providers API returned non-JSON response:', contentType);
        throw new Error('Providers API endpoint not available. Make sure the backend is running.');
      }

      if (!response.ok) {
        try {
          const error: ProviderErrorResponse = await response.json();
          throw new Error(error.message || 'Failed to list providers');
        } catch (parseError) {
          throw new Error(`Failed to list providers (HTTP ${response.status})`);
        }
      }

      const data: ListProvidersResponse = await response.json();
      return data.providers || [];
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to connect to providers API');
    }
  }

  /**
   * PATCH /providers/{name}
   * Activate or deactivate a provider
   */
  async updateProviderStatus(name: string, active: boolean): Promise<UpdateProviderStatusResponse> {
    try {
      const requestBody: UpdateProviderStatusRequest = { active };

      const response = await fetch(`${API_BASE}/providers/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Provider status update endpoint not available.');
      }

      if (!response.ok) {
        try {
          const error: ProviderErrorResponse = await response.json();
          throw new Error(error.message || 'Failed to update provider status');
        } catch (parseError) {
          throw new Error(`Failed to update provider status (HTTP ${response.status})`);
        }
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update provider status');
    }
  }

  /**
   * POST /provider-config
   * Create a new provider config request
   * Returns UUID for polling
   */
  async createProviderConfigRequest(): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}/provider-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Provider config API endpoint not available.');
      }

      if (!response.ok) {
        try {
          const error: ProviderErrorResponse = await response.json();
          throw new Error(error.message || 'Failed to create provider config request');
        } catch (parseError) {
          throw new Error(`Failed to create provider config request (HTTP ${response.status})`);
        }
      }

      const data: CreateProviderConfigResponse = await response.json();
      return data.uuid;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create provider config request');
    }
  }

  /**
   * GET /provider-config/{uuid}
   * Get provider config status - returns response with status code and optional data
   * Returns: 202 = Accepted (pending), 200 = OK (completed with data)
   */
  async getProviderConfigStatus(uuid: string): Promise<{ status: number; data?: GetProviderConfigResponse }> {
    const response = await fetch(`${API_BASE}/provider-config/${encodeURIComponent(uuid)}`, {
      headers: { 'Content-Type': 'application/json' },
    });

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
    try {
      const response = await fetch(`${API_BASE}/provider-config/${encodeURIComponent(uuid)}`, {
        headers: { 'Content-Type': 'application/json' },
      });

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
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get provider config');
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
    try {
      // Convert all values to strings as required by API
      const stringValues: { [key: string]: string } = {};
      Object.entries(values).forEach(([key, value]) => {
        stringValues[key] = String(value);
      });

      const requestBody: SubmitProviderConfigRequest = {
        provider_name: providerName,
        values: stringValues,
      };

      const response = await fetch(`${API_BASE}/provider-config/${encodeURIComponent(uuid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Provider config submit endpoint not available.');
      }

      if (!response.ok) {
        try {
          const error: ProviderErrorResponse = await response.json();
          throw new Error(error.message || 'Failed to submit provider config');
        } catch (parseError) {
          throw new Error(`Failed to submit provider config (HTTP ${response.status})`);
        }
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to submit provider config');
    }
  }
}

// Export singleton instance
export const providersApi = new ProvidersApi();
