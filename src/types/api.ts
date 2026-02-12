// API Request/Response Types

export interface CreateTargetResponse {
  uuid: string;
}

export interface Cluster {
  'cluster-name': string;
  'cluster-api-url': string;
}

export interface ClustersResponse {
  targetData: {
    [operatorName: string]: Cluster[];
  };
  status: string;
}

export interface NodesResponse {
  nodes: string[];
}

// Target CRUD API Types

export type SecretType = 'kubeconfig' | 'token' | 'credentials';

export interface CreateTargetRequest {
  clusterName: string;
  secretType: SecretType;
  clusterAPIURL?: string;
  caBundle?: string;
  kubeconfig?: string;
  token?: string;
  username?: string;
  password?: string;
}

export interface UpdateTargetRequest extends CreateTargetRequest {}

export interface TargetResponse {
  uuid: string;
  clusterName: string;
  clusterAPIURL: string;
  secretType: string;
  ready: boolean;
  createdAt?: string;
}

export interface ListTargetsResponse {
  targets: TargetResponse[];
}

export interface TargetOperationResponse {
  uuid: string;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface ScenariosRequest {
  username?: string;
  password?: string;
  token?: string;
  registryUrl?: string;
  scenarioRepository?: string;
  skipTls?: boolean;
  insecure?: boolean;
}

export interface ScenarioTag {
  name: string;
  digest?: string;
  size?: number;
  lastModified?: string;
}

export interface ScenariosResponse {
  scenarios: ScenarioTag[];
}

// Scenario Detail Types

export type FieldType = 'string' | 'enum' | 'number' | 'file' | 'file_base64' | 'boolean';

export interface BaseField {
  name: string;
  short_description: string;
  title?: string;
  description: string;
  variable: string;
  default?: string;
  required?: boolean;
  type: FieldType;
  secret?: boolean;
}

export interface StringField extends BaseField {
  type: 'string';
  validator?: string;
  validation_message?: string;
}

export interface EnumField extends BaseField {
  type: 'enum';
  separator: string;
  allowed_values: string;
}

export interface NumberField extends BaseField {
  type: 'number';
}

export interface FileField extends BaseField {
  type: 'file';
  mount_path?: string;
}

export interface FileBase64Field extends BaseField {
  type: 'file_base64';
}

export interface BooleanField extends BaseField {
  type: 'boolean';
}

export type ScenarioField = StringField | EnumField | NumberField | FileField | FileBase64Field | BooleanField;

export interface ScenarioDetail {
  name: string;
  digest?: string;
  size?: number;
  last_modified?: string;
  title: string;
  description: string;
  fields: ScenarioField[];
}

export interface ScenarioGlobals {
  name: string;
  digest?: string;
  size?: number;
  last_modified?: string;
  title: string;
  description: string;
  fields: ScenarioField[];
}

export interface ScenarioFormValues {
  [variable: string]: string | number | boolean | File;
}

export interface TouchedFields {
  [variable: string]: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

// Scenario Run Types

export interface ScenarioFileMount {
  name: string;
  content: string; // base64 encoded
  mountPath: string;
}

export interface ScenarioRunRequest {
  targetRequestId: string; // Target request UUID
  targetClusters: { [providerName: string]: string[] }; // Map of provider names to cluster names
  scenarioImage: string;
  scenarioName: string;
  kubeconfigPath?: string;
  environment?: { [key: string]: string };
  files?: ScenarioFileMount[];
  registryUrl?: string;
  scenarioRepository?: string;
  username?: string;
  password?: string;
  token?: string;
  skipTls?: boolean;
  insecure?: boolean;
}

export interface TargetJobResult {
  clusterName: string;
  jobId: string;
  status: string;
  podName: string;
  success: boolean;
  error?: string;
}

export interface ScenarioRunResponse {
  jobs: TargetJobResult[];
  totalTargets: number;
  successfulJobs: number;
  failedJobs: number;
}

/** @deprecated Use ClusterJobPhase instead */
export type JobStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Stopped';

/** @deprecated Use ScenarioRunStatusResponse and ClusterJob instead */
export interface JobStatusResponse {
  jobId: string;
  clusterName: string;
  scenarioName: string;
  status: JobStatus;
  podName: string;
  startTime?: string;
  completionTime?: string;
  message: string;
}

/** @deprecated Use listScenarioRuns() response (ScenarioRunStatusResponse[]) instead */
export interface JobsListResponse {
  jobs: JobStatusResponse[];
}

// NEW API Types for ScenarioRun (CRD-based)

export type ScenarioRunPhase = 'Pending' | 'Running' | 'Succeeded' | 'PartiallyFailed' | 'Failed';
export type ClusterJobPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed';

export interface ClusterJob {
  providerName: string; // Provider that owns this cluster (e.g., 'krkn-operator', 'krkn-operator-acm')
  clusterName: string;
  jobId: string; // UUID - still exists but secondary
  podName: string;
  phase: ClusterJobPhase;
  startTime?: string;
  completionTime?: string;
  message?: string; // Only on errors
}

// Response from POST /api/v1/scenarios/run
export interface CreateScenarioRunResponse {
  scenarioRunName: string;
  targetClusters: { [providerName: string]: string[] };
  totalTargets: number;
}

// Response from GET /api/v1/scenarios/run/{scenarioRunName}
export interface ScenarioRunStatusResponse {
  scenarioRunName: string;
  scenarioName?: string; // Optional - backend may include it in the future
  phase: ScenarioRunPhase;
  totalTargets: number;
  successfulJobs: number;
  failedJobs: number;
  runningJobs: number;
  clusterJobs: ClusterJob[];
  createdAt?: string; // Optional - backend may include it in the future
}

// Internal state for tracking scenario runs
export interface ScenarioRunState {
  scenarioRunName: string;
  scenarioName: string; // For display purposes
  phase: ScenarioRunPhase;
  totalTargets: number;
  successfulJobs: number;
  failedJobs: number;
  runningJobs: number;
  clusterJobs: ClusterJob[];
  createdAt: string;
}

// App State Types

export type AppPhase =
  | 'initializing'
  | 'polling'
  | 'jobs_list' // Landing page
  | 'settings' // Settings page
  | 'selecting_clusters' // Multi-cluster selection
  | 'configuring_registry'
  | 'loading_scenarios'
  | 'selecting_scenarios'
  | 'loading_scenario_detail'
  | 'configuring_scenario'
  | 'error';

export type ErrorType = 'network' | 'timeout' | 'api_error' | 'not_found';

export interface AppError {
  message: string;
  type: ErrorType;
}

export type NotificationVariant = 'success' | 'danger' | 'warning' | 'info';

export interface Notification {
  id: string;
  variant: NotificationVariant;
  title: string;
  message?: string;
}

export interface SelectedCluster {
  operatorName: string;
  clusterName: string;
  clusterApiUrl: string;
}

export interface AppState {
  phase: AppPhase;

