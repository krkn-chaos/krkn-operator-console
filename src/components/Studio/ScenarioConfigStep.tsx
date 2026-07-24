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
  FormGroup,
  FormSelect,
  FormSelectOption,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { DynamicFormBuilder } from '../DynamicFormBuilder';
import { DynamicFormBuilderWithTracking } from '../DynamicFormBuilderWithTracking';
import { operatorApi } from '../../services/operatorApi';
import { elasticsearchApi } from '../../services/elasticsearchApi';
import type { ScenarioDetail, ScenarioFormValues, ScenariosRequest, ScenarioGlobals, TouchedFields, ElasticsearchConfig } from '../../types/api';

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
  const [esConfigs, setEsConfigs] = useState<ElasticsearchConfig[]>([]);
  const [selectedEsConfigName, setSelectedEsConfigName] = useState('');
  const [appliedEsConfigName, setAppliedEsConfigName] = useState('');

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

          // Extract default values from ALL fields
          const defaults: ScenarioFormValues = {};

          // Fields is a direct array, not separated by required/optional
          if (Array.isArray(detail.fields)) {
            detail.fields.forEach(field => {
              if (field.default !== undefined && field.default !== '') {
                defaults[field.variable] = field.default;
              }
            });
          }

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
  }, [scenarioName, registryName, onDefaultValuesLoad]);

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

  // Load ES configs once when global parameters are first shown
  useEffect(() => {
    if (!showGlobalParameters) return;
    elasticsearchApi.listConfigs().then(setEsConfigs).catch(() => {});
  }, [showGlobalParameters]);

  const hasEsGlobalFields = scenarioGlobals?.fields.some(
    (f) => f.variable === 'ENABLE_ES' || f.variable.startsWith('ES_')
  ) ?? false;

  const applyEsConfig = (configName: string) => {
    setSelectedEsConfigName(configName);
    if (!configName) return;
    const cfg = esConfigs.find((c) => c.name === configName);
    if (!cfg) return;

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

    const touched: TouchedFields = { ...globalTouchedFields };
    for (const key of Object.keys(patch)) {
      touched[key] = true;
    }

    onGlobalFormChange(patch, touched);
  };

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
              {/* ES Config Picker - only shown when globals contain ES fields */}
              {hasEsGlobalFields && esConfigs.length > 0 && (
                <Card style={{ marginTop: '1.5rem' }}>
                  <CardTitle>Load Elasticsearch Config</CardTitle>
                  <CardBody>
                    <FormGroup label="Load from saved config" fieldId="es-config-picker">
                      <FormSelect
                        id="es-config-picker"
                        value={selectedEsConfigName}
                        onChange={(_e, v) => applyEsConfig(v)}
                        style={{ maxWidth: '500px' }}
                      >
                        <FormSelectOption value="" label="Select a saved Elasticsearch config…" />
                        {esConfigs.map((c) => (
                          <FormSelectOption key={c.name} value={c.name} label={`${c.name} — ${c.host}`} />
                        ))}
                      </FormSelect>
                      {appliedEsConfigName && (
                        <FormHelperText>
                          <HelperText>
                            <HelperTextItem variant="success">
                              ES_PASSWORD will be injected automatically from &quot;{appliedEsConfigName}&quot;
                            </HelperTextItem>
                          </HelperText>
                        </FormHelperText>
                      )}
                    </FormGroup>
                  </CardBody>
                </Card>
              )}

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
                      disabledFields={appliedEsConfigName ? ['ES_PASSWORD'] : []}
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
                      disabledFields={appliedEsConfigName ? ['ES_PASSWORD'] : []}
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
