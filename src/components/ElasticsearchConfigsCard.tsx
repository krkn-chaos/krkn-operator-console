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
  Form,
  ActionGroup,
  Alert,
  Checkbox,
  Radio,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { PlusCircleIcon, DatabaseIcon, EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';
import { elasticsearchApi } from '../services/elasticsearchApi';
import { useNotifications } from '../hooks';
import { groupsApi } from '../services/groupsApi';
import type {
  ElasticsearchConfig,
  CreateElasticsearchConfigRequest,
  UpdateElasticsearchConfigRequest,
  GroupDetails,
} from '../types/api';

interface ElasticsearchConfigFormProps {
  initial?: ElasticsearchConfig;
  onSubmit: (data: CreateElasticsearchConfigRequest | UpdateElasticsearchConfigRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

const configEntryCellStyle = { paddingTop: '1rem', paddingBottom: '1rem', verticalAlign: 'middle' as const };

function groupIdentifier(group: GroupDetails): string {
  return group.id ?? group.name.trim().replace(/[^a-zA-Z0-9\-_.]+/g, '-').replace(/^[-_.]+|[-_.]+$/g, '').toLowerCase();
}

export function ElasticsearchConfigForm({ initial, onSubmit, onCancel, isEdit = false }: ElasticsearchConfigFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(String(initial?.port ?? 9200));
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [telemetryIndex, setTelemetryIndex] = useState(initial?.telemetryIndex ?? '');
  const [metricsIndex, setMetricsIndex] = useState(initial?.metricsIndex ?? '');
  const [alertsIndex, setAlertsIndex] = useState(initial?.alertsIndex ?? '');
  // Admin-only TLS toggle. Initialized from the existing config so an edit
  // re-submits the current value explicitly (never silently flips it).
  const [insecureSkipTlsVerify, setInsecureSkipTlsVerify] = useState(initial?.insecureSkipTlsVerify ?? false);
  const [availableToAll, setAvailableToAll] = useState(initial ? initial.availableToAll ?? true : true);
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initial?.groups ?? []);
  const [isGroupSelectOpen, setIsGroupSelectOpen] = useState(false);
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setGroupsError(null);
    try {
      setGroups(await groupsApi.listGroups());
    } catch {
      setGroups([]);
      setGroupsError('Unable to load groups. Retry before assigning this config to a group.');
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleSubmit = async () => {
    if (!host.trim()) {
      setError('Host is required');
      return;
    }
    if (!isEdit && !name.trim()) {
      setError('Name is required');
      return;
    }
    if (!availableToAll && selectedGroups.length === 0) {
      setError(groupsError || 'Select a group or make this config public');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const portNum = parseInt(port, 10) || 9200;
      const requestFields = {
        host: host.trim(),
        port: portNum,
        username: username.trim() || undefined,
        password: password || undefined,
        telemetryIndex: telemetryIndex.trim() || undefined,
        metricsIndex: metricsIndex.trim() || undefined,
        alertsIndex: alertsIndex.trim() || undefined,
        insecureSkipTlsVerify,
        groups: availableToAll ? [] : selectedGroups,
        availableToAll,
      };

      await onSubmit(isEdit ? requestFields : { name: name.trim(), ...requestFields });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form>
      {error && (
        <Alert variant="danger" title={error} style={{ marginBottom: '1rem' }} />
      )}
      {groupsError && (
        <Alert
          variant="warning"
          isInline
          title="Group access options unavailable"
          style={{ marginBottom: '1rem' }}
          actionLinks={[
            <Button key="retry-groups" variant="link" onClick={loadGroups} isDisabled={submitting}>
              Retry
            </Button>,
          ]}
        />
      )}

      {!isEdit && (
        <FormGroup label="Name" isRequired fieldId="es-name">
          <TextInput
            id="es-name"
            value={name}
            onChange={(_e, v) => setName(v)}
            placeholder="production-es (lowercase alphanumeric and hyphens)"
            isRequired
          />
        </FormGroup>
      )}

      <FormGroup label="Host" isRequired fieldId="es-host">
        <TextInput
          id="es-host"
          value={host}
          onChange={(_e, v) => setHost(v)}
          placeholder="https://es.example.com"
          isRequired
        />
      </FormGroup>

      <FormGroup label="Port" fieldId="es-port">
        <TextInput
          id="es-port"
          type="number"
          value={port}
          onChange={(_e, v) => setPort(v)}
          placeholder="9200"
        />
      </FormGroup>

      <FormGroup label="Username" fieldId="es-username">
        <TextInput
          id="es-username"
          value={username}
          onChange={(_e, v) => setUsername(v)}
          placeholder="elastic"
        />
      </FormGroup>

      <FormGroup
        label={isEdit ? 'Password (leave blank to keep existing)' : 'Password'}
        fieldId="es-password"
      >
        <Flex alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem grow={{ default: 'grow' }}>
            <TextInput
              id="es-password"
              type={!isEdit && showPassword ? 'text' : 'password'}
              value={password}
              onChange={(_e, v) => setPassword(v)}
              placeholder={isEdit ? '••••••••' : ''}
            />
          </FlexItem>
          {!isEdit && (
            <FlexItem>
              <Button
                variant="plain"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </Button>
            </FlexItem>
          )}
        </Flex>
      </FormGroup>

      <FormGroup label="Telemetry Index" fieldId="es-telemetry-index">
        <TextInput
          id="es-telemetry-index"
          value={telemetryIndex}
          onChange={(_e, v) => setTelemetryIndex(v)}
          placeholder="krkn-telemetry"
        />
      </FormGroup>

      <FormGroup label="Metrics Index" fieldId="es-metrics-index">
        <TextInput
          id="es-metrics-index"
          value={metricsIndex}
          onChange={(_e, v) => setMetricsIndex(v)}
          placeholder="krkn-metrics"
        />
      </FormGroup>

      <FormGroup label="Alerts Index" fieldId="es-alerts-index">
        <TextInput
          id="es-alerts-index"
          value={alertsIndex}
          onChange={(_e, v) => setAlertsIndex(v)}
          placeholder="krkn-alerts"
        />
      </FormGroup>

      <FormGroup fieldId="es-insecure-skip-tls">
        <Checkbox
          id="es-insecure-skip-tls"
          label="Disable TLS certificate verification"
          description="Insecure. Only use for clusters with self-signed certificates you trust."
          isChecked={insecureSkipTlsVerify}
          onChange={(_e, checked) => setInsecureSkipTlsVerify(checked)}
        />
      </FormGroup>

      <FormGroup label="Access Control" isRequired fieldId="es-access-control">
          <Radio
            id="es-access-public"
            name="es-access-control"
            label="Public (available to all users)"
            isChecked={availableToAll}
            onChange={() => setAvailableToAll(true)}
          />
          <Radio
            id="es-access-group"
            name="es-access-control"
            label="Assign to group"
            isChecked={!availableToAll}
            onChange={() => setAvailableToAll(false)}
          />
          {!availableToAll && (
            <Select
              id="es-access-group-select"
              isOpen={isGroupSelectOpen}
              selected={selectedGroups}
              onOpenChange={(open) => {
                setIsGroupSelectOpen(open);
                if (open) {
                  loadGroups();
                }
              }}
              onSelect={(_event, value) => {
                const group = value as string;
                setSelectedGroups((current) => current.includes(group)
                  ? current.filter((selected) => selected !== group)
                  : [...current, group]);
              }}
              role="menu"
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setIsGroupSelectOpen((open) => !open)}
                  isExpanded={isGroupSelectOpen}
                  isDisabled={submitting}
                  style={{ width: '100%' }}
                >
                  {selectedGroups.length === 0
                    ? 'Select groups'
                    : `${selectedGroups.length} group${selectedGroups.length === 1 ? '' : 's'} selected`}
                </MenuToggle>
              )}
            >
              <SelectList>
              {groups.map((group) => (
                <SelectOption
                  key={groupIdentifier(group)}
                  value={groupIdentifier(group)}
                  hasCheckbox
                  isSelected={selectedGroups.includes(groupIdentifier(group))}
                >
                  {group.name}
                </SelectOption>
              ))}
              </SelectList>
            </Select>
          )}
      </FormGroup>

      <ActionGroup>
          <Button variant="primary" onClick={handleSubmit} isDisabled={submitting}>
            {submitting ? <Spinner size="sm" /> : isEdit ? 'Update' : 'Create'}
          </Button>
          <Button variant="link" onClick={onCancel} isDisabled={submitting}>
            Cancel
          </Button>
      </ActionGroup>
    </Form>
  );
}

/**
 * Displays saved Elasticsearch configurations and provides admin create, edit,
 * and delete actions. Configs are loaded from the operator API on mount.
 *
 * @example
 * ```tsx
 * <Settings>
 *   <ElasticsearchConfigsCard />
 * </Settings>
 * ```
 */
export function ElasticsearchConfigsCard() {
  const { showSuccess, showError } = useNotifications();
  const [configs, setConfigs] = useState<ElasticsearchConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ElasticsearchConfig | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [selectedAccessFilters, setSelectedAccessFilters] = useState<Set<string>>(new Set());
  const [isAccessFilterOpen, setIsAccessFilterOpen] = useState(false);
  const [groups, setGroups] = useState<GroupDetails[]>([]);

  const fetchConfigs = useCallback(async () => {
    try {
      const data = await elasticsearchApi.listConfigs();
      setConfigs(data);
    } catch {
      showError('Failed to load Elasticsearch configs', 'Could not retrieve configs from the server');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const loadGroups = useCallback(async () => {
    try {
      setGroups(await groupsApi.listGroups());
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleCreate = async (data: CreateElasticsearchConfigRequest | UpdateElasticsearchConfigRequest) => {
    await elasticsearchApi.createConfig(data as CreateElasticsearchConfigRequest);
    showSuccess('Config created', `Elasticsearch config "${(data as CreateElasticsearchConfigRequest).name}" was created`);
    setShowCreateModal(false);
    fetchConfigs();
  };

  const handleUpdate = async (data: CreateElasticsearchConfigRequest | UpdateElasticsearchConfigRequest) => {
    if (!editingConfig) return;
    await elasticsearchApi.updateConfig(editingConfig.name, data as UpdateElasticsearchConfigRequest);
    showSuccess('Config updated', `Elasticsearch config "${editingConfig.name}" was updated`);
    setEditingConfig(null);
    fetchConfigs();
  };

  const handleDelete = async (name: string) => {
    try {
      await elasticsearchApi.deleteConfig(name);
      showSuccess('Config deleted', `Elasticsearch config "${name}" was deleted`);
      setDeletingName(null);
      fetchConfigs();
    } catch (err) {
      showError('Failed to delete config', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const filteredConfigs = configs.filter((config) => {
    const matchesName = config.name.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesAccess = selectedAccessFilters.size === 0 || (config.availableToAll
      ? selectedAccessFilters.has('public')
      : config.groups?.some((group) => selectedAccessFilters.has(`group:${group}`)) ?? false);
    return matchesName && matchesAccess;
  });

  const toggleAccessFilter = (value: string) => {
    setSelectedAccessFilters((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardTitle>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>
              <Title headingLevel="h2" size="lg">Elasticsearch Configurations</Title>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setShowCreateModal(true)}>
                Add Config
              </Button>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          {configs.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon icon={DatabaseIcon} />
              <Title headingLevel="h3" size="lg">No Elasticsearch Configs</Title>
              <EmptyStateBody>
                Add an Elasticsearch configuration so users can load connection details when running scenarios.
              </EmptyStateBody>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                Add Config
              </Button>
            </EmptyState>
          ) : (
            <>
              <Flex
                alignItems={{ default: 'alignItemsFlexStart' }}
                style={{ marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}
              >
                <FlexItem style={{ width: '220px' }}>
                  <SearchInput
                    id="es-config-name-filter"
                    value={nameFilter}
                    onChange={(_event, value) => setNameFilter(value)}
                    placeholder="Filter by name"
                    aria-label="Filter Elasticsearch configs by name"
                    onClear={() => setNameFilter('')}
                  />
                </FlexItem>
                <FlexItem style={{ width: '220px' }}>
                  <Select
                    id="es-config-access-filter"
                    isOpen={isAccessFilterOpen}
                    selected={Array.from(selectedAccessFilters)}
                    onOpenChange={(open) => {
                      setIsAccessFilterOpen(open);
                      if (open) {
                        loadGroups();
                      }
                    }}
                    onSelect={(_event, value) => toggleAccessFilter(value as string)}
                    role="menu"
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsAccessFilterOpen((open) => !open)}
                        isExpanded={isAccessFilterOpen}
                        style={{ width: '220px' }}
                      >
                        {selectedAccessFilters.size === 0
                          ? 'Access control: All'
                          : `Access control: ${selectedAccessFilters.size} selected`}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      <SelectOption
                        value="public"
                        hasCheckbox
                        isSelected={selectedAccessFilters.has('public')}
                      >
                        Public
                      </SelectOption>
                      {groups.map((group) => (
                        <SelectOption
                          key={group.name}
                          value={`group:${group.name}`}
                          hasCheckbox
                          isSelected={selectedAccessFilters.has(`group:${group.name}`)}
                        >
                          {group.name}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                </FlexItem>
              </Flex>
              <Table variant="compact" borders>
                <Thead>
                  <Tr>
                    <Th style={{ fontWeight: 700, borderBottom: '2px solid var(--pf-v5-global--BorderColor--100)' }}>Name</Th>
                    <Th style={{ width: '25%', fontWeight: 700, borderBottom: '2px solid var(--pf-v5-global--BorderColor--100)' }}>Host</Th>
                    <Th style={{ fontWeight: 700, borderBottom: '2px solid var(--pf-v5-global--BorderColor--100)' }}>Port</Th>
                    <Th style={{ fontWeight: 700, borderBottom: '2px solid var(--pf-v5-global--BorderColor--100)' }}>Indices</Th>
                    <Th style={{ width: '20%', fontWeight: 700, borderBottom: '2px solid var(--pf-v5-global--BorderColor--100)' }}>Access Control</Th>
                    <Th style={{ fontWeight: 700, borderBottom: '2px solid var(--pf-v5-global--BorderColor--100)' }}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredConfigs.map((cfg) => (
                    <Tr
                      key={cfg.name}
                      style={{ borderBottom: '1px solid var(--pf-v5-global--BorderColor--100)' }}
                    >
                      <Td style={configEntryCellStyle}><strong>{cfg.name}</strong></Td>
                      <Td style={{ ...configEntryCellStyle, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cfg.host}
                      </Td>
                      <Td style={configEntryCellStyle}>{cfg.port}</Td>
                      <Td style={configEntryCellStyle}>
                        <div style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
                          {cfg.telemetryIndex && <div>telemetry: <code>{cfg.telemetryIndex}</code></div>}
                          {cfg.metricsIndex && <div>metrics: <code>{cfg.metricsIndex}</code></div>}
                          {cfg.alertsIndex && <div>alerts: <code>{cfg.alertsIndex}</code></div>}
                          {!cfg.telemetryIndex && !cfg.metricsIndex && !cfg.alertsIndex && (
                            <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>—</span>
                          )}
                        </div>
                      </Td>
                      <Td style={configEntryCellStyle}>
                        {cfg.availableToAll
                          ? 'Public'
                          : cfg.groups?.length
                            ? `Groups: ${cfg.groups.join(', ')}`
                            : 'Unassigned'}
                      </Td>
                      <Td style={configEntryCellStyle}>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Button variant="secondary" size="sm" onClick={() => setEditingConfig(cfg)}>
                              Edit
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button variant="danger" size="sm" onClick={() => setDeletingName(cfg.name)}>
                              Delete
                            </Button>
                          </FlexItem>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              {filteredConfigs.length === 0 && (
                <EmptyState>
                  <Title headingLevel="h3" size="md">No matching configurations</Title>
                </EmptyState>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Create Modal */}
      <Modal
        variant={ModalVariant.medium}
        title="Add Elasticsearch Config"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      >
        <ElasticsearchConfigForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={`Edit: ${editingConfig?.name}`}
        isOpen={!!editingConfig}
        onClose={() => setEditingConfig(null)}
      >
        {editingConfig && (
          <ElasticsearchConfigForm
            initial={editingConfig}
            onSubmit={handleUpdate}
            onCancel={() => setEditingConfig(null)}
            isEdit
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Elasticsearch Config"
        isOpen={!!deletingName}
        onClose={() => setDeletingName(null)}
        actions={[
          <Button key="confirm" variant="danger" onClick={() => deletingName && handleDelete(deletingName)}>
            Delete
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setDeletingName(null)}>
            Cancel
          </Button>,
        ]}
      >
        Are you sure you want to delete the config <strong>{deletingName}</strong>? This cannot be undone.
      </Modal>
    </>
  );
}
