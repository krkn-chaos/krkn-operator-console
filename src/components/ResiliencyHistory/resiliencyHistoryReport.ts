import type { jsPDF } from 'jspdf';
import type {
  CreateGraphRunRequest,
  GraphScenarioNode,
  JobConfigResponse,
  ResiliencyHistoryDataPoint,
  ResiliencyHistoryQueryResponse,
} from '../../types/api';
import { graphRunsApi } from '../../services/graphRunsApi';
import { operatorApi } from '../../services/operatorApi';
import { cacheSet, configCache } from '../scenarioConfigCache';
import type {
  ResiliencyHistoryChartModel,
  ResiliencyHistoryChartPoint,
  ResiliencyHistoryClusterSelection,
} from './resiliencyHistoryUtils';

type ConfigurationRunType = 'scenario-runs' | 'graph-runs';
type RunConfiguration = CreateGraphRunRequest | JobConfigResponse;
type PdfColor = [number, number, number];

interface ReportConfiguration {
  categoryName: string;
  groupId: string;
  runType?: ConfigurationRunType;
  runId?: string;
  scenarioNames: string[];
  config: RunConfiguration | null;
}

interface ReportInput {
  queryResult: ResiliencyHistoryQueryResponse;
  categories: string[];
  clusters: (ResiliencyHistoryClusterSelection | string)[];
  charts: ResiliencyHistoryChartModel[];
  chartMode: 'separate' | 'collapsed';
  showBaselines: boolean;
  queriedAt: string | null;
  reportGeneratedAt: string;
}

interface ScoreSnapshotRow {
  categoryName: string;
  clusterName: string;
  samples: number;
  latestScore: number;
  latestDate: string;
  baseline?: number;
}

const PAGE_WIDTH = 297;
const PAGE_MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CONTENT_BOTTOM = 198;
const SENSITIVE_FIELD = /PASSWORD|SECRET|TOKEN|KEY|CREDENTIAL|AUTH/i;
const COLORS = {
  ink: [26, 26, 26] as PdfColor,
  muted: [102, 102, 102] as PdfColor,
  accent: [204, 0, 0] as PdfColor,
  neutralFill: [232, 232, 232] as PdfColor,
  border: [204, 204, 204] as PdfColor,
  grid: [232, 232, 232] as PdfColor,
  panel: [247, 247, 247] as PdfColor,
  green: [26, 127, 55] as PdfColor,
  red: [207, 34, 46] as PdfColor,
  white: [255, 255, 255] as PdfColor,
};
const SERIES_COLORS: PdfColor[] = [
  [204, 0, 0],
  [26, 127, 55],
  [26, 26, 26],
  [207, 34, 46],
  [102, 102, 102],
  [51, 51, 51],
  [0, 0, 0],
];

function normalizeRunType(value: string | undefined): ConfigurationRunType | undefined {
  return value === 'scenario-runs' || value === 'graph-runs' ? value : undefined;
}

function normalizeClusterSelection(selection: ResiliencyHistoryClusterSelection | string): ResiliencyHistoryClusterSelection {
  return typeof selection === 'string' ? { name: selection, providerName: '' } : selection;
}

function clusterDisplayName(selection: ResiliencyHistoryClusterSelection | string): string {
  const cluster = normalizeClusterSelection(selection);
  return cluster.providerName ? `${cluster.providerName} / ${cluster.name}` : cluster.name;
}

function getClusterPoints(
  response: ResiliencyHistoryQueryResponse,
  categoryName: string,
  selection: ResiliencyHistoryClusterSelection | string,
): ResiliencyHistoryDataPoint[] {
  const cluster = normalizeClusterSelection(selection);
  return (response.clusters[cluster.name]?.[categoryName] ?? []).filter((point) =>
    !cluster.providerName || point.providerName === cluster.providerName,
  );
}

function collectConfigurations(
  response: ResiliencyHistoryQueryResponse,
  categories: string[],
  clusters: (ResiliencyHistoryClusterSelection | string)[],
): Omit<ReportConfiguration, 'config'>[] {
  const entries: Omit<ReportConfiguration, 'config'>[] = [];
  categories.forEach((categoryName) => {
    const points = clusters.flatMap((cluster) => getClusterPoints(response, categoryName, cluster));
    const groupIds = [...new Set(points.map((point) => point.configurationGroupId))].sort();
    groupIds.forEach((groupId) => {
      const metadata = response.configurationGroups[categoryName]?.[groupId];
      const representativePoint = points.find((point) => point.configurationGroupId === groupId);
      const [idRunType, ...idRunParts] = groupId.split('/');
      entries.push({
        categoryName,
        groupId,
        runType: normalizeRunType(metadata?.runType)
          ?? normalizeRunType(idRunType)
          ?? normalizeRunType(representativePoint?.runType),
        runId: metadata?.representativeRunId || idRunParts.join('/') || undefined,
        scenarioNames: metadata?.scenarioNames ?? [],
      });
    });
  });
  return entries;
}

