import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, CardBody, CardTitle, EmptyState, EmptyStateBody,
  EmptyStateIcon, Form, FormGroup, FormSelect, FormSelectOption, Modal,
  ModalVariant, Pagination, SearchInput, Spinner, Switch, TextInput, Title,
} from '@patternfly/react-core';
import { PlusCircleIcon, UsersIcon, TrashIcon, EditIcon, KeyIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { FormModal } from './FormModal';
import { identityApi, type IdentityBlock, type IdentityProvider, type IdentityProviderInput, type RemoteGroup } from '../services/identityApi';
import { groupsApi } from '../services/groupsApi';
import { useNotifications } from '../hooks';
import { usePagination } from '../hooks/usePagination';
import type { ExternalGroupMapping, GroupDetails, UserDetails } from '../types/api';

const emptyProvider: IdentityProviderInput = {
  id: '', type: 'keycloak', displayName: '', issuer: '', clientId: '',
  clientSecret: '', redirectUrl: '', adminClientId: '', adminClientSecret: '', enabled: false,
};

function failure(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/** Admin UI for provider configuration, scoped group mapping and OIDC accounts. */
export function IdentityManagement() {
  const { showError, showSuccess } = useNotifications();
  const [providers, setProviders] = useState<IdentityProvider[]>([]);
  const [providerError, setProviderError] = useState('');
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [editingProvider, setEditingProvider] = useState<IdentityProvider | null>(null);
  const [providerForm, setProviderForm] = useState<IdentityProviderInput | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [selectedLocalGroup, setSelectedLocalGroup] = useState('');
  const [remoteGroups, setRemoteGroups] = useState<RemoteGroup[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [directoryError, setDirectoryError] = useState('');
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [directoryHasMore, setDirectoryHasMore] = useState(false);
  const directoryRevision = useRef(0);
  const [savingMapping, setSavingMapping] = useState(false);
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [blocks, setBlocks] = useState<IdentityBlock[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const accountsRevision = useRef(0);
  const [pending, setPending] = useState<{ title: string; detail: string; action: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const loaded = await identityApi.providers();
      setProviders(loaded);
      setSelectedProvider(current => loaded.some(provider => provider.id === current) ? current : loaded[0]?.id ?? '');
      setProviderError('');
    } catch (error) { setProviderError(failure(error)); }
    finally { setLoadingProviders(false); }
  }, []);

  useEffect(() => { void loadProviders(); }, [loadProviders]);

  const loadGroups = useCallback(async () => {
    try {
      const loaded = await groupsApi.listGroups();
      setGroups(loaded);
      setSelectedLocalGroup(current => loaded.some(group => group.name === current) ? current : loaded[0]?.name ?? '');
    } catch (error) { showError('Could not load local groups', failure(error)); }
  }, [showError]);

  useEffect(() => { void loadGroups(); }, [loadGroups]);

  const loadDirectory = useCallback(async () => {
    const revision = ++directoryRevision.current;
    if (!selectedProvider) { setRemoteGroups([]); setDirectoryHasMore(false); return; }
    setLoadingDirectory(true);
    try {
      const page = await identityApi.groups(selectedProvider, groupSearch);
      if (revision !== directoryRevision.current) return;
      setRemoteGroups(page);
      setDirectoryHasMore(page.length === 50);
      setDirectoryError('');
    } catch (error) {
      if (revision === directoryRevision.current) {
        setRemoteGroups([]); setDirectoryHasMore(false); setDirectoryError(failure(error));
      }
    } finally { if (revision === directoryRevision.current) setLoadingDirectory(false); }
  }, [selectedProvider, groupSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDirectory(), groupSearch ? 300 : 0);
    return () => { window.clearTimeout(timer); directoryRevision.current += 1; };
  }, [loadDirectory, groupSearch]);

  async function loadMoreRemoteGroups() {
    const revision = directoryRevision.current;
    setLoadingDirectory(true);
    try {
      const page = await identityApi.groups(selectedProvider, groupSearch, remoteGroups.length);
      if (revision !== directoryRevision.current) return;
      setRemoteGroups(current => [...current, ...page]);
      setDirectoryHasMore(page.length === 50);
    } catch (error) { if (revision === directoryRevision.current) showError('Could not load more remote groups', failure(error)); }
    finally { if (revision === directoryRevision.current) setLoadingDirectory(false); }
  }

  const loadAccounts = useCallback(async () => {
    const revision = ++accountsRevision.current;
    if (!selectedProvider) { setUsers([]); setBlocks([]); return; }
    setUsers([]);
    setBlocks([]);
    setLoadingAccounts(true);
    try {
      const [loadedUsers, loadedBlocks] = await Promise.all([
        identityApi.users(selectedProvider), identityApi.blocks(selectedProvider),
      ]);
      if (revision !== accountsRevision.current) return;
      setUsers(loadedUsers);
      setBlocks(loadedBlocks);
      setAccountsError('');
    } catch (error) { if (revision === accountsRevision.current) setAccountsError(failure(error)); }
    finally { if (revision === accountsRevision.current) setLoadingAccounts(false); }
  }, [selectedProvider]);

  useEffect(() => {
    void loadAccounts();
    return () => { accountsRevision.current += 1; };
  }, [loadAccounts]);

  const selectedGroup = groups.find(group => group.name === selectedLocalGroup);
  const mappings = selectedGroup?.externalGroups ?? [];
  const selectedMappings = mappings.filter(mapping => mapping.provider === selectedProvider);
  const mappedRemote = useMemo(() => new Set(selectedMappings.map(mapping => mapping.group)), [selectedMappings]);
  const userPage = usePagination(users, { initialPerPage: 10 });
  const blockPage = usePagination(blocks, { initialPerPage: 10 });

  async function saveMapping(next: ExternalGroupMapping[]) {
    if (!selectedGroup || savingMapping) return;
    setSavingMapping(true);
    try {
      await groupsApi.updateGroup(selectedGroup.name, { externalGroups: next });
      await loadGroups();
      showSuccess('Group mapping saved');
    } catch (error) { showError('Could not save group mapping', failure(error)); }
    finally { setSavingMapping(false); }
  }

  function openCreate() {
    setEditingProvider(null);
    setProviderForm({ ...emptyProvider });
  }

  function openEdit(provider: IdentityProvider) {
    setEditingProvider(provider);
    setProviderForm({
      id: provider.id, type: 'keycloak', displayName: provider.displayName,
      issuer: provider.issuer, clientId: provider.clientId, redirectUrl: provider.redirectUrl,
      adminClientId: provider.adminClientId ?? '', clientSecret: '', adminClientSecret: '', enabled: provider.enabled,
    });
  }

  async function saveProvider(event: React.FormEvent) {
    event.preventDefault();
    if (!providerForm) return;
    setSavingProvider(true);
    try {
      if (editingProvider) {
        const { displayName, clientId, clientSecret, redirectUrl, adminClientId, adminClientSecret, enabled } = providerForm;
        await identityApi.updateProvider(editingProvider.id, {
          displayName, clientId, redirectUrl, adminClientId, enabled,
          ...(clientSecret ? { clientSecret } : {}),
          ...(adminClientSecret ? { adminClientSecret } : {}),
        });
      } else {
        await identityApi.createProvider(providerForm);
      }
      setProviderForm(null);
      await loadProviders();
      showSuccess('Identity provider saved');
    } catch (error) { showError('Could not save identity provider', failure(error)); }
    finally { setSavingProvider(false); }
  }

  async function toggleProvider(provider: IdentityProvider, enabled: boolean) {
    try {
      await identityApi.updateProvider(provider.id, { enabled });
      await loadProviders();
      showSuccess(enabled ? 'Provider enabled' : 'Provider disabled');
    } catch (error) { showError('Could not update provider', failure(error)); }
  }

  async function confirmAction() {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.action();
      await loadAccounts();
      showSuccess('Identity updated');
      setPending(null);
    } catch (error) { showError('Could not update identity', failure(error)); }
    finally { setBusy(false); }
  }

  const setField = <K extends keyof IdentityProviderInput>(key: K, value: IdentityProviderInput[K]) =>
    setProviderForm(current => current ? { ...current, [key]: value } : null);

  return (
    <Card>
      <CardTitle>Identity management</CardTitle>
      <CardBody>
        <Title headingLevel="h3" size="lg">Authentication providers</Title>
        <p>Configure Keycloak instances. Each enabled provider appears as a login option.</p>
        <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Keycloak provider</Button>
        {loadingProviders ? <Spinner /> : providerError ? (
          <Alert variant="danger" title="Could not load providers" isInline actionLinks={<Button variant="link" onClick={() => void loadProviders()}>Retry</Button>}>{providerError}</Alert>
        ) : providers.length === 0 ? (
          <EmptyState><EmptyStateIcon icon={KeyIcon} /><Title headingLevel="h4" size="md">No identity providers</Title><EmptyStateBody>Add a Keycloak provider to start external login.</EmptyStateBody></EmptyState>
        ) : (
          <Table aria-label="Authentication providers" variant="compact">
            <Thead><Tr><Th>Name</Th><Th>Provider ID</Th><Th>Issuer</Th><Th>Enabled</Th><Th>Actions</Th></Tr></Thead>
            <Tbody>{providers.map(provider => (
              <Tr key={provider.id}>
                <Td>{provider.displayName}</Td><Td>{provider.id}</Td><Td>{provider.issuer}</Td>
                <Td><Switch id={`provider-${provider.id}`} label="Enabled" labelOff="Disabled" isChecked={provider.enabled} isDisabled={provider.source === 'environment'} onChange={(_, value) => void toggleProvider(provider, value)} /></Td>
                <Td><Button variant="plain" aria-label={`Edit ${provider.displayName}`} isDisabled={provider.source === 'environment'} onClick={() => openEdit(provider)}><EditIcon /></Button></Td>
              </Tr>
            ))}</Tbody>
          </Table>
        )}

        {providers.length > 0 && <>
          <Title headingLevel="h3" size="lg">Group mapping</Title>
          <p>Remote groups are scoped to the selected provider ID. Multiple remote groups can grant the same local group permissions.</p>
          <FormGroup label="Authentication provider" fieldId="identity-provider-select">
            <FormSelect id="identity-provider-select" value={selectedProvider} onChange={(_, value) => setSelectedProvider(value)}>
              {providers.map(provider => <FormSelectOption key={provider.id} value={provider.id} label={`${provider.displayName} (${provider.id})`} />)}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Local group" fieldId="identity-local-group-select">
            <FormSelect id="identity-local-group-select" value={selectedLocalGroup} onChange={(_, value) => setSelectedLocalGroup(value)}>
              {groups.map(group => <FormSelectOption key={group.name} value={group.name} label={group.name} />)}
            </FormSelect>
          </FormGroup>
          {groups.length === 0 ? <EmptyState><EmptyStateIcon icon={UsersIcon} /><Title headingLevel="h4" size="md">No local groups</Title><EmptyStateBody>Create a local group with permissions before mapping Keycloak groups.</EmptyStateBody></EmptyState> : <>
            <Title headingLevel="h4" size="md">Mapped remote groups</Title>
            {selectedMappings.length === 0 ? <p>No remote groups mapped to this local group.</p> : (
              <Table aria-label="Mapped remote groups" variant="compact"><Thead><Tr><Th>Provider ID</Th><Th>Group path</Th><Th>Remote ID</Th><Th>Actions</Th></Tr></Thead><Tbody>
                {selectedMappings.map(mapping => <Tr key={`${mapping.provider}:${mapping.group}`}><Td>{mapping.provider}</Td><Td>{mapping.group}</Td><Td>{mapping.groupId ?? '—'}</Td><Td>
                  <Button variant="plain" aria-label={`Remove mapping ${mapping.group}`} isDisabled={savingMapping} onClick={() => void saveMapping(mappings.filter(item => item !== mapping))}><TrashIcon /></Button>
                </Td></Tr>)}
              </Tbody></Table>
            )}
            <SearchInput aria-label="Search remote groups" placeholder="Search Keycloak groups" value={groupSearch} onChange={(_, value) => setGroupSearch(value)} onClear={() => setGroupSearch('')} />
            {loadingDirectory ? <Spinner /> : directoryError ? <Alert variant="danger" title="Could not list remote groups" isInline actionLinks={<Button variant="link" onClick={() => void loadDirectory()}>Retry</Button>}>{directoryError}</Alert> : remoteGroups.length === 0 ? <EmptyState><EmptyStateIcon icon={UsersIcon} /><Title headingLevel="h4" size="md">No remote groups found</Title><EmptyStateBody>Check the search or Keycloak service account permissions.</EmptyStateBody></EmptyState> : (
              <Table aria-label="Remote groups" variant="compact"><Thead><Tr><Th>Path</Th><Th>Remote ID</Th><Th>Action</Th></Tr></Thead><Tbody>
                {remoteGroups.map(group => <Tr key={group.id}><Td>{group.path}</Td><Td>{group.id}</Td><Td><Button variant="secondary" isDisabled={savingMapping || group.provider !== selectedProvider || mappedRemote.has(group.claimValue)} onClick={() => void saveMapping([...mappings, { provider: group.provider, group: group.claimValue, groupId: group.id }])}>{mappedRemote.has(group.claimValue) ? 'Mapped' : 'Map to local group'}</Button></Td></Tr>)}
              </Tbody></Table>
            )}
            {directoryHasMore && !loadingDirectory && <Button variant="link" onClick={() => void loadMoreRemoteGroups()}>Load more remote groups</Button>}
          </>}

          <Title headingLevel="h3" size="lg">OIDC users</Title>
          {loadingAccounts ? <Spinner /> : accountsError ? <Alert variant="danger" title="Could not load OIDC identities" isInline actionLinks={<Button variant="link" onClick={() => void loadAccounts()}>Retry</Button>}>{accountsError}</Alert> : users.length === 0 ? <EmptyState><EmptyStateIcon icon={UsersIcon} /><Title headingLevel="h4" size="md">No OIDC users yet</Title><EmptyStateBody>Users appear here after their first successful login through this provider.</EmptyStateBody></EmptyState> : <>
            <Table aria-label="OIDC users" variant="compact"><Thead><Tr><Th>Username</Th><Th>Email</Th><Th>Account</Th><Th>Last login</Th><Th>Actions</Th></Tr></Thead><Tbody>
              {userPage.paginatedData.map(user => <Tr key={user.userId}><Td>{user.externalUsername || user.userId}</Td><Td>{user.externalEmail || '—'}</Td><Td>{user.active ? 'Active' : 'Disabled'}</Td><Td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '—'}</Td><Td>
                <Button variant="secondary" onClick={() => setPending({ title: user.active ? 'Disable user?' : 'Enable user?', detail: user.userId, action: () => identityApi.setUserActive(user.userId, !user.active) })}>{user.active ? 'Disable' : 'Enable'}</Button>{' '}
                <Button variant="plain" aria-label={`Delete ${user.userId}`} onClick={() => setPending({ title: 'Delete OIDC user?', detail: `${user.userId} can sign in again later.`, action: () => identityApi.deleteUser(user.userId, false) })}><TrashIcon /></Button>{' '}
                <Button variant="secondary" onClick={() => setPending({ title: 'Delete and blacklist OIDC user?', detail: `${user.userId} will be prevented from signing in again until removed from the blacklist.`, action: () => identityApi.deleteUser(user.userId, true) })}>Delete &amp; blacklist</Button>
              </Td></Tr>)}
            </Tbody></Table>
            {userPage.totalPages > 1 && <Pagination itemCount={userPage.totalItems} page={userPage.page} perPage={userPage.perPage} onSetPage={userPage.handleSetPage} onPerPageSelect={userPage.handlePerPageSelect} />}
          </>}

          <Title headingLevel="h3" size="lg">OIDC blacklist</Title>
          {loadingAccounts || accountsError ? null : blocks.length === 0 ? <EmptyState><EmptyStateIcon icon={UsersIcon} /><Title headingLevel="h4" size="md">No blocked identities</Title><EmptyStateBody>Delete and blacklist an OIDC user to prevent future logins.</EmptyStateBody></EmptyState> : <>
            <Table aria-label="OIDC blacklist" variant="compact"><Thead><Tr><Th>Username</Th><Th>Email</Th><Th>Provider ID</Th><Th>Action</Th></Tr></Thead><Tbody>
              {blockPage.paginatedData.map(block => <Tr key={block.id}><Td>{block.username || block.subject}</Td><Td>{block.email || '—'}</Td><Td>{block.provider}</Td><Td><Button variant="secondary" onClick={() => setPending({ title: 'Remove identity from blacklist?', detail: block.username || block.subject, action: () => identityApi.unblock(block.id) })}>Unblock</Button></Td></Tr>)}
            </Tbody></Table>
            {blockPage.totalPages > 1 && <Pagination itemCount={blockPage.totalItems} page={blockPage.page} perPage={blockPage.perPage} onSetPage={blockPage.handleSetPage} onPerPageSelect={blockPage.handlePerPageSelect} />}
          </>}
        </>}
      </CardBody>

      <FormModal isOpen={providerForm !== null} title={editingProvider ? 'Edit Keycloak provider' : 'Add Keycloak provider'} onClose={() => setProviderForm(null)}>
        {providerForm && <Form onSubmit={event => void saveProvider(event)}>
          <FormGroup label="Provider ID" isRequired fieldId="identity-id"><TextInput id="identity-id" value={providerForm.id} isDisabled={!!editingProvider} isRequired onChange={(_, value) => {
            setProviderForm(current => current ? {
              ...current, id: value,
              redirectUrl: !current.redirectUrl || current.redirectUrl === `${window.location.origin}/api/v1/auth/oidc/${current.id}/callback`
                ? `${window.location.origin}/api/v1/auth/oidc/${value}/callback` : current.redirectUrl,
            } : null);
          }} /></FormGroup>
          <FormGroup label="Display name" isRequired fieldId="identity-name"><TextInput id="identity-name" value={providerForm.displayName} isRequired onChange={(_, value) => setField('displayName', value)} /></FormGroup>
          <FormGroup label="Issuer URL" isRequired fieldId="identity-issuer"><TextInput id="identity-issuer" value={providerForm.issuer} isDisabled={!!editingProvider} isRequired onChange={(_, value) => setField('issuer', value)} /></FormGroup>
          <FormGroup label="OIDC client ID" isRequired fieldId="identity-client"><TextInput id="identity-client" value={providerForm.clientId} isRequired onChange={(_, value) => setField('clientId', value)} /></FormGroup>
          <FormGroup label={editingProvider ? 'OIDC client secret (leave blank to keep)' : 'OIDC client secret'} isRequired={!editingProvider} fieldId="identity-secret"><TextInput id="identity-secret" type="password" value={providerForm.clientSecret ?? ''} isRequired={!editingProvider} onChange={(_, value) => setField('clientSecret', value)} /></FormGroup>
          <FormGroup label="Callback URL" isRequired fieldId="identity-callback"><TextInput id="identity-callback" value={providerForm.redirectUrl} isRequired onChange={(_, value) => setField('redirectUrl', value)} /></FormGroup>
          <FormGroup label="Keycloak admin client ID" fieldId="identity-admin-client"><TextInput id="identity-admin-client" value={providerForm.adminClientId ?? ''} onChange={(_, value) => setField('adminClientId', value)} /></FormGroup>
          <FormGroup label="Keycloak admin client secret (leave blank to keep)" fieldId="identity-admin-secret"><TextInput id="identity-admin-secret" type="password" value={providerForm.adminClientSecret ?? ''} onChange={(_, value) => setField('adminClientSecret', value)} /></FormGroup>
          <p>The admin service account needs permission to list Keycloak groups. Login remains available without group discovery credentials.</p>
          <Switch id="identity-enabled" label="Enabled" labelOff="Disabled" isChecked={providerForm.enabled} onChange={(_, value) => setField('enabled', value)} />
          <Button type="submit" variant="primary" isDisabled={savingProvider}>{savingProvider ? 'Saving…' : 'Save provider'}</Button>{' '}
          <Button variant="link" onClick={() => setProviderForm(null)}>Cancel</Button>
        </Form>}
      </FormModal>

      <Modal variant={ModalVariant.small} title={pending?.title ?? 'Confirm identity action'} isOpen={pending !== null} onClose={() => setPending(null)} actions={[
        <Button key="confirm" variant="danger" isDisabled={busy} onClick={() => void confirmAction()}>Confirm</Button>,
        <Button key="cancel" variant="link" onClick={() => setPending(null)}>Cancel</Button>,
      ]}>{pending?.detail}</Modal>
    </Card>
  );
}
