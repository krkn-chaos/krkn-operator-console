import { useRef } from 'react';
import { Tooltip } from '@patternfly/react-core';
import type { KrknAIScenarioHealthCheck } from '../../services/krknAiApi';
import './ScenarioHealthCharts.css';

interface ScenarioHealthChartsProps {
  scenarioId: string;
  samples: KrknAIScenarioHealthCheck[];
}

interface MeasuredSample {
  application: string;
  timestamp: string;
  secondsIntoScenario: number;
  responseTimeSeconds: number | null;
  statusCode: number | null;
  success: boolean | null;
  error?: string;
  duplicateIndex: number;
}
function measurementDetails(sample: MeasuredSample): string {
  const outcome = sample.success === null ? 'outcome not recorded' : sample.success ? 'success' : 'failure';
  const latency = sample.responseTimeSeconds === null
    ? 'not recorded'
    : sample.responseTimeSeconds < 0
      ? `no response (recorded value ${formatNumber(sample.responseTimeSeconds)} seconds)`
      : `${formatNumber(sample.responseTimeSeconds)} seconds`;
  return [
    sample.application,
    `Elapsed: ${formatNumber(sample.secondsIntoScenario)} seconds`,
    `Timestamp: ${sample.timestamp}`,
    `Status: HTTP ${sample.statusCode ?? 'not recorded'}`,
    `Outcome: ${outcome}`,
    `Error: ${sample.error || 'not recorded'}`,
    `Latency: ${latency}`,
  ].join('. ');
}

const colors = ['#0066cc', '#f4c145', '#3e8635', '#8a8d90', '#6753ac', '#009596', '#c9190b'];
const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

function FailedMeasurement({ x, y, label }: { x: number; y: number; label: string }) {
  const markerRef = useRef<SVGGElement>(null);
  return (
    <Tooltip triggerRef={markerRef} content={label}>
      <g ref={markerRef} className="krkn-ai-health-chart__failure" role="img" aria-label={label} tabIndex={0}>
        <title>{label}</title>
        <circle cx={x} cy={y} r="8" fill="transparent" stroke="none" />
        <path d={`M ${x - 4} ${y - 4} l 8 8 m -8 0 l 8 -8`} />
      </g>
    </Tooltip>
  );
}

function OutcomeMeasurement({
  x,
  y,
  width,
  height,
  className,
  label,
  statusCode,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  className: string;
  label: string;
  statusCode: number | null;
}) {
  const markerRef = useRef<SVGGElement>(null);
  return (
    <Tooltip triggerRef={markerRef} content={label}>
      <g ref={markerRef} className="krkn-ai-health-chart__heatmap-sample" role="img" aria-label={label} tabIndex={0}>
        <title>{label}</title>
        <rect className={className} x={x} y={y} width={width} height={height} />
        <text className="krkn-ai-health-heatmap__code" x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle">
          {statusCode ?? '—'}
        </text>
      </g>
    </Tooltip>
  );
}

