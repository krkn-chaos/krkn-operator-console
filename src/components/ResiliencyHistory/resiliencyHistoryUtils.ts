import type {
  ResiliencyHistoryConfigurationGroup,
  ResiliencyHistoryDataPoint,
  ResiliencyHistoryQueryResponse,
} from '../../types/api';

export type ResiliencyHistoryChartMode = 'separate' | 'collapsed';

export interface ResiliencyHistoryChartPoint {
  x: number;
  y: number;
  tooltip: string;
}

export interface ResiliencyHistoryChartSeries {
  clusterName: string;
  data: ResiliencyHistoryChartPoint[];
}

export interface ResiliencyHistoryChartModel {
  key: string;
  categoryName: string;
  title: string;
  configurationGroupId?: string;
  isMixedConfiguration: boolean;
  series: ResiliencyHistoryChartSeries[];
  hasData: boolean;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** Builds the complete, accessible point label used by chart tooltips. */
export function formatResiliencyHistoryTooltip(
  point: ResiliencyHistoryDataPoint,
  clusterName: string,
  categoryName: string,
  configurationGroup?: ResiliencyHistoryConfigurationGroup,
): string {
  const details = [
    `Date: ${formatDate(point.date)}`,
    `Score: ${point.score}`,
    `Cluster: ${clusterName}`,
    `Category: ${categoryName}`,
    `Run: ${point.runId}`,
    `Run type: ${point.runType}`,
  ];
  if (point.providerName) details.push(`Provider: ${point.providerName}`);
  details.push(`Configuration group: ${point.configurationGroupId}`);
  if (configurationGroup?.scenarioNames?.length) {
    details.push(`Scenarios: ${configurationGroup.scenarioNames.join(', ')}`);
  }
  return details.join(' · ');
}

function buildSeries(
  response: ResiliencyHistoryQueryResponse,
  categoryName: string,
  clusterNames: string[],
  groupId?: string,
  collapsed = false,
): ResiliencyHistoryChartSeries[] {
  return clusterNames.map((clusterName) => {
    const points = response.clusters[clusterName]?.[categoryName] ?? [];
    const data = points
      .filter((point) => (collapsed || groupId === undefined || point.configurationGroupId === groupId)
        && Number.isFinite(point.score)
        && Number.isFinite(new Date(point.date).getTime()))
      .slice()
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
      .map((point) => ({
        x: new Date(point.date).getTime(),
        y: point.score,
        tooltip: formatResiliencyHistoryTooltip(
          point,
          clusterName,
          categoryName,
          response.configurationGroups[categoryName]?.[point.configurationGroupId],
        ),
      }));

    return { clusterName, data };
  });
}

/**
 * Splits query data into category-scoped chart models. Configuration group IDs
 * are deliberately resolved within their category because the same ID may be
 * used by a different category.
 */
export function buildResiliencyHistoryCharts(
  response: ResiliencyHistoryQueryResponse,
  categoryNames: string[],
  clusterNames: string[],
  mode: ResiliencyHistoryChartMode,
): ResiliencyHistoryChartModel[] {
  const charts: ResiliencyHistoryChartModel[] = [];

  categoryNames.forEach((categoryName) => {
    if (mode === 'collapsed') {
      const series = buildSeries(response, categoryName, clusterNames, undefined, true);
      charts.push({
        key: `${categoryName}\u0000mixed`,
        categoryName,
        title: `${categoryName} — Mixed configurations`,
        isMixedConfiguration: true,
        hasData: series.some((item) => item.data.length > 0),
        series,
      });
      return;
    }

    const groupIds = new Set<string>();
    Object.keys(response.configurationGroups[categoryName] ?? {}).forEach((id) => groupIds.add(id));
    Object.values(response.clusters).forEach((categoryMap) => {
      (categoryMap[categoryName] ?? []).forEach((point) => groupIds.add(point.configurationGroupId));
    });

    // Keep a visible empty chart when a selected category has no score groups.
    const groups: (string | undefined)[] = groupIds.size > 0 ? [...groupIds] : [undefined];
    groups.forEach((groupId) => {
      const metadata = groupId ? response.configurationGroups[categoryName]?.[groupId] : undefined;
      const groupDescription = groupId
        ? metadata?.scenarioNames?.length
          ? `${metadata.scenarioNames.join(', ')} (configuration ${groupId})`
          : metadata?.runType
            ? `${metadata.runType} configuration ${groupId}`
            : groupId
        : 'No configuration group';
      const series = buildSeries(response, categoryName, clusterNames, groupId);
      charts.push({
        key: `${categoryName}\u0000${groupId ?? 'empty'}`,
        categoryName,
        title: `${categoryName} — ${groupDescription}`,
        configurationGroupId: groupId,
        isMixedConfiguration: false,
        hasData: series.some((item) => item.data.length > 0),
        series,
      });
    });
  });

  return charts;
}
