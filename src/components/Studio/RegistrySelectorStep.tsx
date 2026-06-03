/**
 * RegistrySelectorStep - Registry selection for wizard (controlled component)
 *
 * Adapted from RegistrySelector but as a controlled component
 * for use in the Studio node configuration wizard.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Form,
  FormGroup,
  Radio,
  FormSelect,
  FormSelectOption,
  Spinner,
  Alert,
} from '@patternfly/react-core';
import { registriesApi } from '../../services/registriesApi';
import type { AvailableRegistry } from '../../types/api';

interface RegistrySelectorStepProps {
  registryType: 'public' | 'private';
  registryName: string; // PRIMITIVE instead of object
  onRegistryTypeChange: (type: 'public' | 'private') => void;
  onRegistryNameChange: (name: string) => void; // PRIMITIVE callback
}

export function RegistrySelectorStep({
  registryType,
  registryName,
  onRegistryTypeChange,
  onRegistryNameChange,
}: RegistrySelectorStepProps) {
  const [availableRegistries, setAvailableRegistries] = useState<AvailableRegistry[]>([]);
  const [loadingRegistries, setLoadingRegistries] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const hasAutoSelected = useRef(false);

  // Load available registries when component mounts
  useEffect(() => {
    async function fetchRegistries() {
      setLoadingRegistries(true);
      setRegistryError(null);
      try {
        const registries = await registriesApi.getAvailableRegistries();
        setAvailableRegistries(registries);

        // Auto-select first registry ONLY if:
        // - We're in private mode
        // - No registry is currently selected
        // - We haven't auto-selected yet (prevent loop)
        if (
          registryType === 'private' &&
          registries.length > 0 &&
          !registryName &&
          !hasAutoSelected.current
        ) {
          hasAutoSelected.current = true;
          onRegistryNameChange(registries[0].name);
        }
      } catch (error) {
        setRegistryError(error instanceof Error ? error.message : 'Failed to load registries');
      } finally {
        setLoadingRegistries(false);
      }
    }

    fetchRegistries();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset auto-select flag when switching registry types
  useEffect(() => {
    hasAutoSelected.current = false;
  }, [registryType]);

  return (
    <Form>
      <FormGroup label="Registry Type" isRequired>
        <Radio
          isChecked={registryType === 'public'}
          name="registryType"
          onChange={() => {
            onRegistryTypeChange('public');
            // onRegistryTypeChange handles config reset and fetch
          }}
          label="Public Registry (quay.io/krkn-chaos)"
          id="registry-public"
          description="Use the public Krkn Chaos scenarios from quay.io"
        />
        <Radio
          isChecked={registryType === 'private'}
          name="registryType"
          onChange={() => onRegistryTypeChange('private')}
          label="Private Registry"
          id="registry-private"
          description="Use scenarios from a configured private registry"
          style={{ marginTop: '1rem' }}
        />
      </FormGroup>

      {registryType === 'private' && (
        <FormGroup label="Select Registry" isRequired>
          {loadingRegistries ? (
            <Spinner size="md" aria-label="Loading registries" />
          ) : registryError ? (
            <Alert variant="danger" isInline title="Failed to load registries">
              {registryError}
            </Alert>
          ) : availableRegistries.length === 0 ? (
            <Alert variant="warning" isInline title="No private registries configured">
              Contact your administrator to configure private registries.
            </Alert>
          ) : (
            <FormSelect
              value={registryName}
              onChange={(_event, value) => onRegistryNameChange(value)}
              aria-label="Select private registry"
            >
              {availableRegistries.map((registry) => (
                <FormSelectOption
                  key={registry.name}
                  value={registry.name}
                  label={`${registry.name} (${registry.registryUrl})`}
                />
              ))}
            </FormSelect>
          )}
        </FormGroup>
      )}
    </Form>
  );
}
