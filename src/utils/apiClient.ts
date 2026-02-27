/**
 * Authenticated API client for krkn-operator-console
 *
 * Provides a fetch wrapper that automatically:
 * - Injects JWT token in Authorization header
 * - Handles 401 responses (expired token)
 * - Triggers logout and redirect on authentication failure
 */

import { authService } from '../services/authService';

/**
 * Callback function called when 401 Unauthorized is received
 * This should trigger logout and redirect to login page
 */
let onUnauthorized: (() => void) | null = null;

/**
 * Set the callback function for handling 401 responses
 * @param callback - Function to call on 401 (should handle logout + redirect)
 */
export function setUnauthorizedHandler(callback: () => void): void {
  onUnauthorized = callback;
}

/**
 * Authenticated fetch wrapper
 *
 * Automatically adds Authorization header if JWT token exists.
 * Intercepts 401 responses and triggers logout.
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Promise with Response
 *
 * @example
 * ```typescript
 * const response = await authenticatedFetch('/api/v1/targets', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get token from authService
  const token = authService.getToken();

  console.log('[authenticatedFetch] Request:', {
    url,
    method: options.method || 'GET',
    hasToken: !!token
  });

  // Add Authorization header if token exists
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Ensure Content-Type is set for JSON requests
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Make request with auth header
  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log('[authenticatedFetch] Response:', {
    url,
    status: response.status,
    ok: response.ok
  });

  // Handle 401 Unauthorized - token expired or invalid
  if (response.status === 401 && onUnauthorized) {
    console.warn('[authenticatedFetch] Received 401 Unauthorized - triggering logout');
    onUnauthorized();
    throw new Error('Session expired. Please login again.');
  }

  return response;
}

/**
 * Base API client class
 *
 * Provides common methods for API services with automatic authentication.
 * Extend this class for specific API clients.
 */
export class BaseApiClient {
  protected baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch JSON with authentication
   * @param url - URL relative to baseUrl
   * @param options - Fetch options
   * @returns Parsed JSON response
   */
  protected async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const fullUrl = `${this.baseUrl}${url}`;
    const response = await authenticatedFetch(fullUrl, options);

    if (!response.ok) {
      // Try to parse error message from response
      try {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      } catch {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    return response.json();
  }

  /**
   * Fetch with authentication (returns Response for custom handling)
   * @param url - URL relative to baseUrl
   * @param options - Fetch options
   * @returns Response object
   */
  protected async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const fullUrl = `${this.baseUrl}${url}`;
    return authenticatedFetch(fullUrl, options);
  }
}
