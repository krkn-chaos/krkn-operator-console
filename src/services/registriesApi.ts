import { BaseApiClient } from '../utils/apiClient';
import type {
  CreateRegistryRequest,
  UpdateRegistryRequest,
  RegistryDetails,
  ListRegistriesResponse,
  RegistryOperationResponse,
} from '../types/api';

const API_BASE = '/api/v1';

/**
 * Registries API client for krkn-operator-console
 *
 * Provides methods for private container registry management.
 * Registries store scenario images and can be shared across users via groups.
 *
 * **Base URL:** `/api/v1`
 *
 * **Authentication:** Required (JWT Bearer token in Authorization header)
 *
 * **Authorization:**
 * - All endpoints: Admin only
 *
 * **Error Handling:**
 * All methods throw errors on failure with the following structure:
 * - 401 Unauthorized: Invalid or expired token
 * - 403 Forbidden: Insufficient permissions (not admin)
 * - 404 Not Found: Registry not found
 * - 400 Bad Request: Validation error (invalid name, URL, etc.)
 * - 409 Conflict: Registry name already exists
 * - 500 Internal Server Error: Server error
 *
 * @example
 * ```typescript
 * import { registriesApi } from '../services/registriesApi';
 *
 * // List all registries
 * const registries = await registriesApi.listRegistries();
 *
 * // Create a new registry
 * await registriesApi.createRegistry({
 *   name: 'my-registry',
 *   registryUrl: 'https://registry.example.com',
 *   scenarioRepository: 'myorg/scenarios',
 *   authType: 'token',
 *   token: 'my-secret-token',
 *   skipTls: false,
 *   insecure: false,
 *   groups: ['dev-team', 'qa-team'],
 *   availableToAll: false
 * });
 * ```
 */
class RegistriesApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  /**
   * List all registries in the system
   *
   * Retrieves a complete list of all private registries with their configurations.
   * Credentials are not included in the response for security reasons.
   * Only administrators can access this endpoint.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** GET
   *
   * **Endpoint:** `/api/v1/registries`
   *
   * @returns Promise resolving to an array of registry details
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const registries = await registriesApi.listRegistries();
   * registries.forEach(registry => {
   *   console.log(`${registry.name}: ${registry.registryUrl}`);
   *   console.log(`Groups: ${registry.groups.join(', ')}`);
   * });
   * ```
   */
  async listRegistries(): Promise<RegistryDetails[]> {
    const data = await this.fetchJson<ListRegistriesResponse>('/registries');
    return data.registries || [];
  }

  /**
   * Get a specific registry by name
   *
   * Retrieves detailed information for a single registry.
   * Credentials are not included in the response for security reasons.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** GET
   *
   * **Endpoint:** `/api/v1/registries/{registryName}`
   *
   * @param name - The registry name (unique identifier)
   * @returns Promise resolving to the registry's details
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if registry not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const registry = await registriesApi.getRegistry('my-registry');
   * console.log(`Registry: ${registry.name}`);
   * console.log(`URL: ${registry.registryUrl}`);
   * console.log(`Auth Type: ${registry.authType}`);
   * ```
   */
  async getRegistry(name: string): Promise<RegistryDetails> {
    return this.fetchJson<RegistryDetails>(`/registries/${encodeURIComponent(name)}`);
  }

  /**
   * Create a new registry
   *
   * Creates a new private registry configuration with authentication.
   * Only administrators can create registries.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** POST
   *
   * **Endpoint:** `/api/v1/registries`
   *
   * **Validation:**
   * - name: Required, RFC 1123 compliant (lowercase alphanumeric, -, .)
   * - registryUrl: Required, valid URL format
   * - scenarioRepository: Required, format: org/repo
   * - authType: Required, must be 'token' or 'password'
   * - token: Required if authType='token'
   * - username/password: Required if authType='password'
   * - groups: Optional, empty array means no group access
   * - availableToAll: Optional, default false
   *
   * @param data - Registry creation request data
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 400 if validation fails
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 409 if registry name already exists
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * // Create registry with token auth
   * await registriesApi.createRegistry({
   *   name: 'my-private-registry',
   *   registryUrl: 'https://registry.example.com',
   *   scenarioRepository: 'myorg/chaos-scenarios',
   *   authType: 'token',
   *   token: 'my-secret-token',
   *   description: 'Private registry for production scenarios',
   *   skipTls: false,
   *   insecure: false,
   *   groups: ['ops-team'],
   *   availableToAll: false
   * });
   *
   * // Create registry with password auth
   * await registriesApi.createRegistry({
   *   name: 'dockerhub-private',
   *   registryUrl: 'https://registry.hub.docker.com',
   *   scenarioRepository: 'myusername/scenarios',
   *   authType: 'password',
   *   username: 'myusername',
   *   password: 'mypassword',
   *   availableToAll: true
   * });
   * ```
   */
  async createRegistry(data: CreateRegistryRequest): Promise<RegistryOperationResponse> {
    return this.fetchJson<RegistryOperationResponse>('/registries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing registry
   *
   * Updates registry configuration including credentials if provided.
   * Only administrators can update registries.
   * Registry name cannot be changed.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** PUT
   *
   * **Endpoint:** `/api/v1/registries/{registryName}`
   *
   * **Editable Fields:**
   * - registryUrl (optional)
   * - scenarioRepository (optional)
   * - authType (optional, if changed must provide new credentials)
   * - token (optional, required if authType='token')
   * - username/password (optional, required if authType='password')
   * - description (optional)
   * - skipTls (optional)
   * - insecure (optional)
   * - groups (optional)
   * - availableToAll (optional)
   *
   * **Non-Editable Fields:**
   * - name - immutable after creation
   *
   * @param name - The registry name (URL will be encoded automatically)
   * @param data - Registry update request data (only fields to change)
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 400 if validation fails
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if registry not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * // Update description and groups
   * await registriesApi.updateRegistry('my-registry', {
   *   description: 'Updated description',
   *   groups: ['dev-team', 'qa-team']
   * });
   *
   * // Change auth type from password to token
   * await registriesApi.updateRegistry('my-registry', {
   *   authType: 'token',
   *   token: 'new-secret-token'
   * });
   * ```
   */
  async updateRegistry(name: string, data: UpdateRegistryRequest): Promise<RegistryOperationResponse> {
    return this.fetchJson<RegistryOperationResponse>(`/registries/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a registry
   *
   * Permanently deletes a registry from the system.
   * Only administrators can delete registries.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** DELETE
   *
   * **Endpoint:** `/api/v1/registries/{registryName}`
   *
   * **Warning:** This operation is permanent and cannot be undone.
   * If this registry is used by active scenario runs, they may fail.
   *
   * @param name - The registry name (URL will be encoded automatically)
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if registry not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * try {
   *   await registriesApi.deleteRegistry('old-registry');
   *   console.log('Registry deleted successfully');
   * } catch (error) {
   *   console.error('Failed to delete registry:', error);
   * }
   * ```
   */
  async deleteRegistry(name: string): Promise<RegistryOperationResponse> {
    return this.fetchJson<RegistryOperationResponse>(`/registries/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }
}

export const registriesApi = new RegistriesApi();
