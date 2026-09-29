import type { ResiliencyHistoryDataPoint, ResiliencyHistoryQueryResponse } from '../../types/api';

export type ResiliencyHistoryChartMode = 'separate' | 'collapsed';

export interface ResiliencyHistoryChartPoint {
  x: number;
  y: number;
  date: string;
  runId: string;
  baseline?: number;
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
  configurationRunType?: 'scenario-runs' | 'graph-runs';
  configurationRunId?: string;
  isMixedConfiguration: boolean;
  series: ResiliencyHistoryChartSeries[];
  hasData: boolean;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

/** Builds a compact point label; the chart title and legend provide shared context. */
export function formatResiliencyHistoryTooltip(
  point: ResiliencyHistoryDataPoint,
  clusterName: string,
): string {
  const details = [`Score ${point.score}`];
  if (typeof point.baseline === 'number' && Number.isFinite(point.baseline)) {
    const delta = point.score - point.baseline;
    const signedDelta = delta === 0 ? '+0' : delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
    details.push(`Baseline ${point.baseline}`);
    details.push(`Δ ${signedDelta}`);
    details.push(delta >= 0 ? 'Met baseline' : 'Below baseline');
  }
  details.push(clusterName, formatDate(point.date), point.runId);
  return details.join(' · ');
}

/** Returns the current compact marker half-width, increased by 20%. */
export function calculateBaselineTickHalfWidth(nearestNeighborDistance?: number): number {
  const previousWidth = typeof nearestNeighborDistance === 'number'
    && Number.isFinite(nearestNeighborDistance)
    && nearestNeighborDistance > 0
    ? Math.max(3, Math.min(8, nearestNeighborDistance * 0.06))
    : 5;
  return previousWidth * 1.2;
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
        date: point.date,
        runId: point.runId,
        ...(point.baseline !== undefined ? { baseline: point.baseline } : {}),
        tooltip: formatResiliencyHistoryTooltip(point, clusterName),
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
      const [groupRunType, ...groupRunNameParts] = groupId?.split('/') ?? [];
      const configurationRunType = metadata?.runType === 'scenario-runs' || metadata?.runType === 'graph-runs'
        ? metadata.runType
        : groupRunType === 'scenario-runs' || groupRunType === 'graph-runs'
          ? groupRunType
          : undefined;
      const configurationRunId = metadata?.representativeRunId || groupRunNameParts.join('/') || undefined;
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
        configurationRunType,
        configurationRunId,
        isMixedConfiguration: false,
        hasData: series.some((item) => item.data.length > 0),
        series,
      });
    });
  });

  return charts;
}
