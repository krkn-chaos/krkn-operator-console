// API Request/Response Types

import type { ProviderInfo, ProviderSchema } from './provider';
import type { UserRole } from './auth';

export interface CreateTargetResponse {
  uuid: string;
}

// Terminal API Types

export interface TerminalRequest {
  cluster_id: string;  // Cluster name from KrknTargetRequest
  uuid: string;        // KrknTargetRequest UUID
  command: string;     // Full command (e.g., 'kubectl get pods -n default')
}

export interface TerminalResponse {
  stdout_base64: string;
  stderr_base64: string;
  exit_code: number;
  error?: string;      // Error type if failed
  message?: string;    // Error message if failed
}

export interface TerminalSubcommand {
  name: string;
  description: string;
}

export interface TerminalCommand {
  name: string;
  description: string;
  subcommands: TerminalSubcommand[];
}

export interface AvailableCommandsResponse {
  commands: TerminalCommand[];
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
  operatorSource?: string; // Source operator (krkn-operator, krkn-operator-acm, etc.) - only for discovered clusters
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
  /** Name of a private registry configured in the system. If not provided, defaults to public quay.io */
  registryName?: string;
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
  /** Name of a private registry configured in the system. If not provided, defaults to public quay.io */
  registryName?: string;
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
  containerImage?: string; // Full container image path (e.g., 'quay.io/user/repo:tag')
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
  ownerUserId?: string; // Email of the user who created the run
  registryName?: string; // Name of private registry used (null for public Quay registry)
  graphRunName?: string; // Name of the parent GraphRun (if this ScenarioRun is part of a graph)
  graphNodeId?: string; // Node ID within the graph (if this ScenarioRun is part of a graph)
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
  ownerUserId?: string; // Email of the user who created the run
  registryName?: string; // Name of private registry used (null for public Quay registry)
  graphRunName?: string; // Name of the parent GraphRun (if this ScenarioRun is part of a graph)
  graphNodeId?: string; // Node ID within the graph (if this ScenarioRun is part of a graph)
}

// User Management Types

export interface UserDetails {
  userId: string; // Email
  name: string;
  surname: string;
  role: UserRole; // From auth.ts
  organization?: string;
  active: boolean; // Account active status
  created?: string; // ISO 8601
  lastLogin?: string; // ISO 8601
}

export interface CreateUserRequest {
  userId: string;
  password: string;
  name: string;
  surname: string;
  role: UserRole;
  organization?: string;
}

export interface UpdateUserRequest {
  name?: string;
  surname?: string;
  organization?: string;
  active?: boolean;
  role?: UserRole;
}

export interface ChangePasswordRequest {
  currentPassword?: string; // Required for self-change, not required for admin changing other user's password
  newPassword: string;
}

export interface ListUsersResponse {
  users: UserDetails[];
}

export interface UserOperationResponse {
  userId: string;
  message?: string;
}

// App State Types

