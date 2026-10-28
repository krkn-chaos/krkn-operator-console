import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from '@patternfly/react-core';
import {
  ChartLineIcon,
  ClipboardListIcon,
  CubesIcon,
  DnaIcon,
  FileCodeIcon,
  HeartbeatIcon,
  SlidersHIcon,
  TopologyIcon,
} from '@patternfly/react-icons';
import { operatorApi } from '../../services/operatorApi';
import { krknAiApi, KrknAIConfigValidationError } from '../../services/krknAiApi';
import type { KrknAIRunResource, KrknAIConfigValidationIssue } from '../../services/krknAiApi';
import { isApiError } from '../../utils/apiClient';
import type { SelectedCluster, TargetResponse } from '../../types/api';
import { FitnessFunctionEditor } from './FitnessFunctionEditor';
import { HealthChecksEditor } from './HealthChecksEditor';
import { NamespaceSelector } from './NamespaceSelector';
import { ClusterComponentsEditor } from './ClusterComponentsEditor';
import {
  createEditableConfigDraft,
  scenarioTypeOptions,
  updateConfigDocument,
  validateConfigDraft,
} from './configModel';
import type { ConfigValidationErrors, EditableConfigDraft, GeneticSettingsDraft } from './configModel';
import type { Document } from 'yaml';

type ConfigurationSectionId = 'scenarios' | 'components' | 'genetic' | 'fitness' | 'health' | 'run-settings' | 'preview';

interface ConfigurationSection {
  id: ConfigurationSectionId;
  label: string;
  summary: string;
  icon: ComponentType;
}

const configurationSections: ConfigurationSection[] = [
  { id: 'scenarios', label: 'Scenarios', summary: 'Select experiment families', icon: ClipboardListIcon },
  { id: 'components', label: 'Cluster components', summary: 'Set the mutation scope', icon: CubesIcon },
  { id: 'genetic', label: 'Genetic algorithm', summary: 'Tune the search strategy', icon: DnaIcon },
  { id: 'fitness', label: 'Fitness functions', summary: 'Define scoring signals', icon: ChartLineIcon },
  { id: 'health', label: 'Health checks', summary: 'Configure measured endpoints', icon: HeartbeatIcon },
  { id: 'run-settings', label: 'Run settings', summary: 'Set timing and score components', icon: SlidersHIcon },
  { id: 'preview', label: 'Review YAML', summary: 'Inspect the configuration', icon: FileCodeIcon },
];

interface SavedConfig {
  id: string;
  name: string;
  yaml: string;
  targetRequestId: string;
  targetClusters: Record<string, string[]>;
}

interface ClusterOption extends SelectedCluster {
  value: string;
}

interface CreateRunProps {
  existingNames: string[];
  targetRequestId: string;
  discoveredClusters: TargetResponse[];
  targetLoading: boolean;
  targetError: string | null;
  onRetryTargetDiscovery: () => void;
  onStart: (run: KrknAIRunResource) => void;
  onCancel: () => void;
}


interface ConfigNumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  min?: number;
  max?: number;
  step?: number | string;
  optional?: boolean;
  description?: string;
}

function ConfigNumberField({ id, label, value, onChange, error, min, max, step, optional = false, description }: ConfigNumberFieldProps) {
  const descriptionId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <FormGroup label={label} fieldId={id} isRequired={!optional}>
      <TextInput
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(_event, nextValue) => onChange(nextValue)}
        validated={error ? 'error' : 'default'}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : (description || optional ? descriptionId : undefined)}
      />
      {error && <p id={errorId} className="krkn-ai-field-error" role="alert">{error}</p>}
      {!error && description && <p id={descriptionId} className="krkn-ai-field-help">{description}</p>}
      {!error && optional && !description && <p id={descriptionId} className="krkn-ai-muted">Leave blank to save null and clear this optional value.</p>}
    </FormGroup>
  );
}

function errorFor(errors: ConfigValidationErrors, field: string): string | undefined {
  return errors[field];
}

