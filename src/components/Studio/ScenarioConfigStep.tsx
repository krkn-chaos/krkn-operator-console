/**
 * ScenarioConfigStep - Scenario configuration for wizard
 *
 * Replicates ScenarioDetail layout with Required/Optional/Global sections
 * but as a controlled component for the Studio wizard.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Spinner,
  Alert,
  Card,
  CardTitle,
  CardBody,
  Checkbox,
} from '@patternfly/react-core';
import { DynamicFormBuilder } from '../DynamicFormBuilder';
import { DynamicFormBuilderWithTracking } from '../DynamicFormBuilderWithTracking';
import { operatorApi } from '../../services/operatorApi';
import type { ScenarioDetail, ScenarioFormValues, ScenariosRequest, ScenarioGlobals, TouchedFields } from '../../types/api';

interface ScenarioConfigStepProps {
  scenarioName: string;
  registryName: string; // PRIMITIVE instead of object
  formValues: ScenarioFormValues;
  globalFormValues: ScenarioFormValues;
  globalTouchedFields: TouchedFields;
  onFormChange: (values: ScenarioFormValues) => void;
  onGlobalFormChange: (values: ScenarioFormValues, touchedFields: TouchedFields) => void;
  onDefaultValuesLoad?: (defaults: ScenarioFormValues) => void;
}

export function ScenarioConfigStep({
  scenarioName,
  registryName,
  formValues,
  globalFormValues,
  globalTouchedFields,
  onFormChange,
  onGlobalFormChange,
  onDefaultValuesLoad,
}: ScenarioConfigStepProps) {
  const [scenarioDetail, setScenarioDetail] = useState<ScenarioDetail | null>(null);
  const [scenarioGlobals, setScenarioGlobals] = useState<ScenarioGlobals | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingGlobals, setLoadingGlobals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showGlobalParameters, setShowGlobalParameters] = useState(false);

  // Fetch scenario detail when scenario changes
  useEffect(() => {
    let mounted = true;

    async function fetchScenarioDetail() {
      setLoading(true);
      setError(null);
      setScenarioDetail(null);

      try {
        // Reconstruct registryConfig from registryName to avoid closure issues
        const config: ScenariosRequest = registryName ? { registryName } : {};
        const detail = await operatorApi.getScenarioDetail(scenarioName, config);

        if (mounted) {
          setScenarioDetail(detail);

          // Extract default values from optional fields
          const defaults: ScenarioFormValues = {};
          if (detail.fields.optional) {
            detail.fields.optional.forEach(field => {
              if (field.default !== undefined && field.default !== '') {
                defaults[field.variable] = field.default;
              }
            });
          }

          console.log('ScenarioConfigStep - Extracted defaults:', {
            scenarioName,
            optionalFieldsCount: detail.fields.optional?.length || 0,
            defaults,
            hasCallback: !!onDefaultValuesLoad
          });

          // Notify parent of default values
          onDefaultValuesLoad?.(defaults);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load scenario details');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchScenarioDetail();

    return () => {
      mounted = false;
    };
  }, [scenarioName, registryName]); // Only primitive dependencies

  // Fetch global parameters when checkbox is toggled
  useEffect(() => {
    if (!showGlobalParameters || scenarioGlobals) {
      return;
    }

    let mounted = true;

    async function fetchGlobalParameters() {
      setLoadingGlobals(true);

      try {
        // Reconstruct registryConfig from registryName to avoid closure issues
        const config: ScenariosRequest = registryName ? { registryName } : {};
        const globals = await operatorApi.getScenarioGlobals(scenarioName, config);

        if (mounted) {
          setScenarioGlobals(globals);
        }
      } catch (err) {
        if (mounted) {
          console.error('[ScenarioConfigStep] Failed to load global parameters:', err);
        }
      } finally {
        if (mounted) {
          setLoadingGlobals(false);
        }
      }
    }

    fetchGlobalParameters();

    return () => {
      mounted = false;
    };
  }, [showGlobalParameters, scenarioName, scenarioGlobals, registryName]); // Only primitive dependencies

  // Memoize filtered field arrays to prevent infinite loops
  // MUST be before any conditional returns (hooks order must be consistent)
  const requiredFields = useMemo(
    () => scenarioDetail?.fields.filter(field => field.required) || [],
    [scenarioDetail?.fields]
  );

  const optionalFields = useMemo(
    () => scenarioDetail?.fields.filter(field => !field.required) || [],
    [scenarioDetail?.fields]
  );

  const requiredGlobalFields = useMemo(
    () => scenarioGlobals?.fields.filter(field => field.required) || [],
    [scenarioGlobals?.fields]
  );

  const optionalGlobalFields = useMemo(
    () => scenarioGlobals?.fields.filter(field => !field.required) || [],
    [scenarioGlobals?.fields]
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <Spinner size="lg" aria-label="Loading scenario details" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" isInline title="Failed to load scenario">
        {error}
      </Alert>
    );
  }

  if (!scenarioDetail) {
    return null;
  }

  return (
    <div>
      {/* Scenario Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3>{scenarioDetail.title}</h3>
        <p style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
          {scenarioDetail.description}
        </p>
      </div>

      {/* Required Fields Section */}
      <Card>
        <CardTitle>Required Parameters</CardTitle>
        <CardBody>
          <DynamicFormBuilder
            fields={requiredFields}
            values={formValues}
            onChange={onFormChange}
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
            {optionalFields.length > 0 ? (
              <DynamicFormBuilder
                fields={optionalFields}
                values={formValues}
                onChange={onFormChange}
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
          {loadingGlobals ? (
            <Card style={{ marginTop: '1.5rem' }}>
              <CardBody>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Spinner size="lg" />
                  <div style={{ marginTop: '1rem' }}>Loading global parameters...</div>
                </div>
              </CardBody>
            </Card>
          ) : scenarioGlobals ? (
            <>
              {/* Required Global Fields */}
              {requiredGlobalFields.length > 0 && (
                <Card style={{ marginTop: '1.5rem' }}>
                  <CardTitle>Required Global Parameters</CardTitle>
                  <CardBody>
                    <DynamicFormBuilderWithTracking
                      fields={requiredGlobalFields}
                      values={globalFormValues}
                      touchedFields={globalTouchedFields}
                      onChange={onGlobalFormChange}
                    />
                  </CardBody>
                </Card>
              )}

              {/* Optional Global Fields */}
              {optionalGlobalFields.length > 0 && (
                <Card style={{ marginTop: '1.5rem' }}>
                  <CardTitle>Optional Global Parameters</CardTitle>
                  <CardBody>
                    <DynamicFormBuilderWithTracking
                      fields={optionalGlobalFields}
                      values={globalFormValues}
                      touchedFields={globalTouchedFields}
                      onChange={onGlobalFormChange}
                    />
                  </CardBody>
                </Card>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
