import { BaseApiClient } from '../utils/apiClient';
import type {
  CloudCredential,
  CreateCloudCredentialRequest,
  UpdateCloudCredentialRequest,
  ListCloudCredentialsResponse,
  CloudCredentialOperationResponse,
} from '../types/api';

const API_BASE = '/api/v1';

class CloudCredentialsApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  async listCredentials(): Promise<CloudCredential[]> {
    const data = await this.fetchJson<ListCloudCredentialsResponse>('/cloud-credentials');
    return data.credentials || [];
  }

  async listAvailable(): Promise<CloudCredential[]> {
    const data = await this.fetchJson<ListCloudCredentialsResponse>('/cloud-credentials/available');
    return data.credentials || [];
  }

  async getCredential(name: string): Promise<CloudCredential> {
    return this.fetchJson<CloudCredential>(`/cloud-credentials/${encodeURIComponent(name)}`);
  }

  async createCredential(data: CreateCloudCredentialRequest): Promise<CloudCredentialOperationResponse> {
    return this.fetchJson<CloudCredentialOperationResponse>('/cloud-credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCredential(name: string, data: UpdateCloudCredentialRequest): Promise<CloudCredentialOperationResponse> {
    return this.fetchJson<CloudCredentialOperationResponse>(`/cloud-credentials/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCredential(name: string): Promise<CloudCredentialOperationResponse> {
    return this.fetchJson<CloudCredentialOperationResponse>(`/cloud-credentials/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }
}

export const cloudCredentialsApi = new CloudCredentialsApi();
