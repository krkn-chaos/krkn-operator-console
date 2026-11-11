import type { JobConfigResponse, RerunIntent, ScenarioRunState } from '../types/api';

/** Build the state handoff used when a scenario run is replayed from its job configuration. */
export function buildRerunIntent(config: JobConfigResponse, run: ScenarioRunState): RerunIntent {
  const clusters = Object.entries(config.targetClusters).flatMap(
    ([operatorName, clusterNames]) => clusterNames.map(clusterName => ({ operatorName, clusterName })),
  );

  return {
    scenario: config.scenario ?? {
      name: config.scenarioName ?? run.scenarioName,
      private: Boolean(run.registryName),
      ...(run.registryName ? { registryName: run.registryName } : {}),
    },
    clusters,
    environment: config.environment,
    kubeconfigPath: config.kubeconfigPath,
    ...(config.cloudCredentialRef ? { cloudCredentialRef: config.cloudCredentialRef } : {}),
    categories: config.categories,
  };
}
