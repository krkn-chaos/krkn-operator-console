import type { ScenarioField, ScenarioFormValues } from '../types/api';

type Resource = 'namespaces' | 'nodes' | 'pods' | 'pvcs' | 'vmi' | 'serviceaccounts';
type Selection = 'name' | 'label' | 'container';

export interface ClusterFieldOptionState {
  options: string[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  selectionMode?: 'single' | 'comma';
  clearable?: boolean;
}

export interface ClusterOptionSource {
  resource: Resource;
  selection: Selection;
  namespaced: boolean;
  selectionMode?: 'comma';
}

interface KubeItem {
  metadata?: { name?: string; namespace?: string; labels?: Record<string, string> };
  spec?: { containers?: Array<{ name?: string }> };
}

interface KubeList {
  items: KubeItem[];
}

export type ClusterCommandRunner = (clusterName: string, command: string) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;
export type ClusterNodeReader = (uuid: string, clusterName: string) => Promise<string[]>;

const namespaced = (resource: Resource, selection: Selection = 'name'): ClusterOptionSource =>
  ({ resource, selection, namespaced: true });
const clusterScoped = (resource: Resource, selection: Selection = 'name'): ClusterOptionSource =>
  ({ resource, selection, namespaced: false });

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
    return { ...clusterScoped('nodes'), ...(variable === 'NODE_NAMES' && { selectionMode: 'comma' as const }) };
  }
  if (['POD_NAME', 'POD_NAMES'].includes(variable)) {
    return { ...namespaced('pods'), ...(variable === 'POD_NAMES' && { selectionMode: 'comma' as const }) };
  }
  if (variable === 'PVC_NAME') return namespaced('pvcs');
  if (variable === 'VM_NAME' && ['vmi-outage', 'kubevirt-outage'].includes(scenario)) return namespaced('vmi');
  if (variable === 'CONTAINER_NAME') return namespaced('pods', 'container');
  if (variable === 'SERVICE_ACCOUNT') return namespaced('serviceaccounts');
  if (variable === 'POD_LABEL' || variable === 'NODE_LABEL_SELECTOR') {
    return variable === 'POD_LABEL' ? namespaced('pods', 'label') : clusterScoped('nodes', 'label');
  }
  if (variable === 'NODE_SELECTOR') return clusterScoped('nodes', 'label');

  if (variable === 'OBJECT_NAME' && scenario === 'time-scenarios') {
    const objectType = String(values.OBJECT_TYPE ?? 'pod').toLowerCase();
    if (objectType === 'node') return clusterScoped('nodes');
    if (objectType === 'pod') return namespaced('pods');
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
  clusterNames: string[],
  source: ClusterOptionSource,
  namespaceExpression: string,
  podName: string,
): string {
  return JSON.stringify([
    uuid, [...clusterNames].sort(), source.resource, source.selection,
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

export async function discoverClusterOptions({
  uuid,
  clusterNames,
  source,
  namespaceExpression = '',
  podName = '',
  runCommand,
  getNodeNames,
  cache,
}: {
  uuid: string;
  clusterNames: string[];
  source: ClusterOptionSource;
  namespaceExpression?: string;
  podName?: string;
  runCommand: ClusterCommandRunner;
  getNodeNames: ClusterNodeReader;
  cache: Map<string, Promise<KubeList>>;
}): Promise<string[]> {
  if (!uuid || clusterNames.length === 0) return [];

  if (source.resource === 'nodes' && source.selection === 'name') {
    const perCluster = await Promise.all(clusterNames.map((clusterName) => getNodeNames(uuid, clusterName)));
    return perCluster[0].filter((name) => perCluster.every((names) => names.includes(name))).sort();
  }

  const getList = (clusterName: string, resource: Resource, namespace?: string, allNamespaces = false): Promise<KubeList> => {
    const scope = allNamespaces ? ' -A' : namespace ? ` -n ${namespace}` : '';
    const command = `kubectl get ${resource}${scope} -o json`;
    const cacheKey = JSON.stringify([uuid, clusterName, command]);
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const request = runCommand(clusterName, command).then(({ stdout, stderr, exitCode }) => {
      if (exitCode !== 0) throw new Error(stderr || `Unable to list ${resource} on ${clusterName}`);
      const parsed = JSON.parse(stdout) as Partial<KubeList>;
      if (!Array.isArray(parsed.items)) throw new Error(`Invalid ${resource} response from ${clusterName}`);
      return parsed as KubeList;
    });
    cache.set(cacheKey, request);
    void request.then(() => cache.delete(cacheKey), () => cache.delete(cacheKey));
    return request;
  };

  const exactNamespace = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(namespaceExpression)
    ? namespaceExpression : null;
  let namespaces: string[] = [];
  if (source.namespaced) {
    if (exactNamespace) {
      namespaces = [exactNamespace];
    } else {
      const perClusterNamespaces = await Promise.all(clusterNames.map(async (clusterName) =>
        new Set(optionValues((await getList(clusterName, 'namespaces')).items, clusterScoped('namespaces'), '')),
      ));
      const commonNamespaces = [...perClusterNamespaces[0]].filter((name) =>
        perClusterNamespaces.every((candidate) => candidate.has(name)),
      );
      namespaces = matchingNamespaces(commonNamespaces, namespaceExpression);
    }
  }

  if (source.namespaced && namespaces.length === 0) return [];
  const namespaceSet = new Set(namespaces);
  const perClusterOptions = await Promise.all(clusterNames.map(async (clusterName) => {
    const list = await getList(clusterName, source.resource, source.namespaced ? exactNamespace ?? undefined : undefined,
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
