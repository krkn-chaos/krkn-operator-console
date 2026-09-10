import { useEffect, useState } from 'react';
import { signatureVerificationApi } from '../services/signatureVerificationApi';

export function useSignatureVerification() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    signatureVerificationApi.getSettings()
      .then((settings) => {
        if (mounted) {
          setEnabled(settings.enabled);
          setError(null);
        }
      })
      .catch((reason) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load image signature verification setting.');
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return {
    enabled,
    error,
    isLoading,
    isReady: enabled !== null && error === null,
  };
}
