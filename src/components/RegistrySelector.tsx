import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Form,
  FormGroup,
  Radio,
  Button,
  ActionGroup,
  Spinner,
  Alert,
  FormSelect,
  FormSelectOption,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { RegistryIcon } from '@patternfly/react-icons';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import { registriesApi } from '../services/registriesApi';
import type { ScenariosRequest, RegistryDetails } from '../types/api';

/**
 * RegistrySelector component
 *
 * Allows users to select a container registry for loading chaos scenarios.
 * Users can choose between the public quay.io registry or a configured private registry.
 *
 * **Registry Options:**
 * - Public Registry: Default quay.io/krkn-chaos repository (no authentication required)
 * - Private Registry: Select from pre-configured registries (admin must configure first)
 *
 * **Workflow:**
 * 1. User selects registry type (public or private)
 * 2. If private, user selects from available registries
 * 3. Component fetches scenarios from the selected registry
 * 4. Dispatches REGISTRY_CONFIGURED and SCENARIOS_SUCCESS actions
 *
 * @component
 */
export function RegistrySelector() {
  const { dispatch } = useAppContext();
  const [registryType, setRegistryType] = useState<'public' | 'private'>('public');
  const [selectedRegistryName, setSelectedRegistryName] = useState<string>('');
  const [availableRegistries, setAvailableRegistries] = useState<RegistryDetails[]>([]);
  const [loadingRegistries, setLoadingRegistries] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load available registries when component mounts
  useEffect(() => {
    async function fetchRegistries() {
      setLoadingRegistries(true);
      setRegistryError(null);
      try {
        const registries = await registriesApi.listRegistries();
        setAvailableRegistries(registries);

        // Auto-select first registry if available
        if (registries.length > 0) {
          setSelectedRegistryName(registries[0].name);
        }
      } catch (error) {
        setRegistryError(error instanceof Error ? error.message : 'Failed to load registries');
      } finally {
        setLoadingRegistries(false);
      }
    }

    fetchRegistries();
  }, []);

  const handleSubmit = async () => {
    setIsLoading(true);

    // Build request payload
    const request: ScenariosRequest = {};

    if (registryType === 'private') {
      if (!selectedRegistryName) {
        setIsLoading(false);
        return;
      }
      request.registryName = selectedRegistryName;
    }
    // If public, registryName is undefined → backend defaults to quay.io

    // Dispatch configuration
    dispatch({
      type: 'REGISTRY_CONFIGURED',
      payload: {
        registryType,
        registryConfig: request,
      },
    });

    // Start loading scenarios
    dispatch({ type: 'SCENARIOS_LOADING' });

    try {
      const response = await operatorApi.getScenarios(request);
      dispatch({
        type: 'SCENARIOS_SUCCESS',
        payload: { scenarios: response.scenarios },
      });
    } catch (error) {
      dispatch({
        type: 'SCENARIOS_ERROR',
        payload: {
          message: error instanceof Error ? error.message : 'Failed to load scenarios',
          type: 'api_error',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    if (registryType === 'public') return true;
    return selectedRegistryName !== '';
  };

  const handleCancel = () => {
    dispatch({ type: 'CANCEL_WORKFLOW' });
  };

  return (
    <Card>
      <CardTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Configure Chaos Scenarios Registry</span>
          <Button variant="link" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </CardTitle>
      <CardBody>
        <Form>
          <FormGroup label="Registry Type" isRequired fieldId="registry-type">
            <Radio
              id="public-registry"
              name="registry-type"
              label="Public Registry (quay.io/krkn-chaos)"
              description="Use the default public registry with pre-built chaos scenarios"
              isChecked={registryType === 'public'}
              onChange={() => setRegistryType('public')}
            />
            <Radio
              id="private-registry"
              name="registry-type"
              label="Private Registry"
              description="Use a configured private container registry"
              isChecked={registryType === 'private'}
              onChange={() => setRegistryType('private')}
            />
          </FormGroup>

          {registryType === 'private' && (
            <>
              {loadingRegistries && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Spinner size="lg" />
                  <div style={{ marginTop: '1rem' }}>Loading available registries...</div>
                </div>
              )}

              {registryError && (
                <Alert variant="danger" title="Failed to load registries" isInline>
                  {registryError}
                </Alert>
              )}

              {!loadingRegistries && !registryError && availableRegistries.length === 0 && (
                <EmptyState>
                  <EmptyStateIcon icon={RegistryIcon} />
                  <Title headingLevel="h3" size="lg">
                    No private registries configured
                  </Title>
                  <EmptyStateBody>
                    Ask your administrator to configure a private registry in Settings → Private Registries before
                    you can use private scenario repositories.
                  </EmptyStateBody>
                </EmptyState>
              )}

              {!loadingRegistries && availableRegistries.length > 0 && (
                <FormGroup label="Select Registry" isRequired fieldId="registry-select">
                  <FormSelect
                    id="registry-select"
                    value={selectedRegistryName}
                    onChange={(_event, value) => setSelectedRegistryName(value as string)}
                    aria-label="Select private registry"
                  >
                    {availableRegistries.map((registry) => (
                      <FormSelectOption
                        key={registry.name}
                        value={registry.name}
                        label={`${registry.name} (${registry.registryUrl}/${registry.scenarioRepository})`}
                      />
                    ))}
                  </FormSelect>
                  {selectedRegistryName && (
                    <div style={{ marginTop: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                      {availableRegistries.find((r) => r.name === selectedRegistryName)?.description ||
                        'No description'}
                    </div>
                  )}
                </FormGroup>
              )}
            </>
          )}

          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isDisabled={!isFormValid() || isLoading || (registryType === 'private' && loadingRegistries)}
              isLoading={isLoading}
            >
              {isLoading ? 'Loading Scenarios...' : 'Load Scenarios'}
            </Button>
          </ActionGroup>
        </Form>
      </CardBody>
    </Card>
  );
}
