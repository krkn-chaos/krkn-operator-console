import { BaseApiClient } from '../utils/apiClient';
import type {
  CreateGroupRequest,
  UpdateGroupRequest,
  GroupDetails,
  ListGroupsResponse,
  GroupOperationResponse,
  GroupMemberDetails,
  ListGroupMembersResponse,
  AddGroupMemberRequest,
  GroupMemberOperationResponse,
} from '../types/api';

const API_BASE = '/api/v1';

/**
 * Groups API client for krkn-operator-console
 *
 * Provides methods for group management and cluster permissions.
 * Groups organize users and define access to clusters.
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
 * - 404 Not Found: Group not found
 * - 400 Bad Request: Validation error
 * - 409 Conflict: Group already exists
 * - 500 Internal Server Error: Server error
 *
 * @example
 * ```typescript
 * import { groupsApi } from '../services/groupsApi';
 *
 * // List all groups
 * const groups = await groupsApi.listGroups();
 *
 * // Create a new group
 * await groupsApi.createGroup({
 *   name: 'dev-team',
 *   description: 'Development team with cluster access',
 *   clusterPermissions: {
 *     'https://api.cluster1.example.com': { actions: ['view', 'run'] },
 *     'https://api.cluster2.example.com': { actions: ['view', 'run', 'cancel'] }
 *   }
 * });
 *
 * // Add member to group
 * await groupsApi.addGroupMember('dev-team', 'user@example.com');
 * ```
 */
class GroupsApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  /**
   * List all groups in the system
   *
   * Retrieves a complete list of all groups with their permissions and member counts.
   * Only administrators can access this endpoint.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** GET
   *
   * **Endpoint:** `/api/v1/groups`
   *
   * @returns Promise resolving to an array of group details
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const groups = await groupsApi.listGroups();
   * groups.forEach(group => {
   *   console.log(`${group.name}: ${group.memberCount} members`);
   * });
   * ```
   */
  async listGroups(): Promise<GroupDetails[]> {
    const data = await this.fetchJson<ListGroupsResponse>('/groups');
    return data.groups || [];
  }

  /**
   * Get a specific group by name
   *
   * Retrieves detailed information for a single group including cluster permissions.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** GET
   *
   * **Endpoint:** `/api/v1/groups/{groupName}`
   *
   * @param groupName - The group name (unique identifier)
   * @returns Promise resolving to the group's details
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if group not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const group = await groupsApi.getGroup('dev-team');
   * console.log(`Group: ${group.name}`);
   * console.log(`Description: ${group.description}`);
   * console.log(`Cluster permissions:`, group.clusterPermissions);
   * ```
   */
  async getGroup(groupName: string): Promise<GroupDetails> {
    return this.fetchJson<GroupDetails>(`/groups/${encodeURIComponent(groupName)}`);
  }

  /**
   * Create a new group
   *
   * Creates a new group with specified cluster permissions.
   * Only administrators can create groups.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** POST
   *
   * **Endpoint:** `/api/v1/groups`
   *
   * **Validation:**
   * - name is required and must be unique
   * - clusterPermissions must have at least one cluster with at least one action
   * - actions can be: 'view', 'run', 'cancel'
   *
   * @param data - Group creation request data
   * @param data.name - Group name (unique identifier)
   * @param data.description - Optional group description
   * @param data.clusterPermissions - Map of cluster API URLs to permissions
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 400 if validation fails
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 409 if group already exists
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const response = await groupsApi.createGroup({
   *   name: 'ops-team',
   *   description: 'Operations team with full access',
   *   clusterPermissions: {
   *     'https://api.prod.example.com': { actions: ['view', 'run', 'cancel'] }
   *   }
   * });
   * console.log(response.message); // "Group created successfully"
   * ```
   */
  async createGroup(data: CreateGroupRequest): Promise<GroupOperationResponse> {
    return this.fetchJson<GroupOperationResponse>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing group
   *
   * Updates group description and/or cluster permissions.
   * Only administrators can update groups.
   * Group name cannot be changed.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** PATCH
   *
   * **Endpoint:** `/api/v1/groups/{groupName}`
   *
   * **Editable Fields:**
   * - description (optional)
   * - clusterPermissions (optional)
   *
   * **Non-Editable Fields:**
   * - name - immutable after creation
   *
   * @param groupName - The group name (URL will be encoded automatically)
   * @param data - Group update request data (only fields to change)
   * @param data.description - Updated description (optional)
   * @param data.clusterPermissions - Updated cluster permissions (optional)
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 400 if validation fails
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if group not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * // Update description only
   * await groupsApi.updateGroup('dev-team', {
   *   description: 'Updated description'
   * });
   *
   * // Update cluster permissions
   * await groupsApi.updateGroup('dev-team', {
   *   clusterPermissions: {
   *     'https://api.cluster1.example.com': { actions: ['view', 'run', 'cancel'] }
   *   }
   * });
   * ```
   */
  async updateGroup(groupName: string, data: UpdateGroupRequest): Promise<GroupOperationResponse> {
    return this.fetchJson<GroupOperationResponse>(`/groups/${encodeURIComponent(groupName)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a group
   *
   * Permanently deletes a group from the system.
   * All users will be removed from this group.
   * Only administrators can delete groups.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** DELETE
   *
   * **Endpoint:** `/api/v1/groups/{groupName}`
   *
   * **Warning:** This operation is permanent and cannot be undone.
   * All users in this group will lose their group membership.
   *
   * @param groupName - The group name (URL will be encoded automatically)
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if group not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * try {
   *   await groupsApi.deleteGroup('old-team');
   *   console.log('Group deleted successfully');
   * } catch (error) {
   *   console.error('Failed to delete group:', error);
   * }
   * ```
   */
  async deleteGroup(groupName: string): Promise<GroupOperationResponse> {
    return this.fetchJson<GroupOperationResponse>(`/groups/${encodeURIComponent(groupName)}`, {
      method: 'DELETE',
    });
  }

  /**
   * List all members of a group
   *
   * Retrieves a list of all users who are members of the specified group.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** GET
   *
   * **Endpoint:** `/api/v1/groups/{groupName}/members`
   *
   * @param groupName - The group name
   * @returns Promise resolving to an array of group member details
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if group not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const members = await groupsApi.listGroupMembers('dev-team');
   * console.log(`Group has ${members.length} members`);
   * members.forEach(member => {
   *   console.log(`${member.name} ${member.surname} (${member.userId})`);
   * });
   * ```
   */
  async listGroupMembers(groupName: string): Promise<GroupMemberDetails[]> {
    const data = await this.fetchJson<ListGroupMembersResponse>(
      `/groups/${encodeURIComponent(groupName)}/members`
    );
    return data.members || [];
  }

  /**
   * Add a user to a group
   *
   * Adds an existing user to the specified group.
   * The user will inherit the group's cluster permissions.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** POST
   *
   * **Endpoint:** `/api/v1/groups/{groupName}/members`
   *
   * **Validation:**
   * - User must exist
   * - User cannot already be a member of this group
   *
   * @param groupName - The group name
   * @param userId - The user's email address
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 400 if validation fails (user not found or already member)
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if group not found
   * @throws {Error} 409 if user already in group
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * await groupsApi.addGroupMember('dev-team', 'john.doe@example.com');
   * console.log('User added to group successfully');
   * ```
   */
  async addGroupMember(groupName: string, userId: string): Promise<GroupMemberOperationResponse> {
    const data: AddGroupMemberRequest = { userId };
    return this.fetchJson<GroupMemberOperationResponse>(
      `/groups/${encodeURIComponent(groupName)}/members`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Remove a user from a group
   *
   * Removes a user from the specified group.
   * The user will lose access to clusters granted by this group.
   *
   * **Authorization:** Admin only
   *
   * **HTTP Method:** DELETE
   *
   * **Endpoint:** `/api/v1/groups/{groupName}/members/{userId}`
   *
   * @param groupName - The group name
   * @param userId - The user's email address (URL will be encoded automatically)
   * @returns Promise resolving to operation response with success message
   * @throws {Error} 401 if not authenticated
   * @throws {Error} 403 if not an admin
   * @throws {Error} 404 if group or user not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * await groupsApi.removeGroupMember('dev-team', 'john.doe@example.com');
   * console.log('User removed from group successfully');
   * ```
   */
  async removeGroupMember(groupName: string, userId: string): Promise<GroupMemberOperationResponse> {
    return this.fetchJson<GroupMemberOperationResponse>(
      `/groups/${encodeURIComponent(groupName)}/members/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
  }
}

export const groupsApi = new GroupsApi();