export function ScenarioHealthCharts({ scenarioId, samples }: ScenarioHealthChartsProps) {
  const elapsedSamples: MeasuredSample[] = samples.flatMap((sample) => (
    sample.elapsedSeconds !== null && sample.elapsedSeconds !== undefined && Number.isFinite(sample.elapsedSeconds)
      ? [{
        application: sample.application,
        timestamp: sample.timestamp,
        secondsIntoScenario: sample.elapsedSeconds,
        responseTimeSeconds: sample.responseTimeSeconds !== null && Number.isFinite(sample.responseTimeSeconds)
          ? sample.responseTimeSeconds
          : null,
        statusCode: sample.statusCode ?? null,
        success: sample.success ?? null,
        error: sample.error,
        duplicateIndex: 0,
      }]
      : []
  ));

  if (elapsedSamples.length === 0) {
    return <p className="krkn-ai-not-available">Measured health-check chart data is not available yet.</p>;
  }

  const grouped = new Map<string, MeasuredSample[]>();
  for (const sample of elapsedSamples) {
    const applicationSamples = grouped.get(sample.application);
    if (applicationSamples) applicationSamples.push(sample);
    else grouped.set(sample.application, [sample]);
  }
  const maxDuplicatesAtTime = new Map<number, number>();
  for (const applicationSamples of grouped.values()) {
    applicationSamples.sort((left, right) => left.secondsIntoScenario - right.secondsIntoScenario);
    const duplicateCounts = new Map<number, number>();
    for (const sample of applicationSamples) {
      const duplicateIndex = duplicateCounts.get(sample.secondsIntoScenario) ?? 0;
      sample.duplicateIndex = duplicateIndex;
      duplicateCounts.set(sample.secondsIntoScenario, duplicateIndex + 1);
    }
    for (const [seconds, count] of duplicateCounts) {
      maxDuplicatesAtTime.set(seconds, Math.max(maxDuplicatesAtTime.get(seconds) ?? 0, count));
    }
  }
  const applications = [...grouped.keys()];
  const width = 860;
  const latencySamples = elapsedSamples.filter((sample) => sample.responseTimeSeconds !== null);
  const failureApplications = applications.filter((application) => grouped.get(application)?.some((sample) => sample.responseTimeSeconds !== null && sample.responseTimeSeconds < 0));
  const failureHeight = failureApplications.length > 0 ? 38 + failureApplications.length * 24 : 0;
  const responseHeight = 340 + failureHeight;
  const responseMargin = { top: 24, right: 24, bottom: 58 + failureHeight, left: 68 };
  const responsePlotWidth = width - responseMargin.left - responseMargin.right;
  const responsePlotHeight = responseHeight - responseMargin.top - responseMargin.bottom;
  const minLatencySeconds = latencySamples.length > 0
    ? Math.min(...latencySamples.map((sample) => sample.secondsIntoScenario))
    : 0;
  const maxLatencySeconds = latencySamples.length > 0
    ? Math.max(...latencySamples.map((sample) => sample.secondsIntoScenario), minLatencySeconds + 1)
    : 1;
  const maxResponse = Math.max(...latencySamples.flatMap((sample) => sample.responseTimeSeconds !== null && sample.responseTimeSeconds >= 0 ? [sample.responseTimeSeconds] : []), 1) * 1.1;
  const x = (seconds: number) => responseMargin.left + ((seconds - minLatencySeconds) / (maxLatencySeconds - minLatencySeconds)) * responsePlotWidth;
  const y = (seconds: number) => responseMargin.top + ((maxResponse - seconds) / maxResponse) * responsePlotHeight;
  const xTicks = Array.from({ length: 5 }, (_, index) => minLatencySeconds + ((maxLatencySeconds - minLatencySeconds) * index) / 4);
  const yTicks = Array.from({ length: 5 }, (_, index) => (maxResponse * index) / 4);

  const minSeconds = Math.min(...elapsedSamples.map((sample) => sample.secondsIntoScenario));
  const maxSeconds = Math.max(...elapsedSamples.map((sample) => sample.secondsIntoScenario));
  const timeRange = maxSeconds - minSeconds;
  // Different endpoints start milliseconds apart; only same-application
  // polling intervals determine how much horizontal space a sample needs.
  let minInterval = Infinity;
  for (const applicationSamples of grouped.values()) {
    for (let index = 1; index < applicationSamples.length; index++) {
      const interval = applicationSamples[index].secondsIntoScenario - applicationSamples[index - 1].secondsIntoScenario;
      if (interval > 0) minInterval = Math.min(minInterval, interval);
    }
  }
  if (!Number.isFinite(minInterval)) minInterval = 1;
  const maxDuplicateCount = Math.max(...maxDuplicatesAtTime.values(), 1);
  const cellWidth = 48;
  const heatmapMargin = {
    top: 40,
    right: 40 + (maxDuplicateCount * cellWidth) / 2,
    bottom: 38,
    left: 40 + (maxDuplicateCount * cellWidth) / 2,
  };
  const heatmapPlotWidth = Math.max(
    860,
    timeRange > 0 ? (timeRange / minInterval) * (maxDuplicateCount * cellWidth + 8) : maxDuplicateCount * cellWidth,
  );
  const heatmapWidth = heatmapMargin.left + heatmapPlotWidth + heatmapMargin.right;
  const cellHeight = 38;
  const heatmapHeight = heatmapMargin.top + applications.length * cellHeight + heatmapMargin.bottom;
  const heatmapX = (sample: MeasuredSample) => {
    const timePosition = timeRange > 0 ? ((sample.secondsIntoScenario - minSeconds) / timeRange) * heatmapPlotWidth : heatmapPlotWidth / 2;
    const duplicateCount = maxDuplicatesAtTime.get(sample.secondsIntoScenario) ?? 1;
    const duplicateOffset = (sample.duplicateIndex - (duplicateCount - 1) / 2) * cellWidth;
    return heatmapMargin.left + timePosition + duplicateOffset;
  };
  const heatmapTickCount = timeRange === 0 ? 1 : Math.max(2, Math.ceil(heatmapPlotWidth / 160) + 1);
  const heatmapTicks = Array.from({ length: heatmapTickCount }, (_, index) => (
    timeRange === 0 ? minSeconds : minSeconds + (timeRange * index) / (heatmapTickCount - 1)
  ));
  return (
    <div className="krkn-ai-health-charts">
      <figure className="krkn-ai-health-chart">
        <figcaption>Measured health-check response time</figcaption>
        <svg
          viewBox={`0 0 ${width} ${responseHeight}`}
          role="img"
          aria-label={`Measured health-check response time by application for scenario ${scenarioId}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {yTicks.map((tick) => (
            <g key={`response-y-${tick}`} className="krkn-ai-health-chart__gridline">
              <line x1={responseMargin.left} x2={width - responseMargin.right} y1={y(tick)} y2={y(tick)} />
              <text x={responseMargin.left - 9} y={y(tick) + 4} textAnchor="end">{formatNumber(tick)}</text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <g key={`response-x-${tick}`} className="krkn-ai-health-chart__tick">
              <line x1={x(tick)} x2={x(tick)} y1={responseHeight - responseMargin.bottom} y2={responseHeight - responseMargin.bottom + 5} />
              <text x={x(tick)} y={responseHeight - responseMargin.bottom + 21} textAnchor="middle">{formatNumber(tick)}</text>
            </g>
          ))}
          <line className="krkn-ai-health-chart__axis" x1={responseMargin.left} x2={responseMargin.left} y1={responseMargin.top} y2={responseHeight - responseMargin.bottom} />
          <line className="krkn-ai-health-chart__axis" x1={responseMargin.left} x2={width - responseMargin.right} y1={responseHeight - responseMargin.bottom} y2={responseHeight - responseMargin.bottom} />
          {latencySamples.length === 0 && (
            <text className="krkn-ai-health-chart__label" x={width / 2} y={responseHeight / 2} textAnchor="middle">
              Response-time measurements are not available.
            </text>
          )}
          {applications.map((application, applicationIndex) => {
            const applicationSamples = grouped.get(application) ?? [];
            let path = '';
            let connected = false;
            for (const sample of applicationSamples) {
              if (sample.responseTimeSeconds === null || sample.responseTimeSeconds < 0) {
                connected = false;
                continue;
              }
              path += `${connected ? ' L' : ' M'} ${x(sample.secondsIntoScenario)} ${y(sample.responseTimeSeconds)}`;
              connected = true;
            }
            return (
              <g key={application}>
                <path className="krkn-ai-health-chart__line" d={path} style={{ stroke: colors[applicationIndex % colors.length] }} />
                {applicationSamples.map((sample, index) => {
                  if (sample.responseTimeSeconds === null || sample.responseTimeSeconds < 0) return null;
                  return (
                    <circle
                      key={`${application}-${sample.secondsIntoScenario}-${index}`}
                      cx={x(sample.secondsIntoScenario)}
                      cy={y(sample.responseTimeSeconds)}
                      r="4"
                      style={{ fill: colors[applicationIndex % colors.length] }}
                    >
                      <title>{measurementDetails(sample)}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
          {failureApplications.length > 0 && (
            <text className="krkn-ai-health-chart__label" x={responseMargin.left} y={responseHeight - responseMargin.bottom + 43}>No response (−1)</text>
          )}
          {failureApplications.map((application, applicationIndex) => {
            const markerY = responseHeight - responseMargin.bottom + 62 + applicationIndex * 24;
            return (
              <g key={`failure-${application}`}>
                <text className="krkn-ai-health-chart__label" x={responseMargin.left - 9} y={markerY + 4} textAnchor="end">
                  <title>{application}</title>
                  {application.length > 8 ? `${application.slice(0, 7)}…` : application}
                </text>
                <line className="krkn-ai-health-chart__failure-lane" x1={responseMargin.left} x2={width - responseMargin.right} y1={markerY} y2={markerY} />
                {grouped.get(application)?.filter((sample) => sample.responseTimeSeconds !== null && sample.responseTimeSeconds < 0).map((sample, index) => (
                  <FailedMeasurement
                    key={`${sample.secondsIntoScenario}-${index}`}
                    x={x(sample.secondsIntoScenario)}
                    y={markerY}
                    label={measurementDetails(sample)}
                  />
                ))}
              </g>
            );
          })}
          <text className="krkn-ai-health-chart__axis-label" x={responseMargin.left + responsePlotWidth / 2} y={responseHeight - 10} textAnchor="middle">Seconds into scenario</text>
          <text className="krkn-ai-health-chart__axis-label" x="18" y={responseMargin.top + responsePlotHeight / 2} textAnchor="middle" transform={`rotate(-90 18 ${responseMargin.top + responsePlotHeight / 2})`}>Response time (seconds)</text>
        </svg>
        <div className="krkn-ai-health-chart__legend" aria-label="Health-check applications">
          {applications.map((application, index) => (
            <span key={application}><i style={{ backgroundColor: colors[index % colors.length] }} />{application}</span>
          ))}
        </div>
        {failureApplications.length > 0 && (
          <p className="krkn-ai-health-chart__failure-note">Red crosses mark failed checks with no response (recorded as −1), not negative latency. Gaps in the line show missing measurements. Hover or focus a cross for the application, elapsed time, and error.</p>
        )}
      </figure>

      <figure className="krkn-ai-health-chart">
        <figcaption>Measured health-check outcomes</figcaption>
        <div role="group" className="krkn-ai-health-chart__heatmap-scroll" aria-label={`Measured health-check outcomes by application for scenario ${scenarioId}`}>
          <div className="krkn-ai-health-chart__heatmap-labels" aria-hidden="true">
            <div className="krkn-ai-health-chart__heatmap-label-spacer" />
            {applications.map((application) => (
              <div key={application} className="krkn-ai-health-chart__heatmap-label" title={application}>{application}</div>
            ))}
            <div className="krkn-ai-health-chart__heatmap-label-bottom" />
          </div>
          <div className="krkn-ai-health-chart__heatmap-viewport">
            <svg
              className="krkn-ai-health-chart__heatmap-plot"
              viewBox={`0 0 ${heatmapWidth} ${heatmapHeight}`}
              width={heatmapWidth}
              height={heatmapHeight}
              style={{ width: `${heatmapWidth}px`, maxWidth: 'none' }}
              role="group"
              aria-label={`Measured health-check outcome samples for scenario ${scenarioId}`}
            >
              {heatmapTicks.map((tick) => {
                const tickX = heatmapMargin.left + (timeRange > 0 ? ((tick - minSeconds) / timeRange) * heatmapPlotWidth : heatmapPlotWidth / 2);
                return (
                  <g key={`heatmap-tick-${tick}`} className="krkn-ai-health-chart__heatmap-tick">
                    <line className="krkn-ai-health-chart__axis" x1={tickX} x2={tickX} y1={heatmapMargin.top - 5} y2={heatmapHeight - heatmapMargin.bottom} />
                    <text x={tickX} y={heatmapMargin.top - 14} textAnchor="middle">{formatNumber(tick)}s</text>
                  </g>
                );
              })}
              {applications.map((application, rowIndex) => {
                const applicationSamples = grouped.get(application) ?? [];
                return applicationSamples.map((sample, sampleIndex) => {
                  const label = measurementDetails(sample);
                  const outcomeClass = sample.success === null
                    ? 'krkn-ai-health-heatmap__unknown'
                    : sample.success
                      ? 'krkn-ai-health-heatmap__success'
                      : 'krkn-ai-health-heatmap__failure';
                  return (
                    <OutcomeMeasurement
                      key={`${application}-${sample.secondsIntoScenario}-${sampleIndex}`}
                      x={heatmapX(sample) - cellWidth / 2}
                      y={heatmapMargin.top + rowIndex * cellHeight}
                      width={cellWidth}
                      height={cellHeight}
                      className={outcomeClass}
                      label={label}
                      statusCode={sample.statusCode}
                    />
                  );
                });
              })}
              <line className="krkn-ai-health-chart__axis" x1={heatmapMargin.left} x2={heatmapWidth - heatmapMargin.right} y1={heatmapHeight - heatmapMargin.bottom} y2={heatmapHeight - heatmapMargin.bottom} />
              <text className="krkn-ai-health-chart__axis-label" x={heatmapMargin.left + heatmapPlotWidth / 2} y={heatmapHeight - 8} textAnchor="middle">Seconds into scenario</text>
            </svg>
          </div>
        </div>
        <div className="krkn-ai-health-heatmap__legend" aria-label="Health-check result legend">
          <span className="krkn-ai-health-heatmap__legend-success">Expected status code</span>
          <span className="krkn-ai-health-heatmap__legend-failure">Unexpected status code</span>
          <span className="krkn-ai-health-heatmap__legend-unknown">Outcome not recorded</span>
        </div>
      </figure>
    </div>
  );
}
