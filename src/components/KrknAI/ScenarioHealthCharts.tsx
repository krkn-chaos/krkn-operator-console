import type { KrknAIScenarioHealthCheck } from '../../services/krknAiApi';

interface ScenarioHealthChartsProps {
  scenarioId: string;
  samples: KrknAIScenarioHealthCheck[];
}

interface MeasuredSample {
  application: string;
  secondsIntoScenario: number;
  responseTimeSeconds: number;
  statusCode: number | null;
  success: boolean | null;
}

const colors = ['#0066cc', '#f4c145', '#3e8635', '#8a8d90', '#6753ac', '#009596', '#c9190b'];
const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function ScenarioHealthCharts({ scenarioId, samples }: ScenarioHealthChartsProps) {
  const measuredSamples: MeasuredSample[] = samples.flatMap((sample) => (
    sample.elapsedSeconds !== null && sample.elapsedSeconds !== undefined
      && Number.isFinite(sample.elapsedSeconds)
      && sample.responseTimeSeconds !== null && sample.responseTimeSeconds !== undefined
      && Number.isFinite(sample.responseTimeSeconds)
      ? [{
        application: sample.application,
        secondsIntoScenario: sample.elapsedSeconds,
        responseTimeSeconds: sample.responseTimeSeconds,
        statusCode: sample.statusCode ?? null,
        success: sample.success ?? null,
      }]
      : []
  ));

  if (measuredSamples.length === 0) {
    return <p className="krkn-ai-not-available">Measured health-check chart data is not available yet.</p>;
  }

  const grouped = new Map<string, MeasuredSample[]>();
  for (const sample of measuredSamples) {
    const applicationSamples = grouped.get(sample.application);
    if (applicationSamples) applicationSamples.push(sample);
    else grouped.set(sample.application, [sample]);
  }
  for (const applicationSamples of grouped.values()) {
    applicationSamples.sort((left, right) => left.secondsIntoScenario - right.secondsIntoScenario);
  }
  const applications = [...grouped.keys()];
  const width = 860;
  const responseHeight = 340;
  const responseMargin = { top: 24, right: 24, bottom: 58, left: 68 };
  const responsePlotWidth = width - responseMargin.left - responseMargin.right;
  const responsePlotHeight = responseHeight - responseMargin.top - responseMargin.bottom;
  const maxSeconds = Math.max(...measuredSamples.map((sample) => sample.secondsIntoScenario), 1);
  const maxResponse = Math.max(...measuredSamples.map((sample) => sample.responseTimeSeconds), 1) * 1.1;
  const x = (seconds: number) => responseMargin.left + (seconds / maxSeconds) * responsePlotWidth;
  const y = (seconds: number) => responseMargin.top + ((maxResponse - seconds) / maxResponse) * responsePlotHeight;
  const xTicks = Array.from({ length: 5 }, (_, index) => (maxSeconds * index) / 4);
  const yTicks = Array.from({ length: 5 }, (_, index) => (maxResponse * index) / 4);

  const maxSamples = Math.max(...[...grouped.values()].map((applicationSamples) => applicationSamples.length));
  const heatmapMargin = { top: 18, right: 24, bottom: 58, left: 94 };
  const cellWidth = (width - heatmapMargin.left - heatmapMargin.right) / maxSamples;
  const cellHeight = 38;
  const heatmapHeight = heatmapMargin.top + applications.length * cellHeight + heatmapMargin.bottom;
  const timeline = grouped.get(applications[0]) ?? [];

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
          {applications.map((application, applicationIndex) => {
            const applicationSamples = grouped.get(application) ?? [];
            const path = applicationSamples.map((sample, index) => `${index === 0 ? 'M' : 'L'} ${x(sample.secondsIntoScenario)} ${y(sample.responseTimeSeconds)}`).join(' ');
            return (
              <g key={application}>
                <path className="krkn-ai-health-chart__line" d={path} style={{ stroke: colors[applicationIndex % colors.length] }} />
                {applicationSamples.map((sample) => (
                  <circle
                    key={`${application}-${sample.secondsIntoScenario}`}
                    cx={x(sample.secondsIntoScenario)}
                    cy={y(sample.responseTimeSeconds)}
                    r="4"
                    style={{ fill: colors[applicationIndex % colors.length] }}
                  >
                    <title>{application} at {formatNumber(sample.secondsIntoScenario)} seconds: {formatNumber(sample.responseTimeSeconds)} seconds, HTTP {sample.statusCode ?? 'not recorded'}</title>
                  </circle>
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
      </figure>

      <figure className="krkn-ai-health-chart">
        <figcaption>Measured health-check outcomes</figcaption>
        <svg
          viewBox={`0 0 ${width} ${heatmapHeight}`}
          role="img"
          aria-label={`Measured health-check outcomes by application for scenario ${scenarioId}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {applications.map((application, rowIndex) => {
            const applicationSamples = grouped.get(application) ?? [];
            return (
              <g key={application}>
                <text className="krkn-ai-health-chart__label" x={heatmapMargin.left - 9} y={heatmapMargin.top + rowIndex * cellHeight + cellHeight / 2 + 4} textAnchor="end">{application}</text>
                {applicationSamples.map((sample, columnIndex) => (
                  <g key={`${application}-${sample.secondsIntoScenario}`}>
                    <rect
                      className={sample.success === null ? 'krkn-ai-health-heatmap__unknown' : sample.success ? 'krkn-ai-health-heatmap__success' : 'krkn-ai-health-heatmap__failure'}
                      x={heatmapMargin.left + columnIndex * cellWidth}
                      y={heatmapMargin.top + rowIndex * cellHeight}
                      width={cellWidth}
                      height={cellHeight}
                    >
                      <title>{application} at {formatNumber(sample.secondsIntoScenario)} seconds: {sample.success === null ? 'outcome not recorded' : sample.success ? 'success' : 'failure'}, HTTP {sample.statusCode ?? 'not recorded'}</title>
                    </rect>
                    <text className="krkn-ai-health-heatmap__code" x={heatmapMargin.left + columnIndex * cellWidth + cellWidth / 2} y={heatmapMargin.top + rowIndex * cellHeight + cellHeight / 2 + 4} textAnchor="middle">{sample.statusCode ?? '—'}</text>
                  </g>
                ))}
              </g>
            );
          })}
          {timeline.map((sample, index) => (
            <text key={sample.secondsIntoScenario} className="krkn-ai-health-chart__label" x={heatmapMargin.left + index * cellWidth + cellWidth / 2} y={heatmapHeight - 31} textAnchor="middle">{formatNumber(sample.secondsIntoScenario)}s</text>
          ))}
          <text className="krkn-ai-health-chart__axis-label" x={heatmapMargin.left + (width - heatmapMargin.left - heatmapMargin.right) / 2} y={heatmapHeight - 8} textAnchor="middle">Seconds into scenario</text>
        </svg>
        <div className="krkn-ai-health-heatmap__legend" aria-label="Health-check result legend">
          <span className="krkn-ai-health-heatmap__legend-success">Expected status code</span>
          <span className="krkn-ai-health-heatmap__legend-failure">Unexpected status code</span>
          <span className="krkn-ai-health-heatmap__legend-unknown">Outcome not recorded</span>
        </div>
      </figure>
    </div>
  );
}
