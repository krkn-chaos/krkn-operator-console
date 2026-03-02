import { BaseApiClient } from '../utils/apiClient';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserDetails,
  ListUsersResponse,
  UserOperationResponse,
} from '../types/api';

const API_BASE = '/api/v1';

/**
 * Users API client for krkn-operator-console
 *
 * Provides methods for user account management (CRUD operations).
 * All methods require authentication via JWT Bearer token.
 *
 * **Base URL:** `/api/v1`
 *
 * **Authentication:** Required (JWT Bearer token in Authorization header)
 *
 * **Authorization:**
 * - `listUsers()`: Admin only
 * - `getUser()`: All authenticated users
 * - `createUser()`: Admin only
 * - `updateUser()`: Admin only
 * - `deleteUser()`: Admin only
 *
 * **Error Handling:**
 * All methods throw errors on failure with the following structure:
 * - 401 Unauthorized: Invalid or expired token
 * - 403 Forbidden: Insufficient permissions
 * - 404 Not Found: User not found
 * - 400 Bad Request: Validation error
 * - 500 Internal Server Error: Server error
 *
 * @example
 * ```typescript
 * import { usersApi } from '../services/usersApi';
 *
 * // List all users (admin only)
 * try {
 *   const users = await usersApi.listUsers();
 *   console.log(`Found ${users.length} users`);
 * } catch (error) {
 *   console.error('Failed to load users:', error);
 * }
 *
 * // Create a new user (admin only)
 * try {
 *   await usersApi.createUser({
 *     userId: 'user@example.com',
 *     password: 'securePassword123',
 *     name: 'John',
 *     surname: 'Doe',
 *     role: 'user',
 *     organization: 'Engineering Team',
 *   });
 * } catch (error) {
 *   console.error('Failed to create user:', error);
 * }
 *
 * // Get a specific user (all users)
 * const user = await usersApi.getUser('user@example.com');
 *
 * // Update a user (admin only)
 * await usersApi.updateUser('user@example.com', {
 *   name: 'John',
 *   surname: 'Smith',
 *   role: 'admin',
 * });
 *
 * // Delete a user (admin only)
 * await usersApi.deleteUser('user@example.com');
 * ```
 */
class UsersApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  /**
   * List all users in the system
   *
   * Retrieves a complete list of all user accounts with their details.
   * Only administrators can access this endpoint.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** GET
   *
   * **Endpoint:** `/api/v1/auth/users`
   *
   * @returns Promise resolving to an array of user details
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const users = await usersApi.listUsers();
   * users.forEach(user => {
   *   console.log(`${user.name} ${user.surname} (${user.role})`);
   * });
   * ```
   */
  async listUsers(): Promise<UserDetails[]> {
    const data = await this.fetchJson<ListUsersResponse>('/users');
    return data.users || [];
  }

  /**
   * Get a specific user by userId (email address)
   *
   * Retrieves detailed information for a single user account.
   * Available to all authenticated users (not admin-only).
   *
   * **Authorization:** All authenticated users
   *
   * **HTTP Method:** GET
   *
   * **Endpoint:** `/api/v1/auth/users/{userId}`
   *
   * @param userId - The user's email address (used as unique identifier)
   * @returns Promise resolving to the user's details
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 404 if user not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const user = await usersApi.getUser('john.doe@example.com');
   * console.log(`User: ${user.name} ${user.surname}`);
   * console.log(`Role: ${user.role}`);
   * console.log(`Last login: ${user.lastLogin}`);
   * ```
   */
  async getUser(userId: string): Promise<UserDetails> {
    return this.fetchJson<UserDetails>(`/users/${encodeURIComponent(userId)}`);
  }

  /**
   * Create a new user account
   *
   * Creates a new user with the specified credentials and profile information.
   * Only administrators can create new users.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** POST
   *
   * **Endpoint:** `/api/v1/auth/users`
   *
   * **Validation:**
   * - userId must be a valid email format
   * - password must be at least 8 characters
   * - name and surname are required
   * - role must be either 'user' or 'admin'
   * - organization is optional
   *
   * @param data - User creation request data
   * @param data.userId - Email address (unique identifier)
   * @param data.password - User password (min 8 characters)
   * @param data.name - First name
   * @param data.surname - Last name
   * @param data.role - User role ('user' or 'admin')
   * @param data.organization - Optional organization name
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 400 if validation fails
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 409 if user already exists
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const response = await usersApi.createUser({
   *   userId: 'jane.smith@example.com',
   *   password: 'SecurePass123',
   *   name: 'Jane',
   *   surname: 'Smith',
   *   role: 'user',
   *   organization: 'QA Team',
   * });
   * console.log(response.message); // "User created successfully"
   * ```
   */
  async createUser(data: CreateUserRequest): Promise<UserOperationResponse> {
    return this.fetchJson<UserOperationResponse>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing user account
   *
   * Updates user profile information and optionally changes password.
   * Only administrators can update user accounts.
   * Email address (userId) cannot be changed.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** PATCH
   *
   * **Endpoint:** `/api/v1/users/{userId}`
   *
   * **Editable Fields:**
   * - name (first name)
   * - surname (last name)
   * - role (user/admin)
   * - organization
   * - password (optional - only if changing password)
   *
   * **Non-Editable Fields:**
   * - userId (email) - immutable after creation
   * - createdAt, lastLogin, enabled - managed by system
   *
   * @param userId - The user's email address (URL will be encoded automatically)
   * @param data - User update request data (only fields to change)
   * @param data.name - Updated first name
   * @param data.surname - Updated last name
   * @param data.role - Updated role ('user' or 'admin')
   * @param data.organization - Updated organization (optional)
   * @param data.password - New password (optional, min 8 characters if provided)
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 400 if validation fails
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if user not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * // Update role and organization
   * await usersApi.updateUser('john.doe@example.com', {
   *   name: 'John',
   *   surname: 'Doe',
   *   role: 'admin',
   *   organization: 'IT Department',
   * });
   *
   * // Update with password change
   * await usersApi.updateUser('john.doe@example.com', {
   *   name: 'John',
   *   surname: 'Doe',
   *   role: 'admin',
   *   organization: 'IT Department',
   *   password: 'NewSecurePass456',
   * });
   * ```
   */
  async updateUser(userId: string, data: UpdateUserRequest): Promise<UserOperationResponse> {
    return this.fetchJson<UserOperationResponse>(`/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a user account
   *
   * Permanently deletes a user account from the system.
   * Only administrators can delete users.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** DELETE
   *
   * **Endpoint:** `/api/v1/auth/users/{userId}`
   *
   * **Safety Restrictions (enforced in UI and backend):**
   * - Users cannot delete their own account (self-deletion prevention)
   * - Cannot delete the last remaining admin account (system protection)
   *
   * **Warning:** This operation is permanent and cannot be undone.
   * All user data and associations will be removed.
   *
   * @param userId - The user's email address (URL will be encoded automatically)
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 400 if attempting to delete self or last admin
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if user not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * try {
   *   await usersApi.deleteUser('old.user@example.com');
   *   console.log('User deleted successfully');
   * } catch (error) {
   *   if (error.message.includes('Cannot delete')) {
   *     console.error('Safety check failed:', error.message);
   *   } else {
   *     console.error('Failed to delete user:', error);
   *   }
   * }
   * ```
   */
  async deleteUser(userId: string): Promise<UserOperationResponse> {
    return this.fetchJson<UserOperationResponse>(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }
}

export const usersApi = new UsersApi();
