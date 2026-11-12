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
  AuthSessionVersion,
  User,
} from '../types/auth';
import { AUTH_SESSION_STORAGE_KEY, AUTH_STORAGE_KEYS, RateLimitError } from '../types/auth';

import { config } from '../config';

const API_BASE = `${config.apiBaseUrl}/auth`;
const AUTH_STORAGE_KEY_LIST = Object.values(AUTH_STORAGE_KEYS);
const LEGACY_SESSION_MIGRATED_KEY = 'legacy_session_migrated';

interface AuthSession {
  token: string | null;
  user: User | null;
  expiresAt: string | null;
}

interface AuthSessionRecord extends AuthSessionVersion {
  version: 1;
  session: AuthSession | null;
}

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

function readLegacySession(storage: Storage): AuthSession {
  return {
    token: storage.getItem(AUTH_STORAGE_KEYS.TOKEN),
    user: readUserFromStorage(storage),
    expiresAt: storage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT),
  };
}

function hasLegacyAuth(storage: Storage): boolean {
  return AUTH_STORAGE_KEY_LIST.some(key => storage.getItem(key) !== null);
}

function emptySession(session: AuthSession): boolean {
  return session.token === null && session.user === null && session.expiresAt === null;
}

/**
 * Authentication service class
 */
class AuthService {
  private readSessionRecord(): AuthSessionRecord {
    const storedRecord = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (storedRecord !== null) {
      clearAuthStorage(sessionStorage);
      try {
        const record = JSON.parse(storedRecord) as AuthSessionRecord;
        if (
          record.version === 1 &&
          Number.isInteger(record.generation) &&
          Number.isInteger(record.logoutGeneration) &&
          (record.session === null || typeof record.session === 'object')
        ) return record;
      } catch {
        // Replace malformed auth data with a logged-out record.
      }

      const record = { version: 1, generation: 1, logoutGeneration: 1, session: null } as const;
      this.writeSessionRecord(record);
      return record;
    }

    if (hasLegacyAuth(localStorage)) {
      const record: AuthSessionRecord = {
        version: 1,
        generation: 1,
        logoutGeneration: 0,
        session: readLegacySession(localStorage),
      };
      clearAuthStorage(localStorage);
      this.writeSessionRecord(record);
      return record;
    }

    const legacyWasMigrated = localStorage.getItem(LEGACY_SESSION_MIGRATED_KEY) !== null;
    if (hasLegacyAuth(sessionStorage)) {
      const legacySession = readLegacySession(sessionStorage);
      const expiresAtMs = legacySession.expiresAt ? Date.parse(legacySession.expiresAt) : Number.NaN;
      const validLegacySession = Boolean(
        legacySession.token && legacySession.user &&
        Number.isFinite(expiresAtMs) && expiresAtMs > Date.now(),
      );
      const record: AuthSessionRecord = {
        version: 1,
        generation: 1,
        logoutGeneration: legacyWasMigrated ? 1 : 0,
        session: !legacyWasMigrated && validLegacySession ? legacySession : null,
      };
      clearAuthStorage(sessionStorage);
      this.writeSessionRecord(record);
      return record;
    }

    if (legacyWasMigrated) {
      const record = { version: 1, generation: 1, logoutGeneration: 1, session: null } as const;
      this.writeSessionRecord(record);
      return record;
    }

    return { version: 1, generation: 0, logoutGeneration: 0, session: null };
  }

  private writeSessionRecord(record: AuthSessionRecord): void {
    localStorage.setItem(LEGACY_SESSION_MIGRATED_KEY, '1');
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(record));
  }

  private updateSession(update: Partial<AuthSession>): void {
    const current = this.readSessionRecord();
    const session = { token: null, user: null, expiresAt: null, ...current.session, ...update };
    const nextSession = emptySession(session) ? null : session;
    if (JSON.stringify(nextSession) === JSON.stringify(current.session)) return;
    this.writeSessionRecord({
      ...current,
      generation: current.generation + 1,
      session: nextSession,
    });
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
   * @param expectedVersion - Shared session version observed when request started
   * @returns Login response with token and user info, or null if a newer session won
   */
  async login(
    request: LoginRequest,
    expectedVersion?: AuthSessionVersion,
  ): Promise<LoginResponse | null> {
    try {
      const versionAtRequestStart = expectedVersion ?? this.getSessionVersion();
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

      const current = this.readSessionRecord();
      if (
        current.generation !== versionAtRequestStart.generation ||
        current.logoutGeneration !== versionAtRequestStart.logoutGeneration
      ) return null;

      this.writeSessionRecord({
        version: 1,
        generation: current.generation + 1,
        logoutGeneration: current.logoutGeneration,
        session: {
          token: data.token,
          expiresAt: data.expiresAt,
          user: {
            userId: data.userId,
            name: data.name,
            surname: data.surname,
            role: data.role,
            organization: data.organization,
          },
        },
      });

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
    const current = this.readSessionRecord();
    if (
      expectedToken !== undefined &&
      (current.session?.token ?? null) !== expectedToken
    ) {
      return false;
    }

    this.writeSessionRecord({
      version: 1,
      generation: current.generation + 1,
      logoutGeneration: current.logoutGeneration + 1,
      session: null,
    });
    clearAuthStorage(localStorage);
    clearAuthStorage(sessionStorage);
    return true;
  }

  /**
   * Get JWT token from localStorage
   * @returns JWT token or null if not found
   */
  getToken(): string | null {
    return this.readSessionRecord().session?.token ?? null;
  }

  /**
   * Store JWT token in localStorage
   * @param token - JWT token
   */
  setToken(token: string): void {
    this.updateSession({ token });
  }

  /**
   * Clear JWT token from localStorage
   */
  clearToken(): void {
    this.updateSession({ token: null });
  }

  /**
   * Get user info from localStorage
   * @returns User object or null if not found
   */
  getUser(): User | null {
    return this.readSessionRecord().session?.user ?? null;
  }

  /**
   * Store user info in localStorage
   * @param user - User object
   */
  setUser(user: User): void {
    this.updateSession({ user });
  }

  setSession(user: User, token: string, expiresAt: string): void {
    const current = this.readSessionRecord();
    this.writeSessionRecord({
      version: 1,
      generation: current.generation + 1,
      logoutGeneration: current.logoutGeneration,
      session: { user, token, expiresAt },
    });
  }

  /**
   * Clear user info from localStorage
   */
  clearUser(): void {
    this.updateSession({ user: null });
  }

  getSessionVersion(): AuthSessionVersion {
    const { generation, logoutGeneration } = this.readSessionRecord();
    return { generation, logoutGeneration };
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
    return this.readSessionRecord().session?.expiresAt ?? null;
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