async function loadConfiguration(
  runType: ConfigurationRunType,
  runId: string,
  pending: Map<string, Promise<RunConfiguration>>,
): Promise<RunConfiguration> {
  const cacheKey = (runType === 'graph-runs' ? 'graph:' : 'scenario:') + runId;
  const cached = configCache.get(cacheKey);
  if (cached) return cached;
  const existingRequest = pending.get(cacheKey);
  if (existingRequest) return existingRequest;
  const request = runType === 'graph-runs'
    ? graphRunsApi.getGraphRunConfig(runId)
    : operatorApi.getScenarioRunConfig(runId);
  const trackedRequest = request.then((config) => {
    cacheSet(cacheKey, config);
    return config;
  });
  pending.set(cacheKey, trackedRequest);
  return trackedRequest;
}

async function loadConfigurations(
  response: ResiliencyHistoryQueryResponse,
  categories: string[],
  clusters: (ResiliencyHistoryClusterSelection | string)[],
): Promise<ReportConfiguration[]> {
  const pending = new Map<string, Promise<RunConfiguration>>();
  const entries = collectConfigurations(response, categories, clusters);
  const loaded: ReportConfiguration[] = [];
  for (let index = 0; index < entries.length; index += 6) {
    const batch = await Promise.all(entries.slice(index, index + 6).map(async (entry) => {
      if (!entry.runType || !entry.runId) return { ...entry, config: null };
      try {
        return { ...entry, config: await loadConfiguration(entry.runType, entry.runId, pending) };
      } catch {
        return { ...entry, config: null };
      }
    }));
    loaded.push(...batch);
  }
  return loaded;
}

function safeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Δδ]/g, 'Delta')
    .replace(/[•●]/g, '*')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\xFF]/g, '?');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string, withTime = true): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return new Intl.DateTimeFormat(undefined, withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}

function setColor(pdf: jsPDF, color: PdfColor, target: 'text' | 'draw' | 'fill'): void {
  if (target === 'text') pdf.setTextColor(...color);
  else if (target === 'draw') pdf.setDrawColor(...color);
  else pdf.setFillColor(...color);
}

function drawText(
  pdf: jsPDF,
  content: unknown,
  x: number,
  y: number,
  options: { size?: number; color?: PdfColor; bold?: boolean; align?: 'left' | 'center' | 'right' } = {},
): void {
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(options.size ?? 8.5);
  setColor(pdf, options.color ?? COLORS.ink, 'text');
  pdf.text(safeText(content), x, y, { align: options.align ?? 'left' });
}

function wrappedLines(pdf: jsPDF, content: unknown, width: number, size = 8): string[] {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(size);
  return pdf.splitTextToSize(safeText(content) || '-', width) as string[];
}

