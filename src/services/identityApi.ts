import { BaseApiClient } from '../utils/apiClient';
import { config } from '../config';
import type { UserDetails, ExternalGroupMapping } from '../types/api';

/** Public login option returned only for enabled providers. */
export interface LoginProvider {
  id: string;
  type: string;
  displayName: string;
  loginUrl: string;
}

/** Admin-visible configuration; the backend never returns secret values. */
export interface IdentityProvider {
  id: string;
  type: 'keycloak';
  displayName: string;
  issuer: string;
  clientId: string;
  redirectUrl: string;
  adminClientId?: string;
  enabled: boolean;
  source: string;
  hasClientSecret: boolean;
  hasAdminClientSecret: boolean;
  hasCACert?: boolean;
  skipTLSVerify?: boolean;
}

export interface IdentityProviderInput {
  id: string;
  type: 'keycloak';
  displayName: string;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUrl: string;
  adminClientId?: string;
  adminClientSecret?: string;
  caCert?: string;
  skipTLSVerify?: boolean;
  enabled: boolean;
}

export interface RemoteGroup extends ExternalGroupMapping {
  id: string;
  name: string;
  path: string;
  claimValue: string;
}

export interface RemoteGroupPage {
  groups: RemoteGroup[];
  nextFirst: number;
  hasMore: boolean;
}

export interface IdentityUserPage {
  users: UserDetails[];
  total: number;
  page: number;
  limit: number;
}

export interface IdentityBlock {
  id: string;
  provider: string;
  issuer: string;
  subject: string;
  username?: string;
  email?: string;
}

class IdentityApi extends BaseApiClient {
  constructor() { super(config.apiBaseUrl); }

  async loginProviders(): Promise<LoginProvider[]> {
    const response = await fetch(`${config.apiBaseUrl}/auth/providers`, { credentials: 'include' });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Could not load login providers');
    return ((await response.json()) as { providers: LoginProvider[] }).providers ?? [];
  }

  async providers(): Promise<IdentityProvider[]> {
    return (await this.fetchJson<{ providers: IdentityProvider[] }>('/identity-providers')).providers ?? [];
  }

  async createProvider(input: IdentityProviderInput): Promise<IdentityProvider> {
    return this.fetchJson('/identity-providers', { method: 'POST', body: JSON.stringify(input) });
  }

  async updateProvider(id: string, input: Partial<Omit<IdentityProviderInput, 'id' | 'type'>>): Promise<IdentityProvider> {
    return this.fetchJson(`/identity-providers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
  }

  async deleteProvider(id: string): Promise<void> {
    await this.fetchNoContent(`/identity-providers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async groups(providerId: string, search = '', first = 0, max = 50): Promise<RemoteGroupPage> {
    const query = new URLSearchParams({ search, first: String(first), max: String(max) });
    return this.fetchJson<RemoteGroupPage>(`/identity-providers/${encodeURIComponent(providerId)}/groups?${query}`);
  }

  async users(providerId: string, page = 1, limit = 10): Promise<IdentityUserPage> {
    const query = new URLSearchParams({ authProvider: providerId, page: String(page), limit: String(limit) });
    return this.fetchJson<IdentityUserPage>(`/users?${query}`);
  }

  async setUserActive(userId: string, active: boolean): Promise<void> {
    await this.fetchJson(`/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify({ active }) });
  }

  async deleteUser(userId: string, blacklist: boolean): Promise<void> {
    await this.fetchJson(`/users/${encodeURIComponent(userId)}${blacklist ? '?blacklist=true' : ''}`, { method: 'DELETE' });
  }

  async blocks(providerId: string): Promise<IdentityBlock[]> {
    return (await this.fetchJson<{ blocks: IdentityBlock[] }>(`/identity-blocks?authProvider=${encodeURIComponent(providerId)}`)).blocks ?? [];
  }

  async unblock(id: string): Promise<void> {
    const response = await this.fetch(`/identity-blocks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Could not remove identity block (HTTP ${response.status})`);
  }
}

export const identityApi = new IdentityApi();
