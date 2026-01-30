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
  targetUUIDs: string[]; // CHANGED: was targetId + clusterName
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
  targetUUID: string;
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

export type JobStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Stopped';

export interface JobStatusResponse {
  jobId: string;
  targetUUID: string; // CHANGED: was targetId + clusterName
  scenarioName: string;
  status: JobStatus;
  podName: string;
  startTime?: string;
  completionTime?: string;
  message: string;
}

export interface JobsListResponse {
  jobs: JobStatusResponse[];
}

// App State Types

export type AppPhase =
  | 'initializing'
  | 'polling'
  | 'jobs_list' // NEW: Landing page
  | 'selecting_clusters' // RENAMED: plural
  | 'creating_targets' // NEW: Create N target UUIDs
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

export interface SelectedCluster {
  operatorName: string;
  clusterName: string;
  clusterApiUrl: string;
}

export interface AppState {
  phase: AppPhase;

  // Initialization (shared)
  uuid: string | null;
  pollAttempts: number;

  // Jobs list (NEW)
  jobs: JobStatusResponse[];
  pollingJobIds: Set<string>;
  expandedJobIds: Set<string>;

  // Workflow state (create job flow)
  clusters: ClustersResponse['targetData'] | null;
  selectedClusters: SelectedCluster[]; // CHANGED: Array (was single object)
  targetUUIDs: string[]; // NEW: Target UUIDs for selected clusters

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

  // Jobs list management (NEW)
  | { type: 'JOBS_LIST_READY' }
  | { type: 'LOAD_JOBS_SUCCESS'; payload: { jobs: JobStatusResponse[] } }
  | { type: 'UPDATE_JOB'; payload: { job: JobStatusResponse } }
  | { type: 'TOGGLE_JOB_ACCORDION'; payload: { jobId: string } }
  | { type: 'JOB_CANCELLED'; payload: { jobId: string } }

  // Workflow control (NEW)
  | { type: 'START_CREATE_WORKFLOW' }
  | { type: 'CANCEL_WORKFLOW' }

  // Cluster selection
  | { type: 'CLUSTERS_SUCCESS'; payload: { clusters: ClustersResponse['targetData'] } }
  | { type: 'CLUSTERS_ERROR'; payload: AppError }
  | { type: 'TOGGLE_CLUSTER'; payload: { cluster: SelectedCluster } } // NEW: Multi-select
  | { type: 'CLUSTERS_SELECTED'; payload: { clusters: SelectedCluster[] } } // NEW

  // Target creation (NEW)
  | { type: 'TARGETS_CREATING' }
  | { type: 'TARGETS_CREATED'; payload: { targetUUIDs: string[] } }
  | { type: 'TARGETS_ERROR'; payload: AppError }

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

  // Batch scenario execution (NEW)
  | { type: 'SCENARIOS_RUN_BATCH_SUCCESS'; payload: { jobs: JobStatusResponse[] } }
  | { type: 'SCENARIOS_RUN_BATCH_ERROR'; payload: AppError }

  // Navigation
  | { type: 'GO_BACK' }
  | { type: 'RETRY' };
