import { useCallback, useEffect, useRef, useState } from 'react';
import { operatorApi } from '../services/operatorApi';
import type { ScenarioField, ScenarioFormValues, SelectedCluster } from '../types/api';
import { clusterOptionQueryKey, discoverClusterOptions, getClusterOptionSource, type ClusterFieldOptionState } from '../utils/clusterParameterOptions';

interface ClusterParameterOptionsArgs {
  uuid: string | null;
  clusters: SelectedCluster[];
  scenarioName: string;
  scenarioFields: ScenarioField[];
  globalFields: ScenarioField[];
  scenarioValues: ScenarioFormValues | null;
  globalValues: ScenarioFormValues | null;
  active: boolean;
}

export function useClusterParameterOptions({
  uuid, clusters, scenarioName, scenarioFields, globalFields,
  scenarioValues, globalValues, active,
}: ClusterParameterOptionsArgs) {
  const [queryStates, setQueryStates] = useState<Record<string, ClusterFieldOptionState>>({});
  const pending = useRef(new Map<string, Promise<void>>());
  const listCache = useRef<Parameters<typeof discoverClusterOptions>[0]['cache']>(new Map());
  const virtualMachineScenario = ['vmi-outage', 'kubevirt-outage'].includes(scenarioName);
  const namespaceExpression = String(virtualMachineScenario
    ? scenarioValues?.KUBE_VIRT_NAMESPACE ?? globalValues?.KUBE_VIRT_NAMESPACE ?? scenarioValues?.NAMESPACE ?? globalValues?.NAMESPACE ?? ''
    : scenarioValues?.NAMESPACE ?? globalValues?.NAMESPACE ?? scenarioValues?.KUBE_VIRT_NAMESPACE ?? globalValues?.KUBE_VIRT_NAMESPACE ?? '');
  const podName = String(scenarioValues?.POD_NAME ?? '');

  const selectedPodLabel = (variable: string): string => {
    const scenarioField = scenarioFields.find((field) => field.variable.toUpperCase() === variable);
    const field = scenarioField ?? globalFields.find((candidate) => candidate.variable.toUpperCase() === variable);
    if (!field) return '';
    const values = scenarioField ? scenarioValues : globalValues;
    const source = getClusterOptionSource(scenarioName, field, values || {});
    if (source?.resource !== 'pods' || source.selection !== 'label') return '';
    return String(values?.[field.variable] ?? field.default ?? '').trim();
  };
  const includedPodLabels = ['POD_LABEL', 'LABEL_SELECTOR'].map(selectedPodLabel).filter(Boolean);
  const excludedPodLabel = selectedPodLabel('EXCLUDE_LABEL');
  const hasPodLabelConflict = Boolean(excludedPodLabel && includedPodLabels.includes(excludedPodLabel));

  const getQuery = useCallback((variable: string, global: boolean) => {
    const field = (global ? globalFields : scenarioFields).find((candidate) => candidate.variable === variable);
    if (!field) return null;
    const source = getClusterOptionSource(scenarioName, field, global ? globalValues || {} : scenarioValues || {});
    if (!source) return null;
    return {
      source,
      key: clusterOptionQueryKey(uuid ?? '', clusters, source, namespaceExpression, podName),
    };
  }, [uuid, clusters, scenarioName, scenarioFields, globalFields,
    scenarioValues, globalValues, namespaceExpression, podName]);

  const getFieldStates = (fields: ScenarioField[], global: boolean): Record<string, ClusterFieldOptionState> => {
    const result: Record<string, ClusterFieldOptionState> = {};
    for (const field of fields) {
      const query = getQuery(field.variable, global);
      if (!query) continue;
      const state = queryStates[query.key] ?? { options: [], status: 'idle' as const };
      const variable = field.variable.toUpperCase();
      const podLabel = query.source.resource === 'pods' && query.source.selection === 'label';
      const omitted = podLabel && variable === 'EXCLUDE_LABEL' ? includedPodLabels
        : podLabel && ['POD_LABEL', 'LABEL_SELECTOR'].includes(variable) ? [excludedPodLabel]
          : [];
      result[field.variable] = {
        ...state,
        options: state.options.filter((option) => !omitted.includes(option)),
        clearable: podLabel && ['POD_LABEL', 'LABEL_SELECTOR', 'EXCLUDE_LABEL'].includes(variable),
        selectionMode: query.source.selectionMode ?? 'single',
      };
    }
    return result;
  };

  const loadOptions = useCallback((variable: string, global = false, automatic = false) => {
    if (!uuid || clusters.length === 0) return;
    const query = getQuery(variable, global);
    if (!query || pending.current.has(query.key)) return;
    if (automatic && queryStates[query.key]) return;

    setQueryStates((previous) => ({
      ...previous, [query.key]: { options: previous[query.key]?.options ?? [], status: 'loading' },
    }));
    const request = discoverClusterOptions({
      uuid, clusters, source: query.source, namespaceExpression, podName,
      cache: listCache.current, refresh: !automatic && Boolean(queryStates[query.key]),
      getNodeNames: async (targetUUID, cluster) => (await operatorApi.getNodes(targetUUID, cluster.clusterName, cluster.operatorName)).nodes,
      runCommand: async (cluster, command) => operatorApi.executeTerminalCommand({
        cluster_id: cluster.clusterName, provider: cluster.operatorName, uuid, command,
      }),
    }).then((options) => {
      setQueryStates((previous) => ({ ...previous, [query.key]: { options, status: 'ready' } }));
    }).catch((error: unknown) => {
      const terminalCode = error instanceof Error && error.message.startsWith('TERMINAL_ERROR:')
        ? error.message.split(':')[1] : '';
      setQueryStates((previous) => ({ ...previous, [query.key]: {
        options: [], status: 'error',
        error: terminalCode === '403'
          ? 'Permission denied while loading cluster options.'
          : terminalCode === '404'
            ? 'Command unavailable on this cluster.'
            : terminalCode === '500'
              ? 'Cluster command failed while loading options.'
              : 'Unable to load cluster options.',
      } }));
    }).finally(() => pending.current.delete(query.key));
    pending.current.set(query.key, request);
  }, [uuid, clusters, getQuery, queryStates, namespaceExpression, podName]);

  useEffect(() => {
    if (!active || !uuid || clusters.length === 0) return;
    const fields = [
      ...scenarioFields.map((field) => ({ field, global: false })),
      ...globalFields.map((field) => ({ field, global: true })),
    ];
    const timer = window.setTimeout(() => {
      for (const { field, global } of fields) {
        const source = getQuery(field.variable, global)?.source;
        if (!source || source.namespaced) continue;
        loadOptions(field.variable, global, true);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [active, uuid, clusters, scenarioFields, globalFields, namespaceExpression, getQuery, loadOptions]);

  return {
    scenarioOptions: getFieldStates(scenarioFields, false),
    globalOptions: getFieldStates(globalFields, true),
    hasPodLabelConflict,
    loadOptions,
  };
}
