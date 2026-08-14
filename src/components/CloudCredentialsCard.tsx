import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  Modal,
  ModalVariant,
  Spinner,
  Flex,
  FlexItem,
  FormGroup,
  TextInput,
  TextArea,
  Form,
  ActionGroup,
  Alert,
  FormSelect,
  FormSelectOption,
  Label,
  Radio,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { PlusCircleIcon, KeyIcon } from '@patternfly/react-icons';
import { cloudCredentialsApi } from '../services/cloudCredentialsApi';
import { operatorApi } from '../services/operatorApi';
import { useNotifications } from '../hooks';
import type {
  CloudCredential,
  CloudCredentialProvider,
  CreateCloudCredentialRequest,
  UpdateCloudCredentialRequest,
  GroupResponse,
} from '../types/api';

const PROVIDER_LABELS: Record<CloudCredentialProvider, string> = {
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  openstack: 'OpenStack',
  baremetal: 'Baremetal',
  vmware: 'VMware',
  ibmcloud: 'IBM Cloud',
};

const PROVIDER_OPTIONS: CloudCredentialProvider[] = ['aws', 'gcp', 'azure', 'openstack', 'baremetal', 'vmware', 'ibmcloud'];

interface CloudCredentialFormProps {
  initial?: CloudCredential;
  onSubmit: (data: CreateCloudCredentialRequest | UpdateCloudCredentialRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  existingProvider?: CloudCredentialProvider;
}

function CloudCredentialForm({ initial, onSubmit, onCancel, isEdit = false, existingProvider }: CloudCredentialFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [provider, setProvider] = useState<CloudCredentialProvider>(existingProvider ?? initial?.provider ?? 'aws');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [accessType, setAccessType] = useState<'public' | 'group'>(
    initial?.availableToAll || (!initial?.groups?.length) ? 'public' : 'group'
  );
  const [selectedGroup, setSelectedGroup] = useState(initial?.groups?.[0] ?? '');
  const [availableGroups, setAvailableGroups] = useState<GroupResponse[]>([]);

  useEffect(() => {
    let mounted = true;
    operatorApi.getGroups()
      .then(response => { if (mounted) setAvailableGroups(response.groups || []); })
      .catch(() => { if (mounted) setAvailableGroups([]); });
    return () => { mounted = false; };
  }, []);

  // AWS
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsDefaultRegion, setAwsDefaultRegion] = useState('');

  // GCP
  const [gcpServiceAccountJson, setGcpServiceAccountJson] = useState('');

