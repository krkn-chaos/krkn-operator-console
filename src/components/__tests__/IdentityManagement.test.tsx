import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentityManagement } from '../IdentityManagement';

const mocks = vi.hoisted(() => ({
  providers: vi.fn(), groups: vi.fn(), users: vi.fn(), blocks: vi.fn(), updateGroup: vi.fn(), listGroups: vi.fn(),
  showError: vi.fn(), showSuccess: vi.fn(),
}));

vi.mock('../../services/identityApi', () => ({ identityApi: {
  providers: mocks.providers, groups: mocks.groups, users: mocks.users, blocks: mocks.blocks,
} }));
vi.mock('../../services/groupsApi', () => ({ groupsApi: {
  listGroups: mocks.listGroups, updateGroup: mocks.updateGroup,
} }));
vi.mock('../../hooks', () => ({ useNotifications: () => ({ showError: mocks.showError, showSuccess: mocks.showSuccess }) }));

describe('IdentityManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providers.mockResolvedValue([{ id: 'corp-keycloak', type: 'keycloak', displayName: 'Corporate Keycloak', issuer: 'https://id.test/realms/corp', clientId: 'login', redirectUrl: 'https://console.test/api/v1/auth/oidc/corp-keycloak/callback', enabled: true, source: 'secret', hasClientSecret: true, hasAdminClientSecret: true }]);
    mocks.groups.mockResolvedValue([{ provider: 'corp-keycloak', id: 'remote-1', name: 'Ops', path: '/Ops', claimValue: '/Ops' }]);
    mocks.listGroups.mockResolvedValue([{ id: 'user', name: 'User', clusterPermissions: {}, externalGroups: [] }]);
    mocks.users.mockResolvedValue([]);
    mocks.blocks.mockResolvedValue([]);
    mocks.updateGroup.mockResolvedValue({ name: 'User' });
  });

  it('saves a remote mapping using the local group ID when its display name differs', async () => {
    let saved = false;
    mocks.listGroups.mockImplementation(async () => [
      { id: 'operators', name: 'Operators', clusterPermissions: {}, externalGroups: [] },
      { id: 'user', name: 'User', clusterPermissions: {}, externalGroups: saved
        ? [{ provider: 'corp-keycloak', group: '/Ops', groupId: 'remote-1' }] : [] },
    ]);
    mocks.updateGroup.mockImplementation(async () => { saved = true; return { name: 'User' }; });
    render(<IdentityManagement />);
    await waitFor(() => expect(mocks.providers).toHaveBeenCalled());
    await waitFor(() => expect(mocks.listGroups).toHaveBeenCalled());
    await waitFor(() => expect(mocks.groups).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('tab', { name: 'Group mapping' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Map' }));
    const mappingDialog = screen.getByRole('dialog', { name: 'Map remote group' });
    expect(mocks.updateGroup).not.toHaveBeenCalled();
    expect(within(mappingDialog).getByRole('button', { name: 'Map group' })).toBeDisabled();
    await userEvent.selectOptions(within(mappingDialog).getByRole('combobox', { name: 'Local group' }), 'user');
    await userEvent.click(within(mappingDialog).getByRole('button', { name: 'Map group' }));
    await waitFor(() => expect(mocks.updateGroup).toHaveBeenCalledWith('user', {
      externalGroups: [{ provider: 'corp-keycloak', group: '/Ops', groupId: 'remote-1' }],
    }));
    await waitFor(() => expect(mocks.listGroups).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Existing mappings')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remove mapping /Ops from User' })).toBeInTheDocument();
  });

  it('shows existing mappings for every local group under the selected provider', async () => {
    mocks.listGroups.mockResolvedValue([
      { id: 'user', name: 'User', clusterPermissions: {}, externalGroups: [{ provider: 'corp-keycloak', group: '/Ops' }] },
      { id: 'operators', name: 'Operators', clusterPermissions: {}, externalGroups: [{ provider: 'corp-keycloak', group: '/Engineering' }] },
    ]);
    render(<IdentityManagement />);
    await userEvent.click(screen.getByRole('tab', { name: 'Group mapping' }));
    expect(await screen.findByRole('button', { name: 'Remove mapping /Ops from User' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove mapping /Engineering from Operators' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Local group' })).not.toBeInTheDocument();
  });

  it('shows Add provider at the top right and asks for provider type first', async () => {
    render(<IdentityManagement />);
    const addButton = screen.getByRole('button', { name: 'Add provider' });
    expect(addButton).toHaveTextContent('Add provider');

    await userEvent.click(addButton);
    expect(screen.getByRole('dialog', { name: 'Add provider' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Issuer URL' })).not.toBeInTheDocument();

    await userEvent.selectOptions(within(screen.getByRole('dialog', { name: 'Add provider' })).getByRole('combobox'), 'keycloak');
    expect(screen.getByRole('textbox', { name: 'Issuer URL' })).toBeInTheDocument();
  });
});
