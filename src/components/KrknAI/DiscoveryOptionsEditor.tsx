import { Alert, Card, CardBody, CardTitle, FormGroup, TextInput } from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import type { DiscoveryOptions, DiscoveryOptionErrors } from './discoveryOptions';

interface DiscoveryOptionsEditorProps {
  options: DiscoveryOptions;
  errors: DiscoveryOptionErrors;
  onChange: (field: keyof DiscoveryOptions, value: string) => void;
}

export function DiscoveryOptionsEditor({ options, errors, onChange }: DiscoveryOptionsEditorProps) {
  return (
    <Card>
      <CardTitle>
        <div className="krkn-ai-config-wizard__title">
          <span className="krkn-ai-config-wizard__title-icon" aria-hidden="true"><SearchIcon /></span>
          <span>Discovery options</span>
        </div>
      </CardTitle>
      <CardBody>
        <Alert variant="info" title="Scope the live discovery request" isInline>
          Patterns are sent to Krkn AI when discovery runs. Use comma-separated patterns and <code>!</code> exclusions; an empty namespace pattern discovers no namespaces.
        </Alert>
        <div className="krkn-ai-config-fields">
          <FormGroup label="Namespace pattern" fieldId="krkn-ai-discovery-namespace-pattern" isRequired>
            <TextInput
              id="krkn-ai-discovery-namespace-pattern"
              value={options.namespacePattern}
              onChange={(_event, value) => onChange('namespacePattern', value)}
              validated={errors.namespacePattern ? 'error' : 'default'}
              aria-invalid={!!errors.namespacePattern}
            />
            {errors.namespacePattern && <p className="krkn-ai-field-error" role="alert">{errors.namespacePattern}</p>}
          </FormGroup>
          <FormGroup label="Pod label-key pattern" fieldId="krkn-ai-discovery-pod-label-pattern" isRequired>
            <TextInput
              id="krkn-ai-discovery-pod-label-pattern"
              value={options.podLabelPattern}
              onChange={(_event, value) => onChange('podLabelPattern', value)}
              validated={errors.podLabelPattern ? 'error' : 'default'}
              aria-invalid={!!errors.podLabelPattern}
            />
            {errors.podLabelPattern && <p className="krkn-ai-field-error" role="alert">{errors.podLabelPattern}</p>}
          </FormGroup>
          <FormGroup label="Node label-key pattern" fieldId="krkn-ai-discovery-node-label-pattern" isRequired>
            <TextInput
              id="krkn-ai-discovery-node-label-pattern"
              value={options.nodeLabelPattern}
              onChange={(_event, value) => onChange('nodeLabelPattern', value)}
              validated={errors.nodeLabelPattern ? 'error' : 'default'}
              aria-invalid={!!errors.nodeLabelPattern}
            />
            {errors.nodeLabelPattern && <p className="krkn-ai-field-error" role="alert">{errors.nodeLabelPattern}</p>}
          </FormGroup>
        </div>
      </CardBody>
    </Card>
  );
}
