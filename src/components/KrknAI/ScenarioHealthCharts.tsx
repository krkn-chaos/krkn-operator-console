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
  secondsIntoScenario: number | null;
  responseTimeSeconds: number | null;
  statusCode: number | null;
  success: boolean | null;
  error?: string;
  recordedIndex: number;
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
    `Elapsed: ${sample.secondsIntoScenario === null ? 'not recorded' : `${formatNumber(sample.secondsIntoScenario)} seconds`}`,
    `Timestamp: ${sample.timestamp || 'not recorded'}`,
    `Status: HTTP ${sample.statusCode ?? 'not recorded'}`,
    `Outcome: ${outcome}`,
    `Error: ${sample.error || 'not recorded'}`,
    `Latency: ${latency}`,
  ].join('. ');
}

const colors = ['#0066cc', '#f4c145', '#3e8635', '#8a8d90', '#6753ac', '#009596', '#c9190b'];
const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

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
  if (samples.length === 0) {
    return <p className="krkn-ai-not-available">Measured health-check chart data is not available yet.</p>;
  }

  const measuredSamples: MeasuredSample[] = samples.map((sample, recordedIndex) => ({
    application: sample.application,
    timestamp: sample.timestamp,
    secondsIntoScenario: sample.elapsedSeconds !== null
      && sample.elapsedSeconds !== undefined
      && Number.isFinite(sample.elapsedSeconds)
      ? sample.elapsedSeconds
      : null,
    responseTimeSeconds: sample.responseTimeSeconds !== null && Number.isFinite(sample.responseTimeSeconds)
      ? sample.responseTimeSeconds
      : null,
    statusCode: sample.statusCode ?? null,
    success: sample.success ?? null,
    error: sample.error,
    recordedIndex,
  }));
  const grouped = new Map<string, MeasuredSample[]>();
  for (const sample of measuredSamples) {
    const applicationSamples = grouped.get(sample.application);
    if (applicationSamples) applicationSamples.push(sample);
    else grouped.set(sample.application, [sample]);
  }
  const applications = [...grouped.keys()];
  const width = 860;
  const responseHeight = 340;
  const responseMargin = { top: 24, right: 24, bottom: 58, left: 68 };
  const responsePlotWidth = width - responseMargin.left - responseMargin.right;
  const responsePlotHeight = responseHeight - responseMargin.top - responseMargin.bottom;
  const timedSamples = measuredSamples.filter((sample) => sample.secondsIntoScenario !== null);
  const latencySamples = measuredSamples.filter((sample) => sample.responseTimeSeconds !== null
    && sample.responseTimeSeconds >= 0);
  const minElapsed = timedSamples.length > 0
    ? Math.min(...timedSamples.map((sample) => sample.secondsIntoScenario!))
    : 0;
  const maxElapsed = timedSamples.length > 0
    ? Math.max(...timedSamples.map((sample) => sample.secondsIntoScenario!))
    : 1;
  const elapsedRange = maxElapsed > minElapsed ? maxElapsed - minElapsed : 1;
  const maxMeasuredLatency = Math.max(...latencySamples.map((sample) => sample.responseTimeSeconds!), 0);
  const maxResponse = maxMeasuredLatency > 0 ? maxMeasuredLatency * 1.1 : 1;
  const x = (seconds: number) => responseMargin.left + ((seconds - minElapsed) / elapsedRange) * responsePlotWidth;
  const y = (seconds: number) => responseMargin.top + ((maxResponse - seconds) / maxResponse) * responsePlotHeight;
  const xTicks = Array.from({ length: 5 }, (_, index) => minElapsed + (elapsedRange * index) / 4);
  const yTicks = Array.from({ length: 5 }, (_, index) => (maxResponse * index) / 4);
  const cellHeight = 38;
  const minCellWidth = 32;
  const maxRowLength = Math.max(...applications.map((application) => grouped.get(application)?.length ?? 0), 1);
  const heatmapPlotWidth = maxRowLength * minCellWidth;
  const heatmapHeight = applications.length * cellHeight;

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
            const applicationSamples = [...(grouped.get(application) ?? [])]
              .sort((left, right) => (left.secondsIntoScenario ?? Infinity) - (right.secondsIntoScenario ?? Infinity)
                || left.recordedIndex - right.recordedIndex);
            let path = '';
            let connected = false;
            for (const sample of applicationSamples) {
              if (sample.secondsIntoScenario === null || sample.responseTimeSeconds === null || sample.responseTimeSeconds < 0) {
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
                  if (sample.secondsIntoScenario === null || sample.responseTimeSeconds === null || sample.responseTimeSeconds < 0) return null;
                  return (
                    <circle
                      key={`${application}-${sample.recordedIndex}-${index}`}
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
          <text className="krkn-ai-health-chart__axis-label" x={responseMargin.left + responsePlotWidth / 2} y={responseHeight - 10} textAnchor="middle">Seconds into scenario</text>
          <text className="krkn-ai-health-chart__axis-label" x="18" y={responseMargin.top + responsePlotHeight / 2} textAnchor="middle" transform={`rotate(-90 18 ${responseMargin.top + responsePlotHeight / 2})`}>Response time (seconds)</text>
        </svg>
        <div className="krkn-ai-health-chart__legend" aria-label="Health-check applications">
          {applications.map((application, index) => {
            const failedCount = grouped.get(application)?.filter((sample) => sample.success === false).length ?? 0;
            return (
              <span key={application}><i style={{ backgroundColor: colors[index % colors.length] }} />
                {application}{failedCount > 0 ? ` (${failedCount} failed)` : ''}
              </span>
            );
          })}
        </div>
        <p className="krkn-ai-health-chart__guidance">Gaps indicate missing latency; HTTP errors retain measured latency. Outcome cells show failed checks.</p>
      </figure>

      <figure className="krkn-ai-health-chart">
        <figcaption>Measured health-check outcomes</figcaption>
        <div role="group" className="krkn-ai-health-chart__heatmap-scroll" aria-label={`Measured health-check outcomes by application for scenario ${scenarioId}`}>
          <div className="krkn-ai-health-chart__heatmap-labels" aria-hidden="true">
            {applications.map((application) => (
              <div key={application} className="krkn-ai-health-chart__heatmap-label" title={application}>{application}</div>
            ))}
          </div>
          <div className="krkn-ai-health-chart__heatmap-viewport">
            <svg
              className="krkn-ai-health-chart__heatmap-plot"
              viewBox={`0 0 ${heatmapPlotWidth} ${heatmapHeight}`}
              preserveAspectRatio="none"
              style={{ width: `min(100%, ${maxRowLength * 48}px)`, minWidth: `${heatmapPlotWidth}px`, height: `${heatmapHeight}px` }}
              role="group"
              aria-label={`Measured health-check outcome samples for scenario ${scenarioId}`}
            >
              {applications.map((application, rowIndex) => {
                const applicationSamples = [...(grouped.get(application) ?? [])]
                  .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.recordedIndex - right.recordedIndex);
                const cellWidth = heatmapPlotWidth / maxRowLength;
                return applicationSamples.map((sample, sampleIndex) => {
                  const label = measurementDetails(sample);
                  const outcomeClass = sample.success === null
                    ? 'krkn-ai-health-heatmap__unknown'
                    : sample.success
                      ? 'krkn-ai-health-heatmap__success'
                      : 'krkn-ai-health-heatmap__failure';
                  return (
                    <OutcomeMeasurement
                      key={`${application}-${sample.recordedIndex}`}
                      x={sampleIndex * cellWidth}
                      y={rowIndex * cellHeight}
                      width={cellWidth}
                      height={cellHeight}
                      className={outcomeClass}
                      label={label}
                      statusCode={sample.statusCode}
                    />
                  );
                });
              })}
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
