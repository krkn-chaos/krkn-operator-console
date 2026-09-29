import { config } from '../config';
import { BaseApiClient } from '../utils/apiClient';

export interface KrknAIApiRequestOptions {
  signal?: AbortSignal;
}

export interface KrknAITargetSelection {
  targetRequestId: string;
  targetClusters: Record<string, string[]>;
}

export interface KrknAIDiscoveryRequest extends KrknAITargetSelection {
  namespacePattern?: string;
  podLabelPattern?: string;
  nodeLabelPattern?: string;
  skipPodName?: string;
}

export interface KrknAIDiscoveryResponse {
  configYaml: string;
  warnings: string[];
}

export interface KrknAIConfigValidationIssue {
  path: string;
  message: string;
}

export interface KrknAIConfigValidationResponse {
  valid: true;
}

export interface KrknAIConfigRequest extends KrknAITargetSelection {
  name: string;
  configYaml: string;
  description?: string;
  groups?: string[];
  availableToAll?: boolean;
}

export interface KrknAIConfigResponse {
  configId: string;
}

export interface KrknAIRunRequest extends KrknAITargetSelection {
  name: string;
  configId: string;
  prometheusUrl?: string;
  prometheusTokenSecretRef?: string;
  activeDeadlineSeconds?: number;
}

export type KrknAIRunPhase = 'Pending' | 'Provisioning' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled' | string;

