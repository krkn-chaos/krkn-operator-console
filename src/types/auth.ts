/**
 * Authentication types for krkn-operator-console
 *
 * Types for JWT-based authentication, user management, and session handling.
 */

/**
 * User role in the system
 */
export type UserRole = 'admin' | 'user';

/**
 * User information stored in session
 */
export interface User {
  userId: string; // Email address
  name: string;
  surname: string;
  role: UserRole;
  organization?: string;
}

/**
 * Login request payload
 */
export interface LoginRequest {
  userId: string; // Email address
  password: string;
}

/**
 * Login response from API
 */
export interface LoginResponse {
  token: string;
  expiresAt: string; // ISO 8601 timestamp
  userId: string;
  role: UserRole;
  name: string;
  surname: string;
  organization?: string;
}

/**
 * Registration request payload
 */
export interface RegisterRequest {
  userId: string; // Email address
  password: string;
  name: string;
  surname: string;
  organization?: string;
  role: UserRole; // First user must be 'admin'
}

/**
 * Registration response from API
 */
export interface RegisterResponse {
  message: string;
  userId: string;
  role: UserRole;
}

/**
 * Check if admin is registered response
 */
export interface IsRegisteredResponse {
  registered: boolean;
}

/**
 * Authentication error from API
 */
export interface AuthError {
  error: string; // Error code: 'invalid_credentials', 'account_disabled', 'validation_error', 'user_exists'
  message: string; // User-friendly error message
}

/**
 * Session storage keys for auth data
 */
export const AUTH_STORAGE_KEYS = {
  TOKEN: 'jwt_token',
  USER_ROLE: 'user_role',
  USER_NAME: 'user_name',
  USER_EMAIL: 'user_email',
  USER_SURNAME: 'user_surname',
  USER_ORGANIZATION: 'user_organization',
  TOKEN_EXPIRES_AT: 'token_expires_at',
} as const;
