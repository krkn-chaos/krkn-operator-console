import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  Spinner,
  Flex,
  FlexItem,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Form,
  Modal,
  ModalVariant,
  Alert,
  Label,
  DatePicker,
  isValidDate,
  yyyyMMddFormat,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Grid,
  GridItem,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td, ExpandableRowContent } from '@patternfly/react-table';
import { Chart, ChartAxis, ChartBar, ChartGroup, ChartLegend, ChartThreshold } from '@patternfly/react-charts';
import { DatabaseIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { elasticsearchApi } from '../services/elasticsearchApi';
import { useNotifications, useRole } from '../hooks';
import { ElasticsearchConfigForm } from './ElasticsearchConfigsCard';
import { JobStatsSummary } from './JobStatsSummary';
import type {
  ElasticsearchConfig,
  ClusterMetadata,
  NodeSummaryInfo,
  TelemetryDocument,
  TelemetryScenarioDetail,
  RecoveredPod,
  TelemetryStats,
  CreateElasticsearchConfigRequest,
  UpdateElasticsearchConfigRequest,
  InlineElasticsearchConnection,
  QueryTelemetryResponse,
} from '../types/api';

/**
 * Formats an epoch-seconds timestamp as "MMM DD, YYYY, h:mm:ss AM/PM".
 * Returns an em dash when the timestamp is missing or zero.
 */
/**
 * Returns a "yyyy-MM-dd" date string for `daysAgo` days before today, using the
 * browser's local calendar date. Prior dates are computed with a calendar
 * operation (setDate) rather than subtracting fixed 24-hour intervals so that
 * daylight-saving transitions do not shift the result. Deriving the string from
 * local year/month/day (instead of toISOString(), which is UTC) keeps the picker
 * defaults, future-date validation, and query bounds on one timezone convention
 * that matches the locally formatted telemetry timestamps.
 */
function isoDate(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Bounds for the "Max results" limit. The query is capped server-side, so the
// UI enforces a sane positive-integer range rather than forwarding arbitrary
// input.
const MIN_SIZE = 1;
const MAX_SIZE = 10000;

/**
 * Validates the raw "Max results" input. An empty value is allowed and means
 * "no explicit limit" (the limit is omitted from the query). Any non-empty value
 * must be a whole number within [MIN_SIZE, MAX_SIZE]; otherwise an inline error
 * message is returned.
 */
function validateSize(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'Max results must be a whole number';
  }
  const value = Number(trimmed);
  if (value < MIN_SIZE || value > MAX_SIZE) {
    return `Max results must be between ${MIN_SIZE} and ${MAX_SIZE}`;
  }
  return null;
}

/**
 * Normalizes a DatePicker change into a stored "yyyy-MM-dd" bound. PatternFly
 * supplies the parsed `date` alongside the raw input string; an empty input
 * clears the bound, and any string that does not parse to a valid date whose
 * canonical format matches the input is rejected (stored as '') so a malformed
 * value can never enable or reach the query.
 */
function parseDateInput(str: string, date: Date | undefined): string {
  if (str.trim() === '') return '';
  if (date && isValidDate(date) && str === yyyyMMddFormat(date)) return str;
  return '';
}

function formatTimestamp(epochSeconds: number): string {
  if (!epochSeconds) {
    return '—';
  }
  const date = new Date(epochSeconds * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Renders an arbitrary telemetry value as a display string. `scenarios[].parameters`
 * is untyped (Record<string, unknown>), so values may be scalars, arrays, or nested
 * objects. Missing/empty values collapse to an em dash, matching the table's
 * convention; arrays are comma-joined and objects are JSON-stringified.
 */
function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '—';
    }
    return value
      .map((item) => (item !== null && typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * Recursively flattens a value into label/value leaf rows. Nested objects (and
 * arrays of objects) expand so each scalar field gets its own Metadata/Value
 * row, labeled by the leaf key only (e.g. `actions`, not
 * `node_scenarios.0.actions`). Array indices are skipped as labels. Scalars and
 * arrays of scalars collapse to a single row via displayValue.
 */
function flattenEntries(label: string, value: unknown): { label: string; value: string }[] {
  const isPlainObject = value !== null && typeof value === 'object';
  const hasNestedObject = Array.isArray(value)
    ? value.some((item) => item !== null && typeof item === 'object')
    : isPlainObject && Object.keys(value as Record<string, unknown>).length > 0;
  if (!isPlainObject || !hasNestedObject) {
    return [{ label, value: displayValue(value) }];
  }
  const isArray = Array.isArray(value);
  const rows: { label: string; value: string }[] = [];
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    // For array elements keep the parent label; for object fields use the child key.
    rows.push(...flattenEntries(isArray ? label : key, child));
  });
  return rows;
}

/**
 * Flattens a telemetry document's cluster metadata and every scenario's raw
 * parameters into a single list of label/value rows for the "Cluster Config"
 * table. `kubernetes_objects_count` is excluded because its kind->count map is
 * too large to read as flat rows; `node_summary_infos` is excluded because it is
 * rendered as the dedicated Node summary table.
 */
function buildClusterConfigRows(doc: TelemetryDocument): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (doc.run_uuid) {
    rows.push({ label: 'run_uuid', value: doc.run_uuid });
  }
  const metadata = doc.metadata;
  if (metadata) {
    (Object.keys(metadata) as (keyof ClusterMetadata)[]).forEach((key) => {
      if (key === 'kubernetes_objects_count' || key === 'node_summary_infos') {
        return;
      }
      rows.push(...flattenEntries(key, metadata[key]));
    });
  }
  const scenarios = doc.scenarios ?? [];
  scenarios.forEach((scenario) => {
    const params = scenario.parameters;
    if (!params) {
      return;
    }
    Object.keys(params).forEach((key) => {
      rows.push(...flattenEntries(key, params[key]));
    });
  });
  return rows;
}

/**
 * Two-column key/value table listing cluster metadata and scenario parameters
 * for one telemetry document. Shown in the left half of an expanded row.
 */
function ClusterConfigTable({ doc }: { doc: TelemetryDocument }) {
  const rows = buildClusterConfigRows(doc);
  if (rows.length === 0) {
    return <Alert variant="info" isInline isPlain title="No cluster config data" />;
  }
  return (
    <Table variant="compact" aria-label="Cluster config">
      <Thead>
        <Tr>
          <Th>Metadata</Th>
          <Th>Value</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row, index) => (
          <Tr key={`${row.label}-${index}`}>
            <Td dataLabel="Metadata">{row.label}</Td>
            <Td dataLabel="Value">
              {row.label === 'build_url' && row.value !== '—' ? (
                <a href={row.value} target="_blank" rel="noopener noreferrer" aria-label="Open build URL">
                  <img src="/prow-icon.png" alt="Prow build" width={20} height={20} />
                </a>
              ) : (
                row.value
              )}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

// Column spec for the Node summary table. Node Type leads; the rest follow the
// JSON field order. label = header text, key = NodeSummaryInfo field.
const NODE_SUMMARY_COLUMNS: { label: string; key: keyof NodeSummaryInfo }[] = [
  { label: 'Node Type', key: 'nodes_type' },
  { label: 'Count', key: 'count' },
  { label: 'Architecture', key: 'architecture' },
  { label: 'Instance Type', key: 'instance_type' },
//  { label: 'Kernel Version', key: 'kernel_version' },
  { label: 'Kubelet Version', key: 'kubelet_version' },
//  { label: 'OS Version', key: 'os_version' },
];

/**
 * Multi-column table of `metadata.node_summary_infos`, one row per node group
 * and one column per field. Shown full-width below the Cluster Config table.
 * Falls back to a short note when no node summary data is present.
 */
function NodeSummaryTable({ metadata }: { metadata?: ClusterMetadata }) {
  const nodes = metadata?.node_summary_infos ?? [];
  if (nodes.length === 0) {
    return <Alert variant="info" isInline isPlain title="No node summary data" />;
  }
  return (
    <Table variant="compact" aria-label="Node summary">
      <Thead>
        <Tr>
          {NODE_SUMMARY_COLUMNS.map((col) => (
            <Th key={col.key}>{col.label}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {nodes.map((node, index) => (
          <Tr key={`${node.nodes_type}-${index}`}>
            {NODE_SUMMARY_COLUMNS.map((col) => (
              <Td key={col.key} dataLabel={col.label}>{displayValue(node[col.key])}</Td>
            ))}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

// Scenario type whose telemetry carries per-pod recovery timings.
const POD_DISRUPTION_TYPE = 'pod_disruption_scenarios';

/**
 * Recursively searches a decoded parameters value for the first numeric
 * `expected_recovery_time`. The parameters shape varies by scenario type (the
 * value is often nested under a `scenarios` array), so the tree is walked rather
 * than indexed. Returns undefined when no such number is present.
 */
function findExpectedRecoveryTime(value: unknown): number | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  if (!Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.expected_recovery_time === 'number') {
      return record.expected_recovery_time;
    }
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = findExpectedRecoveryTime(child);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

// One recovery metric series rendered as a group of bars across pods.
interface PodRecoverySeries {
  name: string;
  data: { name: string; x: string; y: number }[];
}

/**
 * Builds grouped Victory bar series (one per recovery metric) keyed by pod name
 * from a scenario's `affected_pods.recovered`, plus the `expected_recovery_time`
 * threshold pulled from the scenario's raw parameters. Returns empty series when
 * no recovered pods are present so callers can render a no-data fallback.
 */
function buildPodRecoveryData(scenario: TelemetryScenarioDetail): {
  series: PodRecoverySeries[];
  expectedRecoveryTime?: number;
} {
  const recovered = scenario.affected_pods?.recovered ?? [];
  if (recovered.length === 0) {
    return { series: [] };
  }
  const metrics: { name: string; pick: (pod: RecoveredPod) => number }[] = [
    { name: 'Total recovery time', pick: (pod) => pod.total_recovery_time },
    { name: 'Pod readiness time', pick: (pod) => pod.pod_readiness_time },
    { name: 'Pod rescheduling time', pick: (pod) => pod.pod_rescheduling_time },
  ];
  const series = metrics.map((metric) => ({
    name: metric.name,
    data: recovered.map((pod) => ({ name: metric.name, x: pod.pod_name, y: metric.pick(pod) })),
  }));
  return { series, expectedRecoveryTime: findExpectedRecoveryTime(scenario.parameters) };
}

/**
 * Grouped horizontal bar chart of per-pod recovery timings for one
 * pod_disruption scenario. Each pod shows three bars (total / readiness /
 * rescheduling seconds); the `expected_recovery_time` budget is drawn as a
 * threshold line so pods that exceeded it stand out. Falls back to a short note
 * when the scenario reported no recovered pods.
 */
function PodRecoveryChart({ scenario }: { scenario: TelemetryScenarioDetail }) {
  const { series, expectedRecoveryTime } = buildPodRecoveryData(scenario);
  if (series.length === 0) {
    return <Alert variant="info" isInline isPlain title="No pod recovery data" />;
  }
  const podCount = series[0].data.length;
  // Vertical bars run along the x-axis, so width (not height) scales with pod
  // count to keep grouped bars from crowding when many pods recovered.
  const width = Math.max(600, podCount * 160 + 120);
  const height = 360;
  // Saturated PatternFly chart tokens keep the three metric series legible in
  // light and dark; the threshold line stays a distinct color from all three.
  const colorScale = ['#0066cc', '#f0ab00', '#5752d1'];
  const legendData = series.map((s) => ({ name: s.name }));
  if (expectedRecoveryTime !== undefined) {
    legendData.push({ name: `Expected recovery time (${expectedRecoveryTime}s)` });
  }
  const thresholdData = expectedRecoveryTime !== undefined
    ? series[0].data.map((point) => ({ x: point.x, y: expectedRecoveryTime }))
    : [];
  return (
    <Chart
      ariaTitle="Pod Recovery Analysis"
      height={height}
      width={width}
      colorScale={colorScale}
      domainPadding={{ x: [40, 40] }}
      padding={{ left: 70, right: 40, top: 20, bottom: 110 }}
      legendData={legendData}
      legendPosition="bottom"
      legendComponent={<ChartLegend y={height - 30} />}
    >
      <ChartAxis label="Pod" />
      <ChartAxis dependentAxis showGrid label="Seconds" />
      <ChartGroup offset={11}>
        {series.map((s) => (
          <ChartBar key={s.name} data={s.data} />
        ))}
      </ChartGroup>
      {thresholdData.length > 0 && <ChartThreshold data={thresholdData} />}
    </Chart>
  );
}

/**
 * ElasticsearchDataView — top-level page that queries telemetry documents from a
 * saved Elasticsearch configuration (or an ephemeral inline connection) and
 * renders them in a table.
 *
 * Users pick a saved config from a dropdown (or add a new one via the same form
 * used in Settings), then run a query. When no saved config exists, non-admins
 * (and admins who prefer not to persist credentials) can supply connection
 * details inline for the current session only — those values are never stored
 * server-side. For saved configs, connection credentials never reach the
 * browser: the backend resolves them from the named config and performs the
 * search server-side.
 *
 * Takes no props; all state is internal. Mount it directly for the
 * `elasticsearch_data` phase.
 *
 * @example
 * import { ElasticsearchDataView } from './components';
 *
 * case 'elasticsearch_data':
 *   return (
 *     <PageSection>
 *       <ElasticsearchDataView />
 *     </PageSection>
 *   );
 */
export function ElasticsearchDataView() {
  const { showError } = useNotifications();
  const [configs, setConfigs] = useState<ElasticsearchConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [size, setSize] = useState('50');
  const [startDate, setStartDate] = useState(isoDate(10));
  const [endDate, setEndDate] = useState(isoDate(0));
  const [documents, setDocuments] = useState<TelemetryDocument[]>([]);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const {isAdmin} = useRole();

  // Ephemeral (not saved) connection fields, used when no saved config exists.
  // These values are held only in component state and are cleared on unmount;
  // they are never persisted server-side (no createConfig call, no storage).
  const [inlineHost, setInlineHost] = useState('');
  const [inlinePort, setInlinePort] = useState('');
  const [inlineUsername, setInlineUsername] = useState('');
  const [inlinePassword, setInlinePassword] = useState('');
  const [inlineIndex, setInlineIndex] = useState('');

  // Per-row expansion state, keyed by run_uuid (or row index fallback).
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Monotonic id identifying the most recent query. Each run captures the id it
  // started with; a response only updates the table if its id still matches, so
  // stale responses (from criteria that have since changed) are discarded.
  const latestRequestId = useRef(0);

  // Clears any displayed results and invalidates in-flight requests. Called
  // whenever the query criteria change so the table never shows telemetry that
  // no longer matches the current config, date range, or result limit.
  const invalidateResults = useCallback(() => {
    latestRequestId.current += 1;
    setDocuments([]);
    setStats(null);
    setHasQueried(false);
    setQuerying(false);
    setExpandedRows({});
  }, []);

  const fetchConfigs = useCallback(async () => {
    try {
      const data = await elasticsearchApi.listConfigs();
      setConfigs(data);
    } catch {
      showError('Failed to load Elasticsearch configs', 'Could not retrieve configs from the server');
    } finally {
      setLoadingConfigs(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Date bounds are compared as "yyyy-MM-dd" strings, which are
  // lexicographically ordered by date.
  const today = isoDate(0);
  const startAfterEnd = !!startDate && !!endDate && startDate > endDate;
  const endInFuture = !!endDate && endDate > today;
  const invalidDateRange = startAfterEnd || endInFuture;
  const sizeError = validateSize(size);

  // Shared date/size validation for both the saved-config and inline query
  // paths. Returns the validated size (or undefined) when valid, or null after
  // surfacing an error so the caller can abort.
  const validatedQueryArgs = (): { sizeNum: number | undefined } | null => {
    if (startAfterEnd) {
      showError('Invalid date range', 'Start date must not be after end date');
      return null;
    }
    if (endInFuture) {
      showError('Invalid date range', 'End date must not be in the future');
      return null;
    }
    if (sizeError) {
      showError('Invalid max results', sizeError);
      return null;
    }
    // An empty input intentionally omits the limit; a validated value is a
    // bounded positive integer.
    const trimmedSize = size.trim();
    return { sizeNum: trimmedSize === '' ? undefined : Number(trimmedSize) };
  };

  // Runs a telemetry query via the supplied fetcher, applying the monotonic
  // request-id guard so stale responses are discarded. Shared by the saved
  // config and inline connection paths.
  const executeQuery = async (
    runner: (sizeNum: number | undefined) => Promise<QueryTelemetryResponse>,
  ) => {
    const args = validatedQueryArgs();
    if (!args) return;
    // Snapshot this run's id; only the latest run may commit its response.
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setQuerying(true);
    try {
      const result = await runner(args.sizeNum);
      // Ignore responses superseded by a newer run or by a criteria change.
      if (latestRequestId.current !== requestId) return;
      setDocuments(result.documents || []);
      setStats(result.stats ?? null);
      setHasQueried(true);
      // Fresh results: start with all rows collapsed.
      setExpandedRows({});
    } catch (err) {
      if (latestRequestId.current !== requestId) return;
      showError('Query failed', err instanceof Error ? err.message : 'Could not query Elasticsearch');
    } finally {
      if (latestRequestId.current === requestId) {
        setQuerying(false);
      }
    }
  };

  const handleRunQuery = async () => {
    if (!selectedConfig) {
      showError('No config selected', 'Please select an Elasticsearch config to query');
      return;
    }
    await executeQuery((sizeNum) =>
      elasticsearchApi.queryTelemetry(
        selectedConfig,
        sizeNum,
        startDate || undefined,
        endDate || undefined,
      ),
    );
  };

  // Inline form validity: host and telemetry index are the required fields.
  const inlineComplete = inlineHost.trim() !== '' && inlineIndex.trim() !== '';

  const handleRunInlineQuery = async () => {
    if (!inlineComplete) {
      showError('Missing connection details', 'Host and telemetry index are required');
      return;
    }
    const trimmedPort = inlinePort.trim();
    if (trimmedPort !== '' && !/^\d+$/.test(trimmedPort)) {
      showError('Invalid port', 'Port must be a whole number');
      return;
    }
    const inline: InlineElasticsearchConnection = {
      host: inlineHost.trim(),
      telemetryIndex: inlineIndex.trim(),
      ...(trimmedPort !== '' ? { port: Number(trimmedPort) } : {}),
      ...(inlineUsername.trim() !== '' ? { username: inlineUsername.trim() } : {}),
      ...(inlinePassword !== '' ? { password: inlinePassword } : {}),
    };
    await executeQuery((sizeNum) =>
      elasticsearchApi.queryTelemetryInline(
        inline,
        sizeNum,
        startDate || undefined,
        endDate || undefined,
      ),
    );
  };

  const handleCreateConfig = async (
    data: CreateElasticsearchConfigRequest | UpdateElasticsearchConfigRequest,
  ) => {
    // Creating a shared saved config is an administrator-only operation, matching
    // the Settings > Elasticsearch tab boundary. Guard the submit path so the
    // role check cannot be bypassed even if a create control is reached.
    if (!isAdmin) {
      showError('Not authorized', 'Only administrators can add Elasticsearch configs');
      return;
    }
    const createReq = data as CreateElasticsearchConfigRequest;
    await elasticsearchApi.createConfig(createReq);
    setShowCreateModal(false);
    await fetchConfigs();
    setSelectedConfig(createReq.name);
    // Switching config must clear results from the prior config and invalidate
    // any in-flight request, matching the selector's onChange behavior.
    invalidateResults();
  };

  // Job stats summary shown once a query has committed results. Rendered above
  // the results table in both the saved-config and inline paths.
  const statsSection = hasQueried && !querying && stats && (
    <div style={{ marginTop: '1.5rem' }}>
      <JobStatsSummary
        stats={{
          // Whole matched window: response.total counts only the returned page.
          totalJobs: stats.pass + stats.fail,
          succeededJobs: stats.pass,
          failedJobs: stats.fail,
        }}
        labels={{ total: 'Total Runs', succeeded: 'Passed', failed: 'Failed', passRate: 'Pass Rate' }}
        subTexts={{
          total: 'Runs across matched window',
          succeeded: 'status = true',
          failed: 'status = false',
          passRate: 'Percentage of runs that passed',
        }}
      />
    </div>
  );

  // Shared results region: spinner while querying, an info prompt before the
  // first run, an empty state when a query returned nothing, or the table.
  const resultsSection = (
    <>
      {statsSection}
      <div style={{ marginTop: '1.5rem' }}>
        {querying ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="lg" />
          </div>
        ) : !hasQueried ? (
          <Alert
            variant="info"
            isInline
            title="Run a query to view telemetry data."
          />
        ) : documents.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={DatabaseIcon} />
            <Title headingLevel="h3" size="md">No telemetry documents found</Title>
            <EmptyStateBody>
              The telemetry index returned no results.
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <Table isStriped={true} aria-label="Telemetry documents">
            <Thead>
              <Tr>
                <Th screenReaderText="Row expansion" />
                <Th>UUID</Th>
                <Th>Scenario Type</Th>
                <Th>Start Time</Th>
                <Th>End Time</Th>
                <Th>Namespace</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            {documents.map((doc, rowIndex) => {
              const rowKey = doc.run_uuid || String(rowIndex);
              const isExpanded = !!expandedRows[rowKey];
              const hasMetadata = doc.metadata !== undefined && doc.metadata !== null;
              const hasPodDisruption = (doc.scenarios ?? []).some(
                s => s.scenario_type === POD_DISRUPTION_TYPE && s.affected_pods
              );
              const isExpandable = hasMetadata || hasPodDisruption;
              return (
                <Tbody key={rowKey} isExpanded={isExpanded}>
                  <Tr>
                    {isExpandable ? (
                      <Td
                        expand={{
                          rowIndex,
                          isExpanded,
                          onToggle: () =>
                            setExpandedRows((prev) => ({ ...prev, [rowKey]: !prev[rowKey] })),
                          expandId: `es-row-${rowKey}`,
                        }}
                      />
                    ) : (
                      <Td />
                    )}
                    <Td dataLabel="UUID">
                      <code>{doc.run_uuid ? doc.run_uuid.slice(0, 7) : '—'}</code>
                    </Td>
                    <Td dataLabel="Scenario Type">{doc.scenario_type || '—'}</Td>
                    <Td dataLabel="Start Time">{formatTimestamp(doc.start_timestamp)}</Td>
                    <Td dataLabel="End Time">{formatTimestamp(doc.end_timestamp)}</Td>
                    <Td dataLabel="Namespace">{doc.namespace || '—'}</Td>
                    <Td dataLabel="Status">
                      <Label color={doc.status ? 'green' : 'red'}>
                        {doc.status ? 'Pass' : 'Fail'}
                      </Label>
                    </Td>
                  </Tr>
                  {isExpandable && (
                    <Tr isExpanded={isExpanded}>
                      <Td dataLabel="Run details" colSpan={7}>
                        <ExpandableRowContent>
                          <Grid hasGutter>
                            <GridItem span={6}>
                              <Card>
                                <CardTitle style={{ borderBottom: '1px solid var(--pf-global--BorderColor--100)' }}>
                                  Cluster Config
                                </CardTitle>
                                <CardBody style={{ padding: 0 }}>
                                  <ClusterConfigTable doc={doc} />
                                </CardBody>
                              </Card>
                            </GridItem>
                            <GridItem span={6}>
                              <Card>
                                <CardTitle style={{ borderBottom: '1px solid var(--pf-global--BorderColor--100)' }}>
                                  Node summary
                                </CardTitle>
                                <CardBody style={{ padding: 0 }}>
                                  <NodeSummaryTable metadata={doc.metadata} />
                                </CardBody>
                              </Card>
                              {(doc.scenarios ?? []).map((scenario) =>
                                scenario.scenario_type === POD_DISRUPTION_TYPE ? (
                                  <Card key={scenario.scenario_type}>
                                    <CardTitle style={{ borderBottom: '1px solid var(--pf-global--BorderColor--100)' }}>
                                      Pod-Recovery Analysis
                                    </CardTitle>
                                    <CardBody style={{ padding: 0 }}>
                                      <PodRecoveryChart scenario={scenario} />
                                    </CardBody>
                                  </Card>
                                ) : null
                              )}
                            </GridItem>
                          </Grid>
                        </ExpandableRowContent>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              );
            })}
          </Table>
        )}
      </div>
    </>
  );

  // Date-range and max-results controls shared by the saved-config and inline
  // query forms.
  const dateAndSizeControls = (
    <>
      <FlexItem>
        <FormGroup label="Start Date" fieldId="es-data-start-date">
          <DatePicker
            id="es-data-start-date"
            value={startDate}
            onChange={(_event, str, date) => { setStartDate(parseDateInput(str, date)); invalidateResults(); }}
            aria-label="Start date"
          />
        </FormGroup>
      </FlexItem>
      <FlexItem>to</FlexItem>
      <FlexItem>
        <FormGroup label="End Date" fieldId="es-data-end-date">
          <DatePicker
            id="es-data-end-date"
            value={endDate}
            onChange={(_event, str, date) => { setEndDate(parseDateInput(str, date)); invalidateResults(); }}
            aria-label="End date"
          />
        </FormGroup>
      </FlexItem>
      <FlexItem>
        <FormGroup label="Max results" fieldId="es-data-size">
          <TextInput
            id="es-data-size"
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={size}
            onChange={(_e, v) => { setSize(v); invalidateResults(); }}
            validated={sizeError ? 'error' : 'default'}
            aria-label="Max results"
            style={{ width: '7rem' }}
          />
          {sizeError && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{sizeError}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      </FlexItem>
    </>
  );

  return (
    <>
      <Card>
        <CardTitle>
          <Title headingLevel="h2" size="lg">Elasticsearch Telemetry Data</Title>
        </CardTitle>
        <CardBody>
          {loadingConfigs ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spinner size="xl" />
            </div>
          ) : configs.length === 0 ? (
            <>
              <EmptyState>
                <EmptyStateIcon icon={DatabaseIcon} />
                <Title headingLevel="h3" size="lg">No Saved Elasticsearch Configs</Title>
                <EmptyStateBody>
                  {isAdmin ? (
                    <p>Add a saved Elasticsearch configuration, or connect below without saving to query telemetry data.</p>
                  ) : (
                    <p>No saved configuration is available. Enter connection details below to connect without saving and query telemetry data.</p>
                  )}
                </EmptyStateBody>
                {isAdmin && (
                  <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setShowCreateModal(true)}>
                    Add Config
                  </Button>
                )}
              </EmptyState>

              <Title headingLevel="h3" size="md" style={{ marginTop: '1.5rem' }}>
                Connect without saving
              </Title>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    These connection details are used only for this session and are not stored on the server.
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>

              <Form style={{ marginTop: '1rem', maxWidth: '40em' }}>
                <FormGroup label="Host" fieldId="es-inline-host" isRequired>
                  <TextInput
                    id="es-inline-host"
                    value={inlineHost}
                    onChange={(_e, v) => { setInlineHost(v); invalidateResults(); }}
                    placeholder="https://elasticsearch.example.com"
                    aria-label="Elasticsearch host"
                  />
                </FormGroup>
                <FormGroup label="Port" fieldId="es-inline-port">
                  <TextInput
                    id="es-inline-port"
                    type="number"
                    value={inlinePort}
                    onChange={(_e, v) => { setInlinePort(v); invalidateResults(); }}
                    placeholder="9200"
                    aria-label="Elasticsearch port"
                  />
                </FormGroup>
                <FormGroup label="Username" fieldId="es-inline-username">
                  <TextInput
                    id="es-inline-username"
                    value={inlineUsername}
                    onChange={(_e, v) => { setInlineUsername(v); invalidateResults(); }}
                    aria-label="Elasticsearch username"
                  />
                </FormGroup>
                <FormGroup label="Password" fieldId="es-inline-password">
                  <TextInput
                    id="es-inline-password"
                    type="password"
                    value={inlinePassword}
                    onChange={(_e, v) => { setInlinePassword(v); invalidateResults(); }}
                    aria-label="Elasticsearch password"
                  />
                </FormGroup>
                <FormGroup label="Telemetry Index" fieldId="es-inline-index" isRequired>
                  <TextInput
                    id="es-inline-index"
                    value={inlineIndex}
                    onChange={(_e, v) => { setInlineIndex(v); invalidateResults(); }}
                    aria-label="Telemetry index"
                  />
                </FormGroup>
                <Flex alignItems={{ default: 'alignItemsFlexEnd' }} spaceItems={{ default: 'spaceItemsMd' }}>
                  {dateAndSizeControls}
                  <FlexItem>
                    <FormGroup label="" fieldId="run-inline-query-btn">
                      <Button
                        variant="primary"
                        onClick={handleRunInlineQuery}
                        isDisabled={querying || !inlineComplete || invalidDateRange || !!sizeError}
                        isLoading={querying}
                      >
                        Run Query
                      </Button>
                    </FormGroup>
                  </FlexItem>
                </Flex>
              </Form>

              {resultsSection}
            </>
          ) : (
            <>
              <Flex alignItems={{ default: 'alignItemsFlexEnd' }}
              spaceItems={{ default: 'spaceItemsMd' }}>
                <FlexItem >
                  <FormGroup label="Elasticsearch Config" fieldId="es-data-config"  style={{ width: '30em' }}>
                    <FormSelect
                      id="es-data-config"
                      value={selectedConfig}
                      onChange={(_e, v) => { setSelectedConfig(v); invalidateResults(); }}
                      aria-label="Select an Elasticsearch config"
                    >
                      <FormSelectOption value="" label="Select a saved Elasticsearch config…" isDisabled />
                      {configs.map((cfg) => (
                        <FormSelectOption key={cfg.name} value={cfg.name} label={cfg.name} />
                      ))}
                    </FormSelect>
                  </FormGroup>
                </FlexItem>
                {dateAndSizeControls}
                <FlexItem>
                    <FormGroup label="" fieldId="run-query-btn">
                  <Button
                    variant="primary"
                    onClick={handleRunQuery}
                    isDisabled={querying || !selectedConfig || invalidDateRange || !!sizeError}
                    isLoading={querying}
                  >
                    Run Query
                  </Button>
                  </FormGroup>
                </FlexItem>
                {isAdmin && (
                  <FlexItem>
                    <Button variant="link" icon={<PlusCircleIcon />} onClick={() => setShowCreateModal(true)}>
                      Add new config
                    </Button>
                  </FlexItem>
                )}
              </Flex>

              {resultsSection}
            </>
          )}
        </CardBody>
      </Card>

      {isAdmin && (
        <Modal
          variant={ModalVariant.medium}
          title="Add Elasticsearch Config"
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        >
          <ElasticsearchConfigForm
            onSubmit={handleCreateConfig}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}
    </>
  );
}
