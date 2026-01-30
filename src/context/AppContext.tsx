import { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import type { AppState, AppAction } from '../types/api';

// Initial state
const initialState: AppState = {
  phase: 'initializing',

  // Initialization
  uuid: null,
  pollAttempts: 0,

  // Jobs list
  jobs: [],
  pollingJobIds: new Set<string>(),
  expandedJobIds: new Set<string>(),

  // Workflow state
  clusters: null,
  selectedClusters: [],
  targetUUIDs: [],

  // Registry & scenario configuration
  registryType: null,
  registryConfig: null,
  scenarios: null,
  selectedScenarios: null,
  selectedScenario: null,
  scenarioDetail: null,
  scenarioFormValues: null,
  scenarioGlobals: null,
  globalFormValues: null,
  globalTouchedFields: null,

  // Error handling
  error: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'INIT_START':
      return {
        ...state,
        phase: 'initializing',
        error: null,
      };

    case 'INIT_SUCCESS':
      return {
        ...state,
        phase: 'polling',
        uuid: action.payload.uuid,
        pollAttempts: 0,
        error: null,
      };

    case 'INIT_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.payload,
      };

    case 'POLL_ATTEMPT':
      return {
        ...state,
        pollAttempts: action.payload.attempt,
      };

    case 'POLL_SUCCESS':
      return {
        ...state,
        phase: 'jobs_list', // CHANGED: was 'selecting_cluster'
        error: null,
      };

    case 'POLL_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.payload,
      };

    case 'CLUSTERS_SUCCESS':
      return {
        ...state,
        clusters: action.payload.clusters,
        error: null,
      };

    case 'CLUSTERS_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.payload,
      };

    // Jobs list management
    case 'JOBS_LIST_READY':
      return {
        ...state,
        phase: 'jobs_list',
        error: null,
      };

    case 'LOAD_JOBS_SUCCESS':
      return {
        ...state,
        jobs: action.payload.jobs,
        error: null,
      };

    case 'UPDATE_JOB': {
      const updatedJobs = state.jobs.map(job =>
        job.jobId === action.payload.job.jobId ? action.payload.job : job
      );
      return {
        ...state,
        jobs: updatedJobs,
      };
    }

    case 'TOGGLE_JOB_ACCORDION': {
      const newExpanded = new Set(state.expandedJobIds);
      if (newExpanded.has(action.payload.jobId)) {
        newExpanded.delete(action.payload.jobId);
      } else {
        newExpanded.add(action.payload.jobId);
      }
      return {
        ...state,
        expandedJobIds: newExpanded,
      };
    }

    case 'JOB_CANCELLED': {
      // Update job status to Stopped
      const updatedJobs = state.jobs.map(job =>
        job.jobId === action.payload.jobId
          ? { ...job, status: 'Stopped' as const }
          : job
      );
      return {
        ...state,
        jobs: updatedJobs,
      };
    }

    // Workflow control
    case 'START_CREATE_WORKFLOW':
      return {
        ...state,
        phase: 'selecting_clusters',
        error: null,
      };

    case 'CANCEL_WORKFLOW':
      return {
        ...state,
        phase: 'jobs_list',
        // Clear workflow state
        selectedClusters: [],
        targetUUIDs: [],
        registryType: null,
        registryConfig: null,
        scenarios: null,
        selectedScenarios: null,
        selectedScenario: null,
        scenarioDetail: null,
        scenarioFormValues: null,
        scenarioGlobals: null,
        globalFormValues: null,
        globalTouchedFields: null,
        error: null,
      };

    // Multi-cluster selection
    case 'TOGGLE_CLUSTER': {
      const { cluster } = action.payload;
      const isSelected = state.selectedClusters.some(
        c => c.operatorName === cluster.operatorName && c.clusterName === cluster.clusterName
      );

      const newSelectedClusters = isSelected
        ? state.selectedClusters.filter(
            c => !(c.operatorName === cluster.operatorName && c.clusterName === cluster.clusterName)
          )
        : [...state.selectedClusters, cluster];

      return {
        ...state,
        selectedClusters: newSelectedClusters,
      };
    }

    case 'CLUSTERS_SELECTED':
      return {
        ...state,
        selectedClusters: action.payload.clusters,
      };

    // Target creation
    case 'TARGETS_CREATING':
      return {
        ...state,
        phase: 'creating_targets',
        error: null,
      };

    case 'TARGETS_CREATED':
      return {
        ...state,
        phase: 'configuring_registry',
        targetUUIDs: action.payload.targetUUIDs,
        error: null,
      };

    case 'TARGETS_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.payload,
      };

    case 'CONFIGURE_REGISTRY':
      return {
        ...state,
        phase: 'configuring_registry',
        error: null,
      };

    case 'REGISTRY_CONFIGURED':
      return {
        ...state,
        registryType: action.payload.registryType,
        registryConfig: action.payload.registryConfig,
      };

    case 'SCENARIOS_LOADING':
      return {
        ...state,
        phase: 'loading_scenarios',
        error: null,
      };

    case 'SCENARIOS_SUCCESS':
      return {
        ...state,
        phase: 'selecting_scenarios',
        scenarios: action.payload.scenarios,
        error: null,
      };

    case 'SCENARIOS_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.payload,
      };

    case 'SELECT_SCENARIOS':
      return {
        ...state,
        selectedScenarios: action.payload.scenarios,
      };

    case 'SELECT_SCENARIO_FOR_DETAIL':
      return {
        ...state,
        selectedScenario: action.payload.scenarioName,
        phase: 'loading_scenario_detail',
      };

    case 'SCENARIO_DETAIL_LOADING':
      return {
        ...state,
        phase: 'loading_scenario_detail',
        error: null,
      };

    case 'SCENARIO_DETAIL_SUCCESS':
      return {
        ...state,
        phase: 'configuring_scenario',
        scenarioDetail: action.payload.scenarioDetail,
        error: null,
      };

    case 'SCENARIO_DETAIL_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.payload,
      };

    case 'UPDATE_SCENARIO_FORM':
      return {
        ...state,
        scenarioFormValues: action.payload.formValues,
      };

    case 'SCENARIO_GLOBALS_SUCCESS':
      return {
        ...state,
        scenarioGlobals: action.payload.scenarioGlobals,
        error: null,
      };

    case 'SCENARIO_GLOBALS_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'UPDATE_GLOBAL_FORM':
      return {
        ...state,
        globalFormValues: action.payload.formValues,
        globalTouchedFields: action.payload.touchedFields,
      };

    // Batch scenario execution
    case 'SCENARIOS_RUN_BATCH_SUCCESS':
      return {
        ...state,
        phase: 'jobs_list',
        jobs: [...state.jobs, ...action.payload.jobs],
        // Clear workflow state
        selectedClusters: [],
        targetUUIDs: [],
        scenarioFormValues: null,
        globalFormValues: null,
        globalTouchedFields: null,
        error: null,
      };

    case 'SCENARIOS_RUN_BATCH_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.payload,
      };

    case 'GO_BACK':
      // Navigate back to previous phase based on current phase
      switch (state.phase) {
        case 'selecting_clusters':
          // From cluster selection → cancel workflow, back to jobs list
          return {
            ...state,
            phase: 'jobs_list',
            selectedClusters: [],
          };

        case 'configuring_registry':
          // From registry config → back to cluster selection
          return {
            ...state,
            phase: 'selecting_clusters',
            targetUUIDs: [],
            registryType: null,
            registryConfig: null,
          };

        case 'selecting_scenarios':
          // From scenarios list → back to registry config
          return {
            ...state,
            phase: 'configuring_registry',
            scenarios: null,
            selectedScenarios: null,
          };

        case 'configuring_scenario':
          // From scenario detail → back to scenarios list
          return {
            ...state,
            phase: 'selecting_scenarios',
            selectedScenario: null,
            scenarioDetail: null,
            scenarioFormValues: null,
            scenarioGlobals: null,
            globalFormValues: null,
            globalTouchedFields: null,
          };

        default:
          return state;
      }

    case 'RETRY':
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
