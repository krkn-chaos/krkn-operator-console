import {
  Spinner,
  Card,
  CardBody,
  CardTitle,
  ExpandableSection,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core';
import { DynamicFormBuilder } from './DynamicFormBuilder';
import { DynamicFormBuilderWithTracking } from './DynamicFormBuilderWithTracking';
import type { ScenarioField, ScenarioFormValues, TouchedFields, ElasticsearchConfig } from '../types/api';

interface ScenarioParameterSectionsProps {
  optionalFields: ScenarioField[];
  formValues: ScenarioFormValues;
  onFormChange: (values: ScenarioFormValues) => void;
  suppressOptionalSection?: boolean;
  allGlobalFields: ScenarioField[];
  globalFormValues: ScenarioFormValues;
  globalTouchedFields: TouchedFields;
  onGlobalFormChange: (values: ScenarioFormValues, touchedFields: TouchedFields) => void;
  loadingGlobals: boolean;
  showOptionalFields: boolean;
  onToggleOptional: (isExpanded: boolean) => void;
  showGlobalParameters: boolean;
  onToggleGlobal: (isExpanded: boolean) => void;
  hasEsGlobalFields: boolean;
  esConfigs: ElasticsearchConfig[];
  selectedEsConfigName: string;
  onSelectEsConfig: (name: string) => void;
  appliedEsConfigName: string;
}

export function ScenarioParameterSections({
  optionalFields,
  formValues,
  onFormChange,
  suppressOptionalSection = false,
  allGlobalFields,
  globalFormValues,
  globalTouchedFields,
  onGlobalFormChange,
  loadingGlobals,
  showOptionalFields,
  onToggleOptional,
  showGlobalParameters,
  onToggleGlobal,
  hasEsGlobalFields,
  esConfigs,
  selectedEsConfigName,
  onSelectEsConfig,
  appliedEsConfigName,
}: ScenarioParameterSectionsProps) {
  const disabledFields = appliedEsConfigName ? ['ES_PASSWORD'] : [];
  const requiredGlobalFields = allGlobalFields.filter((f) => f.required);
  const optionalGlobalFields = allGlobalFields.filter((f) => !f.required);

  return (
    <>
      {!suppressOptionalSection && (
        <ExpandableSection
          style={{ marginTop: '1.5rem' }}
          toggleText="Optional Parameters"
          isExpanded={showOptionalFields}
          onToggle={(_event, isExpanded) => onToggleOptional(isExpanded)}
        >
          <Card>
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
        </ExpandableSection>
      )}

      <ExpandableSection
        style={{ marginTop: '1.5rem' }}
        toggleText="Global Parameters"
        isExpanded={showGlobalParameters}
        onToggle={(_event, isExpanded) => onToggleGlobal(isExpanded)}
      >
        {loadingGlobals ? (
          <Card>
            <CardBody>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Spinner size="lg" />
                <div style={{ marginTop: '1rem' }}>Loading global parameters...</div>
              </div>
            </CardBody>
          </Card>
        ) : allGlobalFields.length > 0 ? (
          <>
            {hasEsGlobalFields && esConfigs.length > 0 && (
              <Card style={{ marginBottom: '1rem' }}>
                <CardTitle>Load Elasticsearch Config</CardTitle>
                <CardBody>
                  <FormGroup label="Load from saved config" fieldId="es-config-picker">
                    <FormSelect
                      id="es-config-picker"
                      value={selectedEsConfigName}
                      onChange={(_e, v) => onSelectEsConfig(v)}
                      style={{ maxWidth: '500px' }}
                    >
                      <FormSelectOption value="" label="Select a saved Elasticsearch config…" />
                      {esConfigs.map((c) => (
                        <FormSelectOption
                          key={c.name}
                          value={c.name}
                          label={`${c.name} — ${c.host}`}
                        />
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
            {requiredGlobalFields.length > 0 && (
              <Card style={{ marginBottom: '1rem' }}>
                <CardTitle>Required Global Parameters</CardTitle>
                <CardBody>
                  <DynamicFormBuilderWithTracking
                    fields={requiredGlobalFields}
                    values={globalFormValues}
                    touchedFields={globalTouchedFields}
                    onChange={onGlobalFormChange}
                    disabledFields={disabledFields}
                  />
                </CardBody>
              </Card>
            )}
            {optionalGlobalFields.length > 0 && (
              <Card>
                <CardTitle>Optional Global Parameters</CardTitle>
                <CardBody>
                  <DynamicFormBuilderWithTracking
                    fields={optionalGlobalFields}
                    values={globalFormValues}
                    touchedFields={globalTouchedFields}
                    onChange={onGlobalFormChange}
                    disabledFields={disabledFields}
                  />
                </CardBody>
              </Card>
            )}
          </>
        ) : null}
      </ExpandableSection>
    </>
  );
}
