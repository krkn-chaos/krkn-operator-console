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
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { PlusCircleIcon, DatabaseIcon } from '@patternfly/react-icons';
import { elasticsearchApi } from '../services/elasticsearchApi';
import { useNotifications } from '../hooks';
import type {
  ElasticsearchConfig,
  CreateElasticsearchConfigRequest,
  UpdateElasticsearchConfigRequest,
} from '../types/api';

interface ElasticsearchConfigFormProps {
  initial?: ElasticsearchConfig;
  onSubmit: (data: CreateElasticsearchConfigRequest | UpdateElasticsearchConfigRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

function ElasticsearchConfigForm({ initial, onSubmit, onCancel, isEdit = false }: ElasticsearchConfigFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(String(initial?.port ?? 9200));
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState('');
  const [telemetryIndex, setTelemetryIndex] = useState(initial?.telemetryIndex ?? '');
  const [metricsIndex, setMetricsIndex] = useState(initial?.metricsIndex ?? '');
  const [alertsIndex, setAlertsIndex] = useState(initial?.alertsIndex ?? '');
  const [grafanaUrl, setGrafanaUrl] = useState(initial?.grafanaUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!host.trim()) {
      setError('Host is required');
      return;
    }
    if (!isEdit && !name.trim()) {
      setError('Name is required');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const portNum = parseInt(port, 10) || 9200;
      if (isEdit) {
        const req: UpdateElasticsearchConfigRequest = {
          host: host.trim(),
          port: portNum,
          username: username.trim(),
          password: password || undefined,
          telemetryIndex: telemetryIndex.trim() || undefined,
          metricsIndex: metricsIndex.trim() || undefined,
          alertsIndex: alertsIndex.trim() || undefined,
          grafanaUrl: grafanaUrl.trim() || undefined,
        };
        await onSubmit(req);
      } else {
        const req: CreateElasticsearchConfigRequest = {
          name: name.trim(),
          host: host.trim(),
          port: portNum,
          username: username.trim() || undefined,
          password: password || undefined,
          telemetryIndex: telemetryIndex.trim() || undefined,
          metricsIndex: metricsIndex.trim() || undefined,
          alertsIndex: alertsIndex.trim() || undefined,
          grafanaUrl: grafanaUrl.trim() || undefined,
        };
        await onSubmit(req);
      }
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
        <TextInput
          id="es-password"
          type="password"
          value={password}
          onChange={(_e, v) => setPassword(v)}
          placeholder={isEdit ? '••••••••' : ''}
        />
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

      <FormGroup label="Grafana URL" fieldId="es-grafana-url">
        <TextInput
          id="es-grafana-url"
          value={grafanaUrl}
          onChange={(_e, v) => setGrafanaUrl(v)}
          placeholder="https://grafana.example.com/d/abc"
        />
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

export function ElasticsearchConfigsCard() {
  const { showSuccess, showError } = useNotifications();
  const [configs, setConfigs] = useState<ElasticsearchConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ElasticsearchConfig | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

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
            <Table variant="compact" borders>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Host</Th>
                  <Th>Port</Th>
                  <Th>Username</Th>
                  <Th>Indices</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {configs.map((cfg) => (
                  <Tr key={cfg.name}>
                    <Td><strong>{cfg.name}</strong></Td>
                    <Td>{cfg.host}</Td>
                    <Td>{cfg.port}</Td>
                    <Td>{cfg.username || <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>—</span>}</Td>
                    <Td>
                      <div style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
                        {cfg.telemetryIndex && <div>telemetry: <code>{cfg.telemetryIndex}</code></div>}
                        {cfg.metricsIndex && <div>metrics: <code>{cfg.metricsIndex}</code></div>}
                        {cfg.alertsIndex && <div>alerts: <code>{cfg.alertsIndex}</code></div>}
                        {!cfg.telemetryIndex && !cfg.metricsIndex && !cfg.alertsIndex && (
                          <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>—</span>
                        )}
                      </div>
                    </Td>
                    <Td>
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
