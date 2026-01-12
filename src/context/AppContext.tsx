import { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import type { AppState, AppAction } from '../types/api';

// Initial state
const initialState: AppState = {
  phase: 'initializing',
  uuid: null,
  pollAttempts: 0,
  clusters: null,
  selectedCluster: null,
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
