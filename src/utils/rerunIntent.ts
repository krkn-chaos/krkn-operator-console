import type { JobConfigResponse, RerunIntent, ScenarioRunState } from '../types/api';

/** Build the state handoff used when a scenario run is replayed from its saved configuration. */
export function buildRerunIntent(
  config: JobConfigResponse,
  run: Pick<ScenarioRunState, 'scenarioName' | 'registryName'>,
): RerunIntent {
  const clusters = Object.entries(config.targetClusters).flatMap(
    ([operatorName, clusterNames]) => clusterNames.map(clusterName => ({ operatorName, clusterName })),
  );
  const hasSavedSecrets = Object.values(config.secretFields ?? {}).some(Boolean);

  return {
    scenario: config.scenario ?? {
      name: config.scenarioName ?? run.scenarioName,
      private: Boolean(run.registryName),
      ...(run.registryName ? { registryName: run.registryName } : {}),
    },
    clusters,
    environment: config.environment,
    ...(hasSavedSecrets ? {
      secretFields: config.secretFields,
      sourceScenarioRunName: config.sourceScenarioRunName,
      originalConfiguration: config,
    } : {}),
    kubeconfigPath: config.kubeconfigPath,
    ...(config.cloudCredentialRef ? { cloudCredentialRef: config.cloudCredentialRef } : {}),
    categories: config.categories,
    ...(config.workspace ? { workspace: config.workspace } : {}),
    ...(config.rollbackEnabled !== undefined ? { rollbackEnabled: config.rollbackEnabled } : {}),
  };
}
