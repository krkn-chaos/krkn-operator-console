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
import type { ScenarioField, ScenarioFormValues, TouchedFields, ElasticsearchConfig, CloudCredential } from '../types/api';
import { getCloudDisabledFields, filterFieldsByCloudType } from '../utils/cloudProviderUtils';

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
  /** True when the scenario has cloud-related fields anywhere — required, optional, or global */
  hasCloudCredentialFields: boolean;
  cloudCredentials: CloudCredential[];
  selectedCloudCredName: string;
  onSelectCloudCredential: (name: string) => void;
  appliedCloudCredName: string;
  /** CLOUD_TYPE used to hide other providers' optional credential fields */
  activeCloudType?: string;
  appliedCloudCredName?: string;
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
  hasCloudCredentialFields,
  cloudCredentials,
  selectedCloudCredName,
  onSelectCloudCredential,
  appliedCloudCredName,
  activeCloudType,
}: ScenarioParameterSectionsProps) {
  const cloudDisabledFields = getCloudDisabledFields(appliedCloudCredName);
  const esDisabledFields = appliedEsConfigName ? ['ES_PASSWORD'] : [];
  const disabledFields = [...esDisabledFields, ...cloudDisabledFields];
  const requiredGlobalFields = allGlobalFields.filter((f) => f.required);
  const optionalGlobalFields = allGlobalFields.filter((f) => !f.required);
  // Only show the active provider's cloud fields — avoids listing all 7 providers'
  // credential fields (mostly irrelevant) at once.
  const cloudFilterOptions = {
    hideCloudTypeWhenCredentialApplied: true,
    appliedCloudCredName,
  };
  const visibleOptionalFields = filterFieldsByCloudType(optionalFields, activeCloudType, cloudFilterOptions);
  const visibleRequiredGlobalFields = filterFieldsByCloudType(requiredGlobalFields, activeCloudType, cloudFilterOptions);
  const visibleOptionalGlobalFields = filterFieldsByCloudType(optionalGlobalFields, activeCloudType, cloudFilterOptions);
  const appliedCloudCredProvider = cloudCredentials.find((c) => c.name === appliedCloudCredName)?.provider;

  return (
    <>
      {hasCloudCredentialFields && cloudCredentials.length > 0 && (
        <Card style={{ marginTop: '1.5rem' }}>
          <CardTitle>Load Cloud Credential</CardTitle>
          <CardBody>
            <FormGroup label="Load from saved credential" fieldId="cloud-cred-picker">
              <FormSelect
                id="cloud-cred-picker"
                value={selectedCloudCredName}
                onChange={(_e, v) => onSelectCloudCredential(v)}
                style={{ maxWidth: '500px' }}
              >
                <FormSelectOption value="" label="Select a saved cloud credential…" />
                {cloudCredentials.map((c) => (
                  <FormSelectOption
                    key={c.name}
                    value={c.name}
                    label={`${c.name} — ${c.provider.toUpperCase()}`}
                  />
                ))}
              </FormSelect>
              {appliedCloudCredName && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="success">
                      Cloud credential active: &quot;{appliedCloudCredName}&quot;
                      {appliedCloudCredProvider ? ` (${appliedCloudCredProvider.toUpperCase()})` : ''}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          </CardBody>
        </Card>
      )}

      {!suppressOptionalSection && (
        <ExpandableSection
          style={{ marginTop: '1.5rem' }}
          toggleText="Optional Parameters"
          isExpanded={showOptionalFields}
          onToggle={(_event, isExpanded) => onToggleOptional(isExpanded)}
        >
          <Card>
            <CardBody>
              {appliedCloudCredName && (
                <FormHelperText style={{ marginBottom: '1rem' }}>
                  <HelperText>
                    <HelperTextItem variant="success">
                      Cloud credential active: &quot;{appliedCloudCredName}&quot;
                      {appliedCloudCredProvider ? ` (${appliedCloudCredProvider.toUpperCase()})` : ''} — matching fields below are disabled and injected automatically
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
              {visibleOptionalFields.length > 0 ? (
                <DynamicFormBuilder
                  fields={visibleOptionalFields}
                  values={formValues}
                  onChange={onFormChange}
                  disabledFields={cloudDisabledFields}
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
            {visibleRequiredGlobalFields.length > 0 && (
              <Card style={{ marginBottom: '1rem' }}>
                <CardTitle>Required Global Parameters</CardTitle>
                <CardBody>
                  <DynamicFormBuilderWithTracking
                    fields={visibleRequiredGlobalFields}
                    values={globalFormValues}
                    touchedFields={globalTouchedFields}
                    onChange={onGlobalFormChange}
                    disabledFields={disabledFields}
                  />
                </CardBody>
              </Card>
            )}
            {visibleOptionalGlobalFields.length > 0 && (
              <Card>
                <CardTitle>Optional Global Parameters</CardTitle>
                <CardBody>
                  <DynamicFormBuilderWithTracking
                    fields={visibleOptionalGlobalFields}
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
