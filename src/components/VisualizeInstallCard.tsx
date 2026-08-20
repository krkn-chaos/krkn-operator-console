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
  FormSelect,
  FormSelectOption,
  Switch,
  TextArea,
  Badge,
  Label,
  CodeBlock,
  CodeBlockCode,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { PlusCircleIcon, ChartLineIcon, ExternalLinkAltIcon, CheckCircleIcon, ExclamationCircleIcon, InProgressIcon, ListIcon } from '@patternfly/react-icons';
import { visualizeApi } from '../services/visualizeApi';
import { elasticsearchApi } from '../services/elasticsearchApi';
import { targetsApi } from '../services/targetsApi';
import { useNotifications } from '../hooks';
import type {
  VisualizeConfig,
  CreateVisualizeRequest,
  ElasticsearchConfig,
  TargetResponse,
} from '../types/api';

interface VisualizeInstallFormProps {
  onSubmit: (data: CreateVisualizeRequest) => Promise<void>;
  onCancel: () => void;
  elasticsearchConfigs: ElasticsearchConfig[];
  targets: TargetResponse[];
}

/**
 * Form component for installing krkn-visualize (Grafana) on target clusters.
 * Allows selection of existing Elasticsearch configs and target clusters.
 */
function VisualizeInstallForm({ onSubmit, onCancel, elasticsearchConfigs, targets }: VisualizeInstallFormProps) {
  const [name, setName] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [namespace, setNamespace] = useState('krkn-visualize');
  const [esConfigName, setEsConfigName] = useState('');
  const [grafanaPassword, setGrafanaPassword] = useState('');
  const [autoDetectPrometheus, setAutoDetectPrometheus] = useState(true);
  const [prometheusUrl, setPrometheusUrl] = useState('');
  const [prometheusBearerToken, setPrometheusBearerToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (selectedTargets.length === 0) {
      setError('At least one target cluster is required');
      return;
    }
    if (!grafanaPassword) {
      setError('Grafana admin password is required');
      return;
    }
    if (!autoDetectPrometheus && !prometheusUrl.trim()) {
      setError('Prometheus URL is required when auto-detect is disabled');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const req: CreateVisualizeRequest = {
        name: name.trim(),
        targetClusters: selectedTargets,
        namespace: namespace.trim() || 'krkn-visualize',
        elasticsearchConfigName: esConfigName || undefined,
        grafanaPassword,
        autoDetectPrometheus,
        prometheusUrl: !autoDetectPrometheus ? prometheusUrl.trim() : undefined,
        prometheusBearerToken: !autoDetectPrometheus ? prometheusBearerToken.trim() : undefined,
      };
      await onSubmit(req);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter out targets that already have krkn-visualize installed (if needed)
  // TODO: Remove this comment after debugging - showing all targets for now
  const availableTargets = targets; // targets.filter((t) => t.ready);

  console.log('VisualizeInstallForm render:', {
    targets,
    availableTargets,
    targetsLength: targets.length,
    availableTargetsLength: availableTargets.length,
  });

  return (
    <Form>
      {error && (
        <Alert variant="danger" title={error} style={{ marginBottom: '1rem' }} />
      )}

      <FormGroup label="Instance Name" isRequired fieldId="visualize-name">
        <TextInput
          id="visualize-name"
          value={name}
          onChange={(_e, v) => setName(v)}
          placeholder="my-krkn-visualize"
          isRequired
        />
      </FormGroup>

      <FormGroup label="Target Clusters" isRequired fieldId="visualize-targets">
        <FormSelect
          id="visualize-targets"
          value={selectedTargets[0] || ''}
          onChange={(_e, value) => setSelectedTargets([value as string])}
          isRequired
        >
          <FormSelectOption key="placeholder" value="" label="Select a target cluster" isDisabled />
          {availableTargets.map((target) => (
            <FormSelectOption
              key={target.uuid}
              value={target.clusterName}
              label={`${target.clusterName} (${target.clusterAPIURL})`}
            />
          ))}
        </FormSelect>
        {availableTargets.length === 0 && (
          <Alert variant="warning" title="No target clusters" isInline style={{ marginTop: '0.5rem' }}>
            No target clusters found. Please add a target cluster in the{' '}
            <strong>Settings → Cluster Targets</strong> tab first, then return here to install krkn-visualize.
          </Alert>
        )}
        {availableTargets.length > 0 && targets.some(t => !t.ready) && (
          <Alert variant="info" title="Target validation in progress" isInline style={{ marginTop: '0.5rem' }}>
            Some targets are still being validated. If a target isn't ready yet, wait a few moments and refresh the page.
          </Alert>
        )}
      </FormGroup>

      <FormGroup label="Namespace" fieldId="visualize-namespace">
        <TextInput
          id="visualize-namespace"
          value={namespace}
          onChange={(_e, v) => setNamespace(v)}
          placeholder="krkn-visualize"
        />
      </FormGroup>

      <FormGroup
        label="Elasticsearch Configuration"
        fieldId="visualize-es-config"
        labelIcon={
          <Label color="blue" isCompact>Optional</Label>
        }
      >
        <FormSelect
          id="visualize-es-config"
          value={esConfigName}
          onChange={(_e, value) => setEsConfigName(value as string)}
        >
          <FormSelectOption key="none" value="" label="None (configure manually later)" />
          {elasticsearchConfigs.map((config) => (
            <FormSelectOption
              key={config.name}
              value={config.name}
              label={`${config.name} (${config.host}:${config.port})`}
            />
          ))}
        </FormSelect>
        {elasticsearchConfigs.length === 0 && (
          <div style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.5rem' }}>
            No Elasticsearch configs found. You can add one in <strong>Settings → Elasticsearch</strong> to pre-configure
            Grafana data sources, or skip this and configure manually later.
          </div>
        )}
      </FormGroup>

      <FormGroup label="Grafana Admin Password" isRequired fieldId="visualize-grafana-password">
        <TextInput
          id="visualize-grafana-password"
          type="password"
          value={grafanaPassword}
          onChange={(_e, v) => setGrafanaPassword(v)}
          placeholder="Enter a secure password"
          isRequired
        />
      </FormGroup>

      <FormGroup label="Prometheus Configuration" fieldId="visualize-prometheus">
        <Switch
          id="auto-detect-prometheus"
          label="Auto-detect Prometheus (OpenShift)"
          labelOff="Manual Prometheus configuration"
          isChecked={autoDetectPrometheus}
          onChange={(_e, checked) => setAutoDetectPrometheus(checked)}
        />
        {!autoDetectPrometheus && (
          <div style={{ marginTop: '1rem' }}>
            <FormGroup label="Prometheus URL" isRequired fieldId="prometheus-url">
              <TextInput
                id="prometheus-url"
                value={prometheusUrl}
                onChange={(_e, v) => setPrometheusUrl(v)}
                placeholder="https://prometheus-k8s.openshift-monitoring.svc:9091"
                isRequired
              />
            </FormGroup>
            <FormGroup label="Prometheus Bearer Token" fieldId="prometheus-token">
              <TextArea
                id="prometheus-token"
                value={prometheusBearerToken}
                onChange={(_e, v) => setPrometheusBearerToken(v)}
                placeholder="eyJhbGciOiJSUzI1NiIs..."
                rows={3}
              />
            </FormGroup>
          </div>
        )}
      </FormGroup>

      <ActionGroup>
        <Button variant="primary" onClick={handleSubmit} isDisabled={submitting}>
          {submitting ? <Spinner size="sm" /> : 'Install krkn-visualize'}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
}

/**
 * Status badge component for visualize instances
 */
function StatusBadge({ status }: { status?: VisualizeConfig['status'] }) {
  const statusConfig = {
    Pending: { color: 'blue' as const, icon: InProgressIcon },
    Installing: { color: 'cyan' as const, icon: InProgressIcon },
    Ready: { color: 'green' as const, icon: CheckCircleIcon },
    Failed: { color: 'red' as const, icon: ExclamationCircleIcon },
    Deleting: { color: 'orange' as const, icon: InProgressIcon },
  };

  const config = statusConfig[status || 'Pending'];
  const Icon = config.icon;

  return (
    <Badge color={config.color}>
      <Icon style={{ marginRight: '0.25rem' }} />
      {status || 'Pending'}
    </Badge>
  );
}

/**
 * Main card component for managing krkn-visualize installations.
 * Displays installed instances and provides installation form.
 */
export function VisualizeInstallCard() {
  const { showSuccess, showError } = useNotifications();
  const [instances, setInstances] = useState<VisualizeConfig[]>([]);
  const [esConfigs, setEsConfigs] = useState<ElasticsearchConfig[]>([]);
  const [targets, setTargets] = useState<TargetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [logsModalInstance, setLogsModalInstance] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [instancesData, esConfigsData, targetsData] = await Promise.all([
        visualizeApi.listInstances().catch(err => {
          console.error('Visualize API error:', err);
          // If visualize endpoint fails, continue with empty array
          return [];
        }),
        elasticsearchApi.listConfigs(),
        targetsApi.listTargets(),
      ]);

      console.log('Fetched data:', {
        instances: instancesData,
        esConfigs: esConfigsData,
        targetsResponse: targetsData,
      });

      setInstances(instancesData);
      setEsConfigs(esConfigsData);
      setTargets(targetsData || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      showError('Failed to load data', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh when instances are in transitional states
  useEffect(() => {
    const hasTransitioning = instances.some(
      (inst) => inst.status === 'Installing' || inst.status === 'Pending' || inst.status === 'Deleting'
    );

    if (!hasTransitioning) {
      return; // No polling needed if no instances are transitioning
    }

    // Poll every 5 seconds
    const intervalId = setInterval(() => {
      console.log('Auto-refreshing visualize instances...');
      fetchData();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [instances, fetchData]);

  const handleInstall = async (data: CreateVisualizeRequest) => {
    await visualizeApi.createInstance(data);
    showSuccess(
      'Installation started',
      `krkn-visualize "${data.name}" is being installed on ${data.targetClusters.join(', ')}`
    );
    setShowInstallModal(false);
    fetchData();
  };

  const handleDelete = async (name: string) => {
    try {
      await visualizeApi.deleteInstance(name);
      showSuccess('Instance deleted', `krkn-visualize "${name}" was deleted`);
      setDeletingName(null);
      fetchData();
    } catch (err) {
      showError('Failed to delete instance', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleOpenInstallModal = () => {
    // Refresh data before opening modal to get latest targets and ES configs
    fetchData();
    setShowInstallModal(true);
  };

  const handleViewLogs = async (name: string) => {
    setLogsModalInstance(name);
    setLoadingLogs(true);
    setLogs('');
    try {
      const response = await visualizeApi.getLogs(name);
      setLogs(response.logs || 'No logs available');
    } catch (err) {
      setLogs(`Failed to load logs: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingLogs(false);
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
              <Title headingLevel="h2" size="lg">krkn-visualize (Grafana Dashboards)</Title>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleOpenInstallModal}>
                Install krkn-visualize
              </Button>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          {instances.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon icon={ChartLineIcon} />
              <Title headingLevel="h3" size="lg">No krkn-visualize Instances</Title>
              <EmptyStateBody>
                Install krkn-visualize to deploy Grafana dashboards for visualizing chaos experiment results and cluster metrics.
              </EmptyStateBody>
              <Button variant="primary" onClick={handleOpenInstallModal}>
                Install krkn-visualize
              </Button>
            </EmptyState>
          ) : (
            <Table variant="compact" borders>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Target Cluster</Th>
                  <Th>Namespace</Th>
                  <Th>Status</Th>
                  <Th>Grafana URL</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {instances.map((instance) => (
                  <Tr key={instance.name}>
                    <Td><strong>{instance.name}</strong></Td>
                    <Td>{instance.targetCluster}</Td>
                    <Td>{instance.namespace}</Td>
                    <Td>
                      <StatusBadge status={instance.status} />
                      {instance.status === 'Failed' && instance.errorMessage && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--pf-v5-global--danger-color--100)', marginTop: '0.25rem' }}>
                          {instance.errorMessage}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {instance.grafanaUrl ? (
                        <a href={instance.grafanaUrl} target="_blank" rel="noopener noreferrer">
                          Open Dashboard <ExternalLinkAltIcon style={{ marginLeft: '0.25rem' }} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>—</span>
                      )}
                    </Td>
                    <Td>
                      <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                        <FlexItem>
                          <Button variant="secondary" size="sm" icon={<ListIcon />} onClick={() => handleViewLogs(instance.name)}>
                            View Logs
                          </Button>
                        </FlexItem>
                        <FlexItem>
                          <Button variant="danger" size="sm" onClick={() => setDeletingName(instance.name)}>
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

      {/* Install Modal */}
      <Modal
        variant={ModalVariant.medium}
        title="Install krkn-visualize"
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      >
        <VisualizeInstallForm
          onSubmit={handleInstall}
          onCancel={() => setShowInstallModal(false)}
          elasticsearchConfigs={esConfigs}
          targets={targets}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete krkn-visualize Instance"
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
        Are you sure you want to delete <strong>{deletingName}</strong>? This will remove the Grafana deployment from the target cluster.
      </Modal>

      {/* Logs Modal */}
      <Modal
        variant={ModalVariant.large}
        title={`Installation Logs: ${logsModalInstance}`}
        isOpen={!!logsModalInstance}
        onClose={() => setLogsModalInstance(null)}
        actions={[
          <Button key="refresh" variant="secondary" onClick={() => logsModalInstance && handleViewLogs(logsModalInstance)} isDisabled={loadingLogs}>
            Refresh
          </Button>,
          <Button key="close" variant="link" onClick={() => setLogsModalInstance(null)}>
            Close
          </Button>,
        ]}
      >
        {loadingLogs ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '1rem' }}>Loading logs...</div>
          </div>
        ) : (
          <CodeBlock>
            <CodeBlockCode>
              {logs || 'No logs available'}
            </CodeBlockCode>
          </CodeBlock>
        )}
      </Modal>
    </>
  );
}
