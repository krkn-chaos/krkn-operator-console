import { useState } from 'react';
import {
  Alert,
  Bullseye,
  Button,
  Card,
  CardBody,
  CardTitle,
  Modal,
  ModalVariant,
  Spinner,
  Switch,
  Title,
} from '@patternfly/react-core';
import { useSignatureVerification } from '../hooks/useSignatureVerification';

export function SignatureVerificationSettings() {
  const [pendingEnable, setPendingEnable] = useState(false);
  const { enabled, error, isLoading, updateSettings } = useSignatureVerification();

  const updateSetting = async (nextEnabled: boolean) => {
    try {
      await updateSettings(nextEnabled);
    } catch (error) {
      // The shared hook stores the error for rendering; keep the handler promise-safe.
    }
  };

  const handleChange = (_event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
    if (!checked) {
      setPendingEnable(true);
      return;
    }
    updateSetting(true);
  };

  return (
    <Card
      component="section"
      aria-labelledby="signature-verification-title"
      style={{ border: '2px solid var(--pf-v5-global--danger-color--100)', marginBottom: '1.5rem' }}
    >
      <CardTitle>
        <Title id="signature-verification-title" headingLevel="h2" size="lg">
          Danger Zone
        </Title>
      </CardTitle>
      <CardBody>
        <p>
          Image signature verification controls whether scenario images are trusted before execution.
          Disabling this security control allows unsigned or unverified images to run.
        </p>

        {error && (
          <Alert
            variant="danger"
            isInline
            title="Unable to update setting"
            style={{ marginBottom: '1rem' }}
          >
            {error}
          </Alert>
        )}

        {isLoading && enabled === null ? (
          <Bullseye style={{ minHeight: '4rem' }}>
            <Spinner aria-label="Loading image signature verification setting" />
          </Bullseye>
        ) : (
          <Switch
            id="signature-verification-switch"
            label="Require valid image signatures"
            labelOff="Allow unverified scenario images"
            isChecked={enabled === true}
            isDisabled={isLoading || enabled === null}
            onChange={handleChange}
            aria-label="Require valid image signatures"
          />
        )}

        <Modal
          variant={ModalVariant.small}
          title="Disable image signature verification?"
          isOpen={pendingEnable}
          onClose={() => setPendingEnable(false)}
          actions={[
            <Button
              key="confirm"
              variant="danger"
              onClick={() => {
                setPendingEnable(false);
                updateSetting(false);
              }}
              isDisabled={isLoading}
            >
              Disable verification
            </Button>,
            <Button key="cancel" variant="link" onClick={() => setPendingEnable(false)} isDisabled={isLoading}>
              Cancel
            </Button>,
          ]}
        >
          Disabling this setting enables the signature verification override. Unsigned or untrusted scenario images may then be executed.
          Confirm only if you understand and accept this security risk.
        </Modal>
      </CardBody>
    </Card>
  );
}
