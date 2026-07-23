import {
  Spinner,
  Card,
  CardTitle,
  CardBody,
  ExpandableSection,
} from '@patternfly/react-core';
import { DynamicFormBuilder } from './DynamicFormBuilder';
import { DynamicFormBuilderWithTracking } from './DynamicFormBuilderWithTracking';
import type { ScenarioField, ScenarioFormValues, TouchedFields } from '../types/api';

interface ScenarioParameterSectionsProps {
  optionalFields: ScenarioField[];
  formValues: ScenarioFormValues;
  onFormChange: (values: ScenarioFormValues) => void;
  requiredGlobalFields: ScenarioField[];
  optionalGlobalFields: ScenarioField[];
  globalFormValues: ScenarioFormValues;
  globalTouchedFields: TouchedFields;
  onGlobalFormChange: (values: ScenarioFormValues, touchedFields: TouchedFields) => void;
  loadingGlobals: boolean;
  showOptionalFields: boolean;
  onToggleOptional: (isExpanded: boolean) => void;
  showGlobalParameters: boolean;
  onToggleGlobal: (isExpanded: boolean) => void;
}

export function ScenarioParameterSections({
  optionalFields,
  formValues,
  onFormChange,
  requiredGlobalFields,
  optionalGlobalFields,
  globalFormValues,
  globalTouchedFields,
  onGlobalFormChange,
  loadingGlobals,
  showOptionalFields,
  onToggleOptional,
  showGlobalParameters,
  onToggleGlobal,
}: ScenarioParameterSectionsProps) {
  return (
    <>
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
        ) : (requiredGlobalFields.length > 0 || optionalGlobalFields.length > 0) ? (
          <>
            {requiredGlobalFields.length > 0 && (
              <Card style={{ marginBottom: '1rem' }}>
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
            {optionalGlobalFields.length > 0 && (
              <Card>
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
      </ExpandableSection>
    </>
  );
}