function apiErrorMessage(error: unknown): string {
  if (isApiError(error)) return `HTTP ${error.status}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return 'The request failed. Try again.';
}

function parseNamespaceNames(stdout: string): string[] {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('Namespace listing returned invalid JSON.');
  }
  if (!payload || typeof payload !== 'object' || !('items' in payload) || !Array.isArray(payload.items)) {
    throw new Error('Namespace listing returned an invalid response.');
  }
  const names = (payload.items as unknown[]).flatMap((item) => {
    if (!item || typeof item !== 'object' || !('metadata' in item) || !item.metadata || typeof item.metadata !== 'object' || !('name' in item.metadata)) return [];
    const name = item.metadata.name;
    return typeof name === 'string' && name.trim() ? [name] : [];
  });
  return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function CreateRun({
  existingNames,
  targetRequestId,
  discoveredClusters,
  targetLoading,
  targetError,
  onRetryTargetDiscovery,
  onStart,
  onCancel,
}: CreateRunProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [runName, setRunName] = useState('');
  const [runNameTouched, setRunNameTouched] = useState(false);
  const [discoveryAttempted, setDiscoveryAttempted] = useState(false);
  const [selectedClusterValue, setSelectedClusterValue] = useState('');
  const [configSource, setConfigSource] = useState<'discovery' | 'previous'>('discovery');
  const [previousRuns, setPreviousRuns] = useState<KrknAIRunResource[]>([]);
  const [previousRunsLoading, setPreviousRunsLoading] = useState(false);
  const [previousRunsError, setPreviousRunsError] = useState('');
  const [previousRunsRetry, setPreviousRunsRetry] = useState(0);
  const [selectedPreviousRunUid, setSelectedPreviousRunUid] = useState('');
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([]);
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([]);
  const [namespaceLoading, setNamespaceLoading] = useState(false);
  const [namespaceError, setNamespaceError] = useState<string | null>(null);
  const [namespaceRetry, setNamespaceRetry] = useState(0);
  const [discoveryWarnings, setDiscoveryWarnings] = useState<string[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configLoadError, setConfigLoadError] = useState('');
  const [draft, setDraft] = useState<EditableConfigDraft | null>(null);
  const [configYaml, setConfigYaml] = useState('');
  const [yamlError, setYamlError] = useState('');
  const [configurationSection, setConfigurationSection] = useState<ConfigurationSectionId>('scenarios');
  const [createdConfig, setCreatedConfig] = useState<SavedConfig | null>(null);
  const [serverValidationErrors, setServerValidationErrors] = useState<KrknAIConfigValidationIssue[]>([]);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [dangerousConfirmed, setDangerousConfirmed] = useState(false);
  const documentRef = useRef<Document | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);


  useEffect(() => () => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const clusterOptions = useMemo<ClusterOption[]>(() => discoveredClusters.flatMap((cluster) => {
    if (!cluster.operatorSource) return [];
    return [{
      value: JSON.stringify([cluster.operatorSource, cluster.clusterName]),
      operatorName: cluster.operatorSource,
      clusterName: cluster.clusterName,
      clusterApiUrl: cluster.clusterAPIURL,
    }];
  }), [discoveredClusters]);
  const resolvedClusterValue = clusterOptions.some((cluster) => cluster.value === selectedClusterValue)
    ? selectedClusterValue
    : clusterOptions[0]?.value ?? '';
  const selectedCluster = clusterOptions.find((cluster) => cluster.value === resolvedClusterValue) ?? null;
  const namespaceClusterName = selectedCluster?.clusterName ?? '';
  const namespaceProviderName = selectedCluster?.operatorName ?? '';
  const matchingPreviousRuns = useMemo(() => previousRuns.filter((run) =>
    !!run.spec.configMapName
    && run.spec.targetClusters[namespaceProviderName]?.includes(namespaceClusterName)),
  [previousRuns, namespaceProviderName, namespaceClusterName]);
  const selectedPreviousRun = matchingPreviousRuns.find((run) => run.metadata.uid === selectedPreviousRunUid);

  useEffect(() => {
    if (configSource !== 'previous') return undefined;
    const controller = new AbortController();
    setPreviousRunsLoading(true);
    setPreviousRunsError('');
    void krknAiApi.listRuns({ signal: controller.signal }).then((runs) => {
      if (!controller.signal.aborted) setPreviousRuns(runs);
    }).catch((error) => {
      if (!controller.signal.aborted) setPreviousRunsError(apiErrorMessage(error));
    }).finally(() => {
      if (!controller.signal.aborted) setPreviousRunsLoading(false);
    });
    return () => controller.abort();
  }, [configSource, previousRunsRetry]);

  useEffect(() => {
    if (configSource !== 'discovery' || !targetRequestId || !namespaceClusterName || !namespaceProviderName) {
      setAvailableNamespaces([]);
      setSelectedNamespaces([]);
      setNamespaceError(null);
      setNamespaceLoading(false);
      return undefined;
    }

    let current = true;
    setAvailableNamespaces([]);
    setSelectedNamespaces([]);
    setNamespaceError(null);
    setNamespaceLoading(true);
    void operatorApi.executeTerminalCommand({
      cluster_id: namespaceClusterName,
      operator_name: namespaceProviderName,
      uuid: targetRequestId,
      command: 'kubectl get namespaces -o json',
    }).then(({ stdout, stderr, exitCode }) => {
      if (!current) return;
      if (exitCode !== 0) {
        throw new Error(stderr.trim() || `Namespace listing exited with code ${exitCode}.`);
      }
      setAvailableNamespaces(parseNamespaceNames(stdout));
    }).catch((error) => {
      if (current) setNamespaceError(error instanceof Error ? error.message : 'Unable to list namespaces.');
    }).finally(() => {
      if (current) setNamespaceLoading(false);
    });

    return () => { current = false; };
  }, [configSource, namespaceClusterName, namespaceProviderName, namespaceRetry, targetRequestId]);

  const trimmedName = runName.trim();
  const nameError = !trimmedName
    ? 'Run name is required.'
    : !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(trimmedName)
      ? 'Use a DNS label: 1–63 lowercase letters, numbers, or hyphens; start and end with a letter or number.'
      : existingNames.some((name) => name.toLowerCase() === trimmedName.toLowerCase())
        || previousRuns.some((run) => run.metadata.name.toLowerCase() === trimmedName.toLowerCase())
        ? 'A run with this name already exists.'
        : undefined;
  const visibleNameError = (runNameTouched || discoveryAttempted) ? nameError : undefined;
  const configErrors = draft ? validateConfigDraft(draft) : {};
  const sectionIndex = configurationSections.findIndex((section) => section.id === configurationSection);
  const previousSection = configurationSections[sectionIndex - 1];
  const nextSection = configurationSections[sectionIndex + 1];
  const targetMap = selectedCluster ? { [selectedCluster.operatorName]: [selectedCluster.clusterName] } : {};
  const namespacePattern = selectedNamespaces.map(escapeRegex).join(',');
  const noAuthorizedClusters = !!targetRequestId && !targetLoading && !targetError && discoveredClusters.length === 0;
  const canLoadConfig = !!selectedCluster && !!targetRequestId && !targetLoading && !targetError && !configLoading
    && (configSource === 'previous'
      ? !!selectedPreviousRun && !previousRunsLoading && !previousRunsError
      : selectedNamespaces.length > 0 && !namespaceLoading && !namespaceError);
  const canSaveConfig = !!draft && !!documentRef.current && !!selectedCluster && !nameError && !yamlError
    && !Object.keys(configErrors).length && !actionLoading && !configLoading
    && (!draft.scenarioFlags['service-disruption'] || dangerousConfirmed);
  const canStart = !!createdConfig && !actionLoading && createdConfig.targetRequestId === targetRequestId
    && selectedCluster !== null && createdConfig.targetClusters[selectedCluster.operatorName]?.[0] === selectedCluster.clusterName;
  const selectedGeneticDuration = draft?.genetic.duration.trim() ?? '';
  const runBudgetLabel = selectedGeneticDuration ? 'Duration limit' : 'Expected scenarios';
  const runBudget = selectedGeneticDuration
    ? `${Number(selectedGeneticDuration).toLocaleString()} seconds`
    : draft
      ? (Number(draft.genetic.generations) * Number(draft.genetic.populationSize)).toLocaleString()
      : 'Not available';
  const abortActiveRequest = () => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setActionLoading(false);
    setConfigLoading(false);
  };

  const updateDraft = (updates: Partial<EditableConfigDraft>) => {
    if (!draft || !documentRef.current) return;
    abortActiveRequest();
    const nextDraft = { ...draft, ...updates };
    setDraft(nextDraft);
    setConfigYaml(updateConfigDocument(documentRef.current, nextDraft));
    setCreatedConfig(null);
    setServerValidationErrors([]);
    setActionError('');
  };

  const updateGenetic = (field: keyof GeneticSettingsDraft, value: string) => {
    if (!draft) return;
    const genetic = { ...draft.genetic, [field]: value };
    if (field === 'duration' && value.trim()) genetic.generations = '';
    if (field === 'generations' && value.trim()) genetic.duration = '';
    updateDraft({ genetic });
  };

  const startRequest = () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    return controller;
  };

  const handleLoadConfiguration = async () => {
    setDiscoveryAttempted(true);
    if (!canLoadConfig || nameError || !selectedCluster) return;
    setConfigLoading(true);
    setConfigLoadError('');
    setActionError('');
    setCreatedConfig(null);
    const controller = startRequest();
    try {
      let yaml: string;
      let warnings: string[] = [];
      if (configSource === 'previous') {
        if (!selectedPreviousRun) return;
        const available = await operatorApi.getAvailableFiles('krkn-ai-config', { signal: controller.signal });
        if (controller.signal.aborted) return;
        const configFile = available.files.find((file) => file.fileName === selectedPreviousRun.spec.configMapName);
        if (!configFile) throw new Error('The saved configuration for this run is unavailable or you do not have permission to access it. Select another run or discover a new configuration.');
        const file = await operatorApi.getFile(configFile.fileId, { signal: controller.signal });
        if (controller.signal.aborted) return;
        yaml = file.content;
      } else {
        const response = await krknAiApi.discover({
          targetRequestId,
          targetClusters: targetMap,
          namespacePattern,
        }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        yaml = response.configYaml;
        warnings = response.warnings ?? [];
      }
      const editable = createEditableConfigDraft(yaml);
      editable.draft.genetic.compositionRate = '0';
      documentRef.current = editable.document;
      setDraft(editable.draft);
      setConfigYaml(updateConfigDocument(editable.document, editable.draft));
      setDiscoveryWarnings(warnings);
      setDangerousConfirmed(false);
      setServerValidationErrors([]);
      setYamlError('');
      setConfigurationSection('scenarios');
      setStep(2);
    } catch (error) {
      if (!controller.signal.aborted) setConfigLoadError(apiErrorMessage(error));
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      if (!controller.signal.aborted) setConfigLoading(false);
    }
  };

  const updateYaml = (yaml: string) => {
    abortActiveRequest();
    setConfigYaml(yaml);
    setCreatedConfig(null);
    setServerValidationErrors([]);
    setActionError('');
    try {
      const editable = createEditableConfigDraft(yaml);
      documentRef.current = editable.document;
      setDraft(editable.draft);
      setYamlError('');
    } catch (error) {
      documentRef.current = null;
      setYamlError(apiErrorMessage(error));
    }
  };

  const handleScenarioToggle = (scenarioId: (typeof scenarioTypeOptions)[number]['id'], enabled: boolean) => {
    if (!draft) return;
    if (scenarioId === 'service-disruption' && enabled) {
      const confirmed = window.confirm('Service disruption can delete entire namespaces. Confirm that you intend to authorize this cluster-critical scenario.');
      if (!confirmed) return;
      setDangerousConfirmed(true);
    }
    if (scenarioId === 'service-disruption' && !enabled) setDangerousConfirmed(false);
    updateDraft({ scenarioFlags: { ...draft.scenarioFlags, [scenarioId]: enabled } });
  };

  const handleCreateConfig = async () => {
    if (!canSaveConfig || !selectedCluster) return;
    const currentYaml = updateConfigDocument(documentRef.current!, draft!);
    setConfigYaml(currentYaml);
    setActionLoading(true);
    setActionError('');
    setServerValidationErrors([]);
    const controller = startRequest();
    try {
      await krknAiApi.validateConfig(currentYaml, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const configName = `ai-${trimmedName.slice(0, 47)}-${crypto.randomUUID().slice(0, 8)}`;
      const response = await krknAiApi.createConfig({
        name: configName,
        configYaml: currentYaml,
        targetRequestId,
        targetClusters: targetMap,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!response.configId) throw new Error('Config creation did not return a config ID.');
      setCreatedConfig({ id: response.configId, name: configName, yaml: currentYaml, targetRequestId, targetClusters: targetMap });
      setConfigurationSection('preview');
      setStep(3);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof KrknAIConfigValidationError) setServerValidationErrors(error.errors);
      else setActionError(apiErrorMessage(error));
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      if (!controller.signal.aborted) setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!canStart || !createdConfig) return;
    setActionLoading(true);
    setActionError('');
    const controller = startRequest();
    try {
      const run = await krknAiApi.createRun({
        name: trimmedName,
        configId: createdConfig.id,
        targetRequestId: createdConfig.targetRequestId,
        targetClusters: createdConfig.targetClusters,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!run?.metadata?.name || !run.metadata.uid) throw new Error('Run creation did not return a Kubernetes run identity.');
      onStart(run);
    } catch (error) {
      if (!controller.signal.aborted) setActionError(apiErrorMessage(error));
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      if (!controller.signal.aborted) setActionLoading(false);
    }
  };

  const resetConfiguration = () => {
    abortActiveRequest();
    documentRef.current = null;
    setDraft(null);
    setCreatedConfig(null);
    setConfigYaml('');
    setConfigLoadError('');
    setDiscoveryWarnings([]);
    setServerValidationErrors([]);
    setYamlError('');
    setActionError('');
    setStep(1);
  };

  const handleClusterChange = (value: string) => {
    resetConfiguration();
    setSelectedClusterValue(value);
    setSelectedPreviousRunUid('');
    setAvailableNamespaces([]);
    setSelectedNamespaces([]);
    setNamespaceError(null);
  };

  const handleNamespaceToggle = (namespace: string, enabled: boolean) => {
    setSelectedNamespaces((current) => {
      if (enabled) return current.includes(namespace) ? current : [...current, namespace];
      return current.filter((selected) => selected !== namespace);
    });
    setConfigLoadError('');
  };


  const cancel = () => {
    requestControllerRef.current?.abort();
    onCancel();
  };

  const configurationTitle = (section: ConfigurationSection) => {
    const Icon = section.icon;
    return (
      <div className="krkn-ai-config-wizard__title">
        <span className="krkn-ai-config-wizard__title-icon" aria-hidden="true"><Icon /></span>
        <div><span>{section.label}</span><small>{section.summary}</small></div>
      </div>
    );
  };

  return (
    <section className="krkn-ai-create" aria-labelledby="krkn-ai-create-title">
      <div className="krkn-ai-page-heading">
        <div><Title id="krkn-ai-create-title" headingLevel="h1">Create Krkn AI run</Title><p>Select an authorized cluster, then discover components or reuse a previous run&apos;s configuration.</p></div>
      </div>
      <ol className="krkn-ai-steps" aria-label="Run creation steps">
        <li aria-current={step === 1 ? 'step' : undefined} className={step === 1 ? 'is-current' : ''}>1. Select target</li>
        <li aria-current={step === 2 ? 'step' : undefined} className={step === 2 ? 'is-current' : ''}>2. Configure run</li>
        <li aria-current={step === 3 ? 'step' : undefined} className={step === 3 ? 'is-current' : ''}>3. Review and launch</li>
      </ol>

      {step === 1 && (
        <>
          <Card>
            <CardTitle>
              <div className="krkn-ai-config-wizard__title"><span className="krkn-ai-config-wizard__title-icon" aria-hidden="true"><TopologyIcon /></span><span>Run name and cluster</span></div>
            </CardTitle>
            <CardBody className="krkn-ai-target-fields">
              <FormGroup label="Run name" fieldId="krkn-ai-run-name" isRequired>
                <TextInput
                  id="krkn-ai-run-name"
                  value={runName}
                  onChange={(_event, value) => { abortActiveRequest(); setRunName(value); setCreatedConfig(null); }}
                  onBlur={() => setRunNameTouched(true)}
                  validated={visibleNameError ? 'error' : 'default'}
                  aria-invalid={!!visibleNameError}
                />
                {visibleNameError && <p className="krkn-ai-field-error" role="alert">{visibleNameError}</p>}
              </FormGroup>
              {targetLoading && <Alert variant="info" title="Loading available clusters" isInline>Cluster discovery runs automatically. Select a cluster when it completes.</Alert>}
              {targetError && <Alert variant="danger" title="Cluster discovery unavailable" isInline>{targetError}</Alert>}
              {noAuthorizedClusters && <Alert variant="warning" title="No clusters available" isInline>No authorized clusters are available for this account.</Alert>}
              {(targetError || noAuthorizedClusters) && <div className="krkn-ai-actions"><Button variant="link" onClick={onRetryTargetDiscovery}>Retry cluster discovery</Button></div>}
              <FormGroup label="Cluster" fieldId="krkn-ai-target" isRequired>
                <FormSelect
                  id="krkn-ai-target"
                  value={resolvedClusterValue}
                  onChange={(_event, value) => handleClusterChange(value)}
                  isDisabled={targetLoading || !clusterOptions.length}
                >
                  {clusterOptions.map((cluster) => (
                    <FormSelectOption
                      key={cluster.value}
                      value={cluster.value}
                      label={`${cluster.clusterName} (${cluster.operatorName})`}
                    />
                  ))}
                </FormSelect>
              </FormGroup>
              {selectedCluster && <p className="krkn-ai-muted">Selected cluster API: <code>{selectedCluster.clusterApiUrl}</code></p>}
            </CardBody>
          </Card>
          <Card>
            <CardTitle>Configuration source</CardTitle>
            <CardBody className="krkn-ai-target-fields">
              <FormGroup label="Configuration source" fieldId="krkn-ai-config-source">
                <FormSelect
                  id="krkn-ai-config-source"
                  value={configSource}
                  onChange={(_event, value) => {
                    resetConfiguration();
                    setSelectedPreviousRunUid('');
                    setConfigSource(value as 'discovery' | 'previous');
                  }}
                >
                  <FormSelectOption value="discovery" label="Discover a new configuration" />
                  <FormSelectOption value="previous" label="Use configuration from a previous run" />
                </FormSelect>
              </FormGroup>
              {configSource === 'previous' && <>
                <p className="krkn-ai-muted">Only runs on the selected cluster and provider are listed. Saved namespaces and components are reused without discovery; review and edit them before saving a new configuration.</p>
                {previousRunsLoading && <p role="status">Loading previous runs…</p>}
                {previousRunsError && <Alert variant="danger" title="Unable to load previous runs" isInline>{previousRunsError}<Button variant="link" onClick={() => setPreviousRunsRetry((current) => current + 1)}>Retry previous runs</Button></Alert>}
                {!previousRunsLoading && !previousRunsError && matchingPreviousRuns.length === 0 && <Alert variant="info" title="No previous runs with a saved configuration on this cluster" isInline>Select a different cluster or discover a new configuration.</Alert>}
                <FormGroup label="Previous run" fieldId="krkn-ai-previous-run" isRequired>
                  <FormSelect
                    id="krkn-ai-previous-run"
                    value={selectedPreviousRun?.metadata.uid ?? ''}
                    isDisabled={targetLoading || previousRunsLoading || !!previousRunsError || !matchingPreviousRuns.length}
                    onChange={(_event, value) => {
                      resetConfiguration();
                      setSelectedPreviousRunUid(value);
                    }}
                  >
                    <FormSelectOption value="" label="Select a previous run" isPlaceholder />
                    {matchingPreviousRuns.map((run) => <FormSelectOption key={run.metadata.uid} value={run.metadata.uid} label={`${run.metadata.name} (${run.status?.phase ?? 'Pending'})`} />)}
                  </FormSelect>
                </FormGroup>
              </>}
            </CardBody>
          </Card>
          {configSource === 'discovery' && <NamespaceSelector
            namespaces={availableNamespaces}
            selectedNamespaces={selectedNamespaces}
            loading={namespaceLoading}
            error={namespaceError}
            onToggle={handleNamespaceToggle}
            onSelectAll={() => setSelectedNamespaces(availableNamespaces)}
            onClear={() => setSelectedNamespaces([])}
            onRetry={() => setNamespaceRetry((current) => current + 1)}
          />}
          {configLoadError && <Alert variant="danger" title={configSource === 'previous' ? 'Previous run configuration unavailable' : 'Krkn AI discovery failed'} isInline>{configLoadError}</Alert>}
          <div className="krkn-ai-actions">
            <Button variant="secondary" onClick={cancel}>Cancel</Button>
            <Button variant="primary" isDisabled={!canLoadConfig} isLoading={configLoading} onClick={() => void handleLoadConfiguration()}>
              {configSource === 'previous'
                ? configLoading ? 'Loading configuration…' : 'Use selected configuration'
                : configLoading ? 'Discovering…' : 'Discover components'}
            </Button>
          </div>

        </>
      )}

      {step === 2 && selectedCluster && draft && (
        <div className="krkn-ai-config-wizard">
          <div className="krkn-ai-config-wizard__heading"><div><Title headingLevel="h2">Configure the exploration</Title><p>Each section edits the configuration YAML while retaining unrelated fields and comments.</p></div><span>Section {sectionIndex + 1} of {configurationSections.length}</span></div>
          {configSource === 'previous' && selectedPreviousRun && <Alert variant="info" title={`Configuration copied from ${selectedPreviousRun.metadata.name}`} isInline>Review the saved values and cluster components before continuing. Saving creates a new configuration; the previous run&apos;s configuration is not modified.</Alert>}
          <nav aria-label="Configuration sections"><ol className="krkn-ai-config-wizard__nav">{configurationSections.map((section, index) => {
            const Icon = section.icon;
            const isCurrent = section.id === configurationSection;
            return <li key={section.id} className={isCurrent ? 'is-current' : index < sectionIndex ? 'is-visited' : ''}><button type="button" aria-current={isCurrent ? 'step' : undefined} onClick={() => setConfigurationSection(section.id)}><span className="krkn-ai-config-wizard__nav-icon" aria-hidden="true"><Icon /></span><span><strong>{section.label}</strong><small>{section.summary}</small></span></button></li>;
          })}</ol></nav>

          {configurationSection === 'scenarios' && <Card><CardTitle>{configurationTitle(configurationSections[0])}</CardTitle><CardBody>
            <p className="krkn-ai-section-intro">Choose the scenarios Krkn-AI should consider when exploring your cluster and testing its resilience.</p>
            <fieldset className="krkn-ai-scenario-options"><legend>Available scenario types</legend>{scenarioTypeOptions.map((option) => <Checkbox key={option.id} id={`krkn-ai-scenario-${option.id}`} label={option.label} isChecked={draft.scenarioFlags[option.id]} onChange={(_event, checked) => handleScenarioToggle(option.id, checked)} />)}</fieldset>
            {draft.scenarioFlags['service-disruption'] && <Alert variant="danger" title="Cluster-critical scenario enabled" isInline>Service disruption may delete entire namespaces. It is enabled in YAML only after explicit confirmation. Confirmation: {dangerousConfirmed ? 'given' : 'required'}.</Alert>}
          </CardBody></Card>}

          {configurationSection === 'components' && <Card><CardTitle>{configurationTitle(configurationSections[1])}</CardTitle><CardBody>
            <p className="krkn-ai-section-intro">Choose the cluster components Krkn-AI should target for testing. Uncheck any component you want to exclude.</p>
            {discoveryWarnings.map((warning, index) => <Alert key={`${index}-${warning}`} variant="warning" title="Discovery warning" isInline>{warning}</Alert>)}
            <ClusterComponentsEditor components={draft.clusterComponents} onChange={(clusterComponents) => updateDraft({ clusterComponents })} />
          </CardBody></Card>}

          {configurationSection === 'genetic' && <Card><CardTitle>{configurationTitle(configurationSections[2])}</CardTitle><CardBody>
            <div className="krkn-ai-genetic-settings">
              <section className="krkn-ai-genetic-group" aria-labelledby="krkn-ai-genetic-budget">
                <h3 id="krkn-ai-genetic-budget">Search budget</h3>
                <div className="krkn-ai-config-fields">
                  <ConfigNumberField id="krkn-ai-generations" label="Generations" value={draft.genetic.generations} onChange={(value) => updateGenetic('generations', value)} error={errorFor(configErrors, 'generations')} min={1} step={1} optional={!!draft.genetic.duration.trim()} description="Number of evolution cycles to run. Set either generations or duration, not both. When unused, blank is saved as null." />
                  <ConfigNumberField id="krkn-ai-population" label="Population size" value={draft.genetic.populationSize} onChange={(value) => updateGenetic('populationSize', value)} error={errorFor(configErrors, 'populationSize')} min={2} step={1} description="Number of candidate scenarios evaluated in each generation (minimum 2)." />
                  <ConfigNumberField id="krkn-ai-genetic-duration" label="Duration (seconds)" value={draft.genetic.duration} onChange={(value) => updateGenetic('duration', value)} error={errorFor(configErrors, 'genetic.duration')} min={1} step={1} optional={!!draft.genetic.generations.trim()} description="Maximum run time. Set either duration or generations, not both. When unused, blank is saved as null." />
                </div>
              </section>

              <section className="krkn-ai-genetic-group" aria-labelledby="krkn-ai-genetic-variation">
                <h3 id="krkn-ai-genetic-variation">Variation rates</h3>
                <div className="krkn-ai-config-fields">
                  <ConfigNumberField id="krkn-ai-mutation-rate" label="Mutation rate" value={draft.genetic.mutationRate} onChange={(value) => updateGenetic('mutationRate', value)} error={errorFor(configErrors, 'genetic.mutationRate')} min={0} max={1} step="any" description="Chance that a scenario parameter changes during mutation (0–1)." />
                  <ConfigNumberField id="krkn-ai-scenario-mutation-rate" label="Scenario mutation rate" value={draft.genetic.scenarioMutationRate} onChange={(value) => updateGenetic('scenarioMutationRate', value)} error={errorFor(configErrors, 'genetic.scenarioMutationRate')} min={0} max={1} step="any" description="Chance mutation changes the scenario family while retaining its run properties (0–1)." />
                  <ConfigNumberField id="krkn-ai-crossover-rate" label="Crossover rate" value={draft.genetic.crossoverRate} onChange={(value) => updateGenetic('crossoverRate', value)} error={errorFor(configErrors, 'genetic.crossoverRate')} min={0} max={1} step="any" description="Chance of combining parameter values from two parent scenarios (0–1)." />
                  <ConfigNumberField id="krkn-ai-composition-rate" label="Composition rate" value={draft.genetic.compositionRate} onChange={(value) => updateGenetic('compositionRate', value)} error={errorFor(configErrors, 'genetic.compositionRate')} min={0} max={1} step="any" description="Chance crossover combines experiments (0–1)." />
                </div>
              </section>

              <section className="krkn-ai-genetic-group" aria-labelledby="krkn-ai-genetic-selection">
                <h3 id="krkn-ai-genetic-selection">Parent selection</h3>
                <div className="krkn-ai-config-fields">
                  <FormGroup label="Selection strategy" fieldId="krkn-ai-selection-strategy" isRequired>
                    <FormSelect id="krkn-ai-selection-strategy" value={draft.genetic.selectionStrategy} onChange={(_event, value) => updateGenetic('selectionStrategy', value)} validated={configErrors['genetic.selectionStrategy'] ? 'error' : 'default'} aria-invalid={!!configErrors['genetic.selectionStrategy']} aria-describedby="krkn-ai-selection-strategy-help"><FormSelectOption value="roulette" label="roulette" /><FormSelectOption value="tournament" label="tournament" /></FormSelect>
                    <p id="krkn-ai-selection-strategy-help" className="krkn-ai-field-help">Roulette gives higher-fitness candidates a greater chance; tournament picks the best candidate from a random subset.</p>
                    {configErrors['genetic.selectionStrategy'] && <p className="krkn-ai-field-error" role="alert">{configErrors['genetic.selectionStrategy']}</p>}
                  </FormGroup>
                  {draft.genetic.selectionStrategy === 'tournament' && <ConfigNumberField id="krkn-ai-tournament-size" label="Tournament size" value={draft.genetic.tournamentSize} onChange={(value) => updateGenetic('tournamentSize', value)} error={errorFor(configErrors, 'genetic.tournamentSize')} min={1} step={1} description="Number of candidates compared in each tournament; larger values increase selection pressure." />}
                </div>
              </section>
            </div>
          </CardBody></Card>}
          {configurationSection === 'fitness' && <Card><CardTitle>{configurationTitle(configurationSections[3])}</CardTitle><CardBody>
            {discoveryWarnings.filter((warning) => /prometheus|fitness/i.test(warning)).map((warning, index) => <Alert key={`${index}-${warning}`} variant="warning" title="Fitness recommendation unavailable" isInline>{warning}</Alert>)}
            <FitnessFunctionEditor draft={draft} errors={configErrors} onChange={updateDraft} />
            {!draft.fitnessItems.length && <Alert variant="warning" title="Prometheus input required" isInline>Add at least one fitness item before saving.</Alert>}
          </CardBody></Card>}
          {configurationSection === 'health' && <Card><CardTitle>{configurationTitle(configurationSections[4])}</CardTitle><CardBody>
            <HealthChecksEditor draft={draft} errors={configErrors} onChange={updateDraft} />
          </CardBody></Card>}

          {configurationSection === 'run-settings' && <Card><CardTitle>{configurationTitle(configurationSections[5])}</CardTitle><CardBody>
            <div className="krkn-ai-config-fields">
              <ConfigNumberField id="krkn-ai-seed" label="Seed" value={draft.seed} onChange={(value) => updateDraft({ seed: value })} error={errorFor(configErrors, 'seed')} step={1} optional />
              <ConfigNumberField id="krkn-ai-wait-duration" label="Wait duration (seconds)" value={draft.waitDuration} onChange={(value) => updateDraft({ waitDuration: value })} error={errorFor(configErrors, 'waitDuration')} min={0} step={1} />
            </div>
            <section className="krkn-ai-config-subsection" aria-labelledby="krkn-ai-baseline-heading"><h3 id="krkn-ai-baseline-heading">Baseline</h3>
              <Checkbox id="krkn-ai-baseline-enabled" label="Enable baseline run" isChecked={draft.baselineEnabled} onChange={(_event, checked) => updateDraft({ baselineEnabled: checked })} />
              <ConfigNumberField id="krkn-ai-baseline-duration" label="Duration (seconds)" value={draft.baselineDuration} onChange={(value) => updateDraft({ baselineDuration: value })} error={errorFor(configErrors, 'baselineDuration')} min={1} step={1} />
            </section>
            <section className="krkn-ai-config-subsection">
              <fieldset className="krkn-ai-fitness-includes">
                <legend>Include score components</legend>
                <Checkbox id="krkn-ai-include-krkn-failure" label="Krkn failure" isChecked={draft.includeKrknFailure} onChange={(_event, checked) => updateDraft({ includeKrknFailure: checked })} />
                <Checkbox id="krkn-ai-include-health-check-failure" label="Health-check failure" isChecked={draft.includeHealthCheckFailure} onChange={(_event, checked) => updateDraft({ includeHealthCheckFailure: checked })} />
                <Checkbox id="krkn-ai-include-health-check-response-time" label="Health-check response time" isChecked={draft.includeHealthCheckResponseTime} onChange={(_event, checked) => updateDraft({ includeHealthCheckResponseTime: checked })} />
              </fieldset>
            </section>
          </CardBody></Card>}

          {configurationSection === 'preview' && <Card><CardTitle>{configurationTitle(configurationSections[6])}</CardTitle><CardBody>
            <Alert variant="info" title="Validate the discovered configuration" isInline>Review or edit the YAML before server-side schema validation and config creation. Any edit invalidates a previously saved config identity.</Alert>
            <textarea className="krkn-ai-yaml" aria-label="Krkn AI configuration YAML" value={configYaml} onChange={(event) => updateYaml(event.currentTarget.value)} rows={32} />
            {yamlError && <p className="krkn-ai-field-error" role="alert">{yamlError}</p>}
            {Object.keys(configErrors).length > 0 && <div role="status">{Object.entries(configErrors).map(([field, message]) => <p key={field} className="krkn-ai-field-error">{field}: {message}</p>)}</div>}
            {serverValidationErrors.map((issue, index) => <p key={`${index}-${issue.path}`} className="krkn-ai-field-error" role="alert">{issue.path}: {issue.message}</p>)}
            {actionError && <Alert variant="danger" title="Configuration save failed" isInline>{actionError}</Alert>}
          </CardBody></Card>}

          <div className="krkn-ai-actions krkn-ai-actions-between">
            <div className="krkn-ai-action-group">
              <Button variant="secondary" onClick={() => previousSection ? setConfigurationSection(previousSection.id) : setStep(1)}>{previousSection ? 'Previous section' : 'Back to target'}</Button>
              <Button variant="secondary" onClick={cancel}>Cancel</Button>
            </div>
            {nextSection ? <Button variant="primary" onClick={() => setConfigurationSection(nextSection.id)}>Continue</Button> : <Button variant="primary" isDisabled={!canSaveConfig} isLoading={actionLoading} onClick={() => void handleCreateConfig()}>{actionLoading ? 'Validating and saving…' : 'Validate and save config'}</Button>}
          </div>
        </div>
      )}

      {step === 3 && selectedCluster && createdConfig && <>
        <Card><CardTitle>Review saved configuration</CardTitle><CardBody>
          <dl className="krkn-ai-review-grid">
            <div><dt>Run</dt><dd>{trimmedName}</dd></div>
            <div><dt>Provider</dt><dd>{selectedCluster.operatorName}</dd></div>
            <div><dt>Cluster</dt><dd>{selectedCluster.clusterName}</dd></div>
            <div><dt>Config ID</dt><dd>{createdConfig.id}</dd></div>
            <div><dt>{runBudgetLabel}</dt><dd>{runBudget}</dd></div>
            <div><dt>Fitness items</dt><dd>{draft?.fitnessItems.length}</dd></div>
            <div><dt>Health checks</dt><dd>{draft?.healthChecks.length}</dd></div>
          </dl>
          <p className="krkn-ai-muted">Config identity is frozen as <code>{createdConfig.name}</code>. Editing YAML or settings requires validating and saving a new config.</p>
          <pre className="krkn-ai-yaml" aria-label="Saved Krkn AI configuration YAML">{createdConfig.yaml}</pre>
          {actionError && <Alert variant="danger" title="Run creation failed" isInline>{actionError}</Alert>}
        </CardBody></Card>
        <div className="krkn-ai-actions krkn-ai-actions-between">
          <div className="krkn-ai-action-group">
            <Button variant="secondary" onClick={() => setStep(2)}>Back to configuration</Button>
            <Button variant="secondary" onClick={cancel}>Cancel</Button>
          </div>
          <Button variant="primary" isDisabled={!canStart} isLoading={actionLoading} onClick={() => void handleStart()}>{actionLoading ? 'Starting run…' : 'Start run'}</Button>
        </div>
      </>}
    </section>
  );
}