function drawWrappedText(
  pdf: jsPDF,
  content: unknown,
  x: number,
  y: number,
  width: number,
  options: { size?: number; color?: PdfColor; bold?: boolean; lineHeight?: number } = {},
): number {
  const size = options.size ?? 8;
  const lineHeight = options.lineHeight ?? size * 0.48;
  const lines = wrappedLines(pdf, content, width, size);
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(size);
  setColor(pdf, options.color ?? COLORS.ink, 'text');
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawRule(pdf: jsPDF, y: number, color: PdfColor = COLORS.border): void {
  setColor(pdf, color, 'draw');
  pdf.setLineWidth(0.25);
  pdf.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
}

function drawPageHeader(pdf: jsPDF, section: string): void {
  drawText(pdf, 'KRKN / OPERATOR CONSOLE', PAGE_MARGIN, 9, { size: 7.2, color: COLORS.accent, bold: true });
  drawText(pdf, section.toUpperCase(), PAGE_WIDTH - PAGE_MARGIN, 9, {
    size: 7.2,
    color: COLORS.muted,
    bold: true,
    align: 'right',
  });
  drawRule(pdf, 13);
}

function startPage(pdf: jsPDF, section: string): number {
  pdf.addPage('a4', 'landscape');
  drawPageHeader(pdf, section);
  return 21;
}

function drawSectionTitle(pdf: jsPDF, title: string, subtitle: string | undefined, y: number): number {
  drawText(pdf, title, PAGE_MARGIN, y + 5, { size: 15, bold: true });
  let bottom = y + 7;
  if (subtitle) {
    bottom = drawWrappedText(pdf, subtitle, PAGE_MARGIN, y + 12, CONTENT_WIDTH, { size: 8, color: COLORS.muted });
  }
  return bottom + 3;
}

function drawFooter(pdf: jsPDF, pageNumber: number, pageCount: number): void {
  setColor(pdf, COLORS.border, 'draw');
  pdf.setLineWidth(0.25);
  pdf.line(PAGE_MARGIN, 202, PAGE_WIDTH - PAGE_MARGIN, 202);
  drawText(pdf, 'Resiliency history report', PAGE_MARGIN, 207, { size: 7, color: COLORS.muted });
  drawText(pdf, 'Page ' + pageNumber + ' of ' + pageCount, PAGE_WIDTH - PAGE_MARGIN, 207, {
    size: 7,
    color: COLORS.muted,
    align: 'right',
  });
}

function buildSnapshotRows(input: ReportInput): ScoreSnapshotRow[] {
  const rows: ScoreSnapshotRow[] = [];
  input.categories.forEach((categoryName) => input.clusters.forEach((cluster) => {
    const points = getClusterPoints(input.queryResult, categoryName, cluster)
      .slice()
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    const latest = points[points.length - 1];
    if (!latest) return;
    rows.push({
      categoryName,
      clusterName: clusterDisplayName(cluster),
      samples: points.length,
      latestScore: latest.score,
      latestDate: latest.date,
      ...(typeof latest.baseline === 'number' ? { baseline: latest.baseline } : {}),
    });
  }));
  return rows;
}

function drawMetricCard(pdf: jsPDF, x: number, y: number, width: number, label: string, value: string, detail: string): void {
  setColor(pdf, COLORS.panel, 'fill');
  setColor(pdf, COLORS.border, 'draw');
  pdf.setLineWidth(0.25);
  pdf.roundedRect(x, y, width, 22, 1.5, 1.5, 'FD');
  drawText(pdf, label.toUpperCase(), x + 3, y + 5, { size: 6.5, color: COLORS.muted, bold: true });
  drawText(pdf, value, x + 3, y + 13.5, { size: 13, color: COLORS.ink, bold: true });
  drawText(pdf, detail, x + 3, y + 19, { size: 6.5, color: COLORS.muted });
}

function drawScopeCard(pdf: jsPDF, title: string, items: string[], x: number, y: number, width: number): number {
  const joined = items.length > 0 ? items.join(', ') : 'None';
  const lines = wrappedLines(pdf, joined, width - 8, 7.5);
  const height = Math.max(18, 9 + lines.length * 3.7);
  setColor(pdf, COLORS.neutralFill, 'fill');
  pdf.roundedRect(x, y, width, height, 1, 1, 'F');
  drawText(pdf, title.toUpperCase(), x + 4, y + 5.5, { size: 6.3, color: COLORS.accent, bold: true });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  setColor(pdf, COLORS.ink, 'text');
  pdf.text(lines, x + 4, y + 11);
  return y + height;
}

function snapshotHeaders(pdf: jsPDF, y: number, columnWidths: number[]): void {
  const headers = ['Category', 'Cluster', 'Samples', 'Latest score', 'Baseline', 'Delta', 'Status'];
  let x = PAGE_MARGIN;
  setColor(pdf, COLORS.ink, 'fill');
  pdf.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 8, 'F');
  headers.forEach((header, index) => {
    drawText(pdf, header, x + 2, y + 5.3, { size: 7, color: COLORS.white, bold: true });
    x += columnWidths[index];
  });
}

