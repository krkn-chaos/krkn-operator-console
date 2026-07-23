import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardExpandableContent,
  Title,
  Divider,
} from '@patternfly/react-core';
import { DynamicFormBuilderWithTracking } from './DynamicFormBuilderWithTracking';
import { groupGlobalFields } from '../utils/globalFieldGroups';
import type { ScenarioField, FieldGroup, ScenarioFormValues, TouchedFields } from '../types/api';

interface GlobalParametersSectionsProps {
  fields: ScenarioField[];
  groups: FieldGroup[];
  values: ScenarioFormValues;
  touchedFields: TouchedFields;
  onChange: (values: ScenarioFormValues, touchedFields: TouchedFields) => void;
}

/**
 * Renders global scenario fields grouped into collapsible sections using the
 * groups returned by the API. Within each section, required and optional fields
 * are shown as subsections when both are present.
 */
export function GlobalParametersSections({
  fields,
  groups,
  values,
  touchedFields,
  onChange,
}: GlobalParametersSectionsProps) {
  const sections = groupGlobalFields(fields, groups);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      {sections.map(section => {
        const isExpanded = expanded[section.key] ?? false;
        const required = section.fields.filter(f => f.required);
        const optional = section.fields.filter(f => !f.required);
        const hasBoth = required.length > 0 && optional.length > 0;

        return (
          <Card key={section.key} isExpanded={isExpanded} style={{ marginTop: '1.5rem' }}>
            <CardHeader
              onExpand={() => toggle(section.key)}
              toggleButtonProps={{
                id: `toggle-${section.key}`,
                'aria-label': `Toggle ${section.title}`,
                'aria-expanded': isExpanded,
              }}
            >
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardExpandableContent>
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
            </CardExpandableContent>
          </Card>
        );
      })}
    </>
  );
}
