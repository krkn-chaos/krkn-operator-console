import type {
  CreateGraphRunRequest,
  GraphScenarioNode,
  JobConfigResponse,
  ResiliencyHistoryQueryResponse,
} from '../../types/api';
import { graphRunsApi } from '../../services/graphRunsApi';
import { operatorApi } from '../../services/operatorApi';
import { cacheSet, configCache } from '../scenarioConfigCache';
import type { ResiliencyHistoryChartModel } from './resiliencyHistoryUtils';
import reportStyles from './resiliencyHistoryReport.css?inline';

type ConfigurationRunType = 'scenario-runs' | 'graph-runs';
type RunConfiguration = CreateGraphRunRequest | JobConfigResponse;

interface ReportConfiguration {
  categoryName: string;
  groupId: string;
  runType?: ConfigurationRunType;
  runId?: string;
  scenarioNames: string[];
  config: RunConfiguration | null;
}

interface ReportChartVisual {
  svg: string;
  clusters: { name: string; color: string }[];
  hasBaselineKey: boolean;
}

interface ReportInput {
  queryResult: ResiliencyHistoryQueryResponse;
  categories: string[];
  clusters: string[];
  charts: ResiliencyHistoryChartModel[];
  chartMode: 'separate' | 'collapsed';
  showBaselines: boolean;
  queriedAt: string | null;
  reportGeneratedAt: string;
  chartVisuals: Map<string, ReportChartVisual>;
}

const SENSITIVE_FIELD = /PASSWORD|SECRET|TOKEN|KEY|CREDENTIAL|AUTH/i;

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function normalizeRunType(value: string | undefined): ConfigurationRunType | undefined {
  return value === 'scenario-runs' || value === 'graph-runs' ? value : undefined;
}

