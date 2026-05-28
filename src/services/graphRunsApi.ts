/**
 * GraphRun API Client
 *
 * Provides methods for managing chaos scenario graph runs via the krkn-operator GraphRun API.
 * Handles CRUD operations for dependency-based scenario execution graphs.
 */

import { config } from '../config';
import { BaseApiClient } from '../utils/apiClient';
import type {
  GraphRunListItem,
  GraphRunDetail,
  CreateGraphRunRequest,
  ListGraphRunsFilters,
  GraphScenarioNode,
} from '../types/api';

class GraphRunsApiClient extends BaseApiClient {
  constructor() {
    super(config.apiBaseUrl);
  }

  /**
   * GET /api/v1/graphruns
   * List all graph runs with optional filtering
   *
   * @param filters - Optional filters (ownerUserId)
   * @returns Promise with array of graph run list items
   *
   * @example
   * ```typescript
   * // List all graph runs
   * const allRuns = await graphRunsApi.listGraphRuns();
   *
   * // List graph runs for specific user
   * const userRuns = await graphRunsApi.listGraphRuns({ ownerUserId: 'user@example.com' });
   * ```
   */
  async listGraphRuns(filters?: ListGraphRunsFilters): Promise<GraphRunListItem[]> {
    const params = new URLSearchParams();
    if (filters?.ownerUserId) {
      params.append('ownerUserId', filters.ownerUserId);
    }

    const queryString = params.toString();
    const url = queryString ? `/graphruns?${queryString}` : '/graphruns';

    // API returns {graphRuns: [...]} not a direct array
    const data = await this.fetchJson<{ graphRuns?: GraphRunListItem[] }>(url);
    return data.graphRuns || [];
  }

  /**
   * GET /api/v1/graphruns/:name
   * Get detailed information about a specific graph run
   *
   * @param name - Graph run name
   * @returns Promise with graph run details including spec and status
   *
   * @throws {Error} 404 if graph run not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const graphRun = await graphRunsApi.getGraphRun('graphrun-abc123');
   * console.log(`Phase: ${graphRun.status.phase}`);
   * console.log(`Completed: ${graphRun.status.summary.completedNodes}/${graphRun.status.summary.totalNodes}`);
   * ```
   */
  async getGraphRun(name: string): Promise<GraphRunDetail> {
    return this.fetchJson<GraphRunDetail>(`/graphruns/${encodeURIComponent(name)}`);
  }

  /**
   * POST /api/v1/graphruns
   * Create a new graph run
   *
   * Creates a KrknGraphRun CR in the backend, which will orchestrate execution
   * of scenarios according to the dependency graph.
   *
   * @param request - Graph run creation request with graph, targetRequestId, and targetClusters
   * @returns Promise with created graph run details
   *
   * @throws {Error} 400 if validation fails (empty graph, invalid targetRequestId, etc.)
   * @throws {Error} 401 if user is not authenticated
   * @throws {Error} 403 if user lacks permissions on target clusters
   * @throws {Error} 404 if target request not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * const graphRun = await graphRunsApi.createGraphRun({
   *   graph: {
   *     'node1': {
   *       name: 'pod-scenarios',
   *       image: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios',
   *       env: { SCENARIO_TYPE: 'pod_delete' }
   *     },
   *     'node2': {
   *       name: 'network-chaos',
   *       image: 'quay.io/krkn-chaos/krkn-hub:network-chaos',
   *       depends_on: 'node1' // Runs after node1 completes
   *     }
   *   },
   *   targetRequestId: 'target-uuid-123',
   *   targetClusters: {
   *     'krkn-operator': ['cluster1', 'cluster2']
   *   }
   * });
   * ```
   */
  async createGraphRun(request: CreateGraphRunRequest): Promise<GraphRunDetail> {
    return this.fetchJson<GraphRunDetail>('/graphruns', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * DELETE /api/v1/graphruns/:name
   * Delete a graph run (cascade deletes scenario runs via owner references)
   *
   * Only the owner or an admin can delete a graph run.
   * Deletion will cascade to all associated KrknScenarioRun resources.
   *
   * @param name - Graph run name to delete
   * @returns Promise that resolves when deletion is complete
   *
   * @throws {Error} 400 if name is missing
   * @throws {Error} 401 if user is not authenticated
   * @throws {Error} 403 if user is not owner or admin
   * @throws {Error} 404 if graph run not found
   * @throws {Error} 500 on server error
   *
   * @example
   * ```typescript
   * await graphRunsApi.deleteGraphRun('graphrun-abc123');
   * ```
   */
  async deleteGraphRun(name: string): Promise<void> {
    const response = await this.fetch(`/graphruns/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      // Try to parse error message from response
      let errorMessage: string | null = null;
      try {
        const error = await response.json();
        errorMessage = error.message;
      } catch {
        // JSON parsing failed, use status text
      }

      throw new Error(errorMessage || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Validate graph structure before submission
   *
   * Performs client-side validation of the graph to catch common errors
   * before sending to the backend.
   *
   * @param graph - Dependency graph to validate
   * @returns Array of validation error messages (empty if valid)
   *
   * @example
   * ```typescript
   * const errors = graphRunsApi.validateGraph(myGraph);
   * if (errors.length > 0) {
   *   console.error('Validation errors:', errors);
   * }
   * ```
   */
  validateGraph(graph: { [nodeId: string]: GraphScenarioNode }): string[] {
    const errors: string[] = [];

    if (!graph || Object.keys(graph).length === 0) {
      errors.push('Graph cannot be empty');
      return errors;
    }

    const nodeIds = Object.keys(graph);

    // Validate each node
    for (const [nodeId, node] of Object.entries(graph)) {
      // Node ID cannot be empty
      if (!nodeId || nodeId.trim() === '') {
        errors.push('Node IDs cannot be empty');
      }

      // Node must have either name or image
      if (!node.name && !node.image) {
        errors.push(`Node '${nodeId}' must have either name or image`);
      }

      // Validate depends_on references
      if (node.depends_on) {
        if (!nodeIds.includes(node.depends_on)) {
          errors.push(`Node '${nodeId}' depends on non-existent node '${node.depends_on}'`);
        }

        // Check for self-dependency
        if (node.depends_on === nodeId) {
          errors.push(`Node '${nodeId}' cannot depend on itself`);
        }
      }
    }

    // Check for circular dependencies
    const circularErrors = this.detectCircularDependencies(graph);
    errors.push(...circularErrors);

    return errors;
  }

  /**
   * Detect circular dependencies in the graph
   * Uses depth-first search to detect cycles
   *
   * @param graph - Dependency graph to check
   * @returns Array of error messages for circular dependencies found
   */
  private detectCircularDependencies(graph: { [nodeId: string]: GraphScenarioNode }): string[] {
    const errors: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): boolean => {
      // Check if node exists in graph (skip if invalid dependency already reported)
      if (!graph[nodeId]) {
        return false;
      }

      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = [...path.slice(cycleStart), nodeId].join(' -> ');
        errors.push(`Circular dependency detected: ${cycle}`);
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = graph[nodeId];
      if (node.depends_on) {
        dfs(node.depends_on, [...path]);
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check each node as a potential starting point
    for (const nodeId of Object.keys(graph)) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return errors;
  }
}

// Export singleton instance
export const graphRunsApi = new GraphRunsApiClient();
