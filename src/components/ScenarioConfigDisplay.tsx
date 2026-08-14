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
import type { JobConfigResponse } from '../types/api';

const SENSITIVE_PATTERNS = /PASSWORD|SECRET|TOKEN|KEY|CREDENTIALS/i;

export const configCache = new Map<string, JobConfigResponse>();

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

  return (
    <div style={{ padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: '4px' }}>
      <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 'var(--pf-v5-global--FontSize--md)', fontWeight: 'bold' }}>
        Configuration
      </h4>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', margin: 0 }}>
        <dt style={{ fontWeight: 'bold' }}>Scenario Image:</dt>
        <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)', wordBreak: 'break-all' }}>
          {config.scenarioImage}
        </dd>

        {clusterEntries.length > 0 && (
          <>
            <dt style={{ fontWeight: 'bold' }}>Target Clusters:</dt>
            <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
              {clusterEntries.map(([provider, clusters]) => (
                <div key={provider}>
                  {provider}: {(clusters as string[]).join(', ')}
                </div>
              ))}
            </dd>
          </>
        )}

        {envEntries.length > 0 && envEntries.map(([key, value]) => (
          <div key={key} style={{ display: 'contents' }}>
            <dt style={{ fontWeight: 'bold' }}>{key}:</dt>
            <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
              {SENSITIVE_PATTERNS.test(key) ? '********' : value}
            </dd>
          </div>
        ))}

        {envEntries.length === 0 && (
          <>
            <dt style={{ fontWeight: 'bold' }}>Environment:</dt>
            <dd style={{ margin: 0, fontStyle: 'italic', color: 'var(--pf-v5-global--Color--200)' }}>
              No configuration parameters set
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
