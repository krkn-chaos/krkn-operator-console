/**
 * Authentication Context for krkn-operator-console
 *
 * Provides global authentication state and methods for login, logout, and session management.
 */

import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { authService } from '../services/authService';
import { operatorApi } from '../services/operatorApi';
import { setUnauthorizedHandler } from '../utils/apiClient';
import type { User, LoginRequest, RegisterRequest } from '../types/auth';

/**
 * Authentication state
 */
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean; // Loading initial auth state from sessionStorage
}

/**
 * Authentication actions
 */
type AuthAction =
  | { type: 'AUTH_INIT'; payload: { user: User | null } }
  | { type: 'AUTH_LOGIN'; payload: { user: User } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_ERROR' }
  | { type: 'AUTH_UPDATE_GROUPS'; payload: { groups: string[] } };

/**
 * Authentication context value
 */
interface AuthContextValue {
  state: AuthState;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => void;
  register: (request: RegisterRequest) => Promise<void>;
  isAdmin: () => boolean;
}

/**
 * Initial authentication state
 */
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true, // Start with loading=true until we check sessionStorage
};

/**
 * Authentication reducer
 */
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_INIT':
      return {
        ...state,
        isAuthenticated: action.payload.user !== null,
        user: action.payload.user,
        loading: false,
      };

    case 'AUTH_LOGIN':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        loading: false,
      };

    case 'AUTH_LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
      };

    case 'AUTH_ERROR':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
      };

    case 'AUTH_UPDATE_GROUPS':
      return state.user
        ? { ...state, user: { ...state.user, groups: action.payload.groups } }
        : state;

    default:
      return state;
  }
}

/**
 * Create authentication context
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Authentication provider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication provider component
 *
 * Wraps the application and provides authentication state and methods.
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * Handle 401 Unauthorized responses
   * Automatically logout user and clear session
   */
  const handleUnauthorized = useCallback(() => {
    const currentPath = window.location.pathname;

    authService.logout();
    dispatch({ type: 'AUTH_LOGOUT' });

    // Redirect to login with expired flag
    if (currentPath !== '/login') {
      window.location.href = `/login?expired=true&returnUrl=${encodeURIComponent(currentPath)}`;
    }
  }, []);

  const loadAndStoreGroups = useCallback(async () => {
    try {
      const response = await operatorApi.getGroups();
      const groupNames = (response.groups || []).map(g => g.name);
      dispatch({ type: 'AUTH_UPDATE_GROUPS', payload: { groups: groupNames } });
      const user = authService.getUser();
      if (user) {
        authService.setUser({ ...user, groups: groupNames });
      }
    } catch {
      // Non-critical: groups will be loaded on demand
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);

    const user = authService.getUser();
    const token = authService.getToken();

    if (user && token) {
      if (authService.isTokenExpired()) {
        authService.logout();
        dispatch({ type: 'AUTH_INIT', payload: { user: null } });
      } else {
        dispatch({ type: 'AUTH_INIT', payload: { user } });
        loadAndStoreGroups();
      }
    } else {
      dispatch({ type: 'AUTH_INIT', payload: { user: null } });
    }
  }, [handleUnauthorized, loadAndStoreGroups]);

  const login = useCallback(async (request: LoginRequest) => {
    try {
      const response = await authService.login(request);

      dispatch({
        type: 'AUTH_LOGIN',
        payload: {
          user: {
            userId: response.userId,
            name: response.name,
            surname: response.surname,
            role: response.role,
            organization: response.organization,
          },
        },
      });

      // Load groups after login (fire and forget)
      loadAndStoreGroups();
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' });
      throw error;
    }
  }, [loadAndStoreGroups]);

  /**
   * Logout user
   */
  const logout = useCallback(() => {
    authService.logout();
    dispatch({ type: 'AUTH_LOGOUT' });
  }, []);

  /**
   * Register first admin user
   * @param request - Registration data
   */
  const register = useCallback(async (request: RegisterRequest) => {
    await authService.register(request);
    // Note: Register does NOT automatically log in the user
    // User must login after registration
  }, []);

  /**
   * Check if current user is admin
   * @returns True if user has admin role
   */
  const isAdmin = useCallback(() => {
    return state.user?.role === 'admin';
  }, [state.user]);

  const value: AuthContextValue = {
    state,
    login,
    logout,
    register,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use authentication context
 *
 * @returns Authentication context value
 * @throws Error if used outside AuthProvider
 *
 * @example
 * ```tsx
 * const { state, login, logout, isAdmin } = useAuth();
 *
 * if (state.loading) return <Spinner />;
 * if (!state.isAuthenticated) return <Login />;
 *
 * return <Dashboard user={state.user} />;
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