function collectConfigurations(
  response: ResiliencyHistoryQueryResponse,
  categories: string[],
  clusters: string[],
): Omit<ReportConfiguration, 'config'>[] {
  const entries: Omit<ReportConfiguration, 'config'>[] = [];

  categories.forEach((categoryName) => {
    const points = clusters.flatMap((clusterName) => response.clusters[clusterName]?.[categoryName] ?? []);
    const groupIds = [...new Set(points.map((point) => point.configurationGroupId))].sort();
    groupIds.forEach((groupId) => {
      const metadata = response.configurationGroups[categoryName]?.[groupId];
      const representativePoint = points.find((point) => point.configurationGroupId === groupId);
      const [idRunType, ...idRunParts] = groupId.split('/');
      entries.push({
        categoryName,
        groupId,
        runType: normalizeRunType(metadata?.runType) ?? normalizeRunType(idRunType) ?? normalizeRunType(representativePoint?.runType),
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
  const cacheKey = `${runType === 'graph-runs' ? 'graph' : 'scenario'}:${runId}`;
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
  clusters: string[],
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

function collectInlineSvgStyles(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originalElements = [svg, ...Array.from(svg.querySelectorAll<SVGElement>('*'))];
  const clonedElements = [clone, ...Array.from(clone.querySelectorAll<SVGElement>('*'))];
  const styleProperties = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
    'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
    'shape-rendering', 'paint-order', 'letter-spacing',
  ];

  originalElements.forEach((element, index) => {
    const cloned = clonedElements[index];
    if (!cloned) return;
    const computed = window.getComputedStyle(element);
    styleProperties.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (value) cloned.style.setProperty(property, value);
    });

    const classes = element.getAttribute('class')?.split(/\s+/) ?? [];
    if (classes.includes('resiliency-history__grid-line')) cloned.style.setProperty('stroke', '#d8dee8');
    if (classes.includes('resiliency-history__axis-text')) cloned.style.setProperty('fill', '#596579');
    if (classes.includes('resiliency-history__axis-title')) cloned.style.setProperty('fill', '#283447');
    cloned.removeAttribute('tabindex');
  });

  clone.setAttribute('class', 'resiliency-report__svg');
  clone.style.setProperty('display', 'block');
  clone.style.setProperty('width', '100%');
  clone.style.setProperty('height', 'auto');
  clone.style.setProperty('max-height', '72mm');
  clone.style.setProperty('cursor', 'default');
  clone.style.setProperty('overflow', 'visible');
  return clone.outerHTML;
}

export function captureResiliencyHistoryChartVisuals(charts: ResiliencyHistoryChartModel[]): Map<string, ReportChartVisual> {
  const chartCards = Array.from(document.querySelectorAll<HTMLElement>(
    '.resiliency-history__charts .resiliency-history__chart-card',
  ));
  return new Map(charts.flatMap((chart, index) => {
    const card = chartCards[index];
    const svg = card?.querySelector<SVGSVGElement>('svg.resiliency-history__svg');
    if (!card || !svg) return [];
    const clusters = Array.from(card.querySelectorAll<HTMLElement>('.resiliency-history__cluster-key li'))
      .map((item) => {
        const swatch = item.querySelector<HTMLElement>('span');
        const style = swatch ? window.getComputedStyle(swatch) : null;
        return {
          name: item.textContent?.trim() ?? '',
          color: style?.getPropertyValue('--series-color').trim() || style?.backgroundColor || '#2563eb',
        };
      });
    return [[chart.key, {
      svg: collectInlineSvgStyles(svg),
      clusters,
      hasBaselineKey: card.querySelector('.resiliency-history__baseline-key') !== null,
    }] as [string, ReportChartVisual]];
  }));
}

function renderMetric(label: string, value: number | string, detail: string): string {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function renderFilterList(title: string, items: string[]): string {
  return `<div class="scope-group"><h3>${escapeHtml(title)}</h3><div class="scope-chips">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div></div>`;
}

function renderSnapshotTable(
  response: ResiliencyHistoryQueryResponse,
  categories: string[],
  clusters: string[],
): string {
  const rows: string[] = [];
  categories.forEach((categoryName) => clusters.forEach((clusterName) => {
    const points = (response.clusters[clusterName]?.[categoryName] ?? [])
      .slice()
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    const latest = points[points.length - 1];
    if (!latest) return;

    const delta = typeof latest.baseline === 'number' ? latest.score - latest.baseline : undefined;
    const deltaClass = delta === undefined ? '' : delta >= 0 ? 'positive' : 'negative';
    const baselineStatus = delta === undefined ? 'No baseline' : delta >= 0 ? 'Met baseline' : 'Below baseline';
    const statusClass = delta === undefined ? 'status-neutral' : delta >= 0 ? 'status-met' : 'status-below';
    rows.push(`<tr>
      <td><strong>${escapeHtml(categoryName)}</strong></td>
      <td>${escapeHtml(clusterName)}</td>
      <td>${points.length}</td>
      <td><strong>${formatNumber(latest.score)}</strong><small class="cell-subtitle">${escapeHtml(formatDate(latest.date))}</small></td>
      <td>${typeof latest.baseline === 'number' ? formatNumber(latest.baseline) : '—'}</td>
      <td class="${deltaClass}">${delta === undefined ? '—' : `${delta > 0 ? '+' : ''}${formatNumber(delta)}`}</td>
      <td><span class="${statusClass}">${baselineStatus}</span></td>
    </tr>`);
  }));

  if (rows.length === 0) return '<p class="report-empty">No scored runs match the selected scope.</p>';
  return `<div class="table-wrap"><table class="snapshot-table">
    <thead><tr><th>Category</th><th>Cluster</th><th>Samples</th><th>Latest score</th><th>Baseline</th><th>Δ</th><th>Status</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;
}

function renderChartCards(charts: ResiliencyHistoryChartModel[], chartVisuals: Map<string, ReportChartVisual>): string {
  return charts.map((chart) => {
    const configurationSuffix = chart.configurationGroupId
      ? ` (configuration ${chart.configurationGroupId})`
      : '';
    const title = configurationSuffix && chart.title.endsWith(configurationSuffix)
      ? chart.title.slice(0, -configurationSuffix.length)
      : chart.title;
    const visual = chartVisuals.get(chart.key);
    const seriesLegend = visual?.clusters.length
      ? `<ul class="report-chart-legend">${visual.clusters.map((item) => `<li><span style="background:${escapeHtml(item.color)}"></span>${escapeHtml(item.name)}</li>`).join('')}</ul>`
      : '';
    const baselineLegend = visual?.hasBaselineKey
      ? '<div class="report-baseline-legend"><span class="report-baseline-met"></span>Baseline <strong>met</strong><span class="report-baseline-below"></span>Below baseline</div>'
      : '';
    return `<article class="report-chart-card">
      <div class="report-chart-heading"><h3>${escapeHtml(title)}</h3>${chart.configurationGroupId ? `<code>${escapeHtml(chart.configurationGroupId)}</code>` : ''}</div>
      ${visual ? `<div class="report-chart-visual">${visual.svg}</div>${baselineLegend}${seriesLegend}` : '<div class="report-chart-placeholder">Chart preview unavailable</div>'}
    </article>`;
  }).join('');
}

function renderValueRows(values: Record<string, string>): string {
  const rows = Object.entries(values).sort(([left], [right]) => left.localeCompare(right));
  if (rows.length === 0) return '<p class="config-empty">No values configured</p>';
  return `<dl class="config-values">${rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(SENSITIVE_FIELD.test(key) ? '••••••••' : value)}</dd></div>`).join('')}</dl>`;
}

function renderTargetClusters(clusters: Record<string, string[]>): string {
  const entries = Object.entries(clusters);
  if (entries.length === 0) return '<p class="config-empty">No target clusters recorded</p>';
  return `<ul class="config-targets">${entries.map(([provider, names]) => `<li><strong>${escapeHtml(provider)}</strong><span>${escapeHtml(names.join(', ') || 'No clusters')}</span></li>`).join('')}</ul>`;
}

function renderGraphNode(nodeId: string, node: GraphScenarioNode): string {
  const scenarioName = node.scenario?.name || node.name || node.image || 'Scenario';
  const volumes = Object.entries(node.volumes || {});
  return `<article class="config-node">
    <div class="config-node-heading"><strong>${escapeHtml(nodeId)}</strong><span>${escapeHtml(scenarioName)}</span></div>
    ${node.depends_on ? `<p class="config-dependency">Runs after <code>${escapeHtml(node.depends_on)}</code></p>` : ''}
    ${renderValueRows(node.env || {})}
    ${volumes.length ? `<div class="config-volumes"><h5>Volumes</h5><ul>${volumes.map(([name, path]) => `<li><code>${escapeHtml(name)}</code><span>${escapeHtml(SENSITIVE_FIELD.test(name) ? '••••••••' : path)}</span></li>`).join('')}</ul></div>` : ''}
  </article>`;
}

function renderRunConfiguration(config: RunConfiguration | null): string {
  if (!config) return '<p class="config-unavailable">The representative run configuration could not be loaded.</p>';

  if ('graph' in config) {
    const nodes = Object.entries(config.graph || {});
    return `<section class="config-detail-section">
      <h4>Target clusters</h4>${renderTargetClusters(config.targetClusters || {})}
    </section>
    <section class="config-detail-section">
      <h4>Workflow nodes <span>${nodes.length}</span></h4>
      ${nodes.length ? `<div class="config-nodes">${nodes.map(([nodeId, node]) => renderGraphNode(nodeId, node)).join('')}</div>` : '<p class="config-empty">No workflow nodes recorded</p>'}
    </section>
    ${(config.maxRetries !== undefined || config.cloudCredentialRef) ? `<section class="config-detail-section"><h4>Workflow settings</h4><dl class="config-overview">${config.maxRetries !== undefined ? `<div><dt>Retries</dt><dd>${config.maxRetries}</dd></div>` : ''}${config.cloudCredentialRef ? '<div><dt>Cloud credential</dt><dd>Configured</dd></div>' : ''}</dl></section>` : ''}`;
  }

  const scenarioName = config.scenario?.name || config.scenarioName || 'Scenario run';
  return `<section class="config-detail-section">
      <h4>Scenario</h4><dl class="config-overview"><div><dt>Name</dt><dd>${escapeHtml(scenarioName)}</dd></div>${config.scenarioImage ? `<div><dt>Image</dt><dd>${escapeHtml(config.scenarioImage)}</dd></div>` : ''}</dl>
    </section>
    <section class="config-detail-section"><h4>Target clusters</h4>${renderTargetClusters(config.targetClusters || {})}</section>
    <section class="config-detail-section"><h4>Scenario variables</h4>${renderValueRows(config.environment || {})}</section>`;
}

function renderConfigurationCards(configurations: ReportConfiguration[]): string {
  if (configurations.length === 0) return '<p class="report-empty">No configuration groups were found for the selected scope.</p>';

  return configurations.map((configuration) => `<article class="configuration-card">
    <header class="configuration-card-heading">
      <div><span>${escapeHtml(configuration.categoryName)}</span><h3>${escapeHtml(configuration.scenarioNames.length ? configuration.scenarioNames.join(', ') : configuration.runType === 'graph-runs' ? 'Graph workflow' : 'Scenario run')}</h3></div>
      <code>${escapeHtml(configuration.groupId)}</code>
    </header>
    <div class="configuration-card-type">${configuration.runType === 'graph-runs' ? 'Graph run' : configuration.runType === 'scenario-runs' ? 'Scenario run' : 'Run details'}</div>
    ${renderRunConfiguration(configuration.config)}
  </article>`).join('');
}

function renderReportStyles(): string {
  return `<style>${reportStyles}</style>`;
}

function renderReportHtml(input: ReportInput, configurations: ReportConfiguration[]): string {
  const allPoints = input.clusters.flatMap((clusterName) => input.categories.flatMap((categoryName) => (
    input.queryResult.clusters[clusterName]?.[categoryName] ?? []
  )));
  const uniqueRuns = new Set(allPoints.map((point) => point.runId));
  const baselineMode = input.showBaselines ? 'Shown on charts' : 'Hidden on charts';
  const chartModeLabel = input.chartMode === 'separate' ? 'Separate configuration groups' : 'Combined by category';
  const overview = `<section class="report-page report-page--overview">
    <div class="report-masthead"><span class="report-brand">KRKN / OPERATOR CONSOLE</span><span>Resiliency analysis</span></div>
    <header class="report-hero"><div><p class="report-kicker">Historical score report</p><h1>Resiliency history</h1><p class="report-subtitle">A comparative view of resiliency performance across selected categories and clusters.</p></div><div class="report-generated">Report generated<strong>${escapeHtml(input.reportGeneratedAt)}</strong><span>History queried ${escapeHtml(input.queriedAt || 'Unknown')}</span></div></header>
    <div class="report-metrics">
      ${renderMetric('Score samples', allPoints.length, 'Recorded cluster scores')}
      ${renderMetric('Unique runs', uniqueRuns.size, 'Distinct scored runs')}
      ${renderMetric('Charts', input.charts.length, chartModeLabel)}
      ${renderMetric('Config groups', configurations.length, 'Effective run configurations')}
    </div>
    <div class="report-scope">${renderFilterList('Categories', input.categories)}${renderFilterList('Clusters', input.clusters)}</div>
    <div class="report-section-title"><h2>Latest score snapshot</h2><p>${escapeHtml(chartModeLabel)} · Baseline comparisons ${escapeHtml(baselineMode.toLowerCase())}</p></div>
    ${renderSnapshotTable(input.queryResult, input.categories, input.clusters)}
    <p class="report-note">Δ is calculated as latest score minus its recorded run baseline. A non-negative value meets or exceeds the baseline.</p>
  </section>`;
  const chartSection = `<section class="report-page report-page--charts">
    <div class="report-masthead"><span class="report-brand">KRKN / OPERATOR CONSOLE</span><span>Score trends</span></div>
    <header class="report-section-title"><h2>Score trends</h2><p>Each plot is a vector chart with dates, scores, cluster series, and available baseline markers.</p></header>
    <div class="report-chart-grid">${renderChartCards(input.charts, input.chartVisuals)}</div>
  </section>`;
  const configSection = `<section class="report-page report-page--configurations">
    <div class="report-masthead"><span class="report-brand">KRKN / OPERATOR CONSOLE</span><span>Configuration reference</span></div>
    <header class="report-section-title"><h2>Configurations compared</h2><p>Saved representative-run settings for the configuration groups in the selected scope.</p></header>
    <div class="report-config-grid">${renderConfigurationCards(configurations)}</div>
  </section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Resiliency history report</title>${renderReportStyles()}</head><body>
    <nav class="report-toolbar" aria-label="Report actions"><button class="primary" id="report-print">Print / Save as PDF</button><button id="report-close">Close report</button></nav>
    ${overview}${chartSection}${configSection}
  </body></html>`;
}

export async function prepareResiliencyHistoryReport(input: ReportInput): Promise<string> {
  const configurations = await loadConfigurations(input.queryResult, input.categories, input.clusters);
  return renderReportHtml(input, configurations);
}