function drawSnapshotRow(pdf: jsPDF, row: ScoreSnapshotRow, y: number, columnWidths: number[], rowIndex: number): void {
  const delta = row.baseline === undefined ? undefined : row.latestScore - row.baseline;
  const cells = [
    row.categoryName,
    row.clusterName,
    String(row.samples),
    formatNumber(row.latestScore),
    row.baseline === undefined ? '-' : formatNumber(row.baseline),
    delta === undefined ? '-' : (delta > 0 ? '+' : '') + formatNumber(delta),
    delta === undefined ? 'No baseline' : delta >= 0 ? 'Met baseline' : 'Below baseline',
  ];
  setColor(pdf, rowIndex % 2 === 0 ? COLORS.panel : COLORS.white, 'fill');
  pdf.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 10, 'F');
  setColor(pdf, COLORS.border, 'draw');
  pdf.setLineWidth(0.15);
  pdf.line(PAGE_MARGIN, y + 10, PAGE_WIDTH - PAGE_MARGIN, y + 10);
  let x = PAGE_MARGIN;
  cells.forEach((cell, index) => {
    if (index === 3) {
      drawText(pdf, cell, x + 2, y + 4.2, { size: 7, bold: true });
      drawText(pdf, formatDate(row.latestDate), x + 2, y + 8, { size: 5.8, color: COLORS.muted });
    } else {
      const color = index === 6 && delta !== undefined ? (delta >= 0 ? COLORS.green : COLORS.red) : COLORS.ink;
      drawWrappedText(pdf, cell, x + 2, y + 6, columnWidths[index] - 4, {
        size: index === 6 ? 6.5 : 7,
        color,
        bold: index === 6,
      });
    }
    x += columnWidths[index];
  });
}

function drawOverview(pdf: jsPDF, input: ReportInput, reportTitle: string): void {
  drawPageHeader(pdf, 'Executive overview');
  drawText(pdf, 'HISTORICAL SCORE REPORT', PAGE_MARGIN, 22, { size: 7, color: COLORS.accent, bold: true });
  drawText(pdf, reportTitle, PAGE_MARGIN, 32, { size: 22, bold: true });
  drawWrappedText(
    pdf,
    'Comparative resiliency performance across the selected categories and clusters.',
    PAGE_MARGIN,
    39,
    165,
    { size: 8.5, color: COLORS.muted },
  );
  drawText(pdf, 'Generated', PAGE_WIDTH - PAGE_MARGIN - 61, 23, { size: 6.5, color: COLORS.muted });
  drawText(pdf, input.reportGeneratedAt, PAGE_WIDTH - PAGE_MARGIN - 61, 28, { size: 7.5, bold: true });
  drawText(pdf, 'History queried', PAGE_WIDTH - PAGE_MARGIN - 61, 34, { size: 6.5, color: COLORS.muted });
  drawText(pdf, input.queriedAt || 'Unknown', PAGE_WIDTH - PAGE_MARGIN - 61, 39, { size: 7.5, bold: true });

  const allPoints = input.clusters.flatMap((cluster) => input.categories.flatMap((categoryName) => (
    getClusterPoints(input.queryResult, categoryName, cluster)
  )));
  const runCount = new Set(allPoints.map((point) => point.runId)).size;
  const metricGap = 4;
  const metricWidth = (CONTENT_WIDTH - metricGap * 3) / 4;
  const modeLabel = input.chartMode === 'separate' ? 'Separate configurations' : 'Combined by category';
  const cards = [
    ['Score samples', String(allPoints.length), 'Recorded cluster scores'],
    ['Unique runs', String(runCount), 'Distinct scored runs'],
    ['Charts', String(input.charts.length), modeLabel],
    ['Config groups', String(collectConfigurations(input.queryResult, input.categories, input.clusters).length), 'Effective configurations'],
  ];
  cards.forEach((item, index) => drawMetricCard(
    pdf,
    PAGE_MARGIN + index * (metricWidth + metricGap),
    46,
    metricWidth,
    item[0],
    item[1],
    item[2],
  ));

  const scopeY = 73;
  const scopeGap = 5;
  const scopeWidth = (CONTENT_WIDTH - scopeGap) / 2;
  const categoriesBottom = drawScopeCard(pdf, 'Categories', input.categories, PAGE_MARGIN, scopeY, scopeWidth);
  const clustersBottom = drawScopeCard(
    pdf,
    'Clusters',
    input.clusters.map(clusterDisplayName),
    PAGE_MARGIN + scopeWidth + scopeGap,
    scopeY,
    scopeWidth,
  );
  const tableTop = Math.max(categoriesBottom, clustersBottom) + 7;
  let y = drawSectionTitle(
    pdf,
    'Latest score snapshot',
    'Delta is the latest score minus its recorded run baseline. A non-negative value meets or exceeds baseline.',
    tableTop,
  );
  const columnWidths = [44, 46, 20, 46, 28, 23, 62];
  const rows = buildSnapshotRows(input);
  if (rows.length === 0) {
    drawText(pdf, 'No scored runs match the selected scope.', PAGE_MARGIN, y + 5, { size: 8, color: COLORS.muted });
    return;
  }
  if (y + 18 > CONTENT_BOTTOM) {
    y = startPage(pdf, 'Latest score snapshot (continued)');
    y = drawSectionTitle(pdf, 'Latest score snapshot', 'Continued', y);
  }
  snapshotHeaders(pdf, y, columnWidths);
  y += 8;
  rows.forEach((row, rowIndex) => {
    if (y + 10 > CONTENT_BOTTOM) {
      y = startPage(pdf, 'Latest score snapshot (continued)');
      y = drawSectionTitle(pdf, 'Latest score snapshot', 'Continued', y);
      snapshotHeaders(pdf, y, columnWidths);
      y += 8;
    }
    drawSnapshotRow(pdf, row, y, columnWidths, rowIndex);
    y += 10;
  });
}

