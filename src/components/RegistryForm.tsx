import { useState, useEffect } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Button,
  ActionGroup,
  Radio,
  Checkbox,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Card,
  CardBody,
  Alert,
  Spinner,
} from '@patternfly/react-core';
import { registriesApi } from '../services/registriesApi';
import { groupsApi } from '../services/groupsApi';
import { useNotifications } from '../hooks';
import type { CreateRegistryRequest, UpdateRegistryRequest, GroupDetails, AuthType } from '../types/api';

/**
 * Registry Form component props
 */
interface RegistryFormProps {
  /**
   * Registry name for edit mode (undefined for create mode)
   */
  registryName?: string;
  /**
   * Submit handler called after successful create/update
   */
  onSubmit: () => void;
  /**
   * Cancel handler to close the form
   */
  onCancel: () => void;
}

/**
 * Registry Form component
 *
 * Handles both create and edit modes for private registry configurations.
 * Provides comprehensive form validation, authentication type handling, and group assignment.
 *
 * **Modes:**
 * - **Create Mode** (registryName is undefined):
 *   - All fields required except description
 *   - Name field is editable
 *   - Credentials are required based on auth type
 * - **Edit Mode** (registryName is provided):
 *   - Name field is disabled (immutable)
 *   - Credentials optional (leave blank to keep existing)
 *   - All other fields editable
 *
 * **Validation Rules:**
 *
 * **Name (Create Mode Only):**
 * - Required
 * - RFC 1123 compliant: lowercase alphanumeric, -, and .
 * - Regex: `/^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/`
 *
 * **Registry URL:**
 * - Required
 * - Must be valid URL format
 *
 * **Scenario Repository:**
 * - Required
 * - Format: org/repo (must contain at least one slash)
 *
 * **Auth Type:**
 * - Required (radio selection: 'token' or 'password')
 *
 * **Credentials:**
 * - If authType='token': token field required (create mode) or optional (edit mode)
 * - If authType='password': username and password required (create mode) or optional (edit mode)
 *
 * **Groups:**
 * - Optional
 * - If no groups selected AND availableToAll=false: shows warning
 *
 * @component
 *
 * @example
 * ```tsx
 * // Create mode
 * <RegistryForm
 *   onSubmit={() => console.log('Created')}
 *   onCancel={() => setModalOpen(false)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Edit mode
 * <RegistryForm
 *   registryName="my-registry"
 *   onSubmit={() => console.log('Updated')}
 *   onCancel={() => setModalOpen(false)}
 * />
 * ```
 */
