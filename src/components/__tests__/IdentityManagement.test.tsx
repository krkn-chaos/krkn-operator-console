import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentityManagement } from '../IdentityManagement';

const mocks = vi.hoisted(() => ({
  providers: vi.fn(), groups: vi.fn(), users: vi.fn(), blocks: vi.fn(), updateGroup: vi.fn(), listGroups: vi.fn(),
}));

vi.mock('../../services/identityApi', () => ({ identityApi: {
  providers: mocks.providers, groups: mocks.groups, users: mocks.users, blocks: mocks.blocks,
} }));
vi.mock('../../services/groupsApi', () => ({ groupsApi: {
  listGroups: mocks.listGroups, updateGroup: mocks.updateGroup,
} }));
vi.mock('../../hooks', () => ({ useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }) }));

describe('IdentityManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providers.mockResolvedValue([{ id: 'corp-keycloak', type: 'keycloak', displayName: 'Corporate Keycloak', issuer: 'https://id.test/realms/corp', clientId: 'login', redirectUrl: 'https://console.test/api/v1/auth/oidc/corp-keycloak/callback', enabled: true, source: 'secret', hasClientSecret: true, hasAdminClientSecret: true }]);
    mocks.groups.mockResolvedValue([{ provider: 'corp-keycloak', id: 'remote-1', name: 'Ops', path: '/Ops', claimValue: '/Ops' }]);
    mocks.listGroups.mockResolvedValue([{ name: 'operators', clusterPermissions: {}, externalGroups: [] }]);
    mocks.users.mockResolvedValue([]);
    mocks.blocks.mockResolvedValue([]);
    mocks.updateGroup.mockResolvedValue({ name: 'operators' });
  });

  it('saves a remote mapping with provider instance ID and exact claim path', async () => {
    render(<IdentityManagement />);
    await waitFor(() => expect(mocks.providers).toHaveBeenCalled());
    await waitFor(() => expect(mocks.listGroups).toHaveBeenCalled());
    await waitFor(() => expect(mocks.groups).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole('button', { name: 'Map to local group' }));
    await waitFor(() => expect(mocks.updateGroup).toHaveBeenCalledWith('operators', {
      externalGroups: [{ provider: 'corp-keycloak', group: '/Ops', groupId: 'remote-1' }],
    }));
  });
});
