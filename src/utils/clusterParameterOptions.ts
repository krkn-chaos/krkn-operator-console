import type { ScenarioField, ScenarioFormValues } from '../types/api';

type Resource = 'namespaces' | 'nodes' | 'pods' | 'pvcs' | 'vmi' | 'serviceaccounts';
type Selection = 'name' | 'label' | 'container';

export interface ClusterOptionSource {
  resource: Resource;
  selection: Selection;
  namespaced: boolean;
}

interface KubeItem {
  metadata?: { name?: string; labels?: Record<string, string> };
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
  if (['NODE_NAME', 'NODE_NAMES', 'KUBE_VIRT_NODE_NAME', 'KUBE_VIRT_SSH_NODE'].includes(variable)) return clusterScoped('nodes');
  if (['POD_NAME', 'POD_NAMES'].includes(variable)) return namespaced('pods');
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
  scenarioName: string,
  variable: string,
  source: ClusterOptionSource,
  namespaceExpression: string,
  podName: string,
): string {
  return JSON.stringify([
    uuid, [...clusterNames].sort(), scenarioName, variable,
    source.resource, source.selection, namespaceExpression, podName,
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
  cache,
}: {
  uuid: string;
  clusterNames: string[];
  source: ClusterOptionSource;
  namespaceExpression?: string;
  podName?: string;
  runCommand: ClusterCommandRunner;
  cache: Map<string, Promise<KubeList>>;
}): Promise<string[]> {
  if (!uuid || clusterNames.length === 0) return [];

  const getList = (clusterName: string, resource: Resource, namespace?: string): Promise<KubeList> => {
    const command = `kubectl get ${resource}${namespace ? ` -n ${namespace}` : ''} -o json`;
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
    void request.catch(() => cache.delete(cacheKey));
    return request;
  };

  let namespaces: string[] = [];
  if (source.namespaced) {
    const perClusterNamespaces = await Promise.all(clusterNames.map(async (clusterName) =>
      new Set(optionValues((await getList(clusterName, 'namespaces')).items, clusterScoped('namespaces'), '')),
    ));
    const commonNamespaces = [...perClusterNamespaces[0]].filter((name) =>
      perClusterNamespaces.every((candidate) => candidate.has(name)),
    );
    namespaces = matchingNamespaces(commonNamespaces, namespaceExpression);
  }

  const perClusterOptions = await Promise.all(clusterNames.map(async (clusterName) => {
    const requestedNamespaces = source.namespaced ? namespaces : [undefined];
    const values = new Set<string>();
    for (let index = 0; index < requestedNamespaces.length; index += 4) {
      const lists = await Promise.all(requestedNamespaces.slice(index, index + 4).map((namespace) =>
        getList(clusterName, source.resource, namespace),
      ));
      lists.forEach((list) => optionValues(list.items, source, podName).forEach((value) => values.add(value)));
    }
    return values;
  }));
  return [...perClusterOptions[0]].filter((value) =>
    perClusterOptions.every((options) => options.has(value)),
  ).sort();
}