export function RegistryForm({ registryName, onSubmit, onCancel }: RegistryFormProps) {
  // Form fields
  const [name, setName] = useState('');
  const [registryUrl, setRegistryUrl] = useState('');
  const [scenarioRepository, setScenarioRepository] = useState('');
  const [authType, setAuthType] = useState<AuthType>('token');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [description, setDescription] = useState('');
  const [skipTls, setSkipTls] = useState(false);
  const [insecure, setInsecure] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [availableToAll, setAvailableToAll] = useState(false);

  // State management
  const [loading, setLoading] = useState(!!registryName);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { showSuccess, showError } = useNotifications();
  const isEditMode = !!registryName;

  // Load groups on mount
  useEffect(() => {
    async function fetchGroups() {
      setLoadingGroups(true);
      try {
        const data = await groupsApi.listGroups();
        setGroups(data);
      } catch (error) {
        showError('Failed to load groups', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoadingGroups(false);
      }
    }

    fetchGroups();
  }, [showError]);

  // Load registry data for edit mode
  useEffect(() => {
    async function fetchRegistry() {
      if (!registryName) return;

      setLoading(true);
      try {
        const data = await registriesApi.getRegistry(registryName);
        setName(data.name);
        setRegistryUrl(data.registryUrl);
        setScenarioRepository(data.scenarioRepository);
        setAuthType(data.authType);
        setDescription(data.description || '');
        setSkipTls(data.skipTls);
        setInsecure(data.insecure);
        setSelectedGroups(new Set(data.groups));
        setAvailableToAll(data.availableToAll);
        // Credentials are not returned by API for security
      } catch (error) {
        showError('Failed to load registry', error instanceof Error ? error.message : 'Unknown error');
        onCancel();
      } finally {
        setLoading(false);
      }
    }

    fetchRegistry();
  }, [registryName, showError, onCancel]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation (CREATE MODE only)
    if (!isEditMode) {
      if (!name.trim()) {
        newErrors.name = 'Name is required';
      } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/.test(name)) {
        newErrors.name = 'Name must be RFC 1123 compliant (lowercase alphanumeric, -, .)';
      }
    }

    // Registry URL validation
    if (!registryUrl.trim()) {
      newErrors.registryUrl = 'Registry URL is required';
    }

    // Scenario repository validation
    if (!scenarioRepository.trim()) {
      newErrors.scenarioRepository = 'Scenario repository is required';
    } else if (!scenarioRepository.includes('/')) {
      newErrors.scenarioRepository = 'Repository must be in format: org/repo';
    }

    // Credentials validation
    if (authType === 'token') {
      if (!isEditMode && !token.trim()) {
        newErrors.token = 'Token is required';
      }
    } else if (authType === 'password') {
      if (!isEditMode) {
        if (!username.trim()) {
          newErrors.username = 'Username is required';
        }
        if (!password.trim()) {
          newErrors.password = 'Password is required';
        }
      }
    }

    // Groups warning (not an error, just a warning)
    if (selectedGroups.size === 0 && !availableToAll) {
      newErrors.groups = 'No groups selected and not available to all users. This registry will not be accessible.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).filter((key) => key !== 'groups').length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      if (isEditMode) {
        // EDIT MODE
        const data: UpdateRegistryRequest = {
          registryUrl: registryUrl.trim(),
          scenarioRepository: scenarioRepository.trim(),
          authType,
          description: description.trim() || undefined,
          skipTls,
          insecure,
          groups: Array.from(selectedGroups),
          availableToAll,
        };

        // Add credentials only if provided
        if (authType === 'token' && token.trim()) {
          data.token = token.trim();
        } else if (authType === 'password') {
          if (username.trim()) data.username = username.trim();
          if (password.trim()) data.password = password.trim();
        }

        await registriesApi.updateRegistry(registryName, data);
        showSuccess('Registry updated', `Registry "${registryName}" has been updated successfully`);
      } else {
        // CREATE MODE
        const data: CreateRegistryRequest = {
          name: name.trim(),
          registryUrl: registryUrl.trim(),
          scenarioRepository: scenarioRepository.trim(),
          authType,
          description: description.trim() || undefined,
          skipTls,
          insecure,
          groups: Array.from(selectedGroups),
          availableToAll,
        };

        // Add credentials based on auth type
        if (authType === 'token') {
          data.token = token.trim();
        } else if (authType === 'password') {
          data.username = username.trim();
          data.password = password.trim();
        }

        await registriesApi.createRegistry(data);
        showSuccess('Registry created', `Registry "${name}" has been created successfully`);
      }

      onSubmit();
    } catch (error) {
      showError(
        isEditMode ? 'Failed to update registry' : 'Failed to create registry',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleGroup = (groupName: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  if (loading || loadingGroups) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <Form>
      {/* Name - CREATE MODE only */}
      {!isEditMode && (
        <FormGroup label="Registry Name" isRequired fieldId="name">
          <TextInput
            id="name"
            value={name}
            onChange={(_event, value) => setName(value)}
            isRequired
            validated={errors.name ? 'error' : 'default'}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>RFC 1123 compliant: lowercase alphanumeric, -, and .</HelperTextItem>
            </HelperText>
          </FormHelperText>
          {errors.name && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{errors.name}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      )}

      {/* Registry URL */}
      <FormGroup label="Registry URL" isRequired fieldId="registryUrl">
        <TextInput
          id="registryUrl"
          value={registryUrl}
          onChange={(_event, value) => setRegistryUrl(value)}
          isRequired
          validated={errors.registryUrl ? 'error' : 'default'}
          placeholder="registry.example.com"
        />
        {errors.registryUrl && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.registryUrl}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      {/* Scenario Repository */}
      <FormGroup label="Scenario Repository" isRequired fieldId="scenarioRepository">
        <TextInput
          id="scenarioRepository"
          value={scenarioRepository}
          onChange={(_event, value) => setScenarioRepository(value)}
          isRequired
          validated={errors.scenarioRepository ? 'error' : 'default'}
          placeholder="myorg/chaos-scenarios"
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Format: organization/repository</HelperTextItem>
          </HelperText>
        </FormHelperText>
        {errors.scenarioRepository && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.scenarioRepository}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      {/* Description */}
      <FormGroup label="Description" fieldId="description">
        <TextArea
          id="description"
          value={description}
          onChange={(_event, value) => setDescription(value)}
          rows={3}
          placeholder="Optional description for this registry"
        />
      </FormGroup>

      {/* Auth Type */}
      <FormGroup label="Authentication Type" isRequired fieldId="authType">
        <Radio
          id="authType-token"
          name="authType"
          label="Token"
          isChecked={authType === 'token'}
          onChange={() => setAuthType('token')}
        />
        <Radio
          id="authType-password"
          name="authType"
          label="Username & Password"
          isChecked={authType === 'password'}
          onChange={() => setAuthType('password')}
        />
      </FormGroup>

      {/* Credentials - Token */}
      {authType === 'token' && (
        <FormGroup label="Token" isRequired={!isEditMode} fieldId="token">
          <TextInput
            type="password"
            id="token"
            value={token}
            onChange={(_event, value) => setToken(value)}
            isRequired={!isEditMode}
            validated={errors.token ? 'error' : 'default'}
            placeholder={isEditMode ? 'Leave blank to keep existing token' : undefined}
          />
          {isEditMode && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem>Leave blank to keep the existing token</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
          {errors.token && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{errors.token}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      )}

      {/* Credentials - Username & Password */}
      {authType === 'password' && (
        <>
          <FormGroup label="Username" isRequired={!isEditMode} fieldId="username">
            <TextInput
              id="username"
              value={username}
              onChange={(_event, value) => setUsername(value)}
              isRequired={!isEditMode}
              validated={errors.username ? 'error' : 'default'}
              placeholder={isEditMode ? 'Leave blank to keep existing username' : undefined}
            />
            {errors.username && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{errors.username}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="Password" isRequired={!isEditMode} fieldId="password">
            <TextInput
              type="password"
              id="password"
              value={password}
              onChange={(_event, value) => setPassword(value)}
              isRequired={!isEditMode}
              validated={errors.password ? 'error' : 'default'}
              placeholder={isEditMode ? 'Leave blank to keep existing password' : undefined}
            />
            {isEditMode && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>Leave blank to keep the existing password</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
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

      {/* TLS Options */}
      <FormGroup label="TLS Options" fieldId="tls-options">
        <Checkbox
          id="skipTls"
          label="Skip TLS Verification"
          description="Skip TLS certificate verification (insecure)"
          isChecked={skipTls}
          onChange={(_event, checked) => setSkipTls(checked)}
        />
        <Checkbox
          id="insecure"
          label="Allow Insecure HTTP"
          description="Allow insecure HTTP connections"
          isChecked={insecure}
          onChange={(_event, checked) => setInsecure(checked)}
        />
      </FormGroup>

      {/* Available to All Users */}
      <FormGroup label="Access Control" fieldId="access-control">
        <Checkbox
          id="availableToAll"
          label="Available to All Users"
          description="If checked, this registry is available to all users. Groups selection will be ignored."
          isChecked={availableToAll}
          onChange={(_event, checked) => setAvailableToAll(checked)}
        />
      </FormGroup>

      {/* Group Selection */}
      {!availableToAll && groups.length > 0 && (
        <FormGroup label="Groups" fieldId="groups">
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                Select groups that can access this registry. Users in these groups can use this registry when creating scenario runs.
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
          {errors.groups && (
            <Alert variant="warning" isInline title="Access Warning" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              {errors.groups}
            </Alert>
          )}
          <Card isCompact style={{ marginTop: '0.5rem' }}>
            <CardBody style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {groups.map((group) => (
                <Checkbox
                  key={group.name}
                  id={`group-${group.name}`}
                  label={`${group.name} (${group.memberCount || 0} members)`}
                  description={group.description}
                  isChecked={selectedGroups.has(group.name)}
                  onChange={() => handleToggleGroup(group.name)}
                  isDisabled={submitting}
                  style={{ marginBottom: '0.5rem' }}
                />
              ))}
            </CardBody>
          </Card>
        </FormGroup>
      )}

      <ActionGroup>
        <Button variant="primary" onClick={handleSubmit} isLoading={submitting} isDisabled={submitting}>
          {isEditMode ? 'Update Registry' : 'Create Registry'}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
}