  // Initialization (shared)
  uuid: string | null; // Used as targetRequestId throughout workflow
  pollAttempts: number;

  // Scenario runs list (NEW: ScenarioRun-centric)
  scenarioRuns: ScenarioRunState[];
  pollingRunNames: Set<string>;
  expandedRunIds: Set<string>;
  expandedClusterJobs: Set<string>; // jobId

  // Workflow state (create job flow)
  clusters: ClustersResponse['targetData'] | null;
  selectedClusters: SelectedCluster[]; // Array of selected clusters

  // Registry & scenario configuration
  registryType: 'public' | 'private' | null;
  registryConfig: ScenariosRequest | null;
  scenarios: ScenarioTag[] | null;
  selectedScenarios: string[] | null;
  selectedScenario: string | null;
  scenarioDetail: ScenarioDetail | null;
  scenarioFormValues: ScenarioFormValues | null;
  scenarioGlobals: ScenarioGlobals | null;
  globalFormValues: ScenarioFormValues | null;
  globalTouchedFields: TouchedFields | null;

  // Error handling
  error: AppError | null;

  // Global notifications
  notifications: Notification[];
}

// Action Types

export type AppAction =
  // Initialization
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: { uuid: string } }
  | { type: 'INIT_ERROR'; payload: AppError }
  | { type: 'POLL_ATTEMPT'; payload: { attempt: number } }
  | { type: 'POLL_SUCCESS' }
  | { type: 'POLL_ERROR'; payload: AppError }

