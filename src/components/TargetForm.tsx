import { useState } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Button,
  ActionGroup,
  Radio,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import type { CreateTargetRequest, SecretType, TargetResponse } from '../types/api';

interface TargetFormProps {
  initialData?: TargetResponse;
  onSubmit: (data: CreateTargetRequest) => Promise<void>;
  onCancel: () => void;
}

export function TargetForm({ initialData, onSubmit, onCancel }: TargetFormProps) {
  const [clusterName, setClusterName] = useState(initialData?.clusterName || '');
  const [secretType, setSecretType] = useState<SecretType>('kubeconfig');
  const [clusterAPIURL, setClusterAPIURL] = useState(initialData?.clusterAPIURL || '');
  const [caBundle, setCaBundle] = useState('');
  const [kubeconfig, setKubeconfig] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!clusterName.trim()) {
      newErrors.clusterName = 'Cluster name is required';
    }

    switch (secretType) {
      case 'kubeconfig':
        if (!kubeconfig.trim()) {
          newErrors.kubeconfig = 'Kubeconfig is required for kubeconfig auth';
        }
        break;

      case 'token':
        if (!token.trim()) {
          newErrors.token = 'Token is required for token auth';
        }
        if (!clusterAPIURL.trim()) {
          newErrors.clusterAPIURL = 'Cluster API URL is required for token auth';
        }
        break;

      case 'credentials':
        if (!username.trim()) {
          newErrors.username = 'Username is required for credentials auth';
        }
        if (!password.trim()) {
          newErrors.password = 'Password is required for credentials auth';
        }
        if (!clusterAPIURL.trim()) {
          newErrors.clusterAPIURL = 'Cluster API URL is required for credentials auth';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    const data: CreateTargetRequest = {
      clusterName: clusterName.trim(),
      secretType,
    };

    switch (secretType) {
      case 'kubeconfig':
        // Convert to base64 if not already
        const kubeconfigContent = kubeconfig.trim();
        try {
          // Check if it's already base64
          atob(kubeconfigContent);
          data.kubeconfig = kubeconfigContent;
        } catch {
          // Not base64, encode it
          data.kubeconfig = btoa(kubeconfigContent);
        }
        break;

      case 'token':
        data.token = token.trim();
        data.clusterAPIURL = clusterAPIURL.trim();
        if (caBundle.trim()) {
          try {
            atob(caBundle.trim());
            data.caBundle = caBundle.trim();
          } catch {
            data.caBundle = btoa(caBundle.trim());
          }
        }
        break;

      case 'credentials':
        data.username = username.trim();
        data.password = password.trim();
        data.clusterAPIURL = clusterAPIURL.trim();
        if (caBundle.trim()) {
          try {
            atob(caBundle.trim());
            data.caBundle = caBundle.trim();
          } catch {
            data.caBundle = btoa(caBundle.trim());
          }
        }
        break;
    }

    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form>
      <FormGroup label="Cluster Name" isRequired fieldId="cluster-name">
        <TextInput
          id="cluster-name"
          value={clusterName}
          onChange={(_event, value) => setClusterName(value)}
          isRequired
          validated={errors.clusterName ? 'error' : 'default'}
        />
        {errors.clusterName && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.clusterName}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Authentication Type" isRequired fieldId="secret-type">
        <Radio
          id="type-kubeconfig"
          name="secret-type"
          label="Kubeconfig"
          isChecked={secretType === 'kubeconfig'}
          onChange={() => setSecretType('kubeconfig')}
        />
        <Radio
          id="type-token"
          name="secret-type"
          label="Service Account Token"
          isChecked={secretType === 'token'}
          onChange={() => setSecretType('token')}
        />
        <Radio
          id="type-credentials"
          name="secret-type"
          label="Username/Password"
          isChecked={secretType === 'credentials'}
          onChange={() => setSecretType('credentials')}
        />
      </FormGroup>

      {secretType === 'kubeconfig' && (
        <FormGroup label="Kubeconfig" isRequired fieldId="kubeconfig">
          <TextArea
            id="kubeconfig"
            value={kubeconfig}
            onChange={(_event, value) => setKubeconfig(value)}
            rows={10}
            isRequired
            validated={errors.kubeconfig ? 'error' : 'default'}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                Paste your kubeconfig file content here. It will be automatically base64-encoded.
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
          {errors.kubeconfig && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{errors.kubeconfig}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      )}

      {(secretType === 'token' || secretType === 'credentials') && (
        <>
          <FormGroup label="Cluster API URL" isRequired fieldId="cluster-api-url">
            <TextInput
              id="cluster-api-url"
              value={clusterAPIURL}
              onChange={(_event, value) => setClusterAPIURL(value)}
              placeholder="https://api.example.com:6443"
              isRequired
              validated={errors.clusterAPIURL ? 'error' : 'default'}
            />
            {errors.clusterAPIURL && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{errors.clusterAPIURL}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="CA Bundle (optional)" fieldId="ca-bundle">
            <TextArea
              id="ca-bundle"
              value={caBundle}
              onChange={(_event, value) => setCaBundle(value)}
              rows={5}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Optional CA certificate bundle for TLS verification. Will be base64-encoded automatically.
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </>
      )}

      {secretType === 'token' && (
        <FormGroup label="Service Account Token" isRequired fieldId="token">
          <TextArea
            id="token"
            value={token}
            onChange={(_event, value) => setToken(value)}
            rows={3}
            isRequired
            validated={errors.token ? 'error' : 'default'}
          />
          {errors.token && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{errors.token}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      )}

      {secretType === 'credentials' && (
        <>
          <FormGroup label="Username" isRequired fieldId="username">
            <TextInput
              id="username"
              value={username}
              onChange={(_event, value) => setUsername(value)}
              isRequired
              validated={errors.username ? 'error' : 'default'}
            />
            {errors.username && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{errors.username}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="Password" isRequired fieldId="password">
            <TextInput
              id="password"
              type="password"
              value={password}
              onChange={(_event, value) => setPassword(value)}
              isRequired
              validated={errors.password ? 'error' : 'default'}
            />
            {errors.password && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{errors.password}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        </>
      )}

      <ActionGroup>
        <Button variant="primary" onClick={handleSubmit} isLoading={submitting} isDisabled={submitting}>
          {initialData ? 'Update' : 'Create'}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
}