function dateRange(points: ResiliencyHistoryChartPoint[]): [number, number] {
  const values = points.map((point) => point.x).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min - 3_600_000, max + 3_600_000];
  const padding = (max - min) * 0.04;
  return [min - padding, max + padding];
}

function scoreRange(points: ResiliencyHistoryChartPoint[], showBaselines: boolean): [number, number] {
  const values = points.flatMap((point) => [
    point.y,
    ...(showBaselines && typeof point.baseline === 'number' && Number.isFinite(point.baseline) ? [point.baseline] : []),
  ]).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  const span = max - min;
  const padding = span === 0 ? Math.max(Math.abs(max) * 0.3, 5) : span * 0.3;
  return [min - padding, max + padding];
}

function drawChart(
  pdf: jsPDF,
  chart: ResiliencyHistoryChartModel,
  x: number,
  y: number,
  width: number,
  height: number,
  showBaselines: boolean,
): void {
  setColor(pdf, COLORS.white, 'fill');
  setColor(pdf, COLORS.border, 'draw');
  pdf.setLineWidth(0.25);
  pdf.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  const allPoints = chart.series.flatMap((series) => series.data);
  const chartTitle = chart.title;
  const titleLines = wrappedLines(pdf, chartTitle, width - 8, 8).slice(0, 2);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setColor(pdf, COLORS.ink, 'text');
  pdf.text(titleLines, x + 4, y + 6.5);
  const configLabel = chart.configurationProfileName
    ? 'Parameter profile: ' + chart.configurationProfileName
    : chart.configurationGroupId
      ? 'Configuration: ' + chart.configurationGroupId
    : chart.isMixedConfiguration ? 'Combined configurations' : 'No configuration group';
  drawText(pdf, configLabel, x + 4, y + 14, { size: 6, color: COLORS.muted });

  const plot = { x: x + 18, y: y + 21, width: width - 24, height: height - 45 };
  if (allPoints.length === 0) {
    drawText(pdf, 'No score samples in this group.', x + width / 2, y + height / 2, {
      size: 8,
      color: COLORS.muted,
      align: 'center',
    });
    return;
  }
  const [minX, maxX] = dateRange(allPoints);
  const [minY, maxY] = scoreRange(allPoints, showBaselines);
  const toX = (value: number) => plot.x + ((value - minX) / (maxX - minX)) * plot.width;
  const toY = (value: number) => plot.y + plot.height - ((value - minY) / (maxY - minY)) * plot.height;

  for (let index = 0; index <= 4; index += 1) {
    const fraction = index / 4;
    const gridY = plot.y + fraction * plot.height;
    setColor(pdf, COLORS.grid, 'draw');
    pdf.setLineWidth(0.2);
    pdf.line(plot.x, gridY, plot.x + plot.width, gridY);
    const value = maxY - fraction * (maxY - minY);
    drawText(pdf, formatNumber(value), plot.x - 2, gridY + 1, { size: 5.6, color: COLORS.muted, align: 'right' });
  }
  setColor(pdf, COLORS.border, 'draw');
  pdf.setLineWidth(0.3);
  pdf.line(plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height);
  const firstDate = new Date(Math.min(...allPoints.map((point) => point.x)));
  const lastDate = new Date(Math.max(...allPoints.map((point) => point.x)));
  drawText(pdf, formatDate(firstDate.toISOString(), false), plot.x, plot.y + plot.height + 4, {
    size: 5.7,
    color: COLORS.muted,
  });
  drawText(pdf, formatDate(lastDate.toISOString(), false), plot.x + plot.width, plot.y + plot.height + 4, {
    size: 5.7,
    color: COLORS.muted,
    align: 'right',
  });

  chart.series.forEach((series, seriesIndex) => {
    const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
    const points = series.data;
    setColor(pdf, color, 'draw');
    pdf.setLineWidth(0.8);
    points.slice(1).forEach((point, index) => {
      const previous = points[index];
      pdf.line(toX(previous.x), toY(previous.y), toX(point.x), toY(point.y));
    });
    points.forEach((point) => {
      if (showBaselines && typeof point.baseline === 'number' && Number.isFinite(point.baseline)) {
        const baselineColor = point.y >= point.baseline ? COLORS.green : COLORS.red;
        setColor(pdf, baselineColor, 'draw');
        pdf.setLineWidth(0.45);
        pdf.line(toX(point.x), toY(point.y), toX(point.x), toY(point.baseline));
        pdf.line(toX(point.x) - 1.2, toY(point.baseline), toX(point.x) + 1.2, toY(point.baseline));
      }
      setColor(pdf, color, 'fill');
      setColor(pdf, COLORS.white, 'draw');
      pdf.setLineWidth(0.25);
      pdf.circle(toX(point.x), toY(point.y), 1.1, 'FD');
    });
  });

  const legendY = y + height - 8;
  let legendX = x + 4;
  chart.series.forEach((series, index) => {
    const color = SERIES_COLORS[index % SERIES_COLORS.length];
    setColor(pdf, color, 'draw');
    pdf.setLineWidth(1);
    pdf.line(legendX, legendY - 1, legendX + 5, legendY - 1);
    const label = safeText(series.clusterName);
    drawText(pdf, label, legendX + 7, legendY, { size: 6.2, color: COLORS.ink });
    legendX += Math.min(48, pdf.getTextWidth(label) + 12);
  });
  if (showBaselines && allPoints.some((point) => typeof point.baseline === 'number')) {
    const baselineX = x + width - 43;
    setColor(pdf, COLORS.green, 'draw');
    pdf.setLineWidth(1);
    pdf.line(baselineX, legendY - 1, baselineX + 4, legendY - 1);
    drawText(pdf, 'Baseline met', baselineX + 6, legendY, { size: 5.7, color: COLORS.muted });
    setColor(pdf, COLORS.red, 'draw');
    pdf.line(baselineX + 27, legendY - 1, baselineX + 31, legendY - 1);
    drawText(pdf, 'Below', baselineX + 33, legendY, { size: 5.7, color: COLORS.muted });
  }
}

