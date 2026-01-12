import { config } from '../config';
import type { CreateTargetResponse, ClustersResponse, NodesResponse } from '../types/api';

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
}

// Export singleton instance
export const operatorApi = new OperatorApiClient();
