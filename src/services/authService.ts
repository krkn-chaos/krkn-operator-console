/**
 * Authentication service for krkn-operator-console
 *
 * Handles user authentication, registration, and session management.
 * Uses localStorage so an authenticated session is shared across tabs.
 */

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  IsRegisteredResponse,
  AuthError,
  User,
} from '../types/auth';
import { AUTH_STORAGE_KEYS, RateLimitError } from '../types/auth';

import { config } from '../config';

const API_BASE = `${config.apiBaseUrl}/auth`;
const AUTH_STORAGE_KEY_LIST = Object.values(AUTH_STORAGE_KEYS);

function clearAuthStorage(storage: Storage): void {
  AUTH_STORAGE_KEY_LIST.forEach(key => storage.removeItem(key));
}

function readUserFromStorage(storage: Storage): User | null {
  const userId = storage.getItem(AUTH_STORAGE_KEYS.USER_EMAIL);
  const name = storage.getItem(AUTH_STORAGE_KEYS.USER_NAME);
  const surname = storage.getItem(AUTH_STORAGE_KEYS.USER_SURNAME);
  const role = storage.getItem(AUTH_STORAGE_KEYS.USER_ROLE);
  const organization = storage.getItem(AUTH_STORAGE_KEYS.USER_ORGANIZATION);

  if (!userId || !name || !surname || !role) {
    return null;
  }

  const groupsJson = storage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS);
  let groups: string[] | undefined;
  if (groupsJson) {
    try { groups = JSON.parse(groupsJson); } catch { /* ignore */ }
  }

  return {
    userId,
    name,
    surname,
    role: role as User['role'],
    organization: organization || undefined,
    groups,
  };
}

/**
 * Authentication service class
 */
class AuthService {
  /**
   * Move a valid pre-upgrade tab session into shared storage once. Incomplete
   * or expired legacy data is discarded so it cannot restore stale auth.
   */
  private migrateLegacySession(): void {
    const hasSharedAuth = AUTH_STORAGE_KEY_LIST.some(key => localStorage.getItem(key) !== null);
    const hasLegacyAuth = AUTH_STORAGE_KEY_LIST.some(key => sessionStorage.getItem(key) !== null);

    if (!hasLegacyAuth) return;
    if (hasSharedAuth) {
      clearAuthStorage(sessionStorage);
      return;
    }

    const token = sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
    const expiresAt = sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT);
    const user = readUserFromStorage(sessionStorage);
    const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;

    if (token && user && Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) {
      AUTH_STORAGE_KEY_LIST.forEach(key => {
        const value = sessionStorage.getItem(key);
        if (value !== null) localStorage.setItem(key, value);
      });
    }

    clearAuthStorage(sessionStorage);
  }

  /**
   * Check if an admin user is already registered
   * @returns True if admin exists, false if first admin needed
   */
  async isRegistered(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/is-registered`);

      if (response.status === 429) {
        throw new RateLimitError();
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: IsRegisteredResponse = await response.json();
      return data.registered;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to check registration status');
    }
  }

  /**
   * Register first admin user
   * @param request - Registration data
   * @returns Registration response
   */
  async register(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (response.status === 429) {
        throw new RateLimitError();
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Registration endpoint not available');
      }

      if (!response.ok) {
        const error: AuthError = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      return await response.json();
    } catch (error) {
      throw error instanceof Error ? error : new Error('Registration failed');
    }
  }

  /**
   * Login user and store session data
   * @param request - Login credentials
   * @param expectedToken - Shared token observed when the login request started
   * @returns Login response with token and user info, or null if a newer session won
   */
  async login(
    request: LoginRequest,
    expectedToken?: string | null,
  ): Promise<LoginResponse | null> {
    try {
      const tokenAtRequestStart = expectedToken === undefined ? this.getToken() : expectedToken;
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (response.status === 429) {
        throw new RateLimitError();
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Login endpoint not available');
      }

      if (!response.ok) {
        const error: AuthError = await response.json();
        if (error.error === 'invalid_credentials') {
          throw new Error('Invalid email or password');
        } else if (error.error === 'account_disabled') {
          throw new Error('Your account has been disabled. Contact admin.');
        }
        throw new Error(error.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();

      // A different tab may have completed login while this request was in
      // flight. Do not let this older response replace that shared session.
      if (this.getToken() !== tokenAtRequestStart) return null;

      // Store auth data in shared localStorage
      this.setUser({
        userId: data.userId,
        name: data.name,
        surname: data.surname,
        role: data.role,
        organization: data.organization,
      });
      localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT, data.expiresAt);
      this.setToken(data.token);

      return data;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Login failed');
    }
  }

  /**
   * Logout user and clear session data. When expectedToken is provided, only
   * clear storage if it still matches token used by the failed request.
   */
  logout(expectedToken?: string | null): boolean {
    if (
      expectedToken !== undefined &&
      localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN) !== expectedToken
    ) {
      return false;
    }

    this.clearToken();
    this.clearUser();
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT);
    clearAuthStorage(sessionStorage);
    return true;
  }

  /**
   * Get JWT token from localStorage
   * @returns JWT token or null if not found
   */
  getToken(): string | null {
    this.migrateLegacySession();
    return localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
  }

  /**
   * Store JWT token in localStorage
   * @param token - JWT token
   */
  setToken(token: string): void {
    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token);
  }

  /**
   * Clear JWT token from localStorage
   */
  clearToken(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
  }

  /**
   * Get user info from localStorage
   * @returns User object or null if not found
   */
  getUser(): User | null {
    this.migrateLegacySession();
    return readUserFromStorage(localStorage);
  }

  /**
   * Store user info in localStorage
   * @param user - User object
   */
  setUser(user: User): void {
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_EMAIL, user.userId);
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_NAME, user.name);
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_SURNAME, user.surname);
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, user.role);
    if (user.organization) {
      localStorage.setItem(AUTH_STORAGE_KEYS.USER_ORGANIZATION, user.organization);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.USER_ORGANIZATION);
    }
    if (user.groups) {
      localStorage.setItem(AUTH_STORAGE_KEYS.USER_GROUPS, JSON.stringify(user.groups));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.USER_GROUPS);
    }
  }

  /**
   * Clear user info from localStorage
   */
  clearUser(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_EMAIL);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_NAME);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_SURNAME);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_ROLE);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_ORGANIZATION);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_GROUPS);
  }

  /**
   * Check if user is authenticated
   * @returns True if user has valid token
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    return token !== null && user !== null;
  }

  /**
   * Get token expiration timestamp
   * @returns ISO 8601 timestamp or null
   */
  getTokenExpiresAt(): string | null {
    this.migrateLegacySession();
    return localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT);
  }

  /**
   * Check if token is expired
   * @returns True if token is expired
   */
  isTokenExpired(): boolean {
    const expiresAt = this.getTokenExpiresAt();
    if (!expiresAt) return true;

    const expiryDate = new Date(expiresAt);
    return expiryDate.getTime() <= Date.now();
  }
}

// Export singleton instance
export const authService = new AuthService();
