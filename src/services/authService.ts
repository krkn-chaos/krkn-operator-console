/**
 * Authentication service for krkn-operator-console
 *
 * Handles user authentication, registration, and session management.
 * Uses sessionStorage for security (cleared on tab close).
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
import { AUTH_STORAGE_KEYS } from '../types/auth';

const API_BASE = '/api/v1/auth';

/**
 * Authentication service class
 */
class AuthService {
  /**
   * Check if an admin user is already registered
   * @returns True if admin exists, false if first admin needed
   */
  async isRegistered(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/is-registered`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: IsRegisteredResponse = await response.json();
      return data.registered;
    } catch (error) {
      console.error('Failed to check registration status:', error);
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
      console.error('Registration error:', error);
      throw error instanceof Error ? error : new Error('Registration failed');
    }
  }

  /**
   * Login user and store session data
   * @param request - Login credentials
   * @returns Login response with token and user info
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    console.log('[authService.login] Sending login request to:', `${API_BASE}/login`);
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      console.log('[authService.login] Login API response:', {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type')
      });

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Login endpoint not available');
      }

      if (!response.ok) {
        const error: AuthError = await response.json();
        // Map error codes to user-friendly messages
        if (error.error === 'invalid_credentials') {
          throw new Error('Invalid email or password');
        } else if (error.error === 'account_disabled') {
          throw new Error('Your account has been disabled. Contact admin.');
        }
        throw new Error(error.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();
      console.log('[authService.login] Login successful, storing session data');

      // Store auth data in sessionStorage
      this.setToken(data.token);
      this.setUser({
        userId: data.userId,
        name: data.name,
        surname: data.surname,
        role: data.role,
        organization: data.organization,
      });
      sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT, data.expiresAt);

      console.log('[authService.login] Session data stored in sessionStorage');

      return data;
    } catch (error) {
      console.error('[authService.login] Login error:', error);
      throw error instanceof Error ? error : new Error('Login failed');
    }
  }

  /**
   * Logout user and clear session data
   */
  logout(): void {
    this.clearToken();
    this.clearUser();
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT);
  }

  /**
   * Get JWT token from sessionStorage
   * @returns JWT token or null if not found
   */
  getToken(): string | null {
    return sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
  }

  /**
   * Store JWT token in sessionStorage
   * @param token - JWT token
   */
  setToken(token: string): void {
    sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token);
  }

  /**
   * Clear JWT token from sessionStorage
   */
  clearToken(): void {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
  }

  /**
   * Get user info from sessionStorage
   * @returns User object or null if not found
   */
  getUser(): User | null {
    const userId = sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_EMAIL);
    const name = sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_NAME);
    const surname = sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_SURNAME);
    const role = sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_ROLE);
    const organization = sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_ORGANIZATION);

    if (!userId || !name || !surname || !role) {
      return null;
    }

    return {
      userId,
      name,
      surname,
      role: role as User['role'],
      organization: organization || undefined,
    };
  }

  /**
   * Store user info in sessionStorage
   * @param user - User object
   */
  setUser(user: User): void {
    sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_EMAIL, user.userId);
    sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_NAME, user.name);
    sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_SURNAME, user.surname);
    sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, user.role);
    if (user.organization) {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_ORGANIZATION, user.organization);
    }
  }

  /**
   * Clear user info from sessionStorage
   */
  clearUser(): void {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.USER_EMAIL);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.USER_NAME);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.USER_SURNAME);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.USER_ROLE);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.USER_ORGANIZATION);
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
    return sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT);
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
