/**
 * ScenarioConfigDisplay - Displays scenario configuration parameters
 *
 * Shows the environment variables and metadata (scenario image, target clusters)
 * used to configure a scenario run or graph run. Self-contained: manages its own
 * data fetching, loading, and error states with an in-memory cache.
 */

import { useState, useEffect } from 'react';
import { Spinner, Alert } from '@patternfly/react-core';
import { operatorApi } from '../services/operatorApi';
import { graphRunsApi } from '../services/graphRunsApi';
import { configCache } from './scenarioConfigCache';
import type { JobConfigResponse } from '../types/api';

const SENSITIVE_PATTERNS = /PASSWORD|SECRET|TOKEN|KEY|CREDENTIALS/i;

interface ScenarioConfigDisplayProps {
  scenarioRunName?: string;
  graphRunName?: string;
}

export function ScenarioConfigDisplay({ scenarioRunName, graphRunName }: ScenarioConfigDisplayProps) {
  const cacheKey = scenarioRunName || graphRunName || '';
  const [config, setConfig] = useState<JobConfigResponse | null>(null);
  const [loading, setLoading] = useState(!!cacheKey);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cacheKey) return;

    const cached = configCache.get(cacheKey);
    if (cached) {
      setConfig(cached);
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        let result: JobConfigResponse;
        if (scenarioRunName) {
          result = await operatorApi.getScenarioRunConfig(scenarioRunName);
        } else if (graphRunName) {
          result = await graphRunsApi.getGraphRunConfig(graphRunName);
        } else {
          return;
        }

        if (mounted) {
          configCache.set(cacheKey, result);
          setConfig(result);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load configuration');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchConfig();

    return () => {
      mounted = false;
    };
  }, [cacheKey, scenarioRunName, graphRunName]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
        <Spinner size="md" aria-label="Loading configuration" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="warning" isInline isPlain title="Configuration not available">
        {error}
      </Alert>
    );
  }

  if (!config) return null;

  const envEntries = Object.entries(config.environment || {}).sort(([a], [b]) => a.localeCompare(b));
  const clusterEntries = Object.entries(config.targetClusters || {});

  const dlStyle = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', margin: 0 } as const;
  const dtStyle = { fontWeight: 'bold' } as const;
  const ddMono = { margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' } as const;
  const labelStyle = {
    margin: 0,
    marginBottom: '0.5rem',
    fontSize: 'var(--pf-v5-global--FontSize--sm)',
    fontWeight: 600,
    color: 'var(--pf-v5-global--Color--200)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Scenario Settings */}
      <div style={{ padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: '4px' }}>
        <p style={labelStyle}>Scenario Settings</p>
        <dl style={dlStyle}>
          <dt style={dtStyle}>Scenario Image:</dt>
          <dd style={{ ...ddMono, wordBreak: 'break-all' }}>
            {config.scenarioImage}
          </dd>

          {clusterEntries.length > 0 && (
            <>
              <dt style={dtStyle}>Target Clusters:</dt>
              <dd style={ddMono}>
                {clusterEntries.map(([provider, clusters]) => (
                  <div key={provider}>
                    {provider}: {(clusters as string[]).join(', ')}
                  </div>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* Scenario Variables */}
      <div style={{ padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: '4px' }}>
        <p style={labelStyle}>Scenario Variables</p>
        {envEntries.length > 0 ? (
          <dl style={dlStyle}>
            {envEntries.map(([key, value]) => (
              <div key={key} style={{ display: 'contents' }}>
                <dt style={dtStyle}>{key}:</dt>
                <dd style={ddMono}>
                  {SENSITIVE_PATTERNS.test(key) ? '********' : value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--pf-v5-global--Color--200)', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
            No configuration parameters set
          </p>
        )}
      </div>
    </div>
  );
}
