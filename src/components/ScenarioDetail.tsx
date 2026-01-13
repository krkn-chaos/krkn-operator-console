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
import { operatorApi } from '../services/operatorApi';
import type { ScenarioFormValues, ScenariosRequest } from '../types/api';

interface ScenarioDetailProps {
  scenarioName: string;
  registryConfig: ScenariosRequest | null;
}

export function ScenarioDetail({ scenarioName, registryConfig }: ScenarioDetailProps) {
  const { state, dispatch } = useAppContext();
  const { scenarioDetail, scenarioFormValues } = state;
  const [showPreview, setShowPreview] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
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

  const handleFormChange = (values: ScenarioFormValues) => {
    dispatch({
      type: 'UPDATE_SCENARIO_FORM',
      payload: { formValues: values },
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
            </CardBody>
          </Card>

          {/* Submit Button (placeholder for future) */}
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <Button variant="primary" size="lg" isDisabled>
              Submit Scenario (Coming Soon)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
