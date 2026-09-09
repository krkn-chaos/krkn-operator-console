import { useEffect, useState } from 'react';
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
import { signatureVerificationApi } from '../services/signatureVerificationApi';

export function SignatureVerificationSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingEnable, setPendingEnable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      setLoading(true);
      try {
        const settings = await signatureVerificationApi.getSettings();
        if (mounted) setEnabled(settings.enabled);
      } catch (error) {
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to load image signature verification setting.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const updateSetting = async (nextEnabled: boolean) => {
    setError(null);
    setSaving(true);
    try {
      const settings = await signatureVerificationApi.updateSettings(nextEnabled);
      setEnabled(settings.enabled);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update image signature verification setting.');
    } finally {
      setSaving(false);
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

        {loading ? (
          <Bullseye style={{ minHeight: '4rem' }}>
            <Spinner aria-label="Loading image signature verification setting" />
          </Bullseye>
        ) : (
          <Switch
            id="signature-verification-switch"
            label="Require valid image signatures"
            labelOff="Allow unverified scenario images"
            isChecked={enabled === true}
            isDisabled={saving || enabled === null}
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
              isDisabled={saving}
            >
              Disable verification
            </Button>,
            <Button key="cancel" variant="link" onClick={() => setPendingEnable(false)} isDisabled={saving}>
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
