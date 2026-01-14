import { useState, useEffect } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Title,
  Button,
  Alert,
  Spinner,
  Checkbox,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useAppContext } from '../context/AppContext';
import { DynamicFormBuilder } from './DynamicFormBuilder';
import { DynamicFormBuilderWithTracking } from './DynamicFormBuilderWithTracking';
import { operatorApi } from '../services/operatorApi';
import type { ScenarioFormValues, ScenariosRequest, TouchedFields, ScenarioRunRequest, ScenarioFileMount, JobStatus, JobStatusResponse, FileField } from '../types/api';

interface ScenarioDetailProps {
  scenarioName: string;
  registryConfig: ScenariosRequest | null;
}

export function ScenarioDetail({ scenarioName, registryConfig }: ScenarioDetailProps) {
  const { state, dispatch } = useAppContext();
  const { scenarioDetail, scenarioFormValues, scenarioGlobals, globalFormValues, globalTouchedFields } = state;
  const [showPreview, setShowPreview] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showGlobalParameters, setShowGlobalParameters] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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
    const fetchGlobalParameters = async () => {
      if (!showGlobalParameters || scenarioGlobals) {
        return;
      }

      try {
        const globals = await operatorApi.getScenarioGlobals(
          scenarioName,
          registryConfig || {}
        );
        dispatch({
          type: 'SCENARIO_GLOBALS_SUCCESS',
          payload: { scenarioGlobals: globals }
        });
      } catch (error) {
        dispatch({
          type: 'SCENARIO_GLOBALS_ERROR',
          payload: {
            message: error instanceof Error ? error.message : 'Failed to load global parameters',
            type: 'api_error',
          },
        });
      }
    };

    fetchGlobalParameters();
  }, [showGlobalParameters, scenarioName, registryConfig, scenarioGlobals, dispatch]);

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
      if (field.required) {
        const value = scenarioFormValues?.[field.variable];
        if (value === undefined || value === null || value === '') {
          errors.push(`${field.short_description} is required`);
        }
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handlePreview = () => {
    if (validateForm()) {
      setShowPreview(true);
    }
  };

  const handleEditForm = () => {
    setShowPreview(false);
  };

  const handleRunScenario = async () => {
    if (!state.uuid || !state.selectedCluster || !scenarioFormValues || !scenarioDetail) {
      return;
    }

    try {
      // Build environment map from scenario form values and global touched fields
      const environment: { [key: string]: string } = {};
      const files: ScenarioFileMount[] = [];

      // Add scenario form values (exclude file type fields)
      scenarioDetail.fields.forEach((field) => {
        const value = scenarioFormValues[field.variable];

        if (field.type === 'file') {
          // Handle file type - add to files array
          if (value && value instanceof File) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64Content = btoa(reader.result as string);
              files.push({
                name: value.name,
                content: base64Content,
                mountPath: (field as FileField).mount_path || `/config/${value.name}`,
              });
            };
            reader.readAsText(value);
          }
        } else if (field.type !== 'file_base64') {
          // Add to environment (all types except file and file_base64)
          if (value !== undefined && value !== null && value !== '') {
            environment[field.variable] = String(value);
          } else if (field.default) {
            environment[field.variable] = field.default;
          }
        } else {
          // file_base64 type - add to environment as base64
          if (value && value instanceof File) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64Content = btoa(reader.result as string);
              environment[field.variable] = base64Content;
            };
            reader.readAsText(value);
          }
        }
      });

      // Add global form values (only touched fields)
      if (showGlobalParameters && scenarioGlobals && globalTouchedFields && globalFormValues) {
        scenarioGlobals.fields.forEach((field) => {
          if (globalTouchedFields[field.variable]) {
            const value = globalFormValues[field.variable];

            if (field.type === 'file') {
              // Handle global file type
              if (value && value instanceof File) {
                const reader = new FileReader();
                reader.onload = () => {
                  const base64Content = btoa(reader.result as string);
                  files.push({
                    name: value.name,
                    content: base64Content,
                    mountPath: (field as FileField).mount_path || `/config/${value.name}`,
                  });
                };
                reader.readAsText(value);
              }
            } else if (field.type !== 'file_base64') {
              if (value !== undefined && value !== null && value !== '') {
                environment[field.variable] = String(value);
              }
            } else {
              // file_base64 type
              if (value && value instanceof File) {
                const reader = new FileReader();
                reader.onload = () => {
                  const base64Content = btoa(reader.result as string);
                  environment[field.variable] = base64Content;
                };
                reader.readAsText(value);
              }
            }
          }
        });
      }

      // Build scenario image
      let scenarioImage: string;
      if (registryConfig && registryConfig.registryUrl && registryConfig.scenarioRepository) {
        scenarioImage = `${registryConfig.registryUrl}/${registryConfig.scenarioRepository}:${scenarioName}`;
      } else {
        scenarioImage = `quay.io/krkn-chaos/krkn-hub:${scenarioName}`;
      }

      // Build the run request
      const runRequest: ScenarioRunRequest = {
        targetId: state.uuid,
        clusterName: state.selectedCluster.clusterName,
        scenarioImage,
        scenarioName,
        kubeconfigPath: '/home/krkn/.kube/config',
        environment,
        files: files.length > 0 ? files : undefined,
        registryUrl: registryConfig?.registryUrl,
        scenarioRepository: registryConfig?.scenarioRepository,
        username: registryConfig?.username,
        password: registryConfig?.password,
      };

      // Call the API to run the scenario
      const runResponse = await operatorApi.runScenario(runRequest);

      // Create initial job status
      const initialJob: JobStatusResponse = {
        jobId: runResponse.jobId,
        targetId: state.uuid,
        clusterName: state.selectedCluster.clusterName,
        scenarioName,
        status: runResponse.status as JobStatus,
        podName: runResponse.podName,
      };

      // Dispatch success action
      dispatch({
        type: 'SCENARIO_RUN_SUCCESS',
        payload: { job: initialJob },
      });
    } catch (error) {
      dispatch({
        type: 'SCENARIO_RUN_ERROR',
        payload: {
          message: error instanceof Error ? error.message : 'Failed to run scenario',
          type: 'api_error',
        },
      });
    }
  };

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

      {!showPreview ? (
        <>
          {/* Required Fields Section */}
          <Card>
            <CardTitle>Required Parameters</CardTitle>
            <CardBody>
              <DynamicFormBuilder
                fields={scenarioDetail.fields.filter(field => field.required)}
                values={scenarioFormValues || {}}
                onChange={handleFormChange}
              />
            </CardBody>
          </Card>

          {/* Optional Fields Toggle */}
          <div style={{ marginTop: '1.5rem' }}>
            <Checkbox
              id="show-optional-fields"
              label="Add optional parameters"
              isChecked={showOptionalFields}
              onChange={(_event, checked) => setShowOptionalFields(checked)}
            />
          </div>

          {/* Optional Fields Section */}
          {showOptionalFields && (
            <Card style={{ marginTop: '1.5rem' }}>
              <CardTitle>Optional Parameters</CardTitle>
              <CardBody>
                {scenarioDetail.fields.filter(field => !field.required).length > 0 ? (
                  <DynamicFormBuilder
                    fields={scenarioDetail.fields.filter(field => !field.required)}
                    values={scenarioFormValues || {}}
                    onChange={handleFormChange}
                  />
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
                    No optional parameters available for this scenario
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Global Parameters Toggle */}
          <div style={{ marginTop: '1.5rem' }}>
            <Checkbox
              id="show-global-parameters"
              label="Add global parameters"
              isChecked={showGlobalParameters}
              onChange={(_event, checked) => setShowGlobalParameters(checked)}
            />
          </div>

          {/* Global Parameters Section */}
          {showGlobalParameters && (
            <>
              {!scenarioGlobals ? (
                <Card style={{ marginTop: '1.5rem' }}>
                  <CardBody>
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <Spinner size="lg" />
                      <div style={{ marginTop: '1rem' }}>Loading global parameters...</div>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <>
                  {/* Required Global Fields */}
                  {scenarioGlobals.fields.filter(field => field.required).length > 0 && (
                    <Card style={{ marginTop: '1.5rem' }}>
                      <CardTitle>Required Global Parameters</CardTitle>
                      <CardBody>
                        <DynamicFormBuilderWithTracking
                          fields={scenarioGlobals.fields.filter(field => field.required)}
                          values={globalFormValues || {}}
                          touchedFields={globalTouchedFields || {}}
                          onChange={handleGlobalFormChange}
                        />
                      </CardBody>
                    </Card>
                  )}

                  {/* Optional Global Fields */}
                  {scenarioGlobals.fields.filter(field => !field.required).length > 0 && (
                    <Card style={{ marginTop: '1.5rem' }}>
                      <CardTitle>Optional Global Parameters</CardTitle>
                      <CardBody>
                        <DynamicFormBuilderWithTracking
                          fields={scenarioGlobals.fields.filter(field => !field.required)}
                          values={globalFormValues || {}}
                          touchedFields={globalTouchedFields || {}}
                          onChange={handleGlobalFormChange}
                        />
                      </CardBody>
                    </Card>
                  )}
                </>
              )}
            </>
          )}

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
                  {scenarioDetail.fields.map((field) => {
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
            </CardBody>
          </Card>

          {/* Run Button */}
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <Button variant="primary" size="lg" onClick={handleRunScenario}>
              Run Scenario
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
