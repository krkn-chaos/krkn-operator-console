import {
  Card,
  CardTitle,
  CardBody,
  Title,
  Divider,
} from '@patternfly/react-core';
import { DynamicFormBuilderWithTracking } from './DynamicFormBuilderWithTracking';
import { groupGlobalFields } from '../utils/globalFieldGroups';
import type { ScenarioField, ScenarioFormValues, TouchedFields } from '../types/api';

interface GlobalParametersSectionsProps {
  fields: ScenarioField[];
  values: ScenarioFormValues;
  touchedFields: TouchedFields;
  onChange: (values: ScenarioFormValues, touchedFields: TouchedFields) => void;
}

/**
 * Renders global scenario fields grouped into semantic sections (Elasticsearch,
 * Cerberus, Telemetry, etc.) based on variable name prefixes. Within each section,
 * required and optional fields are shown as subsections when both are present.
 */
export function GlobalParametersSections({
  fields,
  values,
  touchedFields,
  onChange,
}: GlobalParametersSectionsProps) {
  const sections = groupGlobalFields(fields);

  return (
    <>
      {sections.map(section => {
        const required = section.fields.filter(f => f.required);
        const optional = section.fields.filter(f => !f.required);
        const hasBoth = required.length > 0 && optional.length > 0;

        return (
          <Card key={section.key} style={{ marginTop: '1.5rem' }}>
            <CardTitle>{section.title}</CardTitle>
            <CardBody>
              {required.length > 0 && (
                <>
                  {hasBoth && (
                    <Title headingLevel="h4" size="md" style={{ marginBottom: '1rem' }}>
                      Required
                    </Title>
                  )}
                  <DynamicFormBuilderWithTracking
                    fields={required}
                    values={values}
                    touchedFields={touchedFields}
                    onChange={onChange}
                  />
                </>
              )}
              {hasBoth && <Divider style={{ margin: '1.5rem 0' }} />}
              {optional.length > 0 && (
                <>
                  {hasBoth && (
                    <Title headingLevel="h4" size="md" style={{ marginBottom: '1rem' }}>
                      Optional
                    </Title>
                  )}
                  <DynamicFormBuilderWithTracking
                    fields={optional}
                    values={values}
                    touchedFields={touchedFields}
                    onChange={onChange}
                  />
                </>
              )}
            </CardBody>
          </Card>
        );
      })}
    </>
  );
}
