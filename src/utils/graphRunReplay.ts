import { graphRunsApi, operatorApi } from '../services';
import type { StudioWorkflow } from '../types/api';

export interface GraphRunReplayPayload {
  workflow: StudioWorkflow;
  categories: string[];
}

/**
 * Load a graph run's saved workflow in the format used by Chaos Studio replay.
 *
 * @example
 * ```ts
 * const { workflow, categories } = await loadGraphRunReplay('graphrun-abc123');
 * dispatch({ type: 'OPEN_STUDIO_REPLAY', payload: { workflow, categories } });
 * ```
 */
export async function loadGraphRunReplay(graphRunName: string): Promise<GraphRunReplayPayload> {
  const [config, graphRunDetail] = await Promise.all([
    graphRunsApi.getGraphRunConfig(graphRunName),
    graphRunsApi.getGraphRun(graphRunName),
  ]);
  const replayNodes = Object.entries(config.graph)
    .filter(([nodeId]) => !nodeId.startsWith('_'));
  const signatureStatuses = await Promise.all(replayNodes.map(async ([, node]) => {
    const scenarioName = node.scenario?.name ?? node.name ?? '';
    try {
      const response = await operatorApi.getScenarios(
        node.scenario?.registryName ? { registryName: node.scenario.registryName } : {},
      );
      return response.scenarios.find((scenario) => scenario.name === scenarioName)?.signature_status;
    } catch {
      return undefined;
    }
  }));

  const workflow: StudioWorkflow = {
    nodes: replayNodes.map(([nodeId, node], index) => {
      const scenarioName = node.scenario?.name ?? node.name ?? '';
      return {
        nodeId,
        status: 'configured',
        position: { x: (index % 3) * 280, y: Math.floor(index / 3) * 180 },
        config: {
          registryType: node.scenario?.private ? 'private' : 'public',
          registryConfig: node.scenario?.registryName ? { registryName: node.scenario.registryName } : {},
          scenarioName,
          scenarioImage: node.image ?? `krkn-hub:${scenarioName}`,
          signature_status: signatureStatuses[index] ?? node.scenario?.signature_status,
          scenarioFormValues: node.env ?? {},
          volumes: node.volumes,
          cloudCredentialRef: node.cloudCredentialRef,
        },
      };
    }),
    edges: Object.entries(config.graph)
      .filter(([nodeId, node]) => !nodeId.startsWith('_') && node.depends_on && !node.depends_on.startsWith('_'))
      .map(([nodeId, node]) => ({ id: `${node.depends_on}-${nodeId}`, source: node.depends_on!, target: nodeId })),
    nextNodeNumber: (() => {
      const nodeIds = new Set(Object.keys(config.graph));
      let nextNodeNumber = 1;
      while (nodeIds.has(`node-${nextNodeNumber}`)) {
        nextNodeNumber += 1;
      }
      return nextNodeNumber;
    })(),
    resiliencyScoreConfig: graphRunDetail.spec.resiliencyScoreEnabled
      ? {
          baseline: graphRunDetail.spec.resiliencyScoreBaseline ?? 0,
          mountPath: graphRunDetail.spec.resiliencyMountPath ?? '/etc/krkn/metrics.yaml',
        }
      : undefined,
  };

  return { workflow, categories: config.categories ?? [] };
}
