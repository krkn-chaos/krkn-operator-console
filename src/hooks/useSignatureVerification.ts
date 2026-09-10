import { useCallback, useEffect, useState } from 'react';
import { signatureVerificationApi } from '../services/signatureVerificationApi';

export function useSignatureVerification() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);

    try {
      const settings = await signatureVerificationApi.getSettings();
      setEnabled(settings.enabled);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load image signature verification setting.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    const refresh = () => void loadSettings();
    window.addEventListener('signature-verification-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('signature-verification-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loadSettings]);

  const updateSettings = useCallback(async (nextEnabled: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const settings = await signatureVerificationApi.updateSettings(nextEnabled);
      setEnabled(settings.enabled);
      window.dispatchEvent(new Event('signature-verification-changed'));
      return settings;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to update image signature verification setting.';
      setError(message);
      throw reason;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    enabled,
    error,
    isLoading,
    isReady: enabled !== null && error === null,
    updateSettings,
  };
}
