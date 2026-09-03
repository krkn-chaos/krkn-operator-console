import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Title,
  Button,
  Alert,
  Spinner,
  Modal,
  ModalVariant,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useAppContext } from '../context/AppContext';
import { DynamicFormBuilder } from './DynamicFormBuilder';
import { ClusterConflictWarning } from './ClusterConflictWarning';
import { FileSelector } from './FileSelector';
import { ScenarioParameterSections } from './ScenarioParameterSections';
import { operatorApi } from '../services/operatorApi';
import { elasticsearchApi } from '../services/elasticsearchApi';
import { isApiError } from '../utils/apiClient';

import type { ScenarioFormValues, ScenariosRequest, TouchedFields, ScenarioRunRequest, ScenarioFileMount, ScenarioRunState, StringField, ElasticsearchConfig } from '../types/api';

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bytes = new Uint8Array(reader.result as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        resolve(btoa(binary));
      } catch (error) {
        reject(new Error(`Failed to encode file ${file.name}: ${error instanceof Error ? error.message : 'Invalid character encoding'}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsArrayBuffer(file);
  });

interface ScenarioDetailProps {
  scenarioName: string;
  registryConfig: ScenariosRequest | null;
}

export function ScenarioDetail({ scenarioName, registryConfig }: ScenarioDetailProps) {
  const { state, dispatch } = useAppContext();
  const { scenarioDetail, scenarioFormValues, scenarioGlobals, globalFormValues, globalTouchedFields, startInPreview, rerunScenarioImage, rerunKubeconfigPath } = state;
  const [showPreview, setShowPreview] = useState(startInPreview);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showGlobalParameters, setShowGlobalParameters] = useState(false);
  const [loadingGlobals, setLoadingGlobals] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<{
    clusterName: string;
    existingRuns: string[];
  } | null>(null);
  const [pendingRunRequest, setPendingRunRequest] = useState<ScenarioRunRequest | null>(null);
  const [fileReferences, setFileReferences] = useState<import('../types/api').FileReference[]>([]);
  const [availableFiles, setAvailableFiles] = useState<import('../types/api').FileInfo[]>([]);
  const [hasPendingFileInput, setHasPendingFileInput] = useState(false);
  const [isPendingFileModalOpen, setIsPendingFileModalOpen] = useState(false);
  const [customRunName, setCustomRunName] = useState('');

  // Load available files for file reference mapping
  useEffect(() => {
    async function loadFiles() {
      try {
        const response = await operatorApi.getAvailableFiles();
        setAvailableFiles(response.files || []);
      } catch (err) {
        // Silently fail - file references will show fileId instead of fileName
        console.error('[ScenarioDetail] Failed to load available files:', err);
      }
    }
    loadFiles();
  }, []);

  const [esConfigs, setEsConfigs] = useState<ElasticsearchConfig[]>([]);
  const [selectedEsConfigName, setSelectedEsConfigName] = useState('');
  const [appliedEsConfigName, setAppliedEsConfigName] = useState('');

  useEffect(() => {
    const fetchScenarioDetail = async () => {
      dispatch({ type: 'SCENARIO_DETAIL_LOADING' });

      try {
        const detail = await operatorApi.getScenarioDetail(
          scenarioName,
          registryConfig || {}
        );
        dispatch({
          type: 'SCENARIO_DETAIL_SUCCESS',
          payload: { scenarioDetail: detail }
        });
      } catch (error) {
        dispatch({
          type: 'SCENARIO_DETAIL_ERROR',
          payload: {
            message: error instanceof Error ? error.message : 'Failed to load scenario details',
            type: 'api_error',
          },
        });
      }
    };

    fetchScenarioDetail();
  }, [scenarioName, registryConfig, dispatch]);

  useEffect(() => {
    if (!showGlobalParameters || scenarioGlobals) {
      return;
    }

    let mounted = true;

    const fetchGlobalParameters = async () => {
      setLoadingGlobals(true);

      try {
        const globals = await operatorApi.getScenarioGlobals(
          scenarioName,
          registryConfig || {}
        );
        if (mounted) {
          dispatch({
            type: 'SCENARIO_GLOBALS_SUCCESS',
            payload: { scenarioGlobals: globals }
          });
        }
      } catch (error) {
        if (mounted) {
          dispatch({
            type: 'SCENARIO_GLOBALS_ERROR',
            payload: {
              message: error instanceof Error ? error.message : 'Failed to load global parameters',
              type: 'api_error',
            },
          });
        }
      } finally {
        if (mounted) {
          setLoadingGlobals(false);
        }
      }
    };

    fetchGlobalParameters();

    return () => {
      mounted = false;
    };
  }, [showGlobalParameters, scenarioName, registryConfig, scenarioGlobals, dispatch]);

  // Load ES configs once when global parameters are first shown
  useEffect(() => {
    if (!showGlobalParameters) return;
    elasticsearchApi.listConfigs().then(setEsConfigs).catch(() => { });
  }, [showGlobalParameters]);

  // Ensures fields whose variable name contains "PASSWORD" are always rendered as secret inputs,
  // regardless of whether the scenario definition sets secret:true.
  // Returns true when the loaded globals contain at least one ES-related variable
  const hasEsGlobalFields = scenarioGlobals?.fields.some(
    (f) => f.variable != null && (f.variable === 'ENABLE_ES' || f.variable.startsWith('ES_'))
  ) ?? false;

  const applyEsConfig = (configName: string) => {
    setSelectedEsConfigName(configName);
    if (!configName) return;
    const cfg = esConfigs.find((c) => c.name === configName);
    if (!cfg) return;

    // Password is injected server-side via elasticsearchConfigName — never sent by the client.
    setAppliedEsConfigName(configName);
    const patch: ScenarioFormValues = {
      ...globalFormValues,
      ENABLE_ES: 'True',
      ES_SERVER: cfg.host ?? '',
      ES_PORT: String(cfg.port ?? 9200),
      ES_USERNAME: cfg.username ?? '',
      ES_METRICS_INDEX: cfg.metricsIndex ?? '',
      ES_ALERTS_INDEX: cfg.alertsIndex ?? '',
      ES_TELEMETRY_INDEX: cfg.telemetryIndex ?? '',
    };

    // Mark each applied field as touched so it is included in the run request
    const touched: TouchedFields = { ...(globalTouchedFields || {}) };
    for (const key of Object.keys(patch)) {
      touched[key] = true;
    }

    dispatch({ type: 'UPDATE_GLOBAL_FORM', payload: { formValues: patch, touchedFields: touched } });
  };

  const handleFormChange = (values: ScenarioFormValues) => {
    dispatch({
      type: 'UPDATE_SCENARIO_FORM',
      payload: { formValues: values },
    });
  };

  const handleGlobalFormChange = (values: ScenarioFormValues, touchedFields: TouchedFields) => {
    dispatch({
      type: 'UPDATE_GLOBAL_FORM',
      payload: { formValues: values, touchedFields },
    });
  };

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  const validateForm = (): boolean => {
    if (!scenarioDetail) return false;

    const errors: string[] = [];

    scenarioDetail.fields.forEach((field) => {
      const value = scenarioFormValues?.[field.variable];

      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.short_description} is required`);
        return;
      }

      if (field.type === 'string') {
        const stringField = field as StringField;
        if (stringField.validator && typeof value === 'string' && value !== '') {
          try {
            if (!new RegExp(stringField.validator).test(value)) {
              errors.push(`${field.short_description}: ${stringField.validation_message || `Must match pattern: ${stringField.validator}`}`);
            }
          } catch {
            // invalid regex in schema — skip
          }
        }
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handlePreview = () => {
    if (hasPendingFileInput) {
      setIsPendingFileModalOpen(true);
      return;
    }
    proceedToPreview();
  };

  const proceedToPreview = () => {
    if (validateForm()) {
      setShowPreview(true);
    }
  };

  const handleEditForm = () => {
    setShowPreview(false);
  };

  const executeScenarioRun = async (runRequest: ScenarioRunRequest) => {
    try {
      // NEW API Flow: POST returns scenarioRunName, then GET for full status
      const createResponse = await operatorApi.runScenario(runRequest);

      // Immediately fetch full status
      const statusResponse = await operatorApi.getScenarioRunStatus(createResponse.scenarioRunName);

      // Build ScenarioRunState
      const newRun: ScenarioRunState = {
        scenarioRunName: createResponse.scenarioRunName,
        scenarioName,
        phase: statusResponse.phase,
        totalTargets: statusResponse.totalTargets,
        successfulJobs: statusResponse.successfulJobs,
        failedJobs: statusResponse.failedJobs,
        runningJobs: statusResponse.runningJobs,
        clusterJobs: statusResponse.clusterJobs,
        createdAt: new Date().toISOString(),
        ownerUserId: statusResponse.ownerUserId,
        registryName: statusResponse.registryName,
        customRunName: statusResponse.customRunName || runRequest.customRunName,
      };

      // Dispatch creation event
      dispatch({
        type: 'SCENARIO_RUN_CREATED',
        payload: {
          scenarioRunName: createResponse.scenarioRunName,
          targetClusters: createResponse.targetClusters,
          totalTargets: createResponse.totalTargets,
          scenarioName,
        },
      });

      // Add scenario run to state
      dispatch({
        type: 'ADD_SCENARIO_RUN',
        payload: { run: newRun },
      });

      // Handle partial failures
      if (statusResponse.failedJobs > 0) {
        const failedJobs = statusResponse.clusterJobs.filter((j) => j.phase === 'Failed');
        const failedErrors = failedJobs
          .map((j) => `${j.clusterName}: ${j.message || 'Unknown error'}`)
          .join('\n');

        // Set validation errors to show the failures
        setValidationErrors([
          `${statusResponse.failedJobs} of ${statusResponse.totalTargets} jobs failed:`,
          failedErrors,
        ]);
      }

      // Transition to jobs_list (scenarioRun already added via ADD_SCENARIO_RUN)
      dispatch({
        type: 'SCENARIOS_RUN_BATCH_SUCCESS',
      });
    } catch (error) {
      if (isApiError(error) && error.status === 500) {
        setValidationErrors(['Internal error, please try again']);
        return;
      }
      const msg = error instanceof Error ? error.message : 'Failed to run scenario';
      const isConflict = msg.includes('409') || msg.toLowerCase().includes('conflict');
      if (isConflict && customRunName.trim()) {
        setValidationErrors([
          `A run named "${customRunName.trim()}" already exists. Please choose a different name.`,
        ]);
      } else {
        setValidationErrors([msg]);
      }
    }
  };

  const handleRunScenario = async () => {
    if (!state.uuid) {
      setValidationErrors(['Missing target request — please restart the workflow.']);
      return;
    }
    if (!state.selectedClusters || state.selectedClusters.length === 0) {
      setValidationErrors(['No clusters selected — please go back and select at least one cluster.']);
      return;
    }
    if (!scenarioFormValues || !scenarioDetail) {
      setValidationErrors(['Scenario configuration is not ready — please reload the page.']);
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      const environment: { [key: string]: string } = {};
      const files: ScenarioFileMount[] = [];

      for (const field of scenarioDetail.fields) {
        if (field.type === 'group') continue;
        const value = scenarioFormValues[field.variable];

        if (field.type === 'file') {
          if (value && value instanceof File) {
            files.push({ name: value.name, content: await readFileAsBase64(value) });
          }
        } else if (field.type === 'file_base64') {
          if (value && value instanceof File) {
            environment[field.variable] = await readFileAsBase64(value);
          }
        } else {
          if (value !== undefined && value !== null && value !== '') {
            environment[field.variable] = String(value);
          } else if (field.default) {
            environment[field.variable] = field.default;
          }
        }
      }

      const hasGlobalChanges = globalTouchedFields && Object.values(globalTouchedFields).some(Boolean);
      if (hasGlobalChanges && scenarioGlobals && globalFormValues) {
        for (const field of scenarioGlobals.fields) {
          if (!globalTouchedFields[field.variable]) continue;
          const value = globalFormValues[field.variable];

          if (field.type === 'file') {
            if (value && value instanceof File) {
              files.push({ name: value.name, content: await readFileAsBase64(value) });
            }
          } else if (field.type === 'file_base64') {
            if (value && value instanceof File) {
              environment[field.variable] = await readFileAsBase64(value);
            }
          } else {
            if (value !== undefined && value !== null && value !== '') {
              environment[field.variable] = String(value);
            }
          }
        }
      }

      const isPrivateRegistry = !!registryConfig?.registryName;
      const scenarioImage = rerunScenarioImage ?? (isPrivateRegistry ? scenarioName : `krkn-hub:${scenarioName}`);

      const targetClusters: { [providerName: string]: string[] } = {};
      state.selectedClusters.forEach(cluster => {
        if (!targetClusters[cluster.operatorName]) {
          targetClusters[cluster.operatorName] = [];
        }
        targetClusters[cluster.operatorName].push(cluster.clusterName);
      });

      // When a saved ES config is used, the backend injects ES_PASSWORD server-side.
      if (appliedEsConfigName) {
        delete environment['ES_PASSWORD'];
      }

      // Build the run request (batch execution)
      const runRequest: ScenarioRunRequest = {
        targetRequestId: state.uuid,
        targetClusters,
        scenarioImage,
        scenarioName,
        kubeconfigPath: rerunKubeconfigPath ?? '/home/krkn/.kube/config',
        environment,
        files: files.length > 0 ? files : undefined,
        fileReferences: fileReferences.length > 0 ? fileReferences : undefined,
        registryName: registryConfig?.registryName, // Optional: if not provided, backend defaults to quay.io
        customRunName: customRunName.trim() || undefined,
        elasticsearchConfigName: appliedEsConfigName || undefined,
      };

      const activeRuns = await operatorApi.getActiveRuns();
      for (const cluster of state.selectedClusters) {
        const existingRuns = activeRuns.clusterRuns[cluster.clusterName];
        if (existingRuns && existingRuns.length > 0) {
          setConflictWarning({ clusterName: cluster.clusterName, existingRuns });
          setPendingRunRequest(runRequest);
          return;
        }
      }

      await executeScenarioRun(runRequest);
    } catch (error) {
      dispatch({
        type: 'SCENARIOS_RUN_BATCH_ERROR',
        payload: {
          message: error instanceof Error ? error.message : 'Failed to run scenario',
          type: 'api_error',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConflictCancel = () => {
    setConflictWarning(null);
    setPendingRunRequest(null);
  };

  const handleConflictContinue = async () => {
    if (!pendingRunRequest) return;

    setConflictWarning(null);
    const request = pendingRunRequest;
    setPendingRunRequest(null);

    setIsSubmitting(true);
    try {
      await executeScenarioRun(request);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasGroupedScenarioFields = useMemo(
    () => scenarioDetail?.fields.some(f => f.type === 'group') || false,
    [scenarioDetail?.fields]
  );

  const requiredGlobalFields = useMemo(
    () => (scenarioGlobals?.fields.filter(field => field.required) || []).map((f) =>
      f.variable?.toUpperCase().includes('PASSWORD') ? { ...f, secret: true } : f
    ),
    [scenarioGlobals?.fields]
  );

  const optionalGlobalFields = useMemo(
    () => (scenarioGlobals?.fields.filter(field => !field.required) || []).map((f) =>
      f.variable?.toUpperCase().includes('PASSWORD') ? { ...f, secret: true } : f
    ),
    [scenarioGlobals?.fields]
  );

  const allGlobalFields = useMemo(
    () => [...requiredGlobalFields, ...optionalGlobalFields],
    [requiredGlobalFields, optionalGlobalFields]
  );

  const optionalFields = useMemo(
    () => scenarioDetail?.fields.filter(f => !f.required && f.type !== 'group') || [],
    [scenarioDetail?.fields]
  );

  if (!scenarioDetail) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Spinner size="xl" />
        <div style={{ marginTop: '1rem' }}>Loading scenario details...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Back Button */}
      <div style={{ marginBottom: '1rem' }}>
        <Button variant="link" onClick={handleBack}>
          ← Back to Scenarios List
        </Button>
      </div>

      {/* Scenario Header */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardBody>
          <Title headingLevel="h2" size="xl">
            {scenarioDetail.title}
          </Title>
          <div style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
            {scenarioDetail.description}
          </div>
          {scenarioDetail.digest && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>
              <strong>Digest:</strong> {scenarioDetail.digest.substring(0, 19)}...
            </div>
          )}
        </CardBody>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert
          variant="danger"
          title="Form validation errors"
          style={{ marginBottom: '1.5rem' }}
        >
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Pending File Warning Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Pending file not added"
        titleIconVariant={ExclamationTriangleIcon}
        isOpen={isPendingFileModalOpen}
        onClose={() => setIsPendingFileModalOpen(false)}
        actions={[
          <Button
            key="continue"
            variant="primary"
            onClick={() => {
              setIsPendingFileModalOpen(false);
              proceedToPreview();
            }}
          >
            Continue without adding
          </Button>,
          <Button
            key="cancel"
            variant="link"
            onClick={() => setIsPendingFileModalOpen(false)}
          >
            Go back
          </Button>,
        ]}
      >
        <p>
          You have selected a file in the Managed Files section but you haven&apos;t clicked
          the <strong>&laquo;Add&raquo;</strong> button yet. The file will <strong>not</strong> be
          included in the run unless you go back and click <strong>&laquo;Add&raquo;</strong> to
          confirm it.
        </p>
      </Modal>

      {!showPreview ? (
        <>
          {/* Parameters Section */}
          <Card>
            <CardTitle>{hasGroupedScenarioFields ? 'Parameters' : 'Required Parameters'}</CardTitle>
            <CardBody>
              <DynamicFormBuilder
                fields={hasGroupedScenarioFields ? scenarioDetail.fields : scenarioDetail.fields.filter(field => field.required)}
                values={scenarioFormValues || {}}
                onChange={handleFormChange}
              />
            </CardBody>
          </Card>

          {/* File References Section */}
          <Card style={{ marginTop: '1.5rem' }}>
            <CardTitle>Managed Files</CardTitle>
            <CardBody>
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
                Select centrally-managed files to mount in the scenario container.
                The mount path must include the full file path (folder + filename), e.g., <code>/etc/config/file.yaml</code>.
              </div>
              <FileSelector
                value={fileReferences}
                onChange={setFileReferences}
                onPendingChange={setHasPendingFileInput}
              />
            </CardBody>
          </Card>

          <ScenarioParameterSections
            optionalFields={optionalFields}
            formValues={scenarioFormValues || {}}
            onFormChange={handleFormChange}
            suppressOptionalSection={hasGroupedScenarioFields}
            allGlobalFields={allGlobalFields}
            globalFormValues={globalFormValues || {}}
            globalTouchedFields={globalTouchedFields || {}}
            onGlobalFormChange={handleGlobalFormChange}
            loadingGlobals={loadingGlobals}
            showOptionalFields={showOptionalFields}
            onToggleOptional={(isExpanded) => setShowOptionalFields(isExpanded)}
            showGlobalParameters={showGlobalParameters}
            onToggleGlobal={(isExpanded) => setShowGlobalParameters(isExpanded)}
            hasEsGlobalFields={hasEsGlobalFields}
            esConfigs={esConfigs}
            selectedEsConfigName={selectedEsConfigName}
            onSelectEsConfig={applyEsConfig}
            appliedEsConfigName={appliedEsConfigName}
          />

          {/* Preview Button */}
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <Button variant="primary" size="lg" onClick={handlePreview}>
              Preview Configuration
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Configuration Preview */}
          <Card>
            <CardTitle>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Configuration Preview</span>
                <Button variant="secondary" onClick={handleEditForm}>
                  Edit Configuration
                </Button>
              </div>
            </CardTitle>
            <CardBody>
              <div style={{ marginBottom: '1rem', fontWeight: 'bold' }}>Scenario Parameters</div>
              <Table variant="compact" borders={true}>
                <Thead>
                  <Tr>
                    <Th width={30}>Variable</Th>
                    <Th width={40}>Description</Th>
                    <Th width={30}>Value</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {scenarioDetail.fields.filter(f => f.type !== 'group').map((field) => {
                    const value = scenarioFormValues?.[field.variable];
                    let displayValue: string;

                    if (value === undefined || value === null || value === '') {
                      displayValue = field.default?.toString() || '(empty)';
                    } else if (field.secret) {
                      displayValue = '••••••••';
                    } else if (field.type === 'file' || field.type === 'file_base64') {
                      displayValue = (value as File)?.name || String(value);
                    } else {
                      displayValue = String(value);
                    }

                    return (
                      <Tr key={field.variable}>
                        <Td>
                          <code>{field.variable}</code>
                        </Td>
                        <Td>{field.short_description}</Td>
                        <Td style={{ fontFamily: 'monospace' }}>{displayValue}</Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>

              {/* Global Parameters Preview - Only show touched fields */}
              {showGlobalParameters && scenarioGlobals && globalTouchedFields && Object.keys(globalTouchedFields).some(key => globalTouchedFields[key]) && (
                <>
                  <div style={{ marginTop: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>Global Parameters (Modified)</div>
                  <Table variant="compact" borders={true}>
                    <Thead>
                      <Tr>
                        <Th width={30}>Variable</Th>
                        <Th width={40}>Description</Th>
                        <Th width={30}>Value</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {scenarioGlobals.fields
                        .filter(field => globalTouchedFields[field.variable])
                        .map((field) => {
                          const value = globalFormValues?.[field.variable];
                          let displayValue: string;

                          if (value === undefined || value === null || value === '') {
                            displayValue = field.default?.toString() || '(empty)';
                          } else if (field.secret) {
                            displayValue = '••••••••';
                          } else if (field.type === 'file' || field.type === 'file_base64') {
                            displayValue = (value as File)?.name || String(value);
                          } else {
                            displayValue = String(value);
                          }

                          return (
                            <Tr key={field.variable}>
                              <Td>
                                <code>{field.variable}</code>
                              </Td>
                              <Td>{field.short_description}</Td>
                              <Td style={{ fontFamily: 'monospace' }}>{displayValue}</Td>
                            </Tr>
                          );
                        })}
                    </Tbody>
                  </Table>
                </>
              )}

              {/* File References Preview */}
              {fileReferences.length > 0 && (
                <>
                  <div style={{ marginTop: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>Managed Files</div>
                  <Table variant="compact" borders={true}>
                    <Thead>
                      <Tr>
                        <Th width={50}>File</Th>
                        <Th width={50}>Mount Path</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {fileReferences.map((ref, index) => {
                        const file = availableFiles.find(f => f.fileId === ref.fileId);
                        const displayName = file?.fileName || ref.fileId;
                        return (
                          <Tr key={index}>
                            <Td style={{ fontFamily: 'monospace' }}>{displayName}</Td>
                            <Td style={{ fontFamily: 'monospace' }}>{ref.mountPath}</Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </>
              )}
            </CardBody>
          </Card>

          {/* Custom Run Name */}
          <Card style={{ marginTop: '1.5rem' }}>
            <CardBody>
              <FormGroup
                label="Run name (optional)"
                fieldId="custom-run-name"
              >
                <TextInput
                  id="custom-run-name"
                  type="text"
                  value={customRunName}
                  onChange={(_event, value) => setCustomRunName(value)}
                  placeholder="e.g. nightly-pod-disruption-test"
                  isDisabled={isSubmitting}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>A custom label for this run. If left blank, a name is generated automatically.</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            </CardBody>
          </Card>

          {/* Run Button */}
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <Button variant="primary" size="lg" onClick={handleRunScenario} isDisabled={isSubmitting} isLoading={isSubmitting}>
              {isSubmitting ? 'Running...' : 'Run Scenarios'}
            </Button>
          </div>
        </>
      )}

      {/* Cluster Conflict Warning Modal */}
      {conflictWarning && (
        <ClusterConflictWarning
          isOpen={true}
          clusterName={conflictWarning.clusterName}
          existingRuns={conflictWarning.existingRuns}
          onCancel={handleConflictCancel}
          onContinue={handleConflictContinue}
        />
      )}
    </div>
  );
}
