import { useEffect, useRef, useState } from 'react';
import { Alert, Card, CardBody, CardTitle, Title } from '@patternfly/react-core';
import {
  Chart,
  ChartAxis,
  ChartLegend,
  ChartLine,
  ChartScatter,
  ChartVoronoiContainer,
} from '@patternfly/react-charts';
import type { ResiliencyHistoryChartModel } from './resiliencyHistoryUtils';

const CLUSTER_COLORS = [
  '#0066cc', '#009596', '#c9190b', '#5752d1', '#f0ab00',
  '#3e8635', '#ec7a08', '#8a8d90', '#4f5255', '#a18fff',
];

function useResponsiveWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const updateWidth = (nextWidth = element.clientWidth) => {
      if (nextWidth > 0) setWidth(Math.max(260, Math.floor(nextWidth)));
    };
    const handleResize = () => updateWidth();
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => updateWidth(entries[0]?.contentRect.width));
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { containerRef, width };
}

function formatTick(value: number): string {
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

/** Renders one responsive time-series chart for a category/configuration group. */
export function ResiliencyHistoryChart({ chart }: { chart: ResiliencyHistoryChartModel }) {
  const { containerRef, width } = useResponsiveWidth();
  const height = 340;

  return (
    <Card className="resiliency-history__chart-card" aria-label={chart.title}>
      <CardTitle><Title headingLevel="h3" size="md">{chart.title}</Title></CardTitle>
      <CardBody>
        {!chart.hasData ? (
          <Alert variant="info" isInline isPlain title="No scores for this selection" />
        ) : (
          <div ref={containerRef} className="resiliency-history__chart-container">
            <Chart
              ariaTitle={chart.title}
              ariaDesc={`Resiliency score by date for ${chart.categoryName}. Each line represents a selected cluster.`}
              width={width}
              height={height}
              padding={{ left: 72, right: 28, top: 24, bottom: 78 }}
              domain={{ y: [0, 100] }}
              domainPadding={{ x: 12 }}
              colorScale={CLUSTER_COLORS}
              legendData={chart.series.map((series) => ({ name: series.clusterName }))}
              legendPosition="bottom"
              legendComponent={<ChartLegend y={height - 28} />}
              containerComponent={(
                <ChartVoronoiContainer
                  labels={({ datum }: { datum: { tooltip?: string } }) => datum.tooltip ?? ''}
                  voronoiDimension="x"
                />
              )}
            >
              <ChartAxis
                label="Date"
                tickFormat={formatTick}
                style={{ tickLabels: { angle: -35, textAnchor: 'end' } }}
              />
              <ChartAxis dependentAxis label="Resiliency score" showGrid domain={[0, 100]} />
              {chart.series.map((series, index) => (
                <ChartLine
                  key={`line-${series.clusterName}`}
                  data={series.data}
                  style={{ data: { stroke: CLUSTER_COLORS[index % CLUSTER_COLORS.length], strokeWidth: 2 } }}
                />
              ))}
              {chart.series.map((series, index) => (
                <ChartScatter
                  key={`points-${series.clusterName}`}
                  data={series.data}
                  size={4}
                  style={{ data: { fill: CLUSTER_COLORS[index % CLUSTER_COLORS.length], stroke: CLUSTER_COLORS[index % CLUSTER_COLORS.length] } }}
                />
              ))}
            </Chart>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
