import { config } from '../config';
import { BaseApiClient } from '../utils/apiClient';

/** One feature described by a component build. */
export interface ComponentDescription {
  component: string;
  description: string;
}

/** Manifest published by a component. The version is its exact build tag. */
export interface ComponentManifest {
  version: string;
  components: ComponentDescription[];
}

export interface ListComponentsResponse {
  components: Record<string, ComponentManifest>;
}

class ComponentsApi extends BaseApiClient {
  constructor() {
    super(config.apiBaseUrl);
  }

  /** Read component versions from GET /api/v1/components. */
  async listComponents(signal?: AbortSignal): Promise<Record<string, ComponentManifest>> {
    const response = await this.fetchJson<ListComponentsResponse>('/components', { signal });
    return response.components;
  }
}

export const componentsApi = new ComponentsApi();
