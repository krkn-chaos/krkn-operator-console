import { config } from '../config';
import type { WorkspaceInfo, WorkspacePVC, WorkspacePublishRequest } from '../types/api';
import { BaseApiClient } from '../utils/apiClient';

/** Authenticated workspace catalog and administrator publication API. */
class WorkspacesApi extends BaseApiClient {
  constructor() {
    super(config.apiBaseUrl);
  }

  /** List every published workspace, including unavailable bindings (admin only). */
  async listAll(): Promise<WorkspaceInfo[]> {
    const response = await this.fetchJson<{ workspaces: WorkspaceInfo[] }>('/workspaces');
    return response.workspaces ?? [];
  }

  /** List usable workspaces visible to the current user. */
  async listAvailable(): Promise<WorkspaceInfo[]> {
    const response = await this.fetchJson<{ workspaces: WorkspaceInfo[] }>('/workspaces/available');
    return response.workspaces ?? [];
  }

  /** List Bound Filesystem RWX PVCs that an admin may publish. */
  async listEligiblePVCs(): Promise<WorkspacePVC[]> {
    const response = await this.fetchJson<{ pvcs: WorkspacePVC[] }>('/workspaces/pvcs/available');
    return response.pvcs ?? [];
  }

  /** Publish or update an existing PVC under a platform alias (admin only). */
  async save(name: string, request: WorkspacePublishRequest): Promise<WorkspaceInfo> {
    return this.fetchJson<WorkspaceInfo>(`/workspaces/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  /** Remove only the platform alias; the PVC and its data remain (admin only). */
  async remove(name: string): Promise<void> {
    const response = await this.fetch(`/workspaces/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message || `HTTP ${response.status}: ${response.statusText}`);
    }
  }
}

export const workspacesApi = new WorkspacesApi();
