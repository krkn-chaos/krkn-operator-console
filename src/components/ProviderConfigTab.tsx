import { useState } from 'react';
import {
  Form,
  Button,
  ActionGroup,
  Alert,
  Modal,
  ModalVariant,
} from '@patternfly/react-core';
import { DynamicFormBuilder } from './DynamicFormBuilder';
import { providersApi } from '../services/providersApi';
import { useAppContext } from '../context/AppContext';
import { useNotifications } from '../hooks/useNotifications';
import type { ScenarioFormValues } from '../types/api';
import type { ProviderInfo, ProviderSchema } from '../types/provider';

interface ProviderConfigTabProps {
  provider: ProviderInfo;
  schema: ProviderSchema | null; // null when no config or still loading
  uuid: string; // Provider config request UUID
}

export function ProviderConfigTab({ provider, schema, uuid }: ProviderConfigTabProps) {
  const { dispatch } = useAppContext();
  const { showSuccess, showError } = useNotifications();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<ScenarioFormValues>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schema || schema.fields.length === 0) {
      showError('No Configuration', 'This provider has no configurable fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Serialize all values to strings as required by API
      const serializedValues: { [key: string]: string } = {};
      Object.entries(formValues).forEach(([key, value]) => {
        serializedValues[key] = String(value);
      });

      await providersApi.submitProviderConfig(uuid, provider.name, serializedValues);

      dispatch({
        type: 'PROVIDER_CONFIG_SUBMIT_SUCCESS',
        payload: { providerName: provider.name }
      });

      // Show confirmation modal instead of notification
      setShowSuccessModal(true);
    } catch (error) {
      showError(
        'Failed to Save Configuration',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoHome = () => {
    setShowSuccessModal(false);
    // Go back to jobs list
    dispatch({ type: 'JOBS_LIST_READY' });
  };

  const handleReloadConfig = () => {
    setShowSuccessModal(false);
    // Reset provider config to trigger reload
    dispatch({ type: 'PROVIDER_CONFIG_RESET' });
  };

  const hasConfigFields = schema && schema.fields.length > 0;

  return (
    <div style={{ padding: '1rem' }}>
      <Form onSubmit={handleSubmit}>
        {/* Configuration Form (only if has fields) */}
        {hasConfigFields && (
          <>
            <Alert
              variant="info"
              title="Provider Configuration"
              style={{ marginBottom: '1rem' }}
            >
              ConfigMap: {schema.configMap} (Namespace: {schema.namespace})
            </Alert>

            <DynamicFormBuilder
              fields={schema.fields}
              values={formValues}
              onChange={setFormValues}
            />

            <ActionGroup>
              <Button
                variant="primary"
                type="submit"
                isLoading={isSubmitting}
                isDisabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Configuration'}
              </Button>
            </ActionGroup>
          </>
        )}

        {/* Empty state for provider with no config */}
        {!hasConfigFields && (
          <Alert variant="info" title="No Configuration Required">
            This provider does not require additional configuration.
          </Alert>
        )}
      </Form>

      {/* Success Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Configuration Applied"
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        actions={[
          <Button key="home" variant="primary" onClick={handleGoHome}>
            Yes, go to Home
          </Button>,
          <Button key="reload" variant="secondary" onClick={handleReloadConfig}>
            No, reload configuration
          </Button>
        ]}
      >
        Changes have been applied successfully. Do you want to return to the home page?
      </Modal>
    </div>
  );
}