  // Azure
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureSubscriptionId, setAzureSubscriptionId] = useState('');

  // OpenStack
  const [osAuthUrl, setOsAuthUrl] = useState('');
  const [osUsername, setOsUsername] = useState('');
  const [osPassword, setOsPassword] = useState('');
  const [osProjectName, setOsProjectName] = useState('');
  const [osDomainName, setOsDomainName] = useState('');

  // Baremetal
  const [bmcUser, setBmcUser] = useState('');
  const [bmcPassword, setBmcPassword] = useState('');
  const [bmcAddr, setBmcAddr] = useState('');

  // VMware
  const [vsphereIp, setVsphereIp] = useState('');
  const [vsphereUsername, setVsphereUsername] = useState('');
  const [vspherePassword, setVspherePassword] = useState('');

  // IBM Cloud
  const [ibmcUrl, setIbmcUrl] = useState('');
  const [ibmcApikey, setIbmcApikey] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateGcpJson = (raw: string): string | null => {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.type) return 'Missing required field "type"';
      if (!parsed.project_id) return 'Missing required field "project_id"';
      return null;
    } catch {
      return 'Invalid JSON';
    }
  };

  const handleSubmit = async () => {
    if (!isEdit && !name.trim()) {
      setError('Name is required');
      return;
    }
    if (!isEdit && !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name.trim())) {
      setError('Name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric');
      return;
    }

    if (!isEdit) {
      switch (provider) {
        case 'aws':
          if (!awsAccessKeyId || !awsSecretAccessKey || !awsDefaultRegion) {
            setError('Access Key ID, Secret Access Key, and Region are required for AWS');
            return;
          }
          break;
        case 'gcp':
          if (!gcpServiceAccountJson.trim()) {
            setError('Service Account JSON is required for GCP');
            return;
          }
          {
            const gcpErr = validateGcpJson(gcpServiceAccountJson);
            if (gcpErr) {
              setError(`GCP Service Account JSON: ${gcpErr}`);
              return;
            }
          }
          break;
        case 'azure':
          if (!azureTenantId || !azureClientId || !azureClientSecret || !azureSubscriptionId) {
            setError('All four Azure fields are required');
            return;
          }
          break;
        case 'openstack':
          if (!osAuthUrl || !osUsername || !osPassword || !osProjectName) {
            setError('Auth URL, Username, Password, and Project Name are required for OpenStack');
            return;
          }
          break;
        case 'baremetal':
          if (!bmcUser || !bmcPassword || !bmcAddr) {
            setError('BMC User, Password, and Address are required');
            return;
          }
          break;
        case 'vmware':
          if (!vsphereIp || !vsphereUsername || !vspherePassword) {
            setError('vSphere IP, Username, and Password are required');
            return;
          }
          break;
        case 'ibmcloud':
          if (!ibmcUrl || !ibmcApikey) {
            setError('URL and API Key are required for IBM Cloud');
            return;
          }
          break;
      }
    }

    if (isEdit && provider === 'gcp' && gcpServiceAccountJson.trim()) {
      const gcpErr = validateGcpJson(gcpServiceAccountJson);
      if (gcpErr) {
        setError(`GCP Service Account JSON: ${gcpErr}`);
        return;
      }
    }

    setError(null);
    setSubmitting(true);

    try {
      const providerFields = buildProviderFields();
      const groupsArray = accessType === 'group' && selectedGroup ? [selectedGroup] : [];
      const availableToAll = accessType === 'public';

      if (isEdit) {
        const req: UpdateCloudCredentialRequest = {
          description: description.trim() || undefined,
          groups: groupsArray.length > 0 ? groupsArray : undefined,
          availableToAll,
          ...providerFields,
        };
        await onSubmit(req);
      } else {
        const req: CreateCloudCredentialRequest = {
          name: name.trim(),
          provider,
          description: description.trim() || undefined,
          groups: groupsArray.length > 0 ? groupsArray : undefined,
          availableToAll,
          ...providerFields,
        };
        await onSubmit(req);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const buildProviderFields = (): Partial<CreateCloudCredentialRequest> => {
    const activeProvider = isEdit ? existingProvider ?? provider : provider;
    switch (activeProvider) {
      case 'aws':
        return {
          awsAccessKeyId: awsAccessKeyId || undefined,
          awsSecretAccessKey: awsSecretAccessKey || undefined,
          awsDefaultRegion: awsDefaultRegion || undefined,
        };
      case 'gcp':
        if (!gcpServiceAccountJson.trim()) return {};
        {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(gcpServiceAccountJson.trim());
          const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
          return {
            gcpServiceAccountJson: btoa(binary),
          };
        }
      case 'azure':
        return {
          azureTenantId: azureTenantId || undefined,
          azureClientId: azureClientId || undefined,
          azureClientSecret: azureClientSecret || undefined,
          azureSubscriptionId: azureSubscriptionId || undefined,
        };
      case 'openstack':
        return {
          osAuthUrl: osAuthUrl || undefined,
          osUsername: osUsername || undefined,
          osPassword: osPassword || undefined,
          osProjectName: osProjectName || undefined,
          osDomainName: osDomainName || undefined,
        };
      case 'baremetal':
        return {
          bmcUser: bmcUser || undefined,
          bmcPassword: bmcPassword || undefined,
          bmcAddr: bmcAddr || undefined,
        };
      case 'vmware':
        return {
          vsphereIp: vsphereIp || undefined,
          vsphereUsername: vsphereUsername || undefined,
          vspherePassword: vspherePassword || undefined,
        };
      case 'ibmcloud':
        return {
          ibmcUrl: ibmcUrl || undefined,
          ibmcApikey: ibmcApikey || undefined,
        };
      default:
        return {};
    }
  };

  const editHint = isEdit ? ' (leave blank to keep existing)' : '';
  const activeProvider = isEdit ? existingProvider ?? provider : provider;

  return (
    <Form>
      {error && <Alert variant="danger" title={error} style={{ marginBottom: '1rem' }} />}

      {!isEdit && (
        <FormGroup label="Name" isRequired fieldId="cc-name">
          <TextInput
            id="cc-name"
            value={name}
            onChange={(_e, v) => setName(v)}
            placeholder="aws-prod (lowercase alphanumeric and hyphens)"
            isRequired
          />
        </FormGroup>
      )}

      <FormGroup label="Provider" isRequired fieldId="cc-provider">
        <FormSelect
          id="cc-provider"
          value={activeProvider}
          onChange={(_e, v) => setProvider(v as CloudCredentialProvider)}
          isDisabled={isEdit}
        >
          {PROVIDER_OPTIONS.map((p) => (
            <FormSelectOption key={p} value={p} label={PROVIDER_LABELS[p]} />
          ))}
        </FormSelect>
      </FormGroup>

      <FormGroup label="Description" fieldId="cc-description">
        <TextInput
          id="cc-description"
          value={description}
          onChange={(_e, v) => setDescription(v)}
          placeholder="Optional description"
        />
      </FormGroup>

      <FormGroup label="Access Control" fieldId="cc-access">
        <Radio
          id="cc-access-public"
          name="cc-access-type"
          label="Available to all users"
          isChecked={accessType === 'public'}
          onChange={() => setAccessType('public')}
        />
        <Radio
          id="cc-access-group"
          name="cc-access-type"
          label="Assign to group"
          isChecked={accessType === 'group'}
          onChange={() => setAccessType('group')}
        />
      </FormGroup>

      {accessType === 'group' && (
        <FormGroup label="Group" isRequired fieldId="cc-group">
          <FormSelect
            id="cc-group"
            value={selectedGroup}
            onChange={(_e, v) => setSelectedGroup(v)}
          >
            <FormSelectOption value="" label="Select a group…" />
            {availableGroups.map((g) => (
              <FormSelectOption key={g.name} value={g.name} label={g.name} />
            ))}
          </FormSelect>
        </FormGroup>
      )}

      {activeProvider === 'aws' && (
        <>
          <FormGroup label={`Access Key ID${editHint}`} isRequired={!isEdit} fieldId="cc-aws-key">
            <TextInput id="cc-aws-key" value={awsAccessKeyId} onChange={(_e, v) => setAwsAccessKeyId(v)} placeholder="AKIAIOSFODNN7EXAMPLE" />
          </FormGroup>
          <FormGroup label={`Secret Access Key${editHint}`} isRequired={!isEdit} fieldId="cc-aws-secret">
            <TextInput id="cc-aws-secret" type="password" value={awsSecretAccessKey} onChange={(_e, v) => setAwsSecretAccessKey(v)} placeholder={isEdit ? '••••••••' : ''} />
          </FormGroup>
          <FormGroup label={`Default Region${editHint}`} isRequired={!isEdit} fieldId="cc-aws-region">
            <TextInput id="cc-aws-region" value={awsDefaultRegion} onChange={(_e, v) => setAwsDefaultRegion(v)} placeholder="us-east-1" />
          </FormGroup>
        </>
      )}

      {activeProvider === 'gcp' && (
        <FormGroup label={`Service Account JSON${editHint}`} isRequired={!isEdit} fieldId="cc-gcp-json">
          <TextArea
            id="cc-gcp-json"
            value={gcpServiceAccountJson}
            onChange={(_e, v) => setGcpServiceAccountJson(v)}
            placeholder='{"type": "service_account", "project_id": "...", ...}'
            rows={8}
            resizeOrientation="vertical"
          />
        </FormGroup>
      )}

      {activeProvider === 'azure' && (
        <>
          <FormGroup label={`Tenant ID${editHint}`} isRequired={!isEdit} fieldId="cc-az-tenant">
            <TextInput id="cc-az-tenant" value={azureTenantId} onChange={(_e, v) => setAzureTenantId(v)} />
          </FormGroup>
          <FormGroup label={`Client ID${editHint}`} isRequired={!isEdit} fieldId="cc-az-client">
            <TextInput id="cc-az-client" value={azureClientId} onChange={(_e, v) => setAzureClientId(v)} />
          </FormGroup>
          <FormGroup label={`Client Secret${editHint}`} isRequired={!isEdit} fieldId="cc-az-secret">
            <TextInput id="cc-az-secret" type="password" value={azureClientSecret} onChange={(_e, v) => setAzureClientSecret(v)} placeholder={isEdit ? '••••••••' : ''} />
          </FormGroup>
          <FormGroup label={`Subscription ID${editHint}`} isRequired={!isEdit} fieldId="cc-az-sub">
            <TextInput id="cc-az-sub" value={azureSubscriptionId} onChange={(_e, v) => setAzureSubscriptionId(v)} />
          </FormGroup>
        </>
      )}

      {activeProvider === 'openstack' && (
        <>
          <FormGroup label={`Auth URL${editHint}`} isRequired={!isEdit} fieldId="cc-os-auth">
            <TextInput id="cc-os-auth" value={osAuthUrl} onChange={(_e, v) => setOsAuthUrl(v)} placeholder="http://keystone:5000/v3" />
          </FormGroup>
          <FormGroup label={`Username${editHint}`} isRequired={!isEdit} fieldId="cc-os-user">
            <TextInput id="cc-os-user" value={osUsername} onChange={(_e, v) => setOsUsername(v)} />
          </FormGroup>
          <FormGroup label={`Password${editHint}`} isRequired={!isEdit} fieldId="cc-os-pass">
            <TextInput id="cc-os-pass" type="password" value={osPassword} onChange={(_e, v) => setOsPassword(v)} placeholder={isEdit ? '••••••••' : ''} />
          </FormGroup>
          <FormGroup label={`Project Name${editHint}`} isRequired={!isEdit} fieldId="cc-os-project">
            <TextInput id="cc-os-project" value={osProjectName} onChange={(_e, v) => setOsProjectName(v)} />
          </FormGroup>
          <FormGroup label="Domain Name" fieldId="cc-os-domain">
            <TextInput id="cc-os-domain" value={osDomainName} onChange={(_e, v) => setOsDomainName(v)} placeholder="Default (optional)" />
          </FormGroup>
        </>
      )}

      {activeProvider === 'baremetal' && (
        <>
          <FormGroup label={`BMC User${editHint}`} isRequired={!isEdit} fieldId="cc-bmc-user">
            <TextInput id="cc-bmc-user" value={bmcUser} onChange={(_e, v) => setBmcUser(v)} placeholder="admin" />
          </FormGroup>
          <FormGroup label={`BMC Password${editHint}`} isRequired={!isEdit} fieldId="cc-bmc-pass">
            <TextInput id="cc-bmc-pass" type="password" value={bmcPassword} onChange={(_e, v) => setBmcPassword(v)} placeholder={isEdit ? '••••••••' : ''} />
          </FormGroup>
          <FormGroup label={`BMC Address${editHint}`} isRequired={!isEdit} fieldId="cc-bmc-addr">
            <TextInput id="cc-bmc-addr" value={bmcAddr} onChange={(_e, v) => setBmcAddr(v)} placeholder="192.168.1.100" />
          </FormGroup>
        </>
      )}

      {activeProvider === 'vmware' && (
        <>
          <FormGroup label={`vSphere IP${editHint}`} isRequired={!isEdit} fieldId="cc-vs-ip">
            <TextInput id="cc-vs-ip" value={vsphereIp} onChange={(_e, v) => setVsphereIp(v)} placeholder="10.0.0.1" />
          </FormGroup>
          <FormGroup label={`vSphere Username${editHint}`} isRequired={!isEdit} fieldId="cc-vs-user">
            <TextInput id="cc-vs-user" value={vsphereUsername} onChange={(_e, v) => setVsphereUsername(v)} placeholder="admin@vsphere.local" />
          </FormGroup>
          <FormGroup label={`vSphere Password${editHint}`} isRequired={!isEdit} fieldId="cc-vs-pass">
            <TextInput id="cc-vs-pass" type="password" value={vspherePassword} onChange={(_e, v) => setVspherePassword(v)} placeholder={isEdit ? '••••••••' : ''} />
          </FormGroup>
        </>
      )}

      {activeProvider === 'ibmcloud' && (
        <>
          <FormGroup label={`URL${editHint}`} isRequired={!isEdit} fieldId="cc-ibm-url">
            <TextInput id="cc-ibm-url" value={ibmcUrl} onChange={(_e, v) => setIbmcUrl(v)} placeholder="https://us-south.iaas.cloud.ibm.com/v1" />
          </FormGroup>
          <FormGroup label={`API Key${editHint}`} isRequired={!isEdit} fieldId="cc-ibm-key">
            <TextInput id="cc-ibm-key" type="password" value={ibmcApikey} onChange={(_e, v) => setIbmcApikey(v)} placeholder={isEdit ? '••••••••' : ''} />
          </FormGroup>
        </>
      )}

      <ActionGroup>
        <Button variant="primary" onClick={handleSubmit} isDisabled={submitting}>
          {submitting ? <Spinner size="sm" /> : isEdit ? 'Update' : 'Create'}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>Cancel</Button>
      </ActionGroup>
    </Form>
  );
}

export function CloudCredentialsCard() {
  const { showSuccess, showError } = useNotifications();
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCred, setEditingCred] = useState<CloudCredential | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    try {
      const data = await cloudCredentialsApi.listCredentials();
      setCredentials(data);
    } catch {
      showError('Failed to load cloud credentials', 'Could not retrieve credentials from the server');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);

  const handleCreate = async (data: CreateCloudCredentialRequest | UpdateCloudCredentialRequest) => {
    if (!('name' in data) || !('provider' in data)) return;
    const createData = data as CreateCloudCredentialRequest;
    await cloudCredentialsApi.createCredential(createData);
    showSuccess('Credential created', `Cloud credential "${createData.name}" was created`);
    setShowCreateModal(false);
    fetchCredentials();
  };

  const handleUpdate = async (data: CreateCloudCredentialRequest | UpdateCloudCredentialRequest) => {
    if (!editingCred) return;
    await cloudCredentialsApi.updateCredential(editingCred.name, data);
    showSuccess('Credential updated', `Cloud credential "${editingCred.name}" was updated`);
    setEditingCred(null);
    fetchCredentials();
  };

  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const handleDelete = async (name: string) => {
    setDeletingInProgress(true);
    try {
      await cloudCredentialsApi.deleteCredential(name);
      showSuccess('Credential deleted', `Cloud credential "${name}" was deleted`);
      setDeletingName(null);
      fetchCredentials();
    } catch (err) {
      showError('Failed to delete credential', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingInProgress(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="lg" />
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardTitle>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>Cloud Credentials</FlexItem>
            <FlexItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setShowCreateModal(true)}>
                Add Credential
              </Button>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          {credentials.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon icon={KeyIcon} />
              <Title headingLevel="h2" size="lg">No Cloud Credentials</Title>
              <EmptyStateBody>
                Add cloud provider credentials to enable node, zone, and power outage scenarios.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <Table aria-label="Cloud credentials table" variant="compact">
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Provider</Th>
                  <Th>Description</Th>
                  <Th>Access</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {credentials.map((cred) => (
                  <Tr key={cred.name}>
                    <Td dataLabel="Name"><strong>{cred.name}</strong></Td>
                    <Td dataLabel="Provider">
                      <Label color="blue">{PROVIDER_LABELS[cred.provider] ?? cred.provider}</Label>
                    </Td>
                    <Td dataLabel="Description">{cred.description || '—'}</Td>
                    <Td dataLabel="Access">
                      {cred.availableToAll
                        ? 'All Users'
                        : cred.groups && cred.groups.length > 0
                          ? cred.groups.join(', ')
                          : 'No groups'}
                    </Td>
                    <Td dataLabel="Created">
                      {cred.createdAt ? new Date(cred.createdAt).toLocaleDateString() : '—'}
                    </Td>
                    <Td dataLabel="Actions">
                      <Button variant="secondary" size="sm" onClick={() => setEditingCred(cred)} style={{ marginRight: '0.5rem' }}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeletingName(cred.name)}>
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Cloud Credential"
        variant={ModalVariant.large}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      >
        <CloudCredentialForm onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)} />
      </Modal>

      {/* Edit Modal */}
      {editingCred && (
        <Modal
          title={`Edit Cloud Credential: ${editingCred.name}`}
          variant={ModalVariant.large}
          isOpen={!!editingCred}
          onClose={() => setEditingCred(null)}
        >
          <CloudCredentialForm
            initial={editingCred}
            existingProvider={editingCred.provider}
            onSubmit={handleUpdate}
            onCancel={() => setEditingCred(null)}
            isEdit
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingName && (
        <Modal
          title="Delete Cloud Credential"
          variant={ModalVariant.small}
          isOpen={!!deletingName}
          onClose={() => setDeletingName(null)}
          actions={[
            <Button key="delete" variant="danger" onClick={() => handleDelete(deletingName)} isDisabled={deletingInProgress}>{deletingInProgress ? <Spinner size="sm" /> : 'Delete'}</Button>,
            <Button key="cancel" variant="link" onClick={() => setDeletingName(null)}>Cancel</Button>,
          ]}
        >
          Are you sure you want to delete cloud credential <strong>{deletingName}</strong>? This action cannot be undone.
        </Modal>
      )}
    </>
  );
}
