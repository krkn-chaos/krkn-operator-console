import { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { providersApi } from '../services/providersApi';
import { parseSchema } from '../utils/schemaParser';
import { config } from '../config';
import type { ProviderSchema } from '../types/provider';

/**
 * Custom hook to poll provider config request status
 *
 * Workflow:
 * 1. Settings page creates config request → POST /provider-config → UUID
 * 2. Poll GET /provider-config/{uuid} until 200 OK (202 Accepted means pending)
 * 3. On 200 OK → Fetch full config data, parse schemas
 * 4. Dispatch PROVIDER_CONFIG_READY with normalized data
 */
export function useProviderConfigPoller() {
  const { state, dispatch } = useAppContext();
  const pollIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);

  // Poll: GET /provider-config/{uuid}
  useEffect(() => {
    if (state.providerConfigStatus !== 'polling' || !state.providerConfigUuid) {
      return;
    }

    const uuid = state.providerConfigUuid;
    pollStartTimeRef.current = Date.now();
    let attempt = 0;

    async function pollConfigStatus() {
      attempt++;

      // Check timeout (60 seconds)
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > config.pollTimeout) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        dispatch({
          type: 'PROVIDER_CONFIG_ERROR',
          payload: {
            error: 'Provider configuration polling timeout. The backend may need more time to collect schemas.'
          }
        });
        return;
      }

      try {
        const response = await providersApi.getProviderConfigStatus(uuid);
        const { status, data: configResponse } = response;

        if (status === 200) {
          // Success - data already received in status check
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }

          try {
            if (!configResponse) {
              throw new Error('No config data received from status check');
            }

            // Parse and normalize schemas
            const normalizedData: { [providerName: string]: ProviderSchema } = {};

            for (const [providerName, configData] of Object.entries(configResponse.config_data)) {
              // Parse the config-schema JSON string
              const fields = parseSchema(configData['config-schema']);

              normalizedData[providerName] = {
                configMap: configData['config-map'],
                namespace: configData.namespace,
                fields,
              };
            }

            dispatch({
              type: 'PROVIDER_CONFIG_READY',
              payload: { data: normalizedData }
            });
          } catch (error) {
            dispatch({
              type: 'PROVIDER_CONFIG_ERROR',
              payload: {
                error: error instanceof Error ? error.message : 'Failed to parse provider configuration'
              }
            });
          }
        } else if (status === 202) {
          // Continue polling (202 Accepted - pending)
          if (config.debugMode) {
            console.log(`Provider config poll attempt ${attempt}: 202 Accepted (pending)`);
          }
        } else if (status === 404) {
          // UUID not found
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          dispatch({
            type: 'PROVIDER_CONFIG_ERROR',
            payload: {
              error: 'Provider config request not found'
            }
          });
        } else {
          // Other error
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          dispatch({
            type: 'PROVIDER_CONFIG_ERROR',
            payload: {
              error: `Unexpected status code: ${status}`
            }
          });
        }
      } catch (error) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        dispatch({
          type: 'PROVIDER_CONFIG_ERROR',
          payload: {
            error: error instanceof Error ? error.message : 'Failed to poll provider config status'
          }
        });
      }
    }

    // Start polling
    pollConfigStatus(); // First attempt immediately
    pollIntervalRef.current = window.setInterval(pollConfigStatus, config.pollInterval);

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [state.providerConfigStatus, state.providerConfigUuid, dispatch]);
}
