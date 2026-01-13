import { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import type { AppState, AppAction } from '../types/api';

// Initial state
const initialState: AppState = {
  phase: 'initializing',
  uuid: null,
  pollAttempts: 0,
  clusters: null,
  selectedCluster: null,
  nodes: null,
  registryType: null,
  registryConfig: null,
  scenarios: null,
  selectedScenarios: null,
  selectedScenario: null,
  scenarioDetail: null,
  scenarioFormValues: null,
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
        phase: 'selecting_cluster',
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

    case 'SELECT_CLUSTER':
      return {
        ...state,
        selectedCluster: action.payload,
      };

    case 'NODES_LOADING':
      return {
        ...state,
        phase: 'loading_nodes',
        error: null,
      };

    case 'NODES_SUCCESS':
      return {
        ...state,
        phase: 'ready',
        nodes: action.payload.nodes,
        error: null,
      };

    case 'NODES_ERROR':
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

    case 'GO_BACK':
      // Navigate back to previous phase based on current phase
      switch (state.phase) {
        case 'selecting_cluster':
          // Can't go back from cluster selection (would need to re-initialize)
          return state;

        case 'ready':
          // From nodes display → back to cluster selection
          return {
            ...state,
            phase: 'selecting_cluster',
            selectedCluster: null,
            nodes: null,
          };

        case 'configuring_registry':
          // From registry config → back to nodes display
          return {
            ...state,
            phase: 'ready',
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
