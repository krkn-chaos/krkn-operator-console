import {
  Spinner,
  Card,
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
}: ScenarioParameterSectionsProps) {
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
          <Card>
            <CardBody>
              <DynamicFormBuilderWithTracking
                fields={allGlobalFields}
                values={globalFormValues}
                touchedFields={globalTouchedFields}
                onChange={onGlobalFormChange}
              />
            </CardBody>
          </Card>
        ) : null}
      </ExpandableSection>
    </>
  );
}