export type AppPhase =
  | 'initializing'
  | 'polling'
  | 'jobs_list' // Landing page
  | 'settings' // Settings page
  | 'studio' // Chaos Scenario Studio page
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
  scenarioRunsRefreshTrigger: number; // Increment to force immediate refresh
  scenarioRunToRefresh: string | null; // Specific run name to refresh (null = refresh all)
  pollingRunNames: Set<string>;
  pausedPollingRunIds: Set<string>; // Runs with polling paused (accordion open)
  expandedRunIds: Set<string>;
  expandedClusterJobs: Set<string>; // jobId

  // Graph runs list (GraphRun orchestration)
  graphRuns: GraphRunState[];
  expandedGraphRunIds: Set<string>; // Graph run names that are expanded to show DAG
  pausedGraphPollingIds: Set<string>; // Graph runs with polling paused (accordion open)

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

  // Provider configuration
  providers: ProviderInfo[] | null;
  providerConfigUuid: string | null;
  providerConfigStatus: 'idle' | 'creating' | 'polling' | 'ready' | 'error';
  providerConfigData: { [providerName: string]: ProviderSchema } | null;

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
  | { type: 'REFRESH_SCENARIO_RUN'; payload: { scenarioRunName: string } } // Manual refresh for paused run
  | { type: 'LOAD_SCENARIO_RUNS_SUCCESS'; payload: { runs: ScenarioRunState[] } }
  | { type: 'TOGGLE_RUN_ACCORDION'; payload: { scenarioRunName: string } }
  | { type: 'TOGGLE_CLUSTER_JOB_ACCORDION'; payload: { jobId: string } }

  // Graph runs list management
  | { type: 'GRAPH_RUN_CREATED'; payload: { graphRunName: string; totalNodes: number } }
  | { type: 'ADD_GRAPH_RUN'; payload: { run: GraphRunState } }
  | { type: 'UPDATE_GRAPH_RUN'; payload: { run: GraphRunState } }
  | { type: 'LOAD_GRAPH_RUNS_SUCCESS'; payload: { runs: GraphRunState[] } }
  | { type: 'TOGGLE_GRAPH_RUN_ACCORDION'; payload: { graphRunName: string } }
  | { type: 'DELETE_GRAPH_RUN'; payload: { graphRunName: string } }

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
  | { type: 'NAVIGATE_TO_STUDIO' }

  // Notifications
  | { type: 'SHOW_NOTIFICATION'; payload: { notification: Notification } }
  | { type: 'HIDE_NOTIFICATION'; payload: { id: string } }

  // Provider configuration
  | { type: 'PROVIDERS_LOADED'; payload: { providers: ProviderInfo[] } }
  | { type: 'PROVIDER_STATUS_UPDATED'; payload: { name: string; active: boolean } }
  | { type: 'PROVIDER_CONFIG_CREATE_START' }
  | { type: 'PROVIDER_CONFIG_CREATE_SUCCESS'; payload: { uuid: string } }
  | { type: 'PROVIDER_CONFIG_READY'; payload: { data: { [providerName: string]: ProviderSchema } } }
  | { type: 'PROVIDER_CONFIG_ERROR'; payload: { error: string } }
  | { type: 'PROVIDER_CONFIG_SUBMIT_SUCCESS'; payload: { providerName: string } }
  | { type: 'PROVIDER_CONFIG_RESET' };

// Active Runs Dashboard API Types
export interface ActiveRunsResponse {
  totalActiveRuns: number;
  totalClusters: number;
  clusterRuns: {
    [clusterName: string]: string[]; // cluster name -> array of run names
  };
}

// Group Management Types

export interface ClusterPermissions {
  [clusterAPIURL: string]: {
    actions: Array<'view' | 'run' | 'cancel'>;
  };
}

export interface GroupDetails {
  name: string;
  description?: string;
  clusterPermissions: ClusterPermissions;
  memberCount?: number;
  createdAt?: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  clusterPermissions: ClusterPermissions;
  discoveryUuid?: string; // UUID of cluster discovery request for cleanup
}

export interface UpdateGroupRequest {
  description?: string;
  clusterPermissions?: ClusterPermissions;
  discoveryUuid?: string; // UUID of cluster discovery request for cleanup
}

export interface ListGroupsResponse {
  groups: GroupDetails[];
}

export interface GroupOperationResponse {
  name: string;
  message?: string;
}

export interface GroupMemberDetails {
  userId: string; // Email
  name: string;
  surname: string;
  role: UserRole;
}

export interface ListGroupMembersResponse {
  members: GroupMemberDetails[];
}

export interface AddGroupMemberRequest {
  userId: string; // Email
}

export interface GroupMemberOperationResponse {
  groupName: string;
  userId: string;
  message?: string;
}

// Registry Management Types

export type AuthType = 'token' | 'password';

