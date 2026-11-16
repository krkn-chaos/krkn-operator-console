/**
 * Robots API client for krkn-operator-console
 *
 * Manages MCP robots: admin-created service accounts that authenticate to the
 * MCP server with long-lived tokens. Robots belong to groups and inherit the
 * group's cluster permissions.
 *
 * **Base URL:** `/api/v1`
 *
 * **Authentication:** Required (human admin JWT Bearer token in Authorization header)
 *
 * **Authorization:** All endpoints are admin only.
 *
 * **Error Handling:**
 * All methods throw ApiError on failure:
 * - 400 Bad Request: Validation error (invalid name/group/body)
 * - 401 Unauthorized: Invalid or expired token
 * - 403 Forbidden: Insufficient permissions (not admin)
 * - 404 Not Found: Robot not found (or route absent on old operators)
 * - 409 Conflict: Robot already exists / token conflict
 * - 500 Internal Server Error: Server error
 *
 * **Security:** Token values returned by issueRobotToken are shown to the admin
 * exactly once and must never be logged or persisted.
 */

import { config } from '../config';
import { BaseApiClient } from '../utils/apiClient';
import type {
  CreateRobotRequest,
  IssueRobotTokenResponse,
  ListRobotsResponse,
  RobotDetails,
  UpdateRobotRequest,
} from '../types/api';

const API_BASE = config.apiBaseUrl;

class RobotsApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  /**
   * GET /api/v1/robots
   * List all MCP robots (sorted by name by the backend)
   *
   * @returns Promise resolving to the robots list, total count, and whether
   *          the MCP feature is enabled on the operator
   * @throws {ApiError} 403 if not an admin, 404 on old operators, 500 on server error
   *
   * @example
   * ```typescript
   * const { robots, total, mcpEnabled } = await robotsApi.listRobots();
   * ```
   */
  async listRobots(): Promise<ListRobotsResponse> {
    return this.fetchJson<ListRobotsResponse>('/robots');
  }

  /**
   * GET /api/v1/robots/{name}
   * Get a single robot by name
   *
   * @param name - Robot name (URL-encoded automatically)
   * @returns Promise resolving to the robot's details
   * @throws {ApiError} 404 if robot not found
   *
   * @example
   * ```typescript
   * const robot = await robotsApi.getRobot('ci-runner');
   * ```
   */
  async getRobot(name: string): Promise<RobotDetails> {
    return this.fetchJson<RobotDetails>(`/robots/${encodeURIComponent(name)}`);
  }

  /**
   * POST /api/v1/robots
   * Create a new robot
   *
   * The backend uses a strict JSON decoder: unknown fields are rejected.
   *
   * @param req - Creation request (name required; description and groups optional)
   * @returns Promise resolving to the created robot
   * @throws {ApiError} 400 invalid name/group/body, 409 if robot already exists
   *
   * @example
   * ```typescript
   * const robot = await robotsApi.createRobot({
   *   name: 'ci-runner',
   *   description: 'CI pipeline robot',
   *   groups: ['dev-team'],
   * });
   * ```
   */
  async createRobot(req: CreateRobotRequest): Promise<RobotDetails> {
    return this.fetchJson<RobotDetails>('/robots', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /**
   * PATCH /api/v1/robots/{name}
   * Partially update a robot
   *
   * Only the provided keys are sent. `name` and `tokenId` are immutable and
   * must never be included (the backend's strict decoder rejects them).
   * A provided `groups` array REPLACES all group labels; `[]` clears them.
   *
   * @param name - Robot name (URL-encoded automatically)
   * @param req - Partial update (description, disabled, and/or groups)
   * @returns Promise resolving to the updated robot
   * @throws {ApiError} 400 invalid body, 404 if robot not found, 409 on conflict
   *
   * @example
   * ```typescript
   * await robotsApi.updateRobot('ci-runner', { description: 'Updated' });
   * ```
   */
  async updateRobot(name: string, req: UpdateRobotRequest): Promise<RobotDetails> {
    // Build body with only the keys actually provided — never send name/tokenId
    const body: UpdateRobotRequest = {};
    if (req.description !== undefined) body.description = req.description;
    if (req.disabled !== undefined) body.disabled = req.disabled;
    if (req.groups !== undefined) body.groups = req.groups;

    return this.fetchJson<RobotDetails>(`/robots/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /**
   * Enable or disable a robot
   *
   * Convenience wrapper around updateRobot for the `disabled` flag.
   * Disabled robots cannot authenticate and cannot be issued new tokens.
   *
   * @param name - Robot name (URL-encoded automatically)
   * @param disabled - true to disable, false to enable
   * @returns Promise resolving to the updated robot
   * @throws {ApiError} 404 if robot not found, 409 on conflict
   *
   * @example
   * ```typescript
   * await robotsApi.setRobotDisabled('ci-runner', true);
   * ```
   */
  async setRobotDisabled(name: string, disabled: boolean): Promise<RobotDetails> {
    return this.updateRobot(name, { disabled });
  }

  /**
   * Replace a robot's group labels
   *
   * The provided array REPLACES all existing group labels; pass `[]` to clear.
   *
   * @param name - Robot name (URL-encoded automatically)
   * @param groups - Complete new list of group labels
   * @returns Promise resolving to the updated robot
   * @throws {ApiError} 400 if a group does not exist, 404 if robot not found, 409 on conflict
   *
   * @example
   * ```typescript
   * await robotsApi.setRobotGroups('ci-runner', ['dev-team', 'qa-team']);
   * ```
   */
  async setRobotGroups(name: string, groups: string[]): Promise<RobotDetails> {
    return this.updateRobot(name, { groups });
  }

  /**
   * DELETE /api/v1/robots/{name}
   * Permanently delete a robot
   *
   * Returns 204 with an empty body — resolved as void via fetchNoContent.
   *
   * @param name - Robot name (URL-encoded automatically)
   * @returns Promise that resolves when deletion completes
   * @throws {ApiError} 404 if robot not found
   *
   * @example
   * ```typescript
   * await robotsApi.deleteRobot('ci-runner');
   * ```
   */
  async deleteRobot(name: string): Promise<void> {
    return this.fetchNoContent(`/robots/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  /**
   * POST /api/v1/robots/{name}/token
   * Issue (or re-issue) a robot token
   *
   * The token value is returned exactly once and must be displayed to the
   * admin immediately; it is never retrievable again. Never log the response.
   *
   * @param name - Robot name (URL-encoded automatically)
   * @returns Promise resolving to the one-time token, its id, and expiry
   * @throws {ApiError} 404 if robot not found, 409 if robot is disabled, 500 on server error
   *
   * @example
   * ```typescript
   * const { token, expiresAt } = await robotsApi.issueRobotToken('ci-runner');
   * // show token to the admin — it will not be shown again
   * ```
   */
  async issueRobotToken(name: string): Promise<IssueRobotTokenResponse> {
    return this.fetchJson<IssueRobotTokenResponse>(`/robots/${encodeURIComponent(name)}/token`, {
      method: 'POST',
    });
  }

  /**
   * DELETE /api/v1/robots/{name}/token
   * Revoke a robot's token
   *
   * Returns 204 with an empty body — resolved as void via fetchNoContent.
   * Idempotent on the backend.
   *
   * @param name - Robot name (URL-encoded automatically)
   * @returns Promise that resolves when revocation completes
   * @throws {ApiError} 404 if robot not found
   *
   * @example
   * ```typescript
   * await robotsApi.revokeRobotToken('ci-runner');
   * ```
   */
  async revokeRobotToken(name: string): Promise<void> {
    return this.fetchNoContent(`/robots/${encodeURIComponent(name)}/token`, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export const robotsApi = new RobotsApi();