function drawCharts(pdf: jsPDF, input: ReportInput): void {
  const charts = input.charts;
  if (charts.length === 0) {
    let y = startPage(pdf, 'Score trends');
    y = drawSectionTitle(pdf, 'Score trends', 'No chart data is available for the selected scope.', y);
    drawText(pdf, 'No charts to display.', PAGE_MARGIN, y + 4, { size: 8, color: COLORS.muted });
    return;
  }
  for (let index = 0; index < charts.length; index += 2) {
    let y = startPage(pdf, index === 0 ? 'Score trends' : 'Score trends (continued)');
    y = drawSectionTitle(
      pdf,
      index === 0 ? 'Score trends' : 'Score trends (continued)',
      'Scores by cluster over time. The vertical range includes 30% padding around the observed scores and baselines.',
      y,
    );
    const gap = 5;
    const chartWidth = (CONTENT_WIDTH - gap) / 2;
    const chartHeight = 130;
    drawChart(pdf, charts[index], PAGE_MARGIN, y, chartWidth, chartHeight, input.showBaselines);
    if (charts[index + 1]) {
      drawChart(pdf, charts[index + 1], PAGE_MARGIN + chartWidth + gap, y, chartWidth, chartHeight, input.showBaselines);
    }
  }
}

function drawSubsectionTitle(pdf: jsPDF, title: string, y: number): number {
  drawText(pdf, title, PAGE_MARGIN, y + 4, { size: 9, bold: true });
  setColor(pdf, COLORS.accent, 'draw');
  pdf.setLineWidth(0.7);
  pdf.line(PAGE_MARGIN, y + 6, PAGE_MARGIN + 11, y + 6);
  return y + 10;
}