  // Scenario runs list management (NEW: ScenarioRun-centric)
  | { type: 'JOBS_LIST_READY' }
  | { type: 'SCENARIO_RUN_CREATED'; payload: { scenarioRunName: string; targetClusters: { [providerName: string]: string[] }; totalTargets: number; scenarioName: string } }
  | { type: 'ADD_SCENARIO_RUN'; payload: { run: ScenarioRunState } }
  | { type: 'UPDATE_SCENARIO_RUN'; payload: { run: ScenarioRunState } }
  | { type: 'LOAD_SCENARIO_RUNS_SUCCESS'; payload: { runs: ScenarioRunState[] } }
  | { type: 'TOGGLE_RUN_ACCORDION'; payload: { scenarioRunName: string } }
  | { type: 'TOGGLE_CLUSTER_JOB_ACCORDION'; payload: { jobId: string } }

  // Workflow control (NEW)
  | { type: 'START_CREATE_WORKFLOW' }
  | { type: 'CANCEL_WORKFLOW' }

  // Cluster selection
  | { type: 'CLUSTERS_SUCCESS'; payload: { clusters: ClustersResponse['targetData'] } }
  | { type: 'CLUSTERS_ERROR'; payload: AppError }
  | { type: 'TOGGLE_CLUSTER'; payload: { cluster: SelectedCluster } } // Multi-select
  | { type: 'CLUSTERS_SELECTED' } // Proceed with selected clusters

  // Registry configuration
  | { type: 'CONFIGURE_REGISTRY' }
  | { type: 'REGISTRY_CONFIGURED'; payload: { registryType: 'public' | 'private'; registryConfig: ScenariosRequest } }

  // Scenario selection
  | { type: 'SCENARIOS_LOADING' }
  | { type: 'SCENARIOS_SUCCESS'; payload: { scenarios: ScenarioTag[] } }
  | { type: 'SCENARIOS_ERROR'; payload: AppError }
  | { type: 'SELECT_SCENARIOS'; payload: { scenarios: string[] } }
  | { type: 'SELECT_SCENARIO_FOR_DETAIL'; payload: { scenarioName: string } }

  // Scenario configuration
  | { type: 'SCENARIO_DETAIL_LOADING' }
  | { type: 'SCENARIO_DETAIL_SUCCESS'; payload: { scenarioDetail: ScenarioDetail } }
  | { type: 'SCENARIO_DETAIL_ERROR'; payload: AppError }
  | { type: 'UPDATE_SCENARIO_FORM'; payload: { formValues: ScenarioFormValues } }
  | { type: 'SCENARIO_GLOBALS_SUCCESS'; payload: { scenarioGlobals: ScenarioGlobals } }
  | { type: 'SCENARIO_GLOBALS_ERROR'; payload: AppError }
  | { type: 'UPDATE_GLOBAL_FORM'; payload: { formValues: ScenarioFormValues; touchedFields: TouchedFields } }

  // Batch scenario execution
  | { type: 'SCENARIOS_RUN_BATCH_SUCCESS' } // No payload - scenarioRun already added via ADD_SCENARIO_RUN
  | { type: 'SCENARIOS_RUN_BATCH_ERROR'; payload: AppError }

  // Navigation
  | { type: 'GO_BACK' }
  | { type: 'RETRY' }
  | { type: 'NAVIGATE_TO_SETTINGS' }

  // Notifications
  | { type: 'SHOW_NOTIFICATION'; payload: { notification: Notification } }
  | { type: 'HIDE_NOTIFICATION'; payload: { id: string } };
