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

export interface ErrorResponse {
  error: string;
  message: string;
}

// App State Types

export type AppPhase = 'initializing' | 'polling' | 'selecting_cluster' | 'loading_nodes' | 'ready' | 'error';

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
  | { type: 'RETRY' };
