import { useCallback, useEffect, useState } from 'react';
import {
  ActionGroup, Alert, Button, Card, CardBody, CardTitle, EmptyState, EmptyStateBody,
  EmptyStateIcon, Flex, FlexItem, Form, FormGroup, FormSelect, FormSelectOption,
  Label, Modal, ModalVariant, Radio, Spinner, TextInput, Title,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { DatabaseIcon, EditIcon, PlusCircleIcon, SyncIcon, TrashIcon } from '@patternfly/react-icons';
import { useNotifications } from '../hooks/useNotifications';
import { operatorApi } from '../services/operatorApi';
import { workspacesApi } from '../services/workspacesApi';
import type { GroupResponse, WorkspaceInfo, WorkspacePVC, WorkspacePublishRequest } from '../types/api';
import { FormModal } from './FormModal';

const dnsLabelPattern = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const isDnsSubdomain = (value: string) =>
  value.length > 0 && value.length <= 253 && value.split('.').every((label) => label.length <= 63 && dnsLabelPattern.test(label));

/** Admin catalog for publishing existing RWX PVCs and observing their availability. */
export function WorkspacesCard() {
  const { showSuccess, showError } = useNotifications();
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceInfo | null>(null);
  const [name, setName] = useState('');
  const [claimName, setClaimName] = useState('');
  const [eligiblePVCs, setEligiblePVCs] = useState<WorkspacePVC[]>([]);
  const [pvcLoading, setPVCLoading] = useState(false);
  const [pvcError, setPVCError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'public' | 'group'>('private');
  const [group, setGroup] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<WorkspaceInfo | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setWorkspaces(await workspacesApi.listAll());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadEligiblePVCs = async () => {
    setPVCLoading(true);
    setPVCError(null);
    try {
      setEligiblePVCs(await workspacesApi.listEligiblePVCs());
    } catch (error) {
      setPVCError(error instanceof Error ? error.message : 'Unable to load eligible PVCs');
    } finally {
      setPVCLoading(false);
    }
  };

  const openForm = async (workspace?: WorkspaceInfo) => {
    setEditing(workspace ?? null);
    setName(workspace?.name ?? '');
    setClaimName(workspace?.claimName ?? '');
    setVisibility(workspace?.availableToAll ? 'public' : workspace?.groups?.length ? 'group' : 'private');
    setGroup(workspace?.groups?.[0] ?? '');
    setFormError(null);
    setGroups([]);
    setFormOpen(true);
    setEligiblePVCs([]);
    setPVCError(null);
    if (!workspace) void loadEligiblePVCs();
    try {
      const response = await operatorApi.getGroups();
      setGroups(response.groups ?? []);
    } catch (error) {
      setFormError(`Could not load groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const save = async () => {
    const alias = name.trim();
    const claim = claimName.trim();
    if (!isDnsSubdomain(alias)) {
      setFormError('Workspace name must be a DNS subdomain (lowercase letters, numbers, dots and hyphens).');
      return;
    }
    if (!editing && !eligiblePVCs.some((pvc) => pvc.name === claim)) {
      setFormError('Choose an eligible PVC from the list.');
      return;
    }
    if (!isDnsSubdomain(claim)) {
      setFormError('PVC name must be a DNS subdomain (lowercase letters, numbers, dots and hyphens).');
      return;
    }
    if (visibility === 'group' && !group) {
      setFormError('Choose a group for group access.');
      return;
    }
    const request: WorkspacePublishRequest = {
      claimName: claim,
      availableToAll: visibility === 'public',
      groups: visibility === 'group' ? [group] : [],
    };
    setSaving(true);
    setFormError(null);
    try {
      await workspacesApi.save(alias, request);
      setFormOpen(false);
      showSuccess(editing ? 'Workspace updated' : 'Workspace published', alias);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save workspace');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await workspacesApi.remove(deleting.name);
      showSuccess('Workspace unpublished', `${deleting.name} was removed. Its PVC and files remain.`);
      setDeleting(null);
      await load();
    } catch (error) {
      showError('Unable to unpublish workspace', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem><Title headingLevel="h2" size="lg">Workspaces</Title></FlexItem>
          <FlexItem>
            <Button variant="secondary" icon={<SyncIcon />} onClick={() => void load()} isDisabled={loading}>Refresh</Button>{' '}
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => void openForm()}>Publish PVC</Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        <p style={{ marginBottom: '1rem' }}>Publish an existing ReadWriteMany PVC in the operator namespace. Availability checks PVC metadata; scenario pods still need write access as UID/GID 1001:1001.</p>
        {loading ? <Spinner size="md" aria-label="Loading workspaces" /> : loadError ? (
          <EmptyState>
            <EmptyStateIcon icon={DatabaseIcon} />
            <Title headingLevel="h3" size="md">Unable to load workspaces</Title>
            <EmptyStateBody>{loadError}</EmptyStateBody>
            <Button variant="primary" onClick={() => void load()}>Retry</Button>
          </EmptyState>
        ) : workspaces.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={DatabaseIcon} />
            <Title headingLevel="h3" size="md">No workspaces published</Title>
            <EmptyStateBody>Publish an existing PVC to make it available for scenario runs.</EmptyStateBody>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => void openForm()}>Publish PVC</Button>
          </EmptyState>
        ) : (
          <Table aria-label="Published workspaces" variant="compact">
            <Thead><Tr><Th>Name</Th><Th>PVC</Th><Th>Visibility</Th><Th>Status</Th><Th>Actions</Th></Tr></Thead>
            <Tbody>{workspaces.map((workspace) => (
              <Tr key={workspace.name}>
                <Td dataLabel="Name">{workspace.name}</Td>
                <Td dataLabel="PVC">{workspace.claimName}</Td>
                <Td dataLabel="Visibility">{workspace.availableToAll ? 'Public' : workspace.groups?.length ? `Group: ${workspace.groups[0]}` : 'Admin only'}</Td>
                <Td dataLabel="Status"><Label color={workspace.available ? 'green' : 'red'}>{workspace.available ? 'Available' : 'Unavailable'}</Label>{workspace.reason && <div>{workspace.reason}</div>}</Td>
                <Td dataLabel="Actions">
                  <Button variant="plain" icon={<EditIcon />} aria-label={`Edit ${workspace.name}`} onClick={() => void openForm(workspace)} />
                  <Button variant="plain" icon={<TrashIcon />} aria-label={`Unpublish ${workspace.name}`} onClick={() => setDeleting(workspace)} />
                </Td>
              </Tr>
            ))}</Tbody>
          </Table>
        )}
      </CardBody>
      <FormModal isOpen={formOpen} title={editing ? 'Edit workspace' : 'Publish PVC'} description="The PVC must already exist in the operator namespace." onClose={() => { if (!saving) setFormOpen(false); }}>
        <Form style={{ padding: '1.5rem' }}>
          {formError && <Alert variant="danger" title={formError} isInline />}
          <FormGroup label="Workspace name" isRequired fieldId="workspace-name">
            <TextInput aria-label="Workspace name" id="workspace-name" value={name} onChange={(_event, value) => setName(value)} isDisabled={Boolean(editing) || saving} />
          </FormGroup>
          <FormGroup label="PVC name" isRequired fieldId="workspace-claim">
            {editing ? (
              <TextInput aria-label="PVC name" id="workspace-claim" value={claimName} isDisabled />
            ) : (
              <>
                <FormSelect aria-label="PVC name" id="workspace-claim" value={claimName} onChange={(_event, value) => setClaimName(value)} isDisabled={saving || pvcLoading || Boolean(pvcError)}>
                  <FormSelectOption value="" label="Choose a Bound Filesystem RWX PVC" />
                  {eligiblePVCs.map((pvc) => <FormSelectOption key={pvc.name} value={pvc.name} label={pvc.name} />)}
                </FormSelect>
                {pvcLoading && <Spinner size="sm" aria-label="Loading eligible PVCs" />}
                {pvcError && <Alert variant="danger" title="Unable to load eligible PVCs" isInline actionLinks={<Button variant="link" onClick={() => void loadEligiblePVCs()}>Retry</Button>}>{pvcError}</Alert>}
                {!pvcLoading && !pvcError && eligiblePVCs.length === 0 && <Alert variant="info" title="No eligible PVCs found" isInline>Ask the cluster administrator to provision a Bound Filesystem ReadWriteMany PVC in the operator namespace.</Alert>}
              </>
            )}
          </FormGroup>
          {editing && <Alert variant="info" title="To change the PVC, unpublish this workspace and publish a new one. Existing run bindings will no longer be valid." isInline />}
          <FormGroup label="Visibility" fieldId="workspace-visibility">
            <Radio id="workspace-private" name="workspace-visibility" label="Admin only" isChecked={visibility === 'private'} onChange={() => setVisibility('private')} isDisabled={saving} />
            <Radio id="workspace-public" name="workspace-visibility" label="Public" isChecked={visibility === 'public'} onChange={() => setVisibility('public')} isDisabled={saving} />
            <Radio id="workspace-group" name="workspace-visibility" label="Group" isChecked={visibility === 'group'} onChange={() => setVisibility('group')} isDisabled={saving} />
          </FormGroup>
          {visibility === 'group' && <FormGroup label="Access group" isRequired fieldId="workspace-group-select">
            <FormSelect aria-label="Access group" id="workspace-group-select" value={group} onChange={(_event, value) => setGroup(value)} isDisabled={saving}>
              <FormSelectOption value="" label="Choose a group" />
              {groups.map((item) => <FormSelectOption key={item.id || item.name} value={item.id || item.name} label={item.name} />)}
            </FormSelect>
          </FormGroup>}
          <ActionGroup>
            <Button variant="primary" onClick={() => void save()} isLoading={saving} isDisabled={saving || (!editing && (!claimName || pvcLoading || Boolean(pvcError)))}>{editing ? 'Save' : 'Publish'}</Button>
            <Button variant="link" onClick={() => setFormOpen(false)} isDisabled={saving}>Cancel</Button>
          </ActionGroup>
        </Form>
      </FormModal>
      <Modal variant={ModalVariant.small} title="Unpublish workspace?" isOpen={Boolean(deleting)} onClose={() => { if (!deletePending) setDeleting(null); }} actions={[
        <Button key="delete" variant="danger" onClick={() => void remove()} isLoading={deletePending} isDisabled={deletePending}>Unpublish</Button>,
        <Button key="cancel" variant="link" onClick={() => setDeleting(null)} isDisabled={deletePending}>Cancel</Button>,
      ]}>
        The workspace {deleting?.name} will no longer be selectable. Its PVC and files will not be deleted.
      </Modal>
    </Card>
  );
}
