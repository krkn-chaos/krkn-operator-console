import type { ScenarioField, ScenarioFormValues, SelectedCluster } from '../types/api';

type ClusterRef = Pick<SelectedCluster, 'operatorName' | 'clusterName'>;

type Resource = 'namespaces' | 'nodes' | 'pods' | 'pvcs' | 'vmi' | 'serviceaccounts';
type Selection = 'name' | 'label' | 'container';
const LIST_CACHE_TTL_MS = 30_000;

export interface ClusterFieldOptionState {
  options: string[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  selectionMode?: 'single' | 'comma' | 'list';
  clearable?: boolean;
}

export interface ClusterOptionSource {
  resource: Resource;
  selection: Selection;
  namespaced: boolean;
  selectionMode?: 'comma' | 'list';
}

interface KubeItem {
  metadata?: { name?: string; namespace?: string; labels?: Record<string, string> };
  spec?: { containers?: Array<{ name?: string }> };
}

interface KubeList {
  items: KubeItem[];
}

export type ClusterCommandRunner = (cluster: ClusterRef, command: string) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;
export type ClusterNodeReader = (uuid: string, cluster: ClusterRef) => Promise<string[]>;

const namespaced = (resource: Resource, selection: Selection = 'name'): ClusterOptionSource =>
  ({ resource, selection, namespaced: true });
const clusterScoped = (resource: Resource, selection: Selection = 'name'): ClusterOptionSource =>
  ({ resource, selection, namespaced: false });

/**
 * Finds discovery resource and selection mode for a string field. Returns null
 * when field has no supported cluster lookup or is secret.
 *
 * @example
 * const field: ScenarioField = {
 *   name: 'pod-name', variable: 'POD_NAME', short_description: 'Pod name',
 *   description: '', type: 'string', required: false,
 * };
 * const source = getClusterOptionSource('pod-scenarios', field, {});
 * if (source === null) throw new Error('POD_NAME has no discovery source');
 * console.log(source); // { resource: 'pods', selection: 'name', namespaced: true }
 */
export function getClusterOptionSource(
  scenarioName: string,
  field: ScenarioField,
  values: ScenarioFormValues,
): ClusterOptionSource | null {
  if (field.type !== 'string' || field.secret) return null;
  const variable = field.variable.toUpperCase();
  const scenario = scenarioName.toLowerCase();

  if (variable === 'NAMESPACE' || variable === 'KUBE_VIRT_NAMESPACE') return clusterScoped('namespaces');
  if (['NODE_NAME', 'NODE_NAMES', 'KUBE_VIRT_NODE_NAME', 'KUBE_VIRT_SSH_NODE'].includes(variable)) {
    const selectionMode = variable === 'NODE_NAME' ? 'comma' : variable === 'NODE_NAMES' ? 'list' : undefined;
    return { ...clusterScoped('nodes'), ...(selectionMode && { selectionMode }) };
  }
  if (['POD_NAME', 'POD_NAMES'].includes(variable)) {
    return { ...namespaced('pods'), ...(variable === 'POD_NAMES' && { selectionMode: 'comma' as const }) };
  }
  if (variable === 'PVC_NAME') return namespaced('pvcs');
  if (variable === 'KUBE_VIRT_NAME' && ['vmi-outage', 'kubevirt-outage'].includes(scenario)) return namespaced('vmi');
  if (variable === 'CONTAINER_NAME') return namespaced('pods', 'container');
  if (variable === 'SERVICE_ACCOUNT') return namespaced('serviceaccounts');
  if (variable === 'POD_LABEL' || variable === 'NODE_LABEL_SELECTOR') {
    return variable === 'POD_LABEL' ? namespaced('pods', 'label') : clusterScoped('nodes', 'label');
  }
  if (variable === 'NODE_SELECTOR') return clusterScoped('nodes', 'label');

  if (variable === 'OBJECT_NAME' && scenario === 'time-scenarios') {
    const objectType = String(values.OBJECT_TYPE ?? 'pod').toLowerCase();
    if (objectType === 'node') return { ...clusterScoped('nodes'), selectionMode: 'list' };
    if (objectType === 'pod') return { ...namespaced('pods'), selectionMode: 'list' };
    return null;
  }
  if (variable !== 'LABEL_SELECTOR' && variable !== 'EXCLUDE_LABEL') return null;

  if (['vmi-outage', 'kubevirt-outage'].includes(scenario)) return namespaced('vmi', 'label');
  if (scenario === 'time-scenarios') {
    const objectType = String(values.OBJECT_TYPE ?? 'pod').toLowerCase();
    if (objectType === 'node') return clusterScoped('nodes', 'label');
    if (objectType === 'pod') return namespaced('pods', 'label');
    return null;
  }
  if (scenario.startsWith('node-') || scenario === 'node-scenarios') return clusterScoped('nodes', 'label');
  if (scenario.startsWith('pod-') || scenario === 'container-scenarios') return namespaced('pods', 'label');
  return null;
}

export function clusterOptionQueryKey(
  uuid: string,
  clusters: ClusterRef[],
  source: ClusterOptionSource,
  namespaceExpression: string,
  podName: string,
): string {
  return JSON.stringify([
    uuid, clusters.map(({ operatorName, clusterName }) => [operatorName, clusterName]).sort(([aProvider, aName], [bProvider, bName]) =>
      aProvider.localeCompare(bProvider) || aName.localeCompare(bName)), source.resource, source.selection,
    source.namespaced ? namespaceExpression : '', source.selection === 'container' ? podName : '',
  ]);
}

function optionValues(items: KubeItem[], source: ClusterOptionSource, podName: string): string[] {
  if (source.selection === 'name') {
    return items.map((item) => item.metadata?.name).filter((name): name is string => Boolean(name));
  }
  if (source.selection === 'container') {
    return items
      .filter((item) => !podName || item.metadata?.name === podName)
      .flatMap((item) => item.spec?.containers?.map((container) => container.name).filter((name): name is string => Boolean(name)) ?? []);
  }
  return items.flatMap((item) => Object.entries(item.metadata?.labels ?? {}).flatMap(([key, value]) => {
    if (source.resource === 'nodes' && value === '') return [key];
    return value ? [`${key}=${value}`] : [key];
  }));
}

function matchingNamespaces(names: string[], expression: string): string[] {
  if (!expression || expression === '*') return names;
  if (names.includes(expression)) return [expression];
  try {
    const pattern = new RegExp(expression);
    return names.filter((name) => pattern.test(name));
  } catch {
    throw new Error('Invalid namespace pattern; enter a namespace or valid regex.');
  }
}

/**
 * Lists matching resource names shared by every selected cluster. Namespace
 * expression can be exact name or regex. Node names use getNodeNames; other
 * resources use runCommand. Cache successful lists for 30 seconds; refresh
 * bypasses cached results.
 * Rejects on command failure, invalid list response, or invalid namespace regex.
 *
 * @example
 * import { operatorApi } from '../services/operatorApi';
 *
 * const uuid = 'target-uuid';
 * const field: ScenarioField = {
 *   name: 'pod-name', variable: 'POD_NAME', short_description: 'Pod name',
 *   description: '', type: 'string', required: false,
 * };
 * const source = getClusterOptionSource('pod-scenarios', field, {});
 * if (source === null) throw new Error('POD_NAME has no discovery source');
 * const clusterNames = ['workload'];
 * const clusters = clusterNames.map((clusterName) => ({ operatorName: 'krkn-operator', clusterName }));
 * const cache = new Map();
 * const options: string[] = await discoverClusterOptions({
 *   uuid, clusters, source, namespaceExpression: 'default',
 *   runCommand: (cluster, command) => operatorApi.executeTerminalCommand({
 *     uuid, cluster_id: cluster.clusterName, provider: cluster.operatorName, command,
 *   }),
 *   getNodeNames: async (targetUUID, cluster) =>
 *     (await operatorApi.getNodes(targetUUID, cluster.clusterName, cluster.operatorName)).nodes,
 *   cache,
 * });
 * console.log(options); // e.g. ['web-0', 'web-1']
 */
export async function discoverClusterOptions({
  uuid,
  clusters,
  source,
  namespaceExpression = '',
  podName = '',
  runCommand,
  getNodeNames,
  cache,
  refresh = false,
}: {
  uuid: string;
  clusters: ClusterRef[];
  source: ClusterOptionSource;
  namespaceExpression?: string;
  podName?: string;
  runCommand: ClusterCommandRunner;
  getNodeNames: ClusterNodeReader;
  cache: Map<string, Promise<KubeList>>;
  refresh?: boolean;
}): Promise<string[]> {
  if (!uuid || clusters.length === 0) return [];

  if (source.resource === 'nodes' && source.selection === 'name') {
    const perCluster = await Promise.all(clusters.map((cluster) => getNodeNames(uuid, cluster)));
    return perCluster[0].filter((name) => perCluster.every((names) => names.includes(name))).sort();
  }

  const getList = (cluster: ClusterRef, resource: Resource, namespace?: string, allNamespaces = false): Promise<KubeList> => {
    const scope = allNamespaces ? ' -A' : namespace ? ` -n ${namespace}` : '';
    const command = `kubectl get ${resource}${scope} -o json`;
    const cacheKey = JSON.stringify([uuid, cluster.operatorName, cluster.clusterName, command]);
    const cached = cache.get(cacheKey);
    if (cached && !refresh) return cached;
    const request = runCommand(cluster, command).then(({ stdout, stderr, exitCode }) => {
      if (exitCode !== 0) throw new Error(stderr || `Unable to list ${resource} on ${cluster.clusterName}`);
      const parsed = JSON.parse(stdout) as Partial<KubeList>;
      if (!Array.isArray(parsed.items)) throw new Error(`Invalid ${resource} response from ${cluster.clusterName}`);
      return parsed as KubeList;
    });
    cache.set(cacheKey, request);
    void request.then(
      () => setTimeout(() => {
        if (cache.get(cacheKey) === request) cache.delete(cacheKey);
      }, LIST_CACHE_TTL_MS),
      () => { if (cache.get(cacheKey) === request) cache.delete(cacheKey); },
    );
    return request;
  };

  const exactNamespace = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(namespaceExpression)
    ? namespaceExpression : null;
  let namespaces: string[] = [];
  if (source.namespaced) {
    if (exactNamespace) {
      namespaces = [exactNamespace];
    } else {
      const perClusterNamespaces = await Promise.all(clusters.map(async (cluster) =>
        new Set(optionValues((await getList(cluster, 'namespaces')).items, clusterScoped('namespaces'), '')),
      ));
      const commonNamespaces = [...perClusterNamespaces[0]].filter((name) =>
        perClusterNamespaces.every((candidate) => candidate.has(name)),
      );
      namespaces = matchingNamespaces(commonNamespaces, namespaceExpression);
    }
  }

  if (source.namespaced && namespaces.length === 0) return [];
  const namespaceSet = new Set(namespaces);
  const perClusterOptions = await Promise.all(clusters.map(async (cluster) => {
    const list = await getList(cluster, source.resource, source.namespaced ? exactNamespace ?? undefined : undefined,
      source.namespaced && !exactNamespace);
    const items = source.namespaced && !exactNamespace
      ? list.items.filter((item) => namespaceSet.has(item.metadata?.namespace ?? ''))
      : list.items;
    return new Set(optionValues(items, source, podName));
  }));
  return [...perClusterOptions[0]].filter((value) =>
    perClusterOptions.every((options) => options.has(value)),
  ).sort();
}
