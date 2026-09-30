import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FocusEvent, MouseEvent, PointerEvent, WheelEvent } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Title } from '@patternfly/react-core';
import {
  calculateBaselineTickHalfWidth,
  type ResiliencyHistoryChartModel,
  type ResiliencyHistoryChartPoint,
} from './resiliencyHistoryUtils';
import { ResiliencyHistoryConfigurationTooltip } from './ResiliencyHistoryConfigurationTooltip';

const CLUSTER_COLORS = [
  '#2563eb', '#7c3aed', '#0f766e', '#c2410c', '#be185d',
  '#4d7c0f', '#475569', '#0369a1', '#9333ea', '#a16207',
];
const SVG_HEIGHT = 390;
const MARGIN = { top: 24, right: 24, bottom: 62, left: 62 };
const SCORE_PADDING = 30;
const DATE_TICK_COUNT = 5;

interface ChartDomain {
  x: [number, number];
  y: [number, number];
}

interface ActiveTooltip {
  point: ResiliencyHistoryChartPoint;
  clusterName: string;
  color: string;
  left: number;
  top: number;
}

function getFullDomain(chart: ResiliencyHistoryChartModel): ChartDomain {
  const dates = chart.series.flatMap((series) => series.data.map((point) => point.x));
  if (dates.length === 0) return { x: [0, 1], y: [-SCORE_PADDING, SCORE_PADDING] };

  const start = Math.min(...dates);
  const end = Math.max(...dates);
  const scoresAndBaselines = chart.series.flatMap((series) => series.data.flatMap((point) => (
    typeof point.baseline === 'number' && Number.isFinite(point.baseline)
      ? [point.y, point.baseline]
      : [point.y]
  )));
  const minScore = Math.min(...scoresAndBaselines);
  const maxScore = Math.max(...scoresAndBaselines);
  const intervals = chart.series.flatMap((series) => series.data.slice(1).map((point, index) => (
    point.x - series.data[index].x
  ))).filter((interval) => interval > 0 && Number.isFinite(interval));
  const padding = intervals.length > 0 ? Math.min(...intervals) * 0.12 : 30 * 60 * 1000;

  return {
    x: [start - padding, end + padding],
    y: [minScore - SCORE_PADDING, maxScore + SCORE_PADDING],
  };
}

function zoomDomain(
  current: ChartDomain,
  full: ChartDomain,
  factor: number,
  xAnchor = 0.5,
  yAnchor = 0.5,
): ChartDomain {
  const zoomAxis = (range: [number, number], bounds: [number, number], anchor: number): [number, number] => {
    const fullSpan = bounds[1] - bounds[0];
    const oldSpan = range[1] - range[0];
    const minSpan = fullSpan * 0.01;
    const span = Math.max(minSpan, Math.min(fullSpan, oldSpan * factor));
    const point = range[0] + oldSpan * anchor;
    const start = Math.max(bounds[0], Math.min(bounds[1] - span, point - span * anchor));
    return [start, start + span];
  };

  return {
    x: zoomAxis(current.x, full.x, xAnchor),
    y: zoomAxis(current.y, full.y, yAnchor),
  };
}

function panDomain(current: ChartDomain, full: ChartDomain, deltaX: number, deltaY: number): ChartDomain {
  const panAxis = (range: [number, number], bounds: [number, number], delta: number): [number, number] => {
    const span = range[1] - range[0];
    const start = Math.max(bounds[0], Math.min(bounds[1] - span, range[0] + delta));
    return [start, start + span];
  };

  return {
    x: panAxis(current.x, full.x, deltaX),
    y: panAxis(current.y, full.y, deltaY),
  };
}

function isFullDomain(current: ChartDomain, full: ChartDomain): boolean {
  return current.x.every((value, index) => Math.abs(value - full.x[index]) < 0.001)
    && current.y.every((value, index) => Math.abs(value - full.y[index]) < 0.001);
}

