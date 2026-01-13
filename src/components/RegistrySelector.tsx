import { useState } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Form,
  FormGroup,
  Radio,
  TextInput,
  Button,
  Checkbox,
  ActionGroup,
} from '@patternfly/react-core';
import { useAppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import type { ScenariosRequest } from '../types/api';

export function RegistrySelector() {
  const { dispatch } = useAppContext();
  const [registryType, setRegistryType] = useState<'public' | 'private'>('public');
  const [authMethod, setAuthMethod] = useState<'credentials' | 'token'>('credentials');

  // Form fields for private registry
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [registryUrl, setRegistryUrl] = useState('');
  const [scenarioRepository, setScenarioRepository] = useState('');
  const [skipTls, setSkipTls] = useState(false);
  const [insecure, setInsecure] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);

    // Build request payload
    const request: ScenariosRequest = {};

    if (registryType === 'private') {
      if (authMethod === 'credentials') {
        request.username = username || undefined;
        request.password = password || undefined;
      } else {
        request.token = token || undefined;
      }
      request.registryUrl = registryUrl || undefined;
      request.scenarioRepository = scenarioRepository || undefined;
      request.skipTls = skipTls;
      request.insecure = insecure;
    }

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

    // Private registry validation
    if (!registryUrl || !scenarioRepository) return false;

    if (authMethod === 'credentials') {
      return username.trim() !== '' && password.trim() !== '';
    } else {
      return token.trim() !== '';
    }
  };

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  return (
    <Card>
      <CardTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Configure Chaos Scenarios Registry</span>
          <Button variant="link" onClick={handleBack}>
            ← Back to Nodes
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
              description="Connect to a custom private container registry"
              isChecked={registryType === 'private'}
              onChange={() => setRegistryType('private')}
            />
          </FormGroup>

          {registryType === 'private' && (
            <>
              <FormGroup label="Registry URL" isRequired fieldId="registry-url">
                <TextInput
                  id="registry-url"
                  type="text"
                  value={registryUrl}
                  onChange={(_event, value) => setRegistryUrl(value)}
                  placeholder="https://registry.example.com"
                />
              </FormGroup>

              <FormGroup label="Scenario Repository" isRequired fieldId="scenario-repository">
                <TextInput
                  id="scenario-repository"
                  type="text"
                  value={scenarioRepository}
                  onChange={(_event, value) => setScenarioRepository(value)}
                  placeholder="my-org/chaos-scenarios"
                />
              </FormGroup>

              <FormGroup label="Authentication Method" isRequired fieldId="auth-method">
                <Radio
                  id="auth-credentials"
                  name="auth-method"
                  label="Username & Password"
                  isChecked={authMethod === 'credentials'}
                  onChange={() => setAuthMethod('credentials')}
                />
                <Radio
                  id="auth-token"
                  name="auth-method"
                  label="Token"
                  isChecked={authMethod === 'token'}
                  onChange={() => setAuthMethod('token')}
                />
              </FormGroup>

              {authMethod === 'credentials' ? (
                <>
                  <FormGroup label="Username" isRequired fieldId="username">
                    <TextInput
                      id="username"
                      type="text"
                      value={username}
                      onChange={(_event, value) => setUsername(value)}
                      placeholder="username"
                    />
                  </FormGroup>
                  <FormGroup label="Password" isRequired fieldId="password">
                    <TextInput
                      id="password"
                      type="password"
                      value={password}
                      onChange={(_event, value) => setPassword(value)}
                      placeholder="password"
                    />
                  </FormGroup>
                </>
              ) : (
                <FormGroup label="Token" isRequired fieldId="token">
                  <TextInput
                    id="token"
                    type="password"
                    value={token}
                    onChange={(_event, value) => setToken(value)}
                    placeholder="registry token"
                  />
                </FormGroup>
              )}

              <FormGroup fieldId="tls-options">
                <Checkbox
                  id="skip-tls"
                  label="Skip TLS Verification"
                  description="Skip TLS certificate verification (not recommended for production)"
                  isChecked={skipTls}
                  onChange={(_event, checked) => setSkipTls(checked)}
                />
                <Checkbox
                  id="insecure"
                  label="Allow Insecure Connections"
                  description="Allow insecure (HTTP) connections to the registry"
                  isChecked={insecure}
                  onChange={(_event, checked) => setInsecure(checked)}
                />
              </FormGroup>
            </>
          )}

          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isDisabled={!isFormValid() || isLoading}
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