export interface RegistryDetails {
  name: string;
  registryUrl: string;
  scenarioRepository: string;
  authType: AuthType;
  description?: string;
  skipTls: boolean;
  insecure: boolean;
  groups: string[];
  availableToAll: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CreateRegistryRequest {
  name: string;
  registryUrl: string;
  scenarioRepository: string;
  authType: AuthType;
  username?: string;
  password?: string; // Contains either token (if authType=token) or password (if authType=password)
  description?: string;
  skipTls?: boolean;
  insecure?: boolean;
  groups?: string[];
  availableToAll?: boolean;
}

export interface UpdateRegistryRequest {
  registryUrl?: string;
  scenarioRepository?: string;
  authType?: AuthType;
  username?: string;
  password?: string; // Contains either token (if authType=token) or password (if authType=password)
  description?: string;
  skipTls?: boolean;
  insecure?: boolean;
  groups?: string[];
  availableToAll?: boolean;
}

export interface ListRegistriesResponse {
  registries: RegistryDetails[];
}

export interface RegistryOperationResponse {
  name: string;
  message?: string;
}

export interface AvailableRegistry {
  name: string;
  registryUrl: string;
  scenarioRepository: string;
  description?: string;
}

export interface AvailableRegistriesResponse {
  registries: AvailableRegistry[];
}

// Graph Run API Types

/**
 * GraphScenarioNode represents a node in the scenario dependency graph
 * Compatible with krknctl ScenarioNode structure
 */
export interface GraphScenarioNode {
  /** Optional comment describing the scenario */
  _comment?: string;
  /** Container image for the scenario */
  image?: string;
  /** Name of the scenario */
  name?: string;
  /** Environment variables for the scenario */
  env?: { [key: string]: string };
  /** Volume mounts for the scenario */
  volumes?: { [key: string]: string };
  /** Node ID that this scenario depends on (parent in the graph) */
  depends_on?: string;
}

/**
 * NodeStatus represents the status of a single node in the dependency graph
 */
export interface NodeStatus {
  /** Unique identifier for this node in the graph */
  nodeId: string;
  /** Human-readable name of the scenario */
  nodeName: string;
  /** Current phase of this node */
  phase: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Blocked';
  /** Reference to the KrknScenarioRun CR created for this node */
  scenarioRunRef?: string;
  /** When this node started execution */
  startTime?: string;
  /** When this node completed execution */
  completionTime?: string;
  /** List of node IDs that this node depends on */
  dependsOn?: string[];
  /** Additional information about the node status */
  message?: string;
}

/**
 * GraphRunSummary contains aggregate statistics about the graph run
 */
export interface GraphRunSummary {
  /** Total number of nodes in the graph */
  totalNodes: number;
  /** Number of successfully completed nodes */
  completedNodes: number;
  /** Number of currently running nodes */
  runningNodes: number;
  /** Number of failed nodes */
  failedNodes: number;
  /** Number of pending nodes (including blocked nodes) */
  pendingNodes: number;
}

/**
 * GraphRunSpec represents the specification of a graph run
 */
export interface GraphRunSpec {
  /** Dependency graph of scenarios to execute (maps node ID to scenario node) */
  graph: { [nodeId: string]: GraphScenarioNode };
  /** Reference to the KrknTargetRequest CR UUID */
  targetRequestId: string;
  /** Map of provider name to list of cluster names */
  targetClusters: { [providerName: string]: string[] };
  /** Email address of the user who created this graph run */
  ownerUserId?: string;
}

/**
 * GraphRunStatus represents the status of a graph run
 */
export interface GraphRunStatus {
  /** Overall phase of the graph run */
  phase: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'PartiallyFailed';
  /** Aggregate statistics about the graph run */
  summary: GraphRunSummary;
  /** Status of each node in the graph */
  nodeStatuses: NodeStatus[];
  /** Pre-computed topological levels for frontend rendering */
  resolvedLevels: string[][];
  /** When the graph run started */
  startTime?: string;
  /** When the graph run completed */
  completionTime?: string;
}

/**
 * GraphRunListItem represents a single item in the graph runs list
 * Response from GET /api/v1/graphruns
 */
export interface GraphRunListItem {
  name: string;
  namespace: string;
  creationTimestamp: string;
  phase: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'PartiallyFailed';
  ownerUserId: string;
  targetRequestId: string;
  summary: GraphRunSummary;
  startTime?: string;
  completionTime?: string;
}

/**
 * GraphRunDetail represents detailed information about a single graph run
 * Response from GET /api/v1/graphruns/:name and POST /api/v1/graphruns
 */
export interface GraphRunDetail {
  name: string;
  namespace: string;
  creationTimestamp: string;
  spec: GraphRunSpec;
  status: GraphRunStatus;
}

/**
 * CreateGraphRunRequest is the request body for POST /api/v1/graphruns
 */
export interface CreateGraphRunRequest {
  /** Dependency graph of scenarios to execute */
  graph: { [nodeId: string]: GraphScenarioNode };
  /** Reference to the KrknTargetRequest CR UUID */
  targetRequestId: string;
  /** Map of provider name to list of cluster names */
  targetClusters: { [providerName: string]: string[] };
}

/**
 * ListGraphRunsFilters for filtering graph runs in GET /api/v1/graphruns
 */
export interface ListGraphRunsFilters {
  /** Filter by owner user ID (email) */
  ownerUserId?: string;
}

/**
 * GraphRunState - Internal state for tracking graph runs in the frontend (list view)
 * Lightweight version for list display - matches GraphRunListItem from backend
 * Full details (graph, nodeStatuses, resolvedLevels) fetched on-demand via getGraphRun()
 */
export interface GraphRunState {
  /** Unique name of the graph run (e.g., graphrun-abc123) */
  name: string;
  /** Kubernetes namespace */
  namespace: string;
  /** When the graph run was created */
  creationTimestamp: string;
  /** Overall phase of the graph run */
  phase: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'PartiallyFailed';
  /** Email of the user who created the graph run */
  ownerUserId: string;
  /** Reference to the KrknTargetRequest CR UUID */
  targetRequestId: string;
  /** Aggregate statistics about the graph run */
  summary: GraphRunSummary;
  /** When the graph run started execution */
  startTime?: string;
  /** When the graph run completed execution */
  completionTime?: string;
}

/**
 * RunItem - Union type for items displayed in the runs list
 * Can be either a regular scenario run or a graph run
 * Both types are lightweight for list performance
 */
export type RunItem =
  | (ScenarioRunState & { runType: 'scenario' })
  | (GraphRunState & { runType: 'graph' });

// Chaos Scenario Studio Types

/**
 * StudioNodeStatus - Configuration status of a node in the studio
 */
export type StudioNodeStatus = 'unconfigured' | 'configured';

/**
 * StudioNode - Represents a scenario node in the studio canvas
 */
export interface StudioNode {
  /** Unique node identifier (user-defined, pattern: ^[a-z0-9\-]{5,25}$) */
  nodeId: string;
  /** Configuration status of the node */
  status: StudioNodeStatus;
  /** Node configuration (only present when status === 'configured') */
  config?: {
    /** Registry type (public or private) */
    registryType: 'public' | 'private';
    /** Registry configuration (contains registryName for private registries) */
    registryConfig: ScenariosRequest;
    /** Selected scenario name */
    scenarioName: string;
    /** Full scenario image URL */
    scenarioImage: string;
    /** Scenario form values (environment variables) */
    scenarioFormValues: ScenarioFormValues;
    /** Global form values (optional) */
    globalFormValues?: ScenarioFormValues;
    /** Global touched fields (tracks which global fields were modified) */
    globalTouchedFields?: TouchedFields;
    /** Volume mounts (mock dropdown for now) */
    volumes?: { [key: string]: string };
    /** File mounts (mock dropdown for now) */
    files?: string[];
  };
  /** Node position on canvas */
  position: { x: number; y: number };
}

/**
 * StudioEdge - Represents a dependency edge between two nodes
 */
export interface StudioEdge {
  /** Edge ID (format: "source-target") */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID (target depends on source) */
  target: string;
}

/**
 * StudioWorkflow - Complete workflow state in the studio
 */
export interface StudioWorkflow {
  /** All nodes in the workflow */
  nodes: StudioNode[];
  /** All edges (dependencies) in the workflow */
  edges: StudioEdge[];
  /** Next node number for auto-positioning */
  nextNodeNumber: number;
}

/**
 * StudioAutosave - Autosave data structure
 */
export interface StudioAutosave {
  /** Saved workflow state */
  workflow: StudioWorkflow;
  /** When the autosave was created */
  timestamp: number;
  /** Autosave format version */
  version: string;
}

// ============================================================================
// File Management API Types
// ============================================================================

/**
 * FileResponse - ConfigMap-based file data
 */
export interface FileResponse {
  /** ConfigMap name (unique identifier) */
  name: string;
  /** File name (ConfigMap key) */
  fileName: string;
  /** File content */
  content: string;
  /** Mount path in pods */
  mountPath: string;
  /** File description */
  description?: string;
  /** Groups that can access this file */
  groups?: string[];
  /** If true, available to all users */
  availableToAll: boolean;
  /** Optional file type classification */
  fileType?: string;
}

/**
 * CreateFileRequest - Request to create a new file
 */
export interface CreateFileRequest {
  /** ConfigMap name (RFC 1123 compliant) */
  name: string;
  /** File name (ConfigMap key) */
  fileName: string;
  /** File content */
  content: string;
  /** Mount path in pods */
  mountPath: string;
  /** File description (optional) */
  description?: string;
  /** Groups that can access this file (optional if availableToAll) */
  groups?: string[];
  /** If true, available to all users */
  availableToAll: boolean;
  /** Optional file type classification */
  fileType?: string;
}

/**
 * UpdateFileRequest - Request to update an existing file
 */
export interface UpdateFileRequest {
  /** File name (ConfigMap key) */
  fileName: string;
  /** File content */
  content: string;
  /** Mount path in pods */
  mountPath: string;
  /** File description (optional) */
  description?: string;
  /** Groups that can access this file (optional if availableToAll) */
  groups?: string[];
  /** If true, available to all users */
  availableToAll: boolean;
  /** Optional file type classification */
  fileType?: string;
}

/**
 * FilesListResponse - Response containing list of files
 */
export interface FilesListResponse {
  /** Array of files */
  files: FileResponse[];
}

// ============================================================================
// File Types API Types
// ============================================================================

/**
 * FileTypeResponse - File type metadata with usage statistics
 */
export interface FileTypeResponse {
  /** Type name (unique identifier) */
  name: string;
  /** Hex color for badge (e.g., #FF5733) - empty string means use UI default */
  color: string;
  /** Icon name/identifier - empty string means use UI default */
  icon: string;
  /** Number of files using this type */
  usageCount: number;
  /** When this type was created */
  createdAt: string;
}

/**
 * FileTypesListResponse - Response containing list of file types
 */
export interface FileTypesListResponse {
  /** Array of file types */
  fileTypes: FileTypeResponse[];
}

/**
 * CreateFileTypeRequest - Request to create a new file type
 */
export interface CreateFileTypeRequest {
  /** Type name (Kubernetes label-compatible) */
  name: string;
  /** Hex color (optional - empty string for default) */
  color?: string;
  /** Icon name (optional - empty string for default) */
  icon?: string;
}

/**
 * UpdateFileTypeRequest - Request to update file type metadata
 */
export interface UpdateFileTypeRequest {
  /** Type name (must match URL param, immutable) */
  name: string;
  /** Hex color (empty string resets to default) */
  color: string;
  /** Icon name (empty string resets to default) */
  icon: string;
}
