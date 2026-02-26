/**
 * Authentication Context for krkn-operator-console
 *
 * Provides global authentication state and methods for login, logout, and session management.
 */

import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { authService } from '../services/authService';
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
  | { type: 'AUTH_ERROR' };

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
    console.warn('Session expired or invalid token - logging out');
    authService.logout();
    dispatch({ type: 'AUTH_LOGOUT' });

    // Redirect to login with expired flag
    const currentPath = window.location.pathname;
    if (currentPath !== '/login') {
      window.location.href = `/login?expired=true&returnUrl=${encodeURIComponent(currentPath)}`;
    }
  }, []);

  /**
   * Initialize auth state from sessionStorage on mount
   */
  useEffect(() => {
    // Set up unauthorized handler for API client
    setUnauthorizedHandler(handleUnauthorized);

    // Check if user is authenticated
    const user = authService.getUser();
    const token = authService.getToken();

    if (user && token) {
      // Check if token is expired
      if (authService.isTokenExpired()) {
        console.warn('Token expired - clearing session');
        authService.logout();
        dispatch({ type: 'AUTH_INIT', payload: { user: null } });
      } else {
        // Valid session - restore auth state
        dispatch({ type: 'AUTH_INIT', payload: { user } });
      }
    } else {
      // No session - user not authenticated
      dispatch({ type: 'AUTH_INIT', payload: { user: null } });
    }
  }, [handleUnauthorized]);

  /**
   * Login user
   * @param request - Login credentials
   */
  const login = useCallback(async (request: LoginRequest) => {
    try {
      const response = await authService.login(request);

      // Dispatch login action with user data
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
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' });
      throw error; // Re-throw for component to handle
    }
  }, []);

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
    try {
      await authService.register(request);
      // Note: Register does NOT automatically log in the user
      // User must login after registration
    } catch (error) {
      throw error; // Re-throw for component to handle
    }
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
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