function drawValueGrid(
  pdf: jsPDF,
  entries: [string, string][],
  startY: number,
  ensureSpace: (cursorY: number, height: number) => number,
): number {
  if (entries.length === 0) {
    const y = ensureSpace(startY, 10);
    drawText(pdf, 'No values configured', PAGE_MARGIN + 1, y + 5, { size: 7.3, color: COLORS.muted });
    return y + 9;
  }
  const gap = 4;
  const columnWidth = (CONTENT_WIDTH - gap) / 2;
  let y = startY;
  for (let index = 0; index < entries.length; index += 2) {
    const pair = entries.slice(index, index + 2);
    const formatted = pair.map(([key, value]) => {
      const displayValue = SENSITIVE_FIELD.test(key) ? '[redacted]' : value;
      const lines = wrappedLines(pdf, displayValue, columnWidth - 8, 7.2);
      return { key, lines };
    });
    const maxLines = Math.max(...formatted.map((item) => item.lines.length));
    const rowHeight = Math.max(12, 7 + maxLines * 3.4);
    y = ensureSpace(y, rowHeight);
    pair.forEach((_, pairIndex) => {
      const x = PAGE_MARGIN + pairIndex * (columnWidth + gap);
      if (!formatted[pairIndex]) return;
      setColor(pdf, COLORS.panel, 'fill');
      setColor(pdf, COLORS.border, 'draw');
      pdf.setLineWidth(0.2);
      pdf.roundedRect(x, y, columnWidth, rowHeight - 1, 0.8, 0.8, 'FD');
      drawText(pdf, formatted[pairIndex].key, x + 3, y + 4, { size: 6.2, color: COLORS.accent, bold: true });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.2);
      setColor(pdf, COLORS.ink, 'text');
      pdf.text(formatted[pairIndex].lines, x + 3, y + 8.5);
    });
    y += rowHeight;
  }
  return y;
}

function drawTargetClusters(
  pdf: jsPDF,
  clusters: Record<string, string[]>,
  startY: number,
  ensureSpace: (cursorY: number, height: number) => number,
): number {
  const entries = Object.entries(clusters);
  if (entries.length === 0) {
    const y = ensureSpace(startY, 10);
    drawText(pdf, 'No target clusters recorded', PAGE_MARGIN + 1, y + 5, { size: 7.3, color: COLORS.muted });
    return y + 9;
  }
  let y = startY;
  entries.forEach(([provider, names]) => {
    const value = names.join(', ') || 'No clusters';
    const lines = wrappedLines(pdf, value, CONTENT_WIDTH - 51, 7.2);
    const height = Math.max(10, 4 + lines.length * 3.6);
    y = ensureSpace(y, height);
    setColor(pdf, COLORS.panel, 'fill');
    pdf.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, height - 1, 0.8, 0.8, 'F');
    drawText(pdf, provider, PAGE_MARGIN + 3, y + 5.5, { size: 7, bold: true });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    setColor(pdf, COLORS.ink, 'text');
    pdf.text(lines, PAGE_MARGIN + 49, y + 5.5);
    y += height;
  });
  return y;
}

function drawGraphNode(
  pdf: jsPDF,
  nodeId: string,
  node: GraphScenarioNode,
  startY: number,
  ensureSpace: (cursorY: number, height: number) => number,
): number {
  const scenarioName = node.scenario?.name || node.name || node.image || 'Scenario';
  let y = ensureSpace(startY, 24);
  setColor(pdf, COLORS.neutralFill, 'fill');
  pdf.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 13, 1, 1, 'F');
  drawText(pdf, nodeId, PAGE_MARGIN + 3, y + 5, { size: 8, color: COLORS.accent, bold: true });
  drawText(pdf, scenarioName, PAGE_MARGIN + 48, y + 5, { size: 8, bold: true });
  if (node.depends_on) {
    drawText(pdf, 'Runs after ' + node.depends_on, PAGE_MARGIN + 48, y + 10, { size: 6.4, color: COLORS.muted });
  }
  if (node.cloudCredentialRef) {
    drawText(pdf, 'Cloud credential configured', PAGE_WIDTH - PAGE_MARGIN - 3, y + 5, {
      size: 6.2,
      color: COLORS.muted,
      align: 'right',
    });
  }
  y += 16;
  y = drawValueGrid(pdf, Object.entries(node.env || {}).sort(([a], [b]) => a.localeCompare(b)), y, ensureSpace);
  const volumes = Object.entries(node.volumes || {}).sort(([a], [b]) => a.localeCompare(b));
  if (volumes.length > 0) {
    y = ensureSpace(y, 11);
    drawText(pdf, 'Volumes', PAGE_MARGIN + 1, y + 4, { size: 7, color: COLORS.muted, bold: true });
    y += 6;
    y = drawValueGrid(pdf, volumes, y, ensureSpace);
  }
  return y + 2;
}

