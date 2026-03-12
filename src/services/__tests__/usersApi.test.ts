import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDetails, CreateUserRequest, UpdateUserRequest, ListUsersResponse, UserOperationResponse } from '../../types/api';

// Mock BaseApiClient's fetchJson method - must be declared before mock
const mockFetchJson = vi.fn();

vi.mock('../../utils/apiClient', () => {
  return {
    BaseApiClient: class {
      protected baseUrl: string;
      constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
      }
      protected fetchJson(...args: any[]) {
        return mockFetchJson(...args);
      }
    },
  };
});

// Import after mocking
const { usersApi } = await import('../usersApi');

describe('usersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listUsers', () => {
    it('should return list of users on successful response', async () => {
      const mockUsers: UserDetails[] = [
        {
          userId: 'user1@example.com',
          name: 'John',
          surname: 'Doe',
          role: 'admin',
          organization: 'Test Org',
          active: true,
          created: '2023-01-01T00:00:00Z',
          lastLogin: '2023-01-15T00:00:00Z',
        },
        {
          userId: 'user2@example.com',
          name: 'Jane',
          surname: 'Smith',
          role: 'user',
          active: true,
        },
      ];

      const mockResponse: ListUsersResponse = { users: mockUsers };
      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await usersApi.listUsers();

      expect(mockFetchJson).toHaveBeenCalledWith('/users');
      expect(result).toEqual(mockUsers);
    });

    it('should return empty array when users array is missing', async () => {
      mockFetchJson.mockResolvedValue({});

      const result = await usersApi.listUsers();

      expect(result).toEqual([]);
    });

    it('should throw error on API failure', async () => {
      const errorMessage = 'Network error';
      mockFetchJson.mockRejectedValue(new Error(errorMessage));

      await expect(usersApi.listUsers()).rejects.toThrow(errorMessage);
    });
  });

  describe('getUser', () => {
    it('should fetch specific user by userId', async () => {
      const mockUser: UserDetails = {
        userId: 'user1@example.com',
        name: 'John',
        surname: 'Doe',
        role: 'admin',
        active: true,
      };

      mockFetchJson.mockResolvedValue(mockUser);

      const result = await usersApi.getUser('user1@example.com');

      expect(mockFetchJson).toHaveBeenCalledWith('/users/user1%40example.com');
      expect(result).toEqual(mockUser);
    });

    it('should encode special characters in userId', async () => {
      const mockUser: UserDetails = {
        userId: 'user+test@example.com',
        name: 'Test',
        surname: 'User',
        role: 'user',
        active: true,
      };

      mockFetchJson.mockResolvedValue(mockUser);

      await usersApi.getUser('user+test@example.com');

      expect(mockFetchJson).toHaveBeenCalledWith('/users/user%2Btest%40example.com');
    });

    it('should throw error when user not found', async () => {
      mockFetchJson.mockRejectedValue(new Error('HTTP 404'));

      await expect(usersApi.getUser('nonexistent@example.com')).rejects.toThrow('HTTP 404');
    });
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const createRequest: CreateUserRequest = {
        userId: 'newuser@example.com',
        password: 'password123',
        name: 'New',
        surname: 'User',
        role: 'user',
        organization: 'Test Org',
      };

      const mockResponse: UserOperationResponse = {
        userId: 'newuser@example.com',
        message: 'User created successfully',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await usersApi.createUser(createRequest);

      expect(mockFetchJson).toHaveBeenCalledWith('/users', {
        method: 'POST',
        body: JSON.stringify(createRequest),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle validation errors', async () => {
      const createRequest: CreateUserRequest = {
        userId: 'invalid-email',
        password: 'short',
        name: '',
        surname: '',
        role: 'user',
      };

      mockFetchJson.mockRejectedValue(new Error('Validation failed'));

      await expect(usersApi.createUser(createRequest)).rejects.toThrow('Validation failed');
    });

    it('should create user without optional organization field', async () => {
      const createRequest: CreateUserRequest = {
        userId: 'newuser@example.com',
        password: 'password123',
        name: 'New',
        surname: 'User',
        role: 'user',
      };

      const mockResponse: UserOperationResponse = {
        userId: 'newuser@example.com',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await usersApi.createUser(createRequest);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateUser', () => {
    it('should update user with valid data', async () => {
      const updateRequest: UpdateUserRequest = {
        name: 'Updated',
        surname: 'Name',
        role: 'admin',
        organization: 'New Org',
      };

      const mockResponse: UserOperationResponse = {
        userId: 'user@example.com',
        message: 'User updated successfully',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await usersApi.updateUser('user@example.com', updateRequest);

      expect(mockFetchJson).toHaveBeenCalledWith('/users/user%40example.com', {
        method: 'PATCH',
        body: JSON.stringify(updateRequest),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle partial updates', async () => {
      const updateRequest: UpdateUserRequest = {
        role: 'admin',
      };

      const mockResponse: UserOperationResponse = {
        userId: 'user@example.com',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await usersApi.updateUser('user@example.com', updateRequest);

      expect(result).toEqual(mockResponse);
    });

    it('should throw error when user not found', async () => {
      const updateRequest: UpdateUserRequest = {
        name: 'Updated',
      };

      mockFetchJson.mockRejectedValue(new Error('HTTP 404'));

      await expect(usersApi.updateUser('nonexistent@example.com', updateRequest)).rejects.toThrow('HTTP 404');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const mockResponse: UserOperationResponse = {
        userId: 'user@example.com',
        message: 'User deleted successfully',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      const result = await usersApi.deleteUser('user@example.com');

      expect(mockFetchJson).toHaveBeenCalledWith('/users/user%40example.com', {
        method: 'DELETE',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when user not found', async () => {
      mockFetchJson.mockRejectedValue(new Error('HTTP 404'));

      await expect(usersApi.deleteUser('nonexistent@example.com')).rejects.toThrow('HTTP 404');
    });

    it('should encode special characters in userId for deletion', async () => {
      const mockResponse: UserOperationResponse = {
        userId: 'user+test@example.com',
      };

      mockFetchJson.mockResolvedValue(mockResponse);

      await usersApi.deleteUser('user+test@example.com');

      expect(mockFetchJson).toHaveBeenCalledWith('/users/user%2Btest%40example.com', {
        method: 'DELETE',
      });
    });
  });
});
