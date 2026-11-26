import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Button, Card, CardBody, CardTitle, EmptyState, EmptyStateBody,
  EmptyStateIcon, Form, FormGroup, FormSelect, FormSelectOption, Modal,
  ModalVariant, Pagination, SearchInput, Spinner, Switch, TextArea, TextInput, Title,
  Tabs, Tab, TabTitleText, Grid, GridItem, Flex, FlexItem, Label,
  Dropdown, DropdownItem, DropdownList, MenuToggle,
  Tooltip,
} from '@patternfly/react-core';
import { PlusCircleIcon, UsersIcon, TrashIcon, EditIcon, KeyIcon, EllipsisVIcon, ArrowRightIcon, QuestionCircleIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { FormModal } from './FormModal';
import { identityApi, type IdentityBlock, type IdentityProvider, type IdentityProviderInput, type RemoteGroup } from '../services/identityApi';
import { groupsApi } from '../services/groupsApi';
import { useNotifications } from '../hooks';
import { usePagination } from '../hooks/usePagination';
import type { ExternalGroupMapping, GroupDetails, UserDetails } from '../types/api';
import './IdentityManagement.css';

type ProviderForm = Omit<IdentityProviderInput, 'type'> & {
  type: '' | IdentityProviderInput['type'];
  clearCACert?: boolean;
};

type PendingIdentityAction = {
  title: string;
  detail: string;
  action: () => Promise<void>;
  destructive?: boolean;
  refreshProviders?: boolean;
  refreshGroups?: boolean;
  refreshAccounts?: boolean;
  successMessage?: string;
  providerId?: string;
};

const emptyProvider: ProviderForm = {
  id: '', type: '', displayName: '', issuer: '', clientId: '',
  clientSecret: '', redirectUrl: '', adminClientId: '', adminClientSecret: '',
  caCert: '', skipTLSVerify: false, clearCACert: false, enabled: false,
};

function failure(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function validCallbackURL(raw: string, providerId: string): boolean {
  try {
    const url = new URL(raw);
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    return (url.protocol === 'https:' || url.protocol === 'http:' && loopback)
      && !url.username && !url.password && !url.search && !url.hash
      && url.pathname.endsWith(`/api/v1/auth/oidc/${providerId}/callback`);
  } catch {
    return false;
  }
}

function hasMapping(localGroup: GroupDetails, remoteGroup: RemoteGroup): boolean {
  return (localGroup.externalGroups ?? []).some(mapping =>
    mapping.provider === remoteGroup.provider && mapping.group === remoteGroup.claimValue);
}

function NoProviderState({ body, onView }: { body: string; onView: () => void }) {
  return <EmptyState>
    <EmptyStateIcon icon={KeyIcon} />
    <Title headingLevel="h3" size="md">Add a provider first</Title>
    <EmptyStateBody>{body}</EmptyStateBody>
    <Button variant="link" onClick={onView}>View providers</Button>
  </EmptyState>;
}

function AccountLoadState({ loading, error, title, onRetry }: { loading: boolean; error: string; title: string; onRetry: () => void }) {
  if (loading) return <Spinner />;
  return <EmptyState>
    <EmptyStateIcon icon={UsersIcon} />
    <Title headingLevel="h4" size="md">{title}</Title>
    <EmptyStateBody>{error}</EmptyStateBody>
    <Button variant="primary" onClick={onRetry}>Retry</Button>
  </EmptyState>;
}

/** Admin UI for provider configuration, scoped group mapping and OIDC accounts. */
export function IdentityManagement() {
  const { showError, showSuccess } = useNotifications();
  const [providers, setProviders] = useState<IdentityProvider[]>([]);
  const [providerError, setProviderError] = useState('');
  const [loadingProviders, setLoadingProviders] = useState(true);
  const providersRevision = useRef(0);
  const pendingProviderIds = useRef(new Set<string>());
  const [updatingProviders, setUpdatingProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [activeSection, setActiveSection] = useState(0);
  const [activeAccountsView, setActiveAccountsView] = useState(0);
  const [openUserMenu, setOpenUserMenu] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<IdentityProvider | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderForm | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [groupsLoadError, setGroupsLoadError] = useState('');
  const [mappingRemote, setMappingRemote] = useState<RemoteGroup | null>(null);
  const [mappingLocalGroupId, setMappingLocalGroupId] = useState('');
  const [remoteGroups, setRemoteGroups] = useState<RemoteGroup[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [directoryError, setDirectoryError] = useState('');
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [directoryHasMore, setDirectoryHasMore] = useState(false);
  const [directoryNextFirst, setDirectoryNextFirst] = useState(0);
  const directoryRevision = useRef(0);
  const [savingMapping, setSavingMapping] = useState(false);
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPerPage, setUserPerPage] = useState(10);
  const [blocks, setBlocks] = useState<IdentityBlock[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const accountsRevision = useRef(0);
  const [pending, setPending] = useState<PendingIdentityAction | null>(null);
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadProviders = useCallback(async (): Promise<boolean> => {
    const revision = ++providersRevision.current;
    setLoadingProviders(true);
    try {
      const loaded = await identityApi.providers();
      if (revision !== providersRevision.current) return false;
      setProviders(loaded);
      setSelectedProvider(current => loaded.some(provider => provider.id === current) ? current : loaded[0]?.id ?? '');
      setProviderError('');
      return true;
    } catch (error) {
      if (revision === providersRevision.current) setProviderError(failure(error));
      return false;
    }
    finally { if (revision === providersRevision.current) setLoadingProviders(false); }
  }, []);

  useEffect(() => { void loadProviders(); }, [loadProviders]);

  const loadGroups = useCallback(async (): Promise<boolean> => {
    try {
      const loaded = await groupsApi.listGroups();
      setGroups(loaded);
      setGroupsLoadError('');
      return true;
    } catch (error) {
      setGroupsLoadError(failure(error));
      return false;
    }
  }, []);

  useEffect(() => { void loadGroups(); }, [loadGroups]);

  const loadDirectory = useCallback(async () => {
    const revision = ++directoryRevision.current;
    if (!selectedProvider) { setRemoteGroups([]); setDirectoryHasMore(false); setDirectoryNextFirst(0); return; }
    setLoadingDirectory(true);
    try {
      const page = await identityApi.groups(selectedProvider, groupSearch);
      if (revision !== directoryRevision.current) return;
      setRemoteGroups(page.groups);
      setDirectoryHasMore(page.hasMore);
      setDirectoryNextFirst(page.nextFirst);
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
      const page = await identityApi.groups(selectedProvider, groupSearch, directoryNextFirst);
      if (revision !== directoryRevision.current) return;
      setRemoteGroups(current => [...current, ...page.groups]);
      setDirectoryHasMore(page.hasMore);
      setDirectoryNextFirst(page.nextFirst);
    } catch (error) { if (revision === directoryRevision.current) showError('Could not load more remote groups', failure(error)); }
    finally { if (revision === directoryRevision.current) setLoadingDirectory(false); }
  }

  const loadAccounts = useCallback(async () => {
    const revision = ++accountsRevision.current;
    if (!selectedProvider) { setUsers([]); setUserTotal(0); setBlocks([]); return; }
    setUsers([]);
    setUserTotal(0);
    setBlocks([]);
    setLoadingAccounts(true);
    try {
      const [loadedUsers, loadedBlocks] = await Promise.all([
        identityApi.users(selectedProvider, userPage, userPerPage), identityApi.blocks(selectedProvider),
      ]);
      if (revision !== accountsRevision.current) return;
      if (userPage > 1 && loadedUsers.users.length === 0 && loadedUsers.total > 0 &&
          Math.ceil(loadedUsers.total / userPerPage) < userPage) {
        setUserPage(Math.ceil(loadedUsers.total / userPerPage));
        return;
      }
      setUsers(loadedUsers.users);
      setUserTotal(loadedUsers.total);
      setBlocks(loadedBlocks);
      setAccountsError('');
    } catch (error) { if (revision === accountsRevision.current) setAccountsError(failure(error)); }
    finally { if (revision === accountsRevision.current) setLoadingAccounts(false); }
  }, [selectedProvider, userPage, userPerPage]);

  useEffect(() => {
    void loadAccounts();
    return () => { accountsRevision.current += 1; };
  }, [loadAccounts]);

  const selectedMappings = groups.flatMap(localGroup => (localGroup.externalGroups ?? [])
    .filter(mapping => mapping.provider === selectedProvider)
    .map(mapping => ({ localGroup, mapping })));
  const availableLocalGroups = mappingRemote ? groups.filter(localGroup => !hasMapping(localGroup, mappingRemote)) : [];
  const blockPage = usePagination(blocks, { initialPerPage: 10 });

  async function saveMapping(localGroup: GroupDetails, next: ExternalGroupMapping[]): Promise<boolean> {
    if (savingMapping || deletingProviderId !== null) return false;
    setSavingMapping(true);
    try {
      await groupsApi.updateGroup(localGroup.id ?? localGroup.name, { externalGroups: next });
      if (!await loadGroups()) {
        showError('Group mapping saved, but the group list could not be refreshed', 'Use Retry in the group mapping section to reload the latest mappings.');
        return true;
      }
      showSuccess('Group mapping saved');
      return true;
    } catch (error) { showError('Could not save group mapping', failure(error)); return false; }
    finally { setSavingMapping(false); }
  }

  function openMapping(remoteGroup: RemoteGroup) {
    if (savingMapping || deletingProviderId !== null) return;
    setMappingLocalGroupId('');
    setMappingRemote(remoteGroup);
  }

  async function confirmMapping() {
    if (!mappingRemote || deletingProviderId !== null) return;
    const localGroup = groups.find(group => (group.id ?? group.name) === mappingLocalGroupId);
    if (!localGroup) return;
    if (hasMapping(localGroup, mappingRemote)) return;
    const next = [...(localGroup.externalGroups ?? []), {
      provider: mappingRemote.provider, group: mappingRemote.claimValue, groupId: mappingRemote.id,
    }];
    if (await saveMapping(localGroup, next)) {
      setMappingRemote(null);
      setMappingLocalGroupId('');
    }
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
      adminClientId: provider.adminClientId ?? '', clientSecret: '', adminClientSecret: '',
      caCert: '', clearCACert: false, skipTLSVerify: provider.skipTLSVerify ?? false, enabled: provider.enabled,
    });
  }

  async function saveProvider(event: React.FormEvent) {
    event.preventDefault();
    if (!providerForm || !providerForm.type) return;
    if (!validCallbackURL(providerForm.redirectUrl, providerForm.id)) {
      showError('Could not save identity provider', 'Callback URL must be HTTPS (HTTP is allowed for localhost) and end with this provider\'s /api/v1/auth/oidc/{id}/callback path.');
      return;
    }
    setSavingProvider(true);
    try {
      if (editingProvider) {
        const { displayName, clientId, clientSecret, redirectUrl, adminClientId, adminClientSecret, enabled, caCert, clearCACert, skipTLSVerify } = providerForm;
        if (!adminClientId && editingProvider.hasAdminClientSecret) {
          throw new Error('Use Remove group directory credentials to clear the existing service client.');
        }
        await identityApi.updateProvider(editingProvider.id, {
          displayName, clientId, redirectUrl, adminClientId, enabled,
          skipTLSVerify,
          ...(clearCACert ? { caCert: '' } : caCert?.trim() ? { caCert: caCert.trim() } : {}),
          ...(clientSecret ? { clientSecret } : {}),
          ...(adminClientSecret ? { adminClientSecret } : {}),
        });
      } else {
        const { clearCACert: _clearCACert, ...providerInput } = providerForm;
        await identityApi.createProvider({ ...providerInput, type: providerForm.type });
      }
      setProviderForm(null);
      await loadProviders();
      showSuccess('Identity provider saved');
    } catch (error) { showError('Could not save identity provider', failure(error)); }
    finally { setSavingProvider(false); }
  }

  async function toggleProvider(provider: IdentityProvider, enabled: boolean) {
    if (pendingProviderIds.current.has(provider.id)) return;
    pendingProviderIds.current.add(provider.id);
    setUpdatingProviders(current => [...current, provider.id]);
    try {
      await identityApi.updateProvider(provider.id, { enabled });
      await loadProviders();
      showSuccess(enabled ? 'Provider enabled' : 'Provider disabled');
    } catch (error) { showError('Could not update provider', failure(error)); }
    finally {
      pendingProviderIds.current.delete(provider.id);
      setUpdatingProviders(current => current.filter(id => id !== provider.id));
    }
  }

  async function confirmAction() {
    if (!pending) return;
    const action = pending;
    setBusy(true);
    try {
      await action.action();
      let refreshFailed = false;
      if (action.refreshProviders && !await loadProviders()) refreshFailed = true;
      if (action.refreshGroups && !await loadGroups()) refreshFailed = true;
      if (action.refreshAccounts !== false) await loadAccounts();
      setPending(current => current === action ? null : current);
      if (action.providerId) setDeletingProviderId(current => current === action.providerId ? null : current);
      if (refreshFailed) {
        showError('Identity action completed, but the lists could not be refreshed', 'Use Retry in the provider or group mapping section to reload the latest data. The action has already completed.');
      } else {
        showSuccess(action.successMessage ?? 'Identity updated');
      }
    } catch (error) { showError('Could not update identity', failure(error)); }
    finally { setBusy(false); }
  }

  function requestConfirmation(action: PendingIdentityAction): boolean {
    if (busy || pending !== null) return false;
    setPending(action);
    return true;
  }

  function closeConfirmation() {
    if (busy) return;
    setPending(null);
    setDeletingProviderId(null);
  }

  const setField = <K extends keyof ProviderForm>(key: K, value: ProviderForm[K]) =>
    setProviderForm(current => current ? { ...current, [key]: value } : null);

  return (
    <Card className="identity-management">
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem><Title headingLevel="h2" size="lg">Identity management</Title></FlexItem>
          <FlexItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>
              Add provider
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        <p className="identity-management__intro">
          Configure external sign-in, connect remote groups to local permissions, and manage identities.
        </p>
        {groupsLoadError && <Alert variant="danger" title="Could not refresh local groups" isInline actionLinks={<Button variant="link" onClick={() => void loadGroups()}>Retry group list</Button>}>
          {groupsLoadError}
        </Alert>}
        <Tabs activeKey={activeSection} onSelect={(_, key) => setActiveSection(Number(key))} aria-label="Identity management sections">
          <Tab eventKey={0} title={<TabTitleText>Providers ({providers.length})</TabTitleText>}>
            <div className="identity-management__panel">
              <p className="identity-management__lead">Enabled providers appear as choices on the login page.</p>
              {loadingProviders ? <Spinner /> : providerError ? (
                <EmptyState>
                  <EmptyStateIcon icon={KeyIcon} />
                  <Title headingLevel="h4" size="md">Could not load providers</Title>
                  <EmptyStateBody>{providerError}</EmptyStateBody>
                  <Button variant="primary" onClick={() => void loadProviders()}>Retry</Button>
                </EmptyState>
              ) : providers.length === 0 ? (
                <EmptyState>
                  <EmptyStateIcon icon={KeyIcon} />
                  <Title headingLevel="h4" size="md">No identity providers</Title>
                  <EmptyStateBody>Use the add button in the upper-right corner to configure your first provider.</EmptyStateBody>
                </EmptyState>
              ) : (
                <Table aria-label="Authentication providers" variant="compact">
                  <Thead><Tr><Th>Provider</Th><Th>Type</Th><Th>Issuer</Th><Th>Login</Th><Th>Actions</Th></Tr></Thead>
                  <Tbody>{providers.map(provider => (
                    <Tr key={provider.id}>
                      <Td><strong>{provider.displayName}</strong><div className="identity-management__meta">{provider.id}</div></Td>
                      <Td>{provider.type === 'keycloak' ? 'Keycloak' : provider.type}</Td>
                      <Td className="identity-management__issuer">{provider.issuer}</Td>
                      <Td><Switch id={`provider-${provider.id}`} label="Enabled" labelOff="Disabled" isChecked={provider.enabled} isDisabled={provider.source === 'environment' || updatingProviders.includes(provider.id)} onChange={(_, value) => void toggleProvider(provider, value)} /></Td>
                      <Td>
                        <Button variant="plain" aria-label={`Edit ${provider.displayName}`} isDisabled={provider.source === 'environment'} onClick={() => openEdit(provider)}><EditIcon /></Button>
                        <Button
                          variant="plain"
                          aria-label={`Delete ${provider.displayName}`}
                          isDisabled={provider.source === 'environment' || savingMapping || deletingProviderId !== null}
                          onClick={() => {
                            const opened = requestConfirmation({
                              title: 'Delete identity provider?',
                              detail: `This removes ${provider.displayName}, its remote group mappings, and active sessions. OIDC user records and blacklist entries are retained.`,
                              destructive: true,
                              providerId: provider.id,
                              action: () => identityApi.deleteProvider(provider.id),
                              refreshProviders: true,
                              refreshGroups: true,
                              refreshAccounts: false,
                              successMessage: 'Identity provider deleted',
                            });
                            if (opened) setDeletingProviderId(provider.id);
                          }}
                        ><TrashIcon /></Button>
                      </Td>
                    </Tr>
                  ))}</Tbody>
                </Table>
              )}
            </div>
          </Tab>

          <Tab eventKey={1} title={<TabTitleText>Group mapping</TabTitleText>}>
            <div className="identity-management__panel">
              {providers.length === 0 ? (
                <NoProviderState body="Group mapping becomes available after you configure an identity provider." onView={() => setActiveSection(0)} />
              ) : <>
                <p className="identity-management__lead">
                  Map full remote group paths to local groups. The provider ID keeps identically named groups separate.
                </p>
                <Grid hasGutter className="identity-management__filters">
                  <GridItem span={12} md={6}>
                    <FormGroup label="Authentication provider" fieldId="identity-provider-select">
                      <FormSelect id="identity-provider-select" value={selectedProvider} onChange={(_, value) => { setSelectedProvider(value); setMappingRemote(null); }}>
                        {providers.map(provider => <FormSelectOption key={provider.id} value={provider.id} label={`${provider.displayName} (${provider.id})`} />)}
                      </FormSelect>
                    </FormGroup>
                  </GridItem>
                </Grid>
                {groups.length === 0 ? (
                  <EmptyState>
                    <EmptyStateIcon icon={UsersIcon} />
                    <Title headingLevel="h3" size="md">No local groups</Title>
                    <EmptyStateBody>Create a local group with permissions in the Groups section above.</EmptyStateBody>
                  </EmptyState>
                ) : (
                  <Grid hasGutter>
                    <GridItem span={12} lg={6}>
                      <Card className="identity-management__card" isFlat>
                        <CardTitle>Browse remote groups</CardTitle>
                        <CardBody>
                          <SearchInput aria-label="Search remote groups" placeholder="Search remote groups" value={groupSearch} onChange={(_, value) => setGroupSearch(value)} onClear={() => setGroupSearch('')} />
                          {loadingDirectory ? <Spinner /> : directoryError ? (
                            <Alert variant="danger" title="Could not list remote groups" isInline actionLinks={<Button variant="link" onClick={() => void loadDirectory()}>Retry</Button>}>
                              {directoryError}
                            </Alert>
                          ) : remoteGroups.length === 0 ? (
                            <EmptyState>
                              <EmptyStateIcon icon={UsersIcon} />
                              <Title headingLevel="h4" size="md">No remote groups found</Title>
                              <EmptyStateBody>Try another search or check the provider's group reader credentials.</EmptyStateBody>
                            </EmptyState>
                          ) : (
                            <Table aria-label="Remote groups" variant="compact" className="identity-management__table">
                              <Thead><Tr><Th>Path</Th><Th>Remote ID</Th><Th>Action</Th></Tr></Thead>
                              <Tbody>{remoteGroups.map(group => (
                                <Tr key={group.id}>
                                  <Td>{group.path}</Td><Td>{group.id}</Td>
                                  <Td><Button variant="secondary" isDisabled={savingMapping || deletingProviderId !== null || group.provider !== selectedProvider || groups.every(localGroup => hasMapping(localGroup, group))} onClick={() => openMapping(group)}>
                                    Map
                                  </Button></Td>
                                </Tr>
                              ))}</Tbody>
                            </Table>
                          )}
                          {directoryHasMore && !loadingDirectory && <Button variant="link" onClick={() => void loadMoreRemoteGroups()}>Load more groups</Button>}
                        </CardBody>
                      </Card>
                    </GridItem>
                    <GridItem span={12} lg={1} className="identity-management__mapping-direction">
                      <span role="img" aria-label="Maps remote groups to local groups"><ArrowRightIcon /></span>
                    </GridItem>
                    <GridItem span={12} lg={5}>
                      <Card className="identity-management__card" isFlat>
                        <CardTitle>Existing mappings</CardTitle>
                        <CardBody>
                          <p className="identity-management__meta">Remote groups from {selectedProvider} and the local groups whose permissions they grant.</p>
                          {selectedMappings.length === 0 ? (
                            <EmptyState>
                              <EmptyStateIcon icon={UsersIcon} />
                              <Title headingLevel="h4" size="md">No mappings yet</Title>
                              <EmptyStateBody>Choose Map beside a remote group, then select a local group.</EmptyStateBody>
                            </EmptyState>
                          ) : (
                            <Table aria-label="Existing group mappings" variant="compact" className="identity-management__table">
                              <Thead><Tr><Th>Remote group</Th><Th>Local group</Th><Th>Action</Th></Tr></Thead>
                              <Tbody>{selectedMappings.map(({ localGroup, mapping }) => (
                                <Tr key={`${localGroup.id ?? localGroup.name}:${mapping.provider}:${mapping.group}`}>
                                  <Td><strong>{mapping.group}</strong><div className="identity-management__meta">Provider group ID: {mapping.groupId || 'not supplied (matched by path)'}</div></Td>
                                  <Td>{localGroup.name}</Td>
                                  <Td><Button variant="plain" aria-label={`Remove mapping ${mapping.group} from ${localGroup.name}`} isDisabled={savingMapping || deletingProviderId !== null} onClick={() => void saveMapping(localGroup, (localGroup.externalGroups ?? []).filter(item => item !== mapping))}><TrashIcon /></Button></Td>
                                </Tr>
                              ))}</Tbody>
                            </Table>
                          )}
                        </CardBody>
                      </Card>
                    </GridItem>
                  </Grid>
                )}
              </>}
            </div>
          </Tab>

          <Tab eventKey={2} title={<TabTitleText>Accounts</TabTitleText>}>
            <div className="identity-management__panel">
              {providers.length === 0 ? (
                <NoProviderState body="OIDC accounts appear here after users sign in through a configured provider." onView={() => setActiveSection(0)} />
              ) : <>
                <div className="identity-management__filters">
                  <FormGroup label="Authentication provider" fieldId="identity-accounts-provider">
                    <FormSelect id="identity-accounts-provider" value={selectedProvider} onChange={(_, value) => { setSelectedProvider(value); setUserPage(1); }}>
                      {providers.map(provider => <FormSelectOption key={provider.id} value={provider.id} label={`${provider.displayName} (${provider.id})`} />)}
                    </FormSelect>
                  </FormGroup>
                </div>
                <Tabs activeKey={activeAccountsView} onSelect={(_, key) => setActiveAccountsView(Number(key))} aria-label="OIDC account views">
                  <Tab eventKey={0} title={<TabTitleText>Users ({userTotal})</TabTitleText>}>
                    <div className="identity-management__panel">
                      {loadingAccounts || accountsError ? (
                        <AccountLoadState loading={loadingAccounts} error={accountsError} title="Could not load OIDC identities" onRetry={() => void loadAccounts()} />
                      ) : users.length === 0 ? (
                        <EmptyState>
                          <EmptyStateIcon icon={UsersIcon} />
                          <Title headingLevel="h4" size="md">No OIDC users yet</Title>
                          <EmptyStateBody>Users appear here after their first successful login through this provider.</EmptyStateBody>
                        </EmptyState>
                      ) : <>
                        <Table aria-label="OIDC users" variant="compact">
                          <Thead><Tr><Th>Identity</Th><Th>Status</Th><Th>Last login</Th><Th>Actions</Th></Tr></Thead>
                          <Tbody>{users.map(user => (
                            <Tr key={user.userId}>
                              <Td><strong>{user.externalUsername || user.name || user.userId}</strong><div className="identity-management__meta">{user.externalEmail || user.userId}</div></Td>
                              <Td><Label color={user.active ? 'green' : 'red'}>{user.active ? 'Active' : 'Disabled'}</Label></Td>
                              <Td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</Td>
                              <Td>
                                <Dropdown
                                  isOpen={openUserMenu === user.userId}
                                  onOpenChange={isOpen => setOpenUserMenu(isOpen ? user.userId : null)}
                                  toggle={toggleRef => (
                                    <MenuToggle ref={toggleRef} variant="plain" aria-label={`Actions for ${user.externalUsername || user.userId}`} onClick={() => setOpenUserMenu(openUserMenu === user.userId ? null : user.userId)}>
                                      <EllipsisVIcon />
                                    </MenuToggle>
                                  )}
                                >
                                  <DropdownList>
                                    <DropdownItem onClick={() => { requestConfirmation({ title: user.active ? 'Disable user?' : 'Enable user?', detail: user.userId, destructive: user.active, action: () => identityApi.setUserActive(user.userId, !user.active) }); setOpenUserMenu(null); }}>
                                      {user.active ? 'Disable' : 'Enable'}
                                    </DropdownItem>
                                    <DropdownItem icon={<TrashIcon />} onClick={() => { requestConfirmation({ title: 'Delete OIDC user?', detail: `${user.userId} can sign in again later.`, destructive: true, action: () => identityApi.deleteUser(user.userId, false) }); setOpenUserMenu(null); }}>
                                      Delete
                                    </DropdownItem>
                                    <DropdownItem icon={<TrashIcon />} onClick={() => { requestConfirmation({ title: 'Delete and blacklist OIDC user?', detail: `${user.userId} cannot sign in again until removed from the blacklist.`, destructive: true, action: () => identityApi.deleteUser(user.userId, true) }); setOpenUserMenu(null); }}>
                                      Delete &amp; blacklist
                                    </DropdownItem>
                                  </DropdownList>
                                </Dropdown>
                              </Td>
                            </Tr>
                          ))}</Tbody>
                        </Table>
                        {userTotal > userPerPage && <Pagination className="identity-management__pagination" itemCount={userTotal} page={userPage} perPage={userPerPage} onSetPage={(_, page) => setUserPage(page)} onPerPageSelect={(_, perPage) => { setUserPerPage(perPage); setUserPage(1); }} />}
                      </>}
                    </div>
                  </Tab>
                  <Tab eventKey={1} title={<TabTitleText>Blacklist ({blocks.length})</TabTitleText>}>
                    <div className="identity-management__panel">
                      {loadingAccounts || accountsError ? (
                        <AccountLoadState loading={loadingAccounts} error={accountsError} title="Could not load the blacklist" onRetry={() => void loadAccounts()} />
                      ) : blocks.length === 0 ? (
                        <EmptyState>
                          <EmptyStateIcon icon={UsersIcon} />
                          <Title headingLevel="h4" size="md">No blocked identities</Title>
                          <EmptyStateBody>Delete and blacklist an OIDC user to prevent future logins.</EmptyStateBody>
                        </EmptyState>
                      ) : <>
                        <Table aria-label="OIDC blacklist" variant="compact">
                          <Thead><Tr><Th>Identity</Th><Th>Provider ID</Th><Th>Action</Th></Tr></Thead>
                          <Tbody>{blockPage.paginatedData.map(block => (
                            <Tr key={block.id}>
                              <Td><strong>{block.username || block.subject}</strong><div className="identity-management__meta">{block.email || block.subject}</div></Td>
                              <Td>{block.provider}</Td>
                              <Td><Button variant="secondary" onClick={() => requestConfirmation({ title: 'Remove identity from blacklist?', detail: block.username || block.subject, action: () => identityApi.unblock(block.id) })}>Unblock</Button></Td>
                            </Tr>
                          ))}</Tbody>
                        </Table>
                        {blockPage.totalPages > 1 && <Pagination className="identity-management__pagination" itemCount={blockPage.totalItems} page={blockPage.page} perPage={blockPage.perPage} onSetPage={blockPage.handleSetPage} onPerPageSelect={blockPage.handlePerPageSelect} />}
                      </>}
                    </div>
                  </Tab>
                </Tabs>
              </>}
            </div>
          </Tab>
        </Tabs>
      </CardBody>

      <FormModal isOpen={providerForm !== null} title={editingProvider ? 'Edit provider' : 'Add provider'} description="Choose a provider type, then enter its connection details." onClose={() => setProviderForm(null)}>
        {providerForm && <Form onSubmit={event => void saveProvider(event)}>
          <FormGroup label="Provider type" isRequired fieldId="identity-type">
            <FormSelect id="identity-type" aria-label="Provider type" value={providerForm.type} isDisabled={!!editingProvider} isRequired onChange={(_, value) => setField('type', value as ProviderForm['type'])}>
              <FormSelectOption value="" label="Select provider type" isDisabled />
              <FormSelectOption value="keycloak" label="Keycloak" />
            </FormSelect>
          </FormGroup>
          {providerForm.type === 'keycloak' && <>
            <Title headingLevel="h4" size="md" className="identity-management__form-section">Provider details</Title>
            <FormGroup label="Provider ID" isRequired fieldId="identity-id"><TextInput id="identity-id" value={providerForm.id} isDisabled={!!editingProvider} isRequired onChange={(_, value) => {
              setProviderForm(current => current ? {
                ...current, id: value,
                redirectUrl: !current.redirectUrl || current.redirectUrl === `${window.location.origin}/api/v1/auth/oidc/${current.id}/callback`
                  ? `${window.location.origin}/api/v1/auth/oidc/${value}/callback` : current.redirectUrl,
              } : null);
            }} /></FormGroup>
            <FormGroup label="Display name" isRequired fieldId="identity-name"><TextInput id="identity-name" value={providerForm.displayName} isRequired onChange={(_, value) => setField('displayName', value)} /></FormGroup>
            <FormGroup label="Issuer URL" isRequired fieldId="identity-issuer"><TextInput id="identity-issuer" value={providerForm.issuer} isDisabled={!!editingProvider} isRequired onChange={(_, value) => setField('issuer', value)} /></FormGroup>
            <Title headingLevel="h4" size="md" className="identity-management__form-section">OIDC login</Title>
            <FormGroup label="Client ID" isRequired fieldId="identity-client"><TextInput id="identity-client" value={providerForm.clientId} isRequired onChange={(_, value) => setField('clientId', value)} /></FormGroup>
            <FormGroup label={editingProvider ? 'Client secret (leave blank to keep)' : 'Client secret'} isRequired={!editingProvider} fieldId="identity-secret"><TextInput id="identity-secret" type="password" value={providerForm.clientSecret ?? ''} isRequired={!editingProvider} onChange={(_, value) => setField('clientSecret', value)} /></FormGroup>
            <FormGroup label="Callback URL" isRequired fieldId="identity-callback"><TextInput id="identity-callback" value={providerForm.redirectUrl} isRequired onChange={(_, value) => setField('redirectUrl', value)} /></FormGroup>
            <Title headingLevel="h4" size="md" className="identity-management__form-section">Group directory (optional)</Title>
            <p className="identity-management__meta">Use a separate Keycloak service account with permission to read realm groups.</p>
            <FormGroup label="Admin client ID" fieldId="identity-admin-client"><TextInput id="identity-admin-client" value={providerForm.adminClientId ?? ''} onChange={(_, value) => setField('adminClientId', value)} /></FormGroup>
            <FormGroup label="Admin client secret (leave blank to keep)" fieldId="identity-admin-secret"><TextInput id="identity-admin-secret" type="password" value={providerForm.adminClientSecret ?? ''} onChange={(_, value) => setField('adminClientSecret', value)} /></FormGroup>
            {editingProvider?.hasAdminClientSecret && <Button variant="secondary" onClick={() => {
              setProviderForm(null);
              requestConfirmation({
                title: 'Remove group directory credentials?',
                detail: 'Remote group browsing will be unavailable until new service credentials are configured.',
                destructive: true,
                action: async () => {
                  await identityApi.updateProvider(editingProvider.id, { adminClientId: '', adminClientSecret: '' });
                  await loadProviders();
                  setProviderForm(null);
                },
              });
            }}>Remove group directory credentials</Button>}
            <Title headingLevel="h4" size="md" className="identity-management__form-section">Connection security</Title>
            <FormGroup
              label={editingProvider?.hasCACert ? 'Additional trusted CA (leave blank to keep current)' : 'Additional trusted CA certificate (PEM)'}
              fieldId="identity-ca-cert"
              labelIcon={
                <Tooltip content="Paste the PEM-encoded CA certificate that issued the certificate served by the OIDC provider. Include the full BEGIN CERTIFICATE and END CERTIFICATE lines; include intermediate CA certificates if the chain requires them. Do not paste the server certificate or a private key.">
                  <span tabIndex={0} aria-label="CA certificate input instructions"><QuestionCircleIcon /></span>
                </Tooltip>
              }
            >
              <TextArea
                id="identity-ca-cert"
                value={providerForm.caCert ?? ''}
                resizeOrientation="vertical"
                rows={6}
                isDisabled={providerForm.skipTLSVerify ?? false}
                onChange={(_, value) => {
                  setField('caCert', value);
                  if (value.trim()) setField('clearCACert', false);
                }}
              />
            </FormGroup>
            {editingProvider?.hasCACert && <Button variant="secondary" onClick={() => setField('clearCACert', !providerForm.clearCACert)}>
              {providerForm.clearCACert ? 'Keep configured CA certificate' : 'Remove configured CA certificate'}
            </Button>}
            <Switch
              id="identity-skip-tls-verify"
              label="Skip TLS verification: Enabled"
              labelOff="Skip TLS verification: Disabled"
              isChecked={providerForm.skipTLSVerify ?? false}
              onChange={(_, value) => setField('skipTLSVerify', value)}
            />
            {providerForm.skipTLSVerify && <Alert variant="warning" title="TLS verification is disabled" isInline>
              Connections to this provider will accept untrusted certificates. Use this only on a network you trust.
            </Alert>}
            <Switch id="identity-enabled" label="Enabled" labelOff="Disabled" isChecked={providerForm.enabled} onChange={(_, value) => setField('enabled', value)} />
          </>}
          <div className="identity-management__form-actions">
            <Button type="submit" variant="primary" isDisabled={savingProvider || !providerForm.type}>{savingProvider ? 'Saving…' : 'Save provider'}</Button>
            <Button variant="link" onClick={() => setProviderForm(null)}>Cancel</Button>
          </div>
        </Form>}
      </FormModal>

      <FormModal isOpen={mappingRemote !== null} title="Map remote group" description={mappingRemote ? `Choose the local group whose permissions should be granted to members of ${mappingRemote.path}.` : undefined} onClose={() => setMappingRemote(null)}>
        {mappingRemote && <Form onSubmit={event => { event.preventDefault(); void confirmMapping(); }}>
          <FormGroup label="Local group" isRequired fieldId="identity-mapping-local-group">
            <FormSelect id="identity-mapping-local-group" aria-label="Local group" value={mappingLocalGroupId} isRequired onChange={(_, value) => setMappingLocalGroupId(value)}>
              <FormSelectOption value="" label="Select local group" isDisabled />
              {availableLocalGroups.map(group => <FormSelectOption key={group.id ?? group.name} value={group.id ?? group.name} label={group.name} />)}
            </FormSelect>
          </FormGroup>
          <div className="identity-management__form-actions">
            <Button type="submit" variant="primary" isDisabled={savingMapping || !mappingLocalGroupId}>{savingMapping ? 'Saving…' : 'Map group'}</Button>
            <Button variant="link" onClick={() => setMappingRemote(null)}>Cancel</Button>
          </div>
        </Form>}
      </FormModal>

      <Modal variant={ModalVariant.small} title={pending?.title ?? 'Confirm identity action'} isOpen={pending !== null} showClose={!busy} onClose={closeConfirmation} actions={[
        <Button key="confirm" variant={pending?.destructive ? 'danger' : 'primary'} isDisabled={busy} onClick={() => void confirmAction()}>Confirm</Button>,
        <Button key="cancel" variant="link" isDisabled={busy} onClick={closeConfirmation}>Cancel</Button>,
      ]}>{pending?.detail}</Modal>
    </Card>
  );
}