function drawConfiguration(
  pdf: jsPDF,
  configuration: ReportConfiguration,
): void {
  let y = startPage(pdf, 'Configuration details');
  const name = configuration.scenarioNames.length > 0
    ? configuration.scenarioNames.join(', ')
    : configuration.runType === 'graph-runs' ? 'Graph workflow' : 'Scenario run';
  y = drawSectionTitle(pdf, name, configuration.groupId, y);
  const typeLabel = configuration.runType === 'graph-runs'
    ? 'GRAPH RUN'
    : configuration.runType === 'scenario-runs' ? 'SCENARIO RUN' : 'RUN DETAILS';
  setColor(pdf, COLORS.neutralFill, 'fill');
  pdf.roundedRect(PAGE_MARGIN, y, 35, 8, 1, 1, 'F');
  drawText(pdf, typeLabel, PAGE_MARGIN + 3, y + 5.2, { size: 6, color: COLORS.accent, bold: true });
  y += 12;

  const ensureSpace = (cursorY: number, height: number): number => {
    if (cursorY + height <= CONTENT_BOTTOM) return cursorY;
    y = startPage(pdf, 'Configuration details (continued)');
    drawText(pdf, name + ' (continued)', PAGE_MARGIN, y + 3, { size: 9, bold: true });
    drawWrappedText(pdf, configuration.groupId, PAGE_MARGIN, y + 8, CONTENT_WIDTH, { size: 6.5, color: COLORS.muted });
    y += 13;
    return y;
  };

  const config = configuration.config;
  if (!config) {
    drawText(pdf, 'The representative run configuration could not be loaded.', PAGE_MARGIN, y + 5, {
      size: 8,
      color: COLORS.muted,
    });
    return;
  }

  y = drawSubsectionTitle(pdf, 'Target clusters', y);
  y = drawTargetClusters(pdf, config.targetClusters || {}, y, ensureSpace);

  if ('graph' in config) {
    const nodes = Object.entries(config.graph || {}).sort(([a], [b]) => a.localeCompare(b));
    y = ensureSpace(y, 11);
    y = drawSubsectionTitle(pdf, 'Workflow nodes (' + nodes.length + ')', y);
    if (nodes.length === 0) {
      drawText(pdf, 'No workflow nodes recorded.', PAGE_MARGIN + 1, y + 5, { size: 7.3, color: COLORS.muted });
      y += 9;
    } else {
      nodes.forEach(([nodeId, node]) => {
        y = drawGraphNode(pdf, nodeId, node, y, ensureSpace);
      });
    }
    const settings: [string, string][] = [];
    if (config.maxRetries !== undefined) settings.push(['Retries', String(config.maxRetries)]);
    if (config.cloudCredentialRef) settings.push(['Cloud credential', 'Configured']);
    if (settings.length > 0) {
      y = ensureSpace(y, 10);
      y = drawSubsectionTitle(pdf, 'Workflow settings', y);
      y = drawValueGrid(pdf, settings, y, ensureSpace);
    }
  } else {
    const scenarioName = config.scenario?.name || config.scenarioName || 'Scenario run';
    const scenarioDetails: [string, string][] = [['Name', scenarioName]];
    if (config.scenarioImage) scenarioDetails.push(['Image', config.scenarioImage]);
    y = ensureSpace(y, 10);
    y = drawSubsectionTitle(pdf, 'Scenario', y);
    y = drawValueGrid(pdf, scenarioDetails, y, ensureSpace);
    y = ensureSpace(y, 10);
    y = drawSubsectionTitle(pdf, 'Scenario variables', y);
    drawValueGrid(pdf, Object.entries(config.environment || {}).sort(([a], [b]) => a.localeCompare(b)), y, ensureSpace);
  }
}

function addPageFooters(pdf: jsPDF): void {
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    drawFooter(pdf, page, pageCount);
  }
}

/**
 * Composes a paginated A4 landscape report using vector charts and redacted configuration values.
 */
export async function buildResiliencyHistoryPdf(input: ReportInput): Promise<jsPDF> {
  const configurations = await loadConfigurations(input.queryResult, input.categories, input.clusters);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({
    title: 'Resiliency history report',
    subject: 'Historical resiliency score analysis',
    creator: 'Krkn Operator Console',
  });
  drawOverview(pdf, input, 'Resiliency history');
  drawCharts(pdf, input);
  configurations.forEach((configuration) => drawConfiguration(pdf, configuration));
  addPageFooters(pdf);
  return pdf;
}

/** Creates and downloads the report PDF without opening the browser print dialog. */
export async function downloadResiliencyHistoryPdf(input: ReportInput): Promise<void> {
  const pdf = await buildResiliencyHistoryPdf(input);
  const fileDate = new Date().toISOString().slice(0, 10);
  pdf.save('resiliency-history-' + fileDate + '.pdf');
}