function formatDateTick(value: number, range: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return range < 2 * 24 * 60 * 60 * 1000
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: range > 365 * 24 * 60 * 60 * 1000 ? 'numeric' : undefined });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function formatDelta(score: number, baseline: number): string {
  const delta = score - baseline;
  if (delta === 0) return '+0';
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

function getScoreTicks(domain: [number, number]): number[] {
  const rawStep = (domain[1] - domain[0]) / 6;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const step = (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 3 ? 2.5 : normalizedStep <= 5 ? 5 : 10) * magnitude;
  const firstTick = Math.ceil(domain[0] / step) * step;
  const ticks: number[] = [];
  for (let tick = firstTick; tick <= domain[1]; tick += step) ticks.push(Number(tick.toFixed(3)));
  return ticks;
}

function getTickHalfWidth(
  series: ResiliencyHistoryChartModel['series'][number],
  pointIndex: number,
  toX: (value: number) => number,
): number {
  const point = series.data[pointIndex];
  const nearby = [series.data[pointIndex - 1], series.data[pointIndex + 1]]
    .filter((neighbor): neighbor is ResiliencyHistoryChartPoint => neighbor !== undefined)
    .map((neighbor) => Math.abs(toX(neighbor.x) - toX(point.x)))
    .filter((distance) => distance > 0 && Number.isFinite(distance));

  return calculateBaselineTickHalfWidth(nearby.length > 0 ? Math.min(...nearby) : undefined);
}

/** Draws an interactive, responsive score history chart with native SVG. */
export function ResiliencyHistoryChart({
  chart,
  showBaselines = true,
}: {
  chart: ResiliencyHistoryChartModel;
  showBaselines?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; domain: ChartDomain } | null>(null);
  const [width, setWidth] = useState(800);
  const [isDragging, setIsDragging] = useState(false);
  const [tooltip, setTooltip] = useState<ActiveTooltip | null>(null);
  const fullDomain = useMemo(() => getFullDomain(chart), [chart]);
  const [domain, setDomain] = useState<ChartDomain>(fullDomain);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;
    const updateWidth = (nextWidth = element.clientWidth) => {
      if (nextWidth > 0) setWidth(Math.floor(nextWidth));
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => updateWidth();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
    const observer = new ResizeObserver((entries) => updateWidth(entries[0]?.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setDomain(fullDomain);
    setTooltip(null);
  }, [fullDomain]);

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
  const xSpan = domain.x[1] - domain.x[0];
  const ySpan = domain.y[1] - domain.y[0];
  const toX = (value: number) => MARGIN.left + ((value - domain.x[0]) / xSpan) * plotWidth;
  const toY = (value: number) => MARGIN.top + ((domain.y[1] - value) / ySpan) * plotHeight;
  const scoreTicks = getScoreTicks(domain.y);
  const baselinePoints = chart.series.flatMap((series) => series.data.map((point) => point.baseline)
    .filter((baseline): baseline is number => typeof baseline === 'number' && Number.isFinite(baseline)));
  const hasBaselines = showBaselines && baselinePoints.length > 0;
  const chartIsZoomed = !isFullDomain(domain, fullDomain);
  const visibleTitle = chart.title;

  const showPointTooltip = (
    event: MouseEvent<SVGCircleElement> | FocusEvent<SVGCircleElement>,
    point: ResiliencyHistoryChartPoint,
    clusterName: string,
    color: string,
  ) => {
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    const target = event.currentTarget.getBoundingClientRect();
    const rawLeft = 'clientX' in event && event.clientX > 0
      ? event.clientX - stage.left
      : target.left + target.width / 2 - stage.left;
    const rawTop = 'clientY' in event && event.clientY > 0
      ? event.clientY - stage.top
      : target.top - stage.top;
    const tooltipWidth = Math.min(360, Math.max(160, stage.width - 16));
    const left = Math.max(tooltipWidth / 2 + 8, Math.min(stage.width - tooltipWidth / 2 - 8, rawLeft));
    const top = Math.max(100, rawTop);
    setTooltip({ point, clusterName, color, left, top });
  };

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * width;
    const y = ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * SVG_HEIGHT;
    const xAnchor = Math.max(0, Math.min(1, (x - MARGIN.left) / plotWidth));
    const yAnchor = Math.max(0, Math.min(1, (y - MARGIN.top) / plotHeight));
    const factor = event.deltaY < 0 ? 0.82 : 1.22;
    setDomain((current) => zoomDomain(current, fullDomain, factor, xAnchor, yAnchor));
    setTooltip(null);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { x: event.clientX, y: event.clientY, domain };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
    setTooltip(null);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dragX = event.clientX - dragRef.current.x;
    const dragY = event.clientY - dragRef.current.y;
    setDomain(panDomain(
      dragRef.current.domain,
      fullDomain,
      -(dragX / Math.max(1, bounds.width)) * (dragRef.current.domain.x[1] - dragRef.current.domain.x[0]),
      (dragY / Math.max(1, bounds.height)) * (dragRef.current.domain.y[1] - dragRef.current.domain.y[0]),
    ));
  };

  const stopPanning = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const zoomBy = (factor: number) => {
    setDomain((current) => zoomDomain(current, fullDomain, factor));
    setTooltip(null);
  };

  return (
    <Card className="resiliency-history__chart-card" aria-label={chart.title}>
      <CardTitle>
        <div className="resiliency-history__chart-heading">
          <Title headingLevel="h3" size="md" aria-label={chart.title}>{visibleTitle}</Title>
          {chart.configurationGroupId && chart.configurationRunType && chart.configurationRunId && (
            <ResiliencyHistoryConfigurationTooltip
              configurationGroupId={chart.configurationGroupId}
              parameterProfileName={chart.configurationProfileName}
              runType={chart.configurationRunType}
              runId={chart.configurationRunId}
            />
          )}
        </div>
      </CardTitle>
      <CardBody>
        {!chart.hasData ? (
          <Alert variant="info" isInline isPlain title="No scores for this selection" />
        ) : (
          <>
            <div className="resiliency-history__chart-toolbar">
              <div className="resiliency-history__zoom-controls" role="group" aria-label="Chart zoom controls">
                <Button variant="secondary" size="sm" aria-label="Zoom out" onClick={() => zoomBy(1.3)}>−</Button>
                <Button variant="secondary" size="sm" aria-label="Zoom in" onClick={() => zoomBy(0.77)}>+</Button>
                <Button variant="link" size="sm" isDisabled={!chartIsZoomed} onClick={() => setDomain(fullDomain)}>Reset</Button>
              </div>
              <span className="resiliency-history__chart-hint">Scroll to zoom · Drag to pan</span>
            </div>

            <div ref={stageRef} className="resiliency-history__chart-stage">
              {tooltip && (
                <div
                  className="resiliency-history__point-tooltip"
                  style={{ left: tooltip.left, top: tooltip.top, '--point-color': tooltip.color } as CSSProperties}
                  role="status"
                  aria-live="polite"
                >
                  <div className="resiliency-history__tooltip-score">
                    <span className="resiliency-history__tooltip-dot" aria-hidden="true" />
                    <strong>{tooltip.point.y}</strong>
                    <span>score</span>
                  </div>
                  {typeof tooltip.point.baseline === 'number' && Number.isFinite(tooltip.point.baseline) && (
                    <div className="resiliency-history__tooltip-baseline">
                      <span>Baseline {tooltip.point.baseline}</span>
                      <span>Δ {formatDelta(tooltip.point.y, tooltip.point.baseline)}</span>
                      <span className={tooltip.point.y >= tooltip.point.baseline ? 'is-met' : 'is-below'}>
                        {tooltip.point.y >= tooltip.point.baseline ? 'Met baseline' : 'Below baseline'}
                      </span>
                    </div>
                  )}
                  <div className="resiliency-history__tooltip-run">
                    {tooltip.clusterName} <span aria-hidden="true">·</span> {formatDate(tooltip.point.date)}
                    <span aria-hidden="true">·</span> {tooltip.point.runId}
                  </div>
                </div>
              )}

              <svg
                className={`resiliency-history__svg${isDragging ? ' is-panning' : ''}`}
                viewBox={`0 0 ${width} ${SVG_HEIGHT}`}
                role="group"
                aria-labelledby={`${id}-title ${id}-description`}
                data-zoomed={chartIsZoomed}
                data-y-min={domain.y[0]}
                data-y-max={domain.y[1]}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopPanning}
                onPointerCancel={stopPanning}
                onPointerLeave={() => { if (!dragRef.current) setTooltip(null); }}
              >
                <title id={`${id}-title`}>{chart.title}</title>
                <desc id={`${id}-description`}>
                  Resiliency scores by date. Colored lines identify clusters. Use the chart zoom buttons, scroll to zoom, or drag to pan.
                  {hasBaselines ? ' Solid colored ticks show per-run baselines; dashed connectors identify scores below baseline.' : ''}
                </desc>
                <defs>
                  <clipPath id={`${id}-plot-clip`}>
                    <rect x={MARGIN.left} y={MARGIN.top} width={plotWidth} height={plotHeight} />
                  </clipPath>
                </defs>

                {scoreTicks.map((tick) => (
                  <g key={`y-tick-${tick}`}>
                    <line
                      x1={MARGIN.left}
                      x2={width - MARGIN.right}
                      y1={toY(tick)}
                      y2={toY(tick)}
                      className="resiliency-history__grid-line"
                    />
                    <text x={MARGIN.left - 12} y={toY(tick) + 4} textAnchor="end" className="resiliency-history__axis-text">
                      {tick}
                    </text>
                  </g>
                ))}

                {Array.from({ length: DATE_TICK_COUNT }, (_, index) => {
                  const ratio = index / (DATE_TICK_COUNT - 1);
                  const value = domain.x[0] + xSpan * ratio;
                  const x = toX(value);
                  return (
                    <g key={`x-tick-${index}`}>
                      <line x1={x} x2={x} y1={MARGIN.top} y2={SVG_HEIGHT - MARGIN.bottom} className="resiliency-history__grid-line resiliency-history__grid-line--vertical" />
                      <text x={x} y={SVG_HEIGHT - MARGIN.bottom + 22} textAnchor="middle" className="resiliency-history__axis-text">
                        {formatDateTick(value, xSpan)}
                      </text>
                    </g>
                  );
                })}

                <text x={MARGIN.left} y={SVG_HEIGHT - 12} className="resiliency-history__axis-title">Run date</text>
                <text transform={`translate(17 ${MARGIN.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" className="resiliency-history__axis-title">
                  Resiliency score
                </text>

                <g clipPath={`url(#${id}-plot-clip)`}>
                  {chart.series.map((series, seriesIndex) => {
                    const color = CLUSTER_COLORS[seriesIndex % CLUSTER_COLORS.length];
                    const path = series.data.map((point, pointIndex) => (
                      `${pointIndex === 0 ? 'M' : 'L'} ${toX(point.x)} ${toY(point.y)}`
                    )).join(' ');
                    return (
                      <g key={`series-${series.clusterName}`}>
                        {series.data.length > 1 && (
                          <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                        {showBaselines && series.data.map((point, pointIndex) => {
                          if (typeof point.baseline !== 'number' || !Number.isFinite(point.baseline)) return null;
                          const below = point.y < point.baseline;
                          const baselineColor = below ? '#c2410c' : '#15803d';
                          const x = toX(point.x);
                          const baselineY = toY(point.baseline);
                          const scoreY = toY(point.y);
                          const halfTick = getTickHalfWidth(series, pointIndex, toX);
                          return (
                            <g key={`baseline-${seriesIndex}-${pointIndex}`} aria-hidden="true">
                              <line
                                x1={x}
                                x2={x}
                                y1={baselineY}
                                y2={scoreY}
                                stroke={baselineColor}
                                strokeWidth="1.5"
                                strokeDasharray={below ? '3 3' : undefined}
                                opacity="0.78"
                                className={below ? 'resiliency-history__baseline-connector is-below' : 'resiliency-history__baseline-connector'}
                              />
                              <line
                                x1={x - halfTick}
                                x2={x + halfTick}
                                y1={baselineY}
                                y2={baselineY}
                                stroke={baselineColor}
                                strokeWidth="3"
                                strokeLinecap="round"
                                className="resiliency-history__baseline-tick"
                              />
                            </g>
                          );
                        })}
                        {series.data.map((point, pointIndex) => (
                          <circle
                            key={`point-${seriesIndex}-${pointIndex}`}
                            data-run-id={point.runId}
                            cx={toX(point.x)}
                            cy={toY(point.y)}
                            r="4.5"
                            fill={color}
                            stroke="white"
                            strokeWidth="2"
                            className="resiliency-history__score-point"
                            tabIndex={0}
                            role="img"
                            aria-label={point.tooltip}
                            onMouseEnter={(event) => showPointTooltip(event, point, series.clusterName, color)}
                            onMouseLeave={() => setTooltip(null)}
                            onFocus={(event) => showPointTooltip(event, point, series.clusterName, color)}
                            onBlur={() => setTooltip(null)}
                          />
                        ))}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {hasBaselines && (
              <ul className="resiliency-history__baseline-key" aria-label="Baseline marker key">
                <li><span className="resiliency-history__baseline-key-symbol resiliency-history__baseline-key-symbol--met" aria-hidden="true" />Met baseline</li>
                <li><span className="resiliency-history__baseline-key-symbol resiliency-history__baseline-key-symbol--below" aria-hidden="true" />Below baseline</li>
              </ul>
            )}

            <ul className="resiliency-history__cluster-key" aria-label="Cluster series">
              {chart.series.map((series, index) => (
                <li key={series.clusterName}>
                  <span style={{ '--series-color': CLUSTER_COLORS[index % CLUSTER_COLORS.length] } as CSSProperties} aria-hidden="true" />
                  {series.clusterName}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
