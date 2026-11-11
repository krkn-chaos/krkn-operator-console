import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CloudCredential, CreateCloudCredentialRequest, ListCloudCredentialsResponse } from '../../types/api';

const mockFetchJson = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  BaseApiClient: class {
    protected baseUrl: string;
    constructor(baseUrl: string) { this.baseUrl = baseUrl; }
    protected fetchJson(...args: unknown[]) { return mockFetchJson(...args); }
  },
}));

const { cloudCredentialsApi } = await import('../cloudCredentialsApi');

describe('cloudCredentialsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists available credentials and tolerates a missing credentials array', async () => {
    const credentials: CloudCredential[] = [{ name: 'aws-ci', provider: 'aws', availableToAll: true }];
    mockFetchJson.mockResolvedValueOnce({ credentials, total: credentials.length } satisfies ListCloudCredentialsResponse);
    await expect(cloudCredentialsApi.listAvailable()).resolves.toEqual(credentials);
    expect(mockFetchJson).toHaveBeenCalledWith('/cloud-credentials/available');

    mockFetchJson.mockResolvedValueOnce({});
    await expect(cloudCredentialsApi.listCredentials()).resolves.toEqual([]);
  });

  it('sends create, update, and delete requests to encoded credential endpoints', async () => {
    const request: CreateCloudCredentialRequest = { name: 'azure-ci', provider: 'azure', azureTenantId: 'tenant' };
    const response = { message: 'ok', name: request.name };
    mockFetchJson.mockResolvedValue(response);

    await cloudCredentialsApi.createCredential(request);
    expect(mockFetchJson).toHaveBeenCalledWith('/cloud-credentials', {
      method: 'POST', body: JSON.stringify(request),
    });
    await cloudCredentialsApi.updateCredential('credential/name', { description: 'updated' });
    expect(mockFetchJson).toHaveBeenCalledWith('/cloud-credentials/credential%2Fname', {
      method: 'PUT', body: JSON.stringify({ description: 'updated' }),
    });
    await cloudCredentialsApi.deleteCredential('credential/name');
    expect(mockFetchJson).toHaveBeenCalledWith('/cloud-credentials/credential%2Fname', { method: 'DELETE' });
  });
});
