import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentityManagement } from '../IdentityManagement';

const mocks = vi.hoisted(() => ({
  providers: vi.fn(), groups: vi.fn(), users: vi.fn(), blocks: vi.fn(), updateProvider: vi.fn(), updateGroup: vi.fn(), listGroups: vi.fn(),
  showError: vi.fn(), showSuccess: vi.fn(),
}));

vi.mock('../../services/identityApi', () => ({ identityApi: {
  providers: mocks.providers, groups: mocks.groups, users: mocks.users, blocks: mocks.blocks, updateProvider: mocks.updateProvider,
} }));
vi.mock('../../services/groupsApi', () => ({ groupsApi: {
  listGroups: mocks.listGroups, updateGroup: mocks.updateGroup,
} }));
vi.mock('../../hooks', () => ({ useNotifications: () => ({ showError: mocks.showError, showSuccess: mocks.showSuccess }) }));

describe('IdentityManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providers.mockResolvedValue([{ id: 'corp-keycloak', type: 'keycloak', displayName: 'Corporate Keycloak', issuer: 'https://id.test/realms/corp', clientId: 'login', redirectUrl: 'https://console.test/api/v1/auth/oidc/corp-keycloak/callback', enabled: true, source: 'secret', hasClientSecret: true, hasAdminClientSecret: true }]);
    mocks.groups.mockResolvedValue({ groups: [{ provider: 'corp-keycloak', id: 'remote-1', name: 'Ops', path: '/Ops', claimValue: '/Ops' }], nextFirst: 1, hasMore: false });
    mocks.listGroups.mockResolvedValue([{ id: 'user', name: 'User', clusterPermissions: {}, externalGroups: [] }]);
    mocks.users.mockResolvedValue({ users: [], total: 0, page: 1, limit: 10 });
    mocks.blocks.mockResolvedValue([]);
    mocks.updateGroup.mockResolvedValue({ name: 'User' });
    mocks.updateProvider.mockResolvedValue({});
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

  it('uses Keycloak root offsets even when a page contains nested groups', async () => {
    mocks.groups.mockResolvedValueOnce({ groups: [
      { provider: 'corp-keycloak', id: 'root', name: 'Root', path: '/Root', claimValue: '/Root' },
      { provider: 'corp-keycloak', id: 'nested', name: 'Nested', path: '/Root/Nested', claimValue: '/Root/Nested' },
    ], nextFirst: 1, hasMore: true }).mockResolvedValueOnce({ groups: [
      { provider: 'corp-keycloak', id: 'next', name: 'Next', path: '/Next', claimValue: '/Next' },
    ], nextFirst: 2, hasMore: false });
    render(<IdentityManagement />);
    await userEvent.click(screen.getByRole('tab', { name: 'Group mapping' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Load more groups' }));

    await waitFor(() => expect(mocks.groups).toHaveBeenLastCalledWith('corp-keycloak', '', 1));
    expect(await screen.findByText('/Next')).toBeInTheDocument();
  });

  it('requests later account pages from the operator', async () => {
    mocks.users.mockImplementation(async (_provider: string, page: number) => ({
      users: [{ userId: page === 1 ? 'first' : 'later', name: page === 1 ? 'First' : 'Later', active: true }],
      total: 60, page, limit: 10,
    }));
    render(<IdentityManagement />);
    await userEvent.click(screen.getByRole('tab', { name: 'Accounts' }));
    expect(await screen.findByText('First')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() => expect(mocks.users).toHaveBeenCalledWith('corp-keycloak', 2, 10));
    expect(await screen.findByText('Later')).toBeInTheDocument();
  });

  it('removes both service client credentials through the confirmation action', async () => {
    render(<IdentityManagement />);
    await waitFor(() => expect(mocks.providers).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Edit Corporate Keycloak' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove group directory credentials' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Remove group directory credentials?' })).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(mocks.updateProvider).toHaveBeenCalledWith('corp-keycloak', { adminClientId: '', adminClientSecret: '' }));
  });

  it('requires the explicit remove action to clear stored group directory credentials', async () => {
    render(<IdentityManagement />);
    await waitFor(() => expect(mocks.providers).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Edit Corporate Keycloak' }));
    await userEvent.clear(screen.getByLabelText('Admin client ID'));
    await userEvent.click(screen.getByRole('button', { name: 'Save provider' }));

    await waitFor(() => expect(mocks.showError).toHaveBeenCalled());
    expect(mocks.updateProvider).not.toHaveBeenCalled();
  });

  it('disables a provider switch while its update is pending', async () => {
    let completeUpdate!: () => void;
    mocks.updateProvider.mockImplementation(() => new Promise<void>(resolve => { completeUpdate = resolve; }));
    render(<IdentityManagement />);
    const providerSwitch = await screen.findByLabelText('Enabled');
    await userEvent.click(providerSwitch);
    expect(providerSwitch).toBeDisabled();
    expect(mocks.updateProvider).toHaveBeenCalledTimes(1);
    completeUpdate();
    await waitFor(() => expect(mocks.providers).toHaveBeenCalledTimes(2));
  });
});