export interface KrknAIRunResource {
  apiVersion?: string;
  kind?: string;
  metadata: {
    name: string;
    uid: string;
    creationTimestamp: string;
    [key: string]: unknown;
  };
  spec: {
    targetRequestId: string;
    targetClusterApiUrl?: string;
    configMapName?: string;
    configMapKey?: string;
    orchestratorImage?: string;
    ownerUserId?: string;
    prometheusUrl?: string;
    prometheusTokenSecretRef?: string;
    activeDeadlineSeconds?: number;
    [key: string]: unknown;
  };
  status: {
    phase?: KrknAIRunPhase;
    orchestratorPodName?: string;
    failureReason?: string;
    startTime?: string;
    completionTime?: string;
    scenarioRunRefs?: string[];
    conditions?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

export interface KrknAIFitnessProgression {
  generation: number;
  best: number | null;
  average: number | null;
}

export type KrknAIArtifactStatus = 'not_available' | 'in_progress' | 'succeeded' | 'failed';

export interface KrknAIRunSummary {
  name: string;
  phase: KrknAIRunPhase;
  createdAt: string;
  cluster: string;
  orchestratorPodName: string;
  failureReason: string;
  artifactStatus: KrknAIArtifactStatus;
  completedGenerations: number | null;
  completedScenarios: number | null;
  configuredGenerations: number | null;
  populationSize: number | null;
  bestFitness: number | null;
  averageFitness: number | null;
  baselineFitness: number | null;
  fitnessProgression: KrknAIFitnessProgression[];
}

export type KrknAIScenarioSortKey =
  | 'generation'
  | 'scenarioId'
  | 'scenarioType'
  | 'fitnessScore'
  | 'outcome'
  | 'durationSeconds';

export interface KrknAIScenarioIndexFilters {
  page?: number;
  limit?: number;
  generation?: number;
  scenarioType?: string;
  search?: string;
  sort?: KrknAIScenarioSortKey;
  direction?: 'asc' | 'desc';
  [filter: string]: string | number | boolean | null | undefined;
}

export interface KrknAIScenarioIndexRow {
  generation: number;
  scenarioId: string;
  scenarioType?: string;
  outcome?: string;
  durationSeconds?: number | null;
  fitnessScore?: number | null;
  fitnessState?: 'provisional' | 'final' | string;
  childRunName?: string;
  phase?: string;
  jobId?: string;
  podName?: string;
}

export interface KrknAIScenarioPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface KrknAIScenarioIndexResponse {
  scenarios: KrknAIScenarioIndexRow[];
  pagination: KrknAIScenarioPagination;
}

export interface KrknAIScenarioFitnessScore {
  id: number;
  fitnessScore: number | null;
  weightedScore: number | null;
  normalizedScore: number | null;
}

export interface KrknAIScenarioFitnessResult {
  fitnessScore: number | null;
  scores: KrknAIScenarioFitnessScore[];
  healthCheckFailureScore: number | null;
  healthCheckResponseTimeScore: number | null;
  krknFailureScore: number | null;
}

export interface KrknAIScenarioHealthCheck {
  application: string;
  timestamp: string;
  elapsedSeconds?: number | null;
  responseTimeSeconds: number | null;
  statusCode: number | null;
  success: boolean | null;
  error?: string;
}

export interface KrknAIScenarioDetail {
  generation: number;
  scenarioId: string;
  scenarioType: string;
  parameters: unknown;
  command: string;
  origin: string;
  parentIds: string[];
  durationSeconds: number | null;
  returnCode: number | null;
  fitnessResult: KrknAIScenarioFitnessResult;
  healthChecks: KrknAIScenarioHealthCheck[];
  logPath: string;
  fitnessState: 'provisional' | 'final' | string;
}

export class KrknAIConfigValidationError extends Error {
  readonly status = 422;
  readonly statusText: string;
  readonly errors: KrknAIConfigValidationIssue[];

  constructor(errors: KrknAIConfigValidationIssue[], statusText = 'Unprocessable Entity') {
    super('Krkn-AI configuration validation failed');
    this.name = 'KrknAIConfigValidationError';
    this.statusText = statusText;
    this.errors = errors;
  }
}

async function createKrknAIHttpError(response: Response): Promise<Error & { status: number; statusText: string }> {
  let message = `HTTP ${response.status}: ${response.statusText}`;
  try {
    const payload: { message?: string } = await response.json();
    if (payload.message) message = payload.message;
  } catch {
    // Keep the status-based message when there is no JSON error body.
  }
  return Object.assign(new Error(message), {
    status: response.status,
    statusText: response.statusText,
  });
}

class KrknAIApiClient extends BaseApiClient {
  constructor() {
    super(config.apiBaseUrl);
  }

  listRuns({ signal }: KrknAIApiRequestOptions = {}): Promise<KrknAIRunResource[]> {
    return this.fetchJson<KrknAIRunResource[]>('/krkn-ai/runs', { signal });
  }

  getRunSummary(name: string, { signal }: KrknAIApiRequestOptions = {}): Promise<KrknAIRunSummary> {
    return this.fetchJson<KrknAIRunSummary>(`/krkn-ai/runs/${encodeURIComponent(name)}/results/summary`, { signal });
  }

  getScenarioIndex(
    name: string,
    filters?: KrknAIScenarioIndexFilters,
    { signal }: KrknAIApiRequestOptions = {},
  ): Promise<KrknAIScenarioIndexResponse> {
    const query = new URLSearchParams();
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) query.append(key, String(value));
      }
    }
    const queryString = query.toString();
    const path = `/krkn-ai/runs/${encodeURIComponent(name)}/results/scenarios${queryString ? `?${queryString}` : ''}`;
    return this.fetchJson<KrknAIScenarioIndexResponse>(path, { signal });
  }

  getScenario(
    name: string,
    generation: number | string,
    scenarioId: string,
    { signal }: KrknAIApiRequestOptions = {},
  ): Promise<KrknAIScenarioDetail> {
    return this.fetchJson<KrknAIScenarioDetail>(
      `/krkn-ai/runs/${encodeURIComponent(name)}/results/scenarios/${encodeURIComponent(String(generation))}/${encodeURIComponent(scenarioId)}`,
      { signal },
    );
  }

  discover(request: KrknAIDiscoveryRequest, { signal }: KrknAIApiRequestOptions = {}): Promise<KrknAIDiscoveryResponse> {
    return this.fetchJson<KrknAIDiscoveryResponse>('/krkn-ai/discoveries', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    });
  }

  async validateConfig(
    configYaml: string,
    { signal }: KrknAIApiRequestOptions = {},
  ): Promise<KrknAIConfigValidationResponse> {
    const response = await this.fetch('/krkn-ai/configs/validate', {
      method: 'POST',
      body: JSON.stringify({ configYaml }),
      signal,
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 422) {
      let errors: KrknAIConfigValidationIssue[] = [];
      try {
        const payload: { errors?: KrknAIConfigValidationIssue[] } = await response.json();
        if (Array.isArray(payload.errors)) errors = payload.errors;
      } catch {
        // Keep the typed validation error even if a malformed error body is returned.
      }
      throw new KrknAIConfigValidationError(errors, response.statusText);
    }

    if (response.status !== 200) throw await createKrknAIHttpError(response);
    return response.json();
  }

  async createConfig(request: KrknAIConfigRequest, { signal }: KrknAIApiRequestOptions = {}): Promise<KrknAIConfigResponse> {
    const response = await this.fetch('/krkn-ai/configs', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    });
    if (response.status !== 201) throw await createKrknAIHttpError(response);
    return response.json();
  }

  async createRun(request: KrknAIRunRequest, { signal }: KrknAIApiRequestOptions = {}): Promise<KrknAIRunResource> {
    const response = await this.fetch('/krkn-ai/runs', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    });
    if (response.status !== 201) throw await createKrknAIHttpError(response);
    return response.json();
  }
}

export const krknAiApi = new KrknAIApiClient();
