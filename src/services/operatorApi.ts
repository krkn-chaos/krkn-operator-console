import { config } from '../config';
import type {
  CreateTargetResponse,
  ClustersResponse,
  NodesResponse,
  ScenariosRequest,
  ScenariosResponse,
  ScenarioDetail,
  ScenarioGlobals,
  ScenarioRunRequest,
  CreateScenarioRunResponse,
  ScenarioRunStatusResponse,
  JobStatusResponse,
  JobsListResponse
} from '../types/api';

class OperatorApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
  }

  /**
   * POST /targets
   * Initialize a new target request
   * @returns Promise with UUID
   */
  async createTargetRequest(): Promise<CreateTargetResponse> {
    const response = await fetch(`${this.baseUrl}/targets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to create target request: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * GET /targets/{uuid}
   * Check target request completion status
   * @param uuid - Target request UUID
   * @returns HTTP status code
   */
  async getTargetStatus(uuid: string): Promise<number> {
    const response = await fetch(`${this.baseUrl}/targets/${uuid}`, {
      method: 'GET',
    });

    return response.status;
  }

  /**
   * GET /clusters?id={uuid}
   * Get list of available target clusters
   * @param uuid - Target request UUID
   * @returns Promise with clusters data
   */
  async getClusters(uuid: string): Promise<ClustersResponse> {
    const response = await fetch(`${this.baseUrl}/clusters?id=${uuid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to fetch clusters: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * GET /nodes?id={uuid}&cluster-name={clusterName}
   * Get nodes from selected cluster
   * @param uuid - Target request UUID
   * @param clusterName - Cluster name
   * @returns Promise with nodes data
   */
  async getNodes(uuid: string, clusterName: string): Promise<NodesResponse> {
    const response = await fetch(
      `${this.baseUrl}/nodes?id=${uuid}&cluster-name=${encodeURIComponent(clusterName)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to fetch nodes: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * POST /scenarios
   * Get available chaos scenarios from registry
   * @param request - Scenarios request with optional registry authentication
   * @returns Promise with scenarios data
   */
  async getScenarios(request: ScenariosRequest): Promise<ScenariosResponse> {
    const response = await fetch(`${this.baseUrl}/scenarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to fetch scenarios: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * POST /scenarios/detail/{scenarioName}
   * Get scenario detail with form fields
   * @param scenarioName - Name of the scenario
   * @param request - Scenarios request with optional registry authentication
   * @returns Promise with scenario detail data
   */
  async getScenarioDetail(scenarioName: string, request: ScenariosRequest): Promise<ScenarioDetail> {
    const response = await fetch(`${this.baseUrl}/scenarios/detail/${encodeURIComponent(scenarioName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to fetch scenario detail: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * POST /scenarios/globals/{scenarioName}
   * Get global parameters for a scenario
   * @param scenarioName - Name of the scenario
   * @param request - Scenarios request with optional registry authentication
   * @returns Promise with scenario globals data
   */
  async getScenarioGlobals(scenarioName: string, request: ScenariosRequest): Promise<ScenarioGlobals> {
    const response = await fetch(`${this.baseUrl}/scenarios/globals/${encodeURIComponent(scenarioName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to fetch scenario globals: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * POST /api/v1/scenarios/run
   * Create a new scenario run (NEW API: Returns scenarioRunName instead of job details)
   * @param request - Scenario run request with targetRequestId and clusterNames array
   * @returns Promise with scenarioRunName and basic info
   */
  async runScenario(request: ScenarioRunRequest): Promise<CreateScenarioRunResponse> {
    const response = await fetch(`${this.baseUrl}/scenarios/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to create scenario run: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * GET /api/v1/scenarios/run/{scenarioRunName}
   * Get the status of a scenario run including all cluster jobs
   * @param scenarioRunName - Scenario run name returned from POST /scenarios/run
   * @returns Promise with full scenario run status
   */
  async getScenarioRunStatus(scenarioRunName: string): Promise<ScenarioRunStatusResponse> {
    const response = await fetch(
      `${this.baseUrl}/scenarios/run/${encodeURIComponent(scenarioRunName)}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to fetch scenario run: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Build WebSocket URL for job logs using jobId (NEW API - CORRECT PATH)
   * @param scenarioRunName - Scenario run name
   * @param jobId - Job ID to get logs from
   * @param follow - Whether to follow/stream logs (default: true)
   * @returns WebSocket URL for log streaming
   */
  getJobLogsWebSocketUrl(
    scenarioRunName: string,
    jobId: string,
    follow: boolean = true
  ): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams();
    if (follow) params.append('follow', 'true');

    const path = `/api/v1/scenarios/run/${encodeURIComponent(scenarioRunName)}/jobs/${encodeURIComponent(jobId)}/logs`;
    const queryString = params.toString();

    return queryString
      ? `${protocol}//${host}${path}?${queryString}`
      : `${protocol}//${host}${path}`;
  }

  /**
   * Build WebSocket URL for scenario run logs
   * @deprecated Use getJobLogsWebSocketUrl() instead - this uses clusterName which is incorrect
   * @param scenarioRunName - Scenario run name
   * @param clusterName - Cluster name to get logs from
   * @param follow - Whether to follow/stream logs (default: true)
   * @returns WebSocket URL for log streaming
   */
  getScenarioRunLogsUrl(
    scenarioRunName: string,
    clusterName: string,
    follow: boolean = true
  ): string {
    const params = new URLSearchParams();
    if (follow) params.append('follow', 'true');

    const path = `/scenarios/run/${encodeURIComponent(scenarioRunName)}/logs/${encodeURIComponent(clusterName)}`;
    const queryString = params.toString();

    return queryString ? `${this.baseUrl}${path}?${queryString}` : `${this.baseUrl}${path}`;
  }

  /**
   * GET /api/v1/scenarios/run
   * List all scenario runs (NEW API)
   * @returns Promise with scenario runs array
   */
  async listScenarioRuns(): Promise<ScenarioRunStatusResponse[]> {
    const response = await fetch(`${this.baseUrl}/scenarios/run`, { method: 'GET' });

    if (!response.ok) {
      // Fallback: if backend doesn't support list yet, return empty array
      // This allows frontend to work with individual polling until backend is ready
      if (response.status === 404 || response.status === 405) {
        console.warn('List endpoint not implemented yet, using empty list');
        return [];
      }
      throw new Error(`Failed to list scenario runs: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('listScenarioRuns raw response:', JSON.stringify(data, null, 2));

    // Backend returns: {"scenarioRuns": [...]} (current)
    // or {"runs": [...]} (future spec)
    const runs = data.scenarioRuns || data.runs || [];
    console.log('Extracted runs:', runs);
    return runs;
  }

  /**
   * GET /scenarios/run
   * List all scenario jobs with optional filtering
   * @deprecated Use listScenarioRuns() instead
   * @param filters - Optional filters (status, scenarioName, clusterName)
   * @returns Promise with jobs list
   */
  async listJobs(filters?: {
    status?: string;
    scenarioName?: string;
    clusterName?: string;
  }): Promise<JobsListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.scenarioName) params.append('scenarioName', filters.scenarioName);
    if (filters?.clusterName) params.append('clusterName', filters.clusterName);

    const queryString = params.toString();
    const url = queryString ? `${this.baseUrl}/scenarios/run?${queryString}` : `${this.baseUrl}/scenarios/run`;

    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to list jobs: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * GET /scenarios/run/{jobId}
   * Get status of a running job
   * @deprecated Use getScenarioRunStatus() instead
   * @param jobId - Job ID to check
   * @returns Promise with job status
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await fetch(`${this.baseUrl}/scenarios/run/${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to fetch job status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * DELETE /scenarios/run/{jobId}
   * Cancel a running job
   * @deprecated Will be replaced with scenario run level cancellation
   * @param jobId - Job ID to cancel
   * @returns Promise with final job status
   */
  async cancelJob(jobId: string): Promise<JobStatusResponse> {
    const response = await fetch(`${this.baseUrl}/scenarios/run/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to cancel job: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * GET /scenarios/run/{jobId}/logs
   * Get streaming logs URL for a job
   * @param jobId - Job ID
   * @param follow - Whether to follow logs (stream)
   * @param tailLines - Number of lines to tail
   * @param timestamps - Whether to include timestamps
   * @returns URL for streaming logs
   */
  getJobLogsUrl(jobId: string, follow: boolean = true, tailLines?: number, timestamps: boolean = false): string {
    const params = new URLSearchParams();
    if (follow) {
      params.append('follow', 'true');
    }
    if (tailLines !== undefined) {
      params.append('tailLines', tailLines.toString());
    }
    if (timestamps) {
      params.append('timestamps', 'true');
    }

    // Return URL with query params only if there are any
    const queryString = params.toString();
    return queryString
      ? `${this.baseUrl}/scenarios/run/${encodeURIComponent(jobId)}/logs?${queryString}`
      : `${this.baseUrl}/scenarios/run/${encodeURIComponent(jobId)}/logs`;
  }

  /**
   * Validate clusterNames array for scenario run request
   * @param clusterNames - Array of cluster names to validate
   * @returns Array of validation error messages (empty if valid)
   */
  validateClusterNames(clusterNames: string[]): string[] {
    const errors: string[] = [];

    if (!clusterNames || clusterNames.length === 0) {
      errors.push('At least one cluster name is required');
      return errors;
    }

    // Check for empty strings
    if (clusterNames.some(name => !name || name.trim() === '')) {
      errors.push('Cluster names cannot be empty');
    }

    // Check for duplicates
    const uniqueNames = new Set(clusterNames);
    if (uniqueNames.size !== clusterNames.length) {
      errors.push('Duplicate cluster names found');
    }

    return errors;
  }
}

// Export singleton instance
export const operatorApi = new OperatorApiClient();
