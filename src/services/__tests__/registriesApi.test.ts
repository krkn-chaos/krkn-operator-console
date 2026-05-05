import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  RegistryDetails,
  CreateRegistryRequest,
  UpdateRegistryRequest,
  ListRegistriesResponse,
  RegistryOperationResponse,
} from '../../types/api';

// Mock BaseApiClient's fetchJson method - must be declared before mock
const mockFetchJson = vi.fn();

vi.mock('../../utils/apiClient', () => {
  return {
    BaseApiClient: class {
      protected baseUrl: string;
      constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
      }
      protected fetchJson(...args: unknown[]) {
        return mockFetchJson(...args);
      }
    },
  };
});

// Import after mocking
const { registriesApi } = await import('../registriesApi');

describe('registriesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listRegistries', () => {
    it('should return list of registries on successful response', async () => {
      const mockRegistries: RegistryDetails[] = [
        {
          name: 'registry1',
          registryUrl: 'registry1.example.com',
          scenarioRepository: 'org1/scenarios',
          authType: 'token',
          description: 'Test registry 1',
          skipTls: false,
          insecure: false,
          groups: ['group1', 'group2'],
          availableToAll: false,
          createdAt: '2023-01-01T00:00:00Z',
          createdBy: 'admin@example.com',
        },
        {
          name: 'registry2',
          registryUrl: 'registry2.example.com',
          scenarioRepository: 'org2/scenarios',
          authType: 'password',
          skipTls: false,
          insecure: false,
          groups: [],
          availableToAll: true,
        },
      ];

      const mockResponse: ListRegistriesResponse = { registries: mockRegistries };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await registriesApi.listRegistries();

      expect(mockFetchJson).toHaveBeenCalledWith('/registries');
      expect(result).toEqual(mockRegistries);
    });

    it('should return empty array when registries array is missing', async () => {
      mockFetchJson.mockResolvedValue({});

      const result = await registriesApi.listRegistries();

      expect(result).toEqual([]);
    });

    it('should throw error on API failure', async () => {
      const errorMessage = 'Network error';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      await expect(registriesApi.listRegistries()).rejects.toThrow(errorMessage);
    });
  });

  describe('getRegistry', () => {
    it('should fetch specific registry by name', async () => {
      const mockRegistry: RegistryDetails = {
        name: 'my-registry',
        registryUrl: 'registry.example.com',
        scenarioRepository: 'myorg/scenarios',
        authType: 'token',
        description: 'My private registry',
        skipTls: false,
        insecure: false,
        groups: ['dev-team'],
        availableToAll: false,
      };

      mockFetchJson.mockResolvedValue(mockRegistry);

      const result = await registriesApi.getRegistry('my-registry');

      expect(mockFetchJson).toHaveBeenCalledWith('/registries/my-registry');
      expect(result).toEqual(mockRegistry);
    });

    it('should encode special characters in registry name', async () => {
      const mockRegistry: RegistryDetails = {
        name: 'my.registry',
        registryUrl: 'registry.example.com',
        scenarioRepository: 'myorg/scenarios',
        authType: 'token',
        skipTls: false,
        insecure: false,
        groups: [],
        availableToAll: false,
      };

      mockFetchJson.mockResolvedValue(mockRegistry);

      await registriesApi.getRegistry('my.registry');

      expect(mockFetchJson).toHaveBeenCalledWith('/registries/my.registry');
    });

    it('should throw 404 error when registry not found', async () => {
      mockFetchJson.mockRejectedValue(new Error('Registry not found'));

      await expect(registriesApi.getRegistry('nonexistent')).rejects.toThrow('Registry not found');
    });
  });

  describe('createRegistry', () => {
    it('should create registry with token auth successfully', async () => {
      const createRequest: CreateRegistryRequest = {
        name: 'new-registry',
        registryUrl: 'registry.example.com',
        scenarioRepository: 'myorg/chaos-scenarios',
        authType: 'token',
        token: 'secret-token',
        description: 'Production registry',
        skipTls: false,
        insecure: false,
        groups: ['ops-team'],
        availableToAll: false,
      };

      const mockResponse: RegistryOperationResponse = {
        name: 'new-registry',
        message: 'Registry created successfully',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await registriesApi.createRegistry(createRequest);

      expect(mockFetchJson).toHaveBeenCalledWith('/registries', {
        method: 'POST',
        body: JSON.stringify(createRequest),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should create registry with password auth successfully', async () => {
      const createRequest: CreateRegistryRequest = {
        name: 'dockerhub-private',
        registryUrl: 'registry.hub.docker.com',
        scenarioRepository: 'myuser/scenarios',
        authType: 'password',
        username: 'myusername',
        password: 'mypassword',
        skipTls: false,
        insecure: false,
        groups: [],
        availableToAll: true,
      };

      const mockResponse: RegistryOperationResponse = {
        name: 'dockerhub-private',
        message: 'Registry created successfully',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await registriesApi.createRegistry(createRequest);

      expect(mockFetchJson).toHaveBeenCalledWith('/registries', {
        method: 'POST',
        body: JSON.stringify(createRequest),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw validation error for invalid name format', async () => {
      const errorMessage = 'Name must be RFC 1123 compliant';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      const createRequest: CreateRegistryRequest = {
        name: 'INVALID_NAME',
        registryUrl: 'registry.example.com',
        scenarioRepository: 'org/repo',
        authType: 'token',
        token: 'token',
      };

      await expect(registriesApi.createRegistry(createRequest)).rejects.toThrow(errorMessage);
    });

    it('should throw conflict error when registry name already exists', async () => {
      const errorMessage = 'Registry already exists';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      const createRequest: CreateRegistryRequest = {
        name: 'existing-registry',
        registryUrl: 'registry.example.com',
        scenarioRepository: 'org/repo',
        authType: 'token',
        token: 'token',
      };

      await expect(registriesApi.createRegistry(createRequest)).rejects.toThrow(errorMessage);
    });
  });

  describe('updateRegistry', () => {
    it('should update registry description and groups', async () => {
      const updateRequest: UpdateRegistryRequest = {
        description: 'Updated description',
        groups: ['dev-team', 'qa-team'],
      };

      const mockResponse: RegistryOperationResponse = {
        name: 'my-registry',
        message: 'Registry updated successfully',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await registriesApi.updateRegistry('my-registry', updateRequest);

      expect(mockFetchJson).toHaveBeenCalledWith('/registries/my-registry', {
        method: 'PUT',
        body: JSON.stringify(updateRequest),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should update registry auth type and credentials', async () => {
      const updateRequest: UpdateRegistryRequest = {
        authType: 'token',
        token: 'new-secret-token',
      };

      const mockResponse: RegistryOperationResponse = {
        name: 'my-registry',
        message: 'Registry updated successfully',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await registriesApi.updateRegistry('my-registry', updateRequest);

      expect(mockFetchJson).toHaveBeenCalledWith('/registries/my-registry', {
        method: 'PUT',
        body: JSON.stringify(updateRequest),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should encode registry name in URL', async () => {
      const updateRequest: UpdateRegistryRequest = {
        description: 'Updated',
      };

      mockFetchJson.mockResolvedValue({ name: 'my.registry' });

      await registriesApi.updateRegistry('my.registry', updateRequest);

      expect(mockFetchJson).toHaveBeenCalledWith('/registries/my.registry', {
        method: 'PUT',
        body: JSON.stringify(updateRequest),
      });
    });

    it('should throw 404 error when registry not found', async () => {
      const errorMessage = 'Registry not found';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      const updateRequest: UpdateRegistryRequest = {
        description: 'Updated',
      };

      await expect(registriesApi.updateRegistry('nonexistent', updateRequest)).rejects.toThrow(errorMessage);
    });
  });

  describe('deleteRegistry', () => {
    it('should delete registry successfully', async () => {
      const mockResponse: RegistryOperationResponse = {
        name: 'old-registry',
        message: 'Registry deleted successfully',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await registriesApi.deleteRegistry('old-registry');

      expect(mockFetchJson).toHaveBeenCalledWith('/registries/old-registry', {
        method: 'DELETE',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should encode special characters in registry name', async () => {
      mockFetchJson.mockResolvedValue({ name: 'my.registry' });

      await registriesApi.deleteRegistry('my.registry');

      expect(mockFetchJson).toHaveBeenCalledWith('/registries/my.registry', {
        method: 'DELETE',
      });
    });

    it('should throw 404 error when registry not found', async () => {
      const errorMessage = 'Registry not found';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      await expect(registriesApi.deleteRegistry('nonexistent')).rejects.toThrow(errorMessage);
    });

    it('should throw 403 error when user is not admin', async () => {
      const errorMessage = 'Forbidden: Admin privileges required';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      await expect(registriesApi.deleteRegistry('some-registry')).rejects.toThrow(errorMessage);
    });
  });

  describe('getAvailableRegistries', () => {
    it('should return registries accessible by current user', async () => {
      const mockAvailableRegistries = [
        {
          name: 'team-registry',
          registryUrl: 'registry.example.com',
          scenarioRepository: 'team/scenarios',
          description: 'Team private registry',
        },
        {
          name: 'public-registry',
          registryUrl: 'https://public.registry.com',
          scenarioRepository: 'public/scenarios',
        },
      ];

      const mockResponse = { registries: mockAvailableRegistries };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await registriesApi.getAvailableRegistries();

      expect(mockFetchJson).toHaveBeenCalledWith('/registries/available');
      expect(result).toEqual(mockAvailableRegistries);
    });

    it('should return empty array when no registries available', async () => {
      mockFetchJson.mockResolvedValue({ registries: [] });

      const result = await registriesApi.getAvailableRegistries();

      expect(result).toEqual([]);
    });

    it('should return empty array when registries field is missing', async () => {
      mockFetchJson.mockResolvedValue({});

      const result = await registriesApi.getAvailableRegistries();

      expect(result).toEqual([]);
    });

    it('should throw 401 error when not authenticated', async () => {
      const errorMessage = 'Unauthorized';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      await expect(registriesApi.getAvailableRegistries()).rejects.toThrow(errorMessage);
    });

    it('should only return registry metadata without credentials', async () => {
      const mockResponse = {
        registries: [
          {
            name: 'secure-registry',
            registryUrl: 'https://secure.example.com',
            scenarioRepository: 'org/scenarios',
            description: 'Secure registry',
            // Should NOT include: authType, token, username, password, groups
          },
        ],
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await registriesApi.getAvailableRegistries();

      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('registryUrl');
      expect(result[0]).toHaveProperty('scenarioRepository');
      expect(result[0]).not.toHaveProperty('authType');
      expect(result[0]).not.toHaveProperty('token');
      expect(result[0]).not.toHaveProperty('username');
      expect(result[0]).not.toHaveProperty('groups');
    });
  });
});
