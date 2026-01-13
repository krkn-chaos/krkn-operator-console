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

// App State Types

export type AppPhase = 'initializing' | 'polling' | 'selecting_cluster' | 'loading_nodes' | 'ready' | 'configuring_registry' | 'loading_scenarios' | 'selecting_scenarios' | 'loading_scenario_detail' | 'configuring_scenario' | 'error';

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
  uuid: string | null;
  pollAttempts: number;
  clusters: ClustersResponse['targetData'] | null;
  selectedCluster: SelectedCluster | null;
  nodes: string[] | null;
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
  error: AppError | null;
}

// Action Types

export type AppAction =
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: { uuid: string } }
  | { type: 'INIT_ERROR'; payload: AppError }
  | { type: 'POLL_ATTEMPT'; payload: { attempt: number } }
  | { type: 'POLL_SUCCESS' }
  | { type: 'POLL_ERROR'; payload: AppError }
  | { type: 'CLUSTERS_SUCCESS'; payload: { clusters: ClustersResponse['targetData'] } }
  | { type: 'CLUSTERS_ERROR'; payload: AppError }
  | { type: 'SELECT_CLUSTER'; payload: SelectedCluster }
  | { type: 'NODES_LOADING' }
  | { type: 'NODES_SUCCESS'; payload: { nodes: string[] } }
  | { type: 'NODES_ERROR'; payload: AppError }
  | { type: 'CONFIGURE_REGISTRY' }
  | { type: 'REGISTRY_CONFIGURED'; payload: { registryType: 'public' | 'private'; registryConfig: ScenariosRequest } }
  | { type: 'SCENARIOS_LOADING' }
  | { type: 'SCENARIOS_SUCCESS'; payload: { scenarios: ScenarioTag[] } }
  | { type: 'SCENARIOS_ERROR'; payload: AppError }
  | { type: 'SELECT_SCENARIOS'; payload: { scenarios: string[] } }
  | { type: 'SELECT_SCENARIO_FOR_DETAIL'; payload: { scenarioName: string } }
  | { type: 'SCENARIO_DETAIL_LOADING' }
  | { type: 'SCENARIO_DETAIL_SUCCESS'; payload: { scenarioDetail: ScenarioDetail } }
  | { type: 'SCENARIO_DETAIL_ERROR'; payload: AppError }
  | { type: 'UPDATE_SCENARIO_FORM'; payload: { formValues: ScenarioFormValues } }
  | { type: 'SCENARIO_GLOBALS_SUCCESS'; payload: { scenarioGlobals: ScenarioGlobals } }
  | { type: 'SCENARIO_GLOBALS_ERROR'; payload: AppError }
  | { type: 'UPDATE_GLOBAL_FORM'; payload: { formValues: ScenarioFormValues; touchedFields: TouchedFields } }
  | { type: 'GO_BACK' }
  | { type: 'RETRY' };
