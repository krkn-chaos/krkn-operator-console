import { config } from '../config';
import type { CreateTargetResponse, ClustersResponse, NodesResponse, ScenariosRequest, ScenariosResponse, ScenarioDetail, ScenarioGlobals, ScenarioRunRequest, ScenarioRunResponse, JobStatusResponse } from '../types/api';

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
   * POST /scenarios/run
   * Run a chaos scenario
   * @param request - Scenario run request with all parameters
   * @returns Promise with job information
   */
  async runScenario(request: ScenarioRunRequest): Promise<ScenarioRunResponse> {
    const response = await fetch(`${this.baseUrl}/scenarios/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Failed to run scenario: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * GET /scenarios/run/{jobId}
   * Get status of a running job
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
}

// Export singleton instance
export const operatorApi = new OperatorApiClient();
