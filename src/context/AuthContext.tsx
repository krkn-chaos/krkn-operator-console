/**
 * Authentication Context for krkn-operator-console
 *
 * Provides global authentication state and methods for login, logout, and session management.
 */

import { createContext, useContext, useReducer, useEffect, useState, ReactNode, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { operatorApi } from '../services/operatorApi';
import { setUnauthorizedHandler } from '../utils/apiClient';
import { AUTH_STORAGE_KEYS } from '../types/auth';
import type { User, LoginRequest, RegisterRequest } from '../types/auth';

/**
 * Authentication state
 */
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean; // Loading initial auth state from shared browser storage
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
  loading: true, // Start with loading=true until we check shared browser storage
};

const MAX_TIMEOUT_MS = 2_147_000_000;

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
  const [authSessionRevision, setAuthSessionRevision] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const redirectToExpiredLogin = useCallback(() => {
    const routePath = `${location.pathname}${location.search}${location.hash}`;
    const currentRoute = location.pathname.replace(/\/+$/, '') || '/';

    if (currentRoute !== '/login') {
      navigate(`/login?expired=true&returnUrl=${encodeURIComponent(routePath)}`, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  /**
   * Handle 401 Unauthorized responses
   * Automatically logout user and clear session
   */
  const handleUnauthorized = useCallback((requestToken: string | null) => {
    if (!authService.logout(requestToken)) return;

    dispatch({ type: 'AUTH_LOGOUT' });
    redirectToExpiredLogin();
  }, [redirectToExpiredLogin]);

  const loadAndStoreGroups = useCallback(async (lookupUser: User, lookupToken: string) => {
    if (lookupUser.role !== 'admin') return;

    const isLookupSessionCurrent = () =>
      authService.getToken() === lookupToken &&
      authService.getUser()?.userId === lookupUser.userId;

    try {
      if (!isLookupSessionCurrent()) return;

      const response = await operatorApi.getGroups();
      const groupNames = (response.groups || []).map(g => g.name);
      if (!isLookupSessionCurrent()) return;

      const currentUser = authService.getUser();
      if (
        !currentUser ||
        currentUser.userId !== lookupUser.userId ||
        authService.getToken() !== lookupToken
      ) return;
      authService.setUser({ ...currentUser, groups: groupNames });

      // Storage may change while the shared user record is being updated.
      // Do not apply results to auth state after that session switch.
      if (!isLookupSessionCurrent()) return;
      dispatch({ type: 'AUTH_UPDATE_GROUPS', payload: { groups: groupNames } });
    } catch {
      // Non-critical: groups will be loaded on demand
    }
  }, []);

  const syncAuthFromStorage = useCallback((fromStorageEvent = false) => {
    const user = authService.getUser();
    const token = authService.getToken();
    const expiresAt = authService.getTokenExpiresAt();
    const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;

    if (
      user &&
      token &&
      Number.isFinite(expiresAtMs) &&
      expiresAtMs > Date.now() &&
      !authService.isTokenExpired()
    ) {
      dispatch({ type: 'AUTH_INIT', payload: { user } });
      setAuthSessionRevision(revision => revision + 1);
      loadAndStoreGroups(user, token);
      return;
    }

    if (user || token || expiresAt) {
      if (!fromStorageEvent) authService.logout();
    }
    dispatch({ type: 'AUTH_INIT', payload: { user: null } });
  }, [loadAndStoreGroups]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
  }, [handleUnauthorized]);

  useEffect(() => {
    syncAuthFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      // Token is written last on login and removed first on logout. Storage
      // events run after the originating task, so the full session is visible.
      if (event.key !== AUTH_STORAGE_KEYS.TOKEN && event.key !== null) return;
      syncAuthFromStorage(true);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [syncAuthFromStorage]);

  const expireSession = useCallback(() => {
    if (!authService.isTokenExpired()) return;

    authService.logout();
    dispatch({ type: 'AUTH_LOGOUT' });
    redirectToExpiredLogin();
  }, [redirectToExpiredLogin]);

  useEffect(() => {
    if (!state.isAuthenticated) return;

    const expiresAt = authService.getTokenExpiresAt();
    const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      expireSession();
      return;
    }

    let timer = 0;
    const scheduleExpiryCheck = () => {
      const currentExpiresAt = authService.getTokenExpiresAt();
      const currentExpiresAtMs = currentExpiresAt ? Date.parse(currentExpiresAt) : Number.NaN;
      if (!Number.isFinite(currentExpiresAtMs) || currentExpiresAtMs <= Date.now()) {
        expireSession();
        return;
      }
      timer = window.setTimeout(
        scheduleExpiryCheck,
        Math.min(currentExpiresAtMs - Date.now(), MAX_TIMEOUT_MS),
      );
    };
    scheduleExpiryCheck();
    const checkExpiry = () => {
      if (authService.isTokenExpired()) expireSession();
    };
    const checkVisibleExpiry = () => {
      if (document.visibilityState === 'visible') checkExpiry();
    };

    window.addEventListener('focus', checkExpiry);
    document.addEventListener('visibilitychange', checkVisibleExpiry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', checkExpiry);
      document.removeEventListener('visibilitychange', checkVisibleExpiry);
    };
  }, [authSessionRevision, expireSession, state.isAuthenticated]);

  const login = useCallback(async (request: LoginRequest) => {
    const tokenAtLoginStart = authService.getToken();

    try {
      const response = await authService.login(request, tokenAtLoginStart);
      if (!response) {
        syncAuthFromStorage();
        return;
      }

      const user: User = {
        userId: response.userId,
        name: response.name,
        surname: response.surname,
        role: response.role,
        organization: response.organization,
      };

      if (authService.getToken() !== response.token) {
        syncAuthFromStorage();
        return;
      }

      dispatch({
        type: 'AUTH_LOGIN',
        payload: { user },
      });
      setAuthSessionRevision(revision => revision + 1);

      // Load groups after login (admin only — no endpoint for user's own groups)
      loadAndStoreGroups(user, response.token);
    } catch (error) {
      const currentToken = authService.getToken();
      const currentUser = authService.getUser();
      const currentExpiresAt = authService.getTokenExpiresAt();
      const currentExpiresAtMs = currentExpiresAt ? Date.parse(currentExpiresAt) : Number.NaN;
      const newerValidSession =
        currentToken !== null &&
        currentToken !== tokenAtLoginStart &&
        currentUser !== null &&
        Number.isFinite(currentExpiresAtMs) &&
        currentExpiresAtMs > Date.now() &&
        !authService.isTokenExpired();

      if (newerValidSession) {
        syncAuthFromStorage();
      } else {
        dispatch({ type: 'AUTH_ERROR' });
      }
      throw error;
    }
  }, [loadAndStoreGroups, syncAuthFromStorage]);

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
