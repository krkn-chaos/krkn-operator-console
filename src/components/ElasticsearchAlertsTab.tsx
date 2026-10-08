import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Flex,
  FlexItem,
  FormGroup,
  Label,
  Spinner,
  TextInput,
  Title,
  Pagination,
  PaginationVariant,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { DatabaseIcon } from '@patternfly/react-icons';
import { elasticsearchApi } from '../services/elasticsearchApi';
import { useNotifications } from '../hooks';
import { usePagination } from '../hooks/usePagination';
import type { AlertDocument, ElasticsearchConfig } from '../types/api';
import { getFieldValue, matchesFieldFilters } from '../utils/elasticsearchFieldFilters';
import { ElasticsearchFilterControls } from './ElasticsearchFilterControls';

interface ElasticsearchAlertsTabProps {
  configs: ElasticsearchConfig[];
  selectedConfig: string;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  size: string;
  onSizeChange: (size: string) => void;
}

const SUMMARY_FIELDS = new Set(['run_uuid', 'phase', 'created_at', 'severity']);
type AlertSortColumn = 'uuid' | 'phase' | 'created_at' | 'severity' | 'document';
const ALERT_FILTER_OPTIONS = [
  { key: 'run_uuid', label: 'UUID' },
  { key: 'severity', label: 'Severity', values: ['critical', 'error', 'warning', 'info'] },
  { key: 'phase', label: 'Phase', values: ['pre', 'during', 'post'] },
  { key: 'alertname', label: 'Alert' },
];

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAlertFields(value: unknown, prefix = ''): Array<{ key: string; value: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => formatAlertFields(item, `${prefix}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => {
      if (!prefix && SUMMARY_FIELDS.has(key)) return [];
      return formatAlertFields(child, prefix ? `${prefix}.${key}` : key);
    });
  }
  return [{ key: prefix || 'value', value: value === null ? 'null' : String(value) }];
}

function alertSeverity(document: AlertDocument): string {
  const severity = getFieldValue(document.source, 'severity');
  return severity === undefined ? '—' : String(severity);
}

function alertSeverityColor(severity: string): 'red' | 'orange' | 'gold' | 'grey' {
  switch (severity.toLowerCase()) {
    case 'error':
      return 'red';
    case 'critical':
      return 'orange';
    case 'warning':
      return 'gold';
    default:
      return 'grey';
  }
}

function alertSummaryField(document: AlertDocument, field: string): string {
  const value = getFieldValue(document.source, field);
  return value === undefined || value === null ? '—' : String(value);
}

function formatAlertCreatedAt(document: AlertDocument): string {
  const raw = getFieldValue(document.source, 'created_at');
  if (raw === undefined || raw === null) return '—';
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Displays documents from the configured Elasticsearch alerts index.
 *
 * The parent owns the selected config and query controls so Telemetry and
 * Alerts can share them. Results are queried from the saved config, filtered
 * with the active field chips, paginated, and rendered with sortable columns.
 *
 * @example
 * ```tsx
 * <ElasticsearchAlertsTab
 *   configs={configs}
 *   selectedConfig={selectedConfig}
 *   startDate={startDate}
 *   onStartDateChange={setStartDate}
 *   endDate={endDate}
 *   onEndDateChange={setEndDate}
 *   size={size}
 *   onSizeChange={setSize}
 * />
 * ```
 *
 * @param props.configs Saved Elasticsearch configurations available to the user.
 * @param props.selectedConfig Name of the saved config used for the query.
 * @param props.startDate Inclusive query start date in `yyyy-MM-dd` format.
 * @param props.onStartDateChange Updates the shared start-date state.
 * @param props.endDate Inclusive query end date in `yyyy-MM-dd` format.
 * @param props.onEndDateChange Updates the shared end-date state.
 * @param props.size Maximum number of documents requested from Elasticsearch.
 * @param props.onSizeChange Updates the shared result-size state.
 */
export function ElasticsearchAlertsTab({
  configs, selectedConfig, startDate, onStartDateChange,
  endDate, onEndDateChange, size, onSizeChange,
}: ElasticsearchAlertsTabProps) {
  const { showError } = useNotifications();
  const [documents, setDocuments] = useState<AlertDocument[]>([]);
  const [querying, setQuerying] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [filters, setFilters] = useState<Array<{ key: string; value: string }>>([]);
  const [draftFilter, setDraftFilter] = useState({ key: '', value: '' });
  const latestRequestId = useRef(0);
  const [sortColumn, setSortColumn] = useState<AlertSortColumn>('severity');
  const [sortAscending, setSortAscending] = useState(true);
  const filteredDocuments = useMemo(() => {
    return documents.filter(document => matchesFieldFilters(document.source, filters));
  }, [documents, filters]);
  const sortedDocuments = useMemo(() => {
    const sorted = [...filteredDocuments].sort((left, right) => {
      const leftValue = sortColumn === 'document'
        ? formatAlertFields(left.source).map(field => `${field.key}: ${field.value}`).join(' ')
        : sortColumn === 'severity'
          ? alertSeverity(left)
          : alertSummaryField(left, sortColumn === 'uuid' ? 'run_uuid' : sortColumn);
      const rightValue = sortColumn === 'document'
        ? formatAlertFields(right.source).map(field => `${field.key}: ${field.value}`).join(' ')
        : sortColumn === 'severity'
          ? alertSeverity(right)
          : alertSummaryField(right, sortColumn === 'uuid' ? 'run_uuid' : sortColumn);
      return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
    });
    return sortAscending ? sorted : sorted.reverse();
  }, [filteredDocuments, sortAscending, sortColumn]);
  const { page, perPage, totalItems, paginatedData, handleSetPage, handlePerPageSelect } = usePagination(sortedDocuments, { initialPerPage: 10 });

  const selected = configs.find(config => config.name === selectedConfig);
  const today = localDateString(new Date());
  const endInFuture = !!endDate && endDate > today;
  const invalidRange = (!!startDate && !!endDate && startDate > endDate) || endInFuture;
  const invalidSize = size.trim() !== '' && (!/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 500);

  useEffect(() => {
    latestRequestId.current += 1;
    setDocuments([]);
    setHasQueried(false);
    setQuerying(false);
    setFilters([]);
    setDraftFilter({ key: '', value: '' });
  }, [selectedConfig, startDate, endDate, size]);

  const runQuery = async () => {
    if (!selectedConfig) {
      showError('No config selected', 'Please select an Elasticsearch config to query');
      return;
    }
    if (!selected?.alertsIndex) {
      showError('Alerts index unavailable', 'The selected Elasticsearch config has no alerts index');
      return;
    }
    if (invalidRange || invalidSize) {
      showError('Invalid query parameters', 'Enter a valid date range ending today or earlier and a max results value between 1 and 500');
      return;
    }
    setQuerying(true);
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    const requestConfig = selectedConfig;
    try {
      const result = await elasticsearchApi.queryAlerts(
        selectedConfig,
        size.trim() === '' ? undefined : Number(size),
        startDate || undefined,
        endDate || undefined,
      );
      if (latestRequestId.current !== requestId || selectedConfig !== requestConfig) return;
      setDocuments(result.documents || []);
      setFilters([]);
      setDraftFilter({ key: '', value: '' });
      setHasQueried(true);
    } catch (error) {
      if (latestRequestId.current !== requestId || selectedConfig !== requestConfig) return;
      showError('Query failed', error instanceof Error ? error.message : 'Could not query Elasticsearch alerts');
    } finally {
      if (latestRequestId.current === requestId) setQuerying(false);
    }
  };

  const toggleSort = (column: AlertSortColumn) => {
    if (sortColumn === column) {
      setSortAscending(value => !value);
    } else {
      setSortColumn(column);
      setSortAscending(true);
    }
  };

  const addFilter = () => {
    if (!draftFilter.key) return;
    setFilters(current => [...current, draftFilter]);
    setDraftFilter({ key: '', value: '' });
  };

  if (configs.length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon icon={DatabaseIcon} />
        <Title headingLevel="h3" size="md">No Saved Elasticsearch Configs for Alerts</Title>
        <EmptyStateBody>Add an Elasticsearch config with an alerts index to query alerts.</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <Flex alignItems={{ default: 'alignItemsFlexEnd' }} spaceItems={{ default: 'spaceItemsMd' }} style={{ marginTop: '1rem' }}>
        <FlexItem>
          <FormGroup label="Start Date" fieldId="es-alerts-start-date">
            <TextInput id="es-alerts-start-date" type="date" value={startDate} onChange={(_e, value) => { onStartDateChange(value); setHasQueried(false); }} />
          </FormGroup>
        </FlexItem>
        <FlexItem>
          <FormGroup label="End Date" fieldId="es-alerts-end-date">
            <TextInput id="es-alerts-end-date" type="date" value={endDate} onChange={(_e, value) => { onEndDateChange(value); setHasQueried(false); }} />
          </FormGroup>
        </FlexItem>
        <FlexItem>
          <FormGroup label="Max results" fieldId="es-alerts-size">
            <TextInput id="es-alerts-size" type="number" value={size} onChange={(_e, value) => { onSizeChange(value); setHasQueried(false); }} aria-label="Alerts max results" />
          </FormGroup>
        </FlexItem>
        <ElasticsearchFilterControls
          draftFilter={draftFilter}
          options={ALERT_FILTER_OPTIONS}
          idPrefix="es-alerts"
          onDraftChange={setDraftFilter}
          onAddFilter={addFilter}
        />
        <FlexItem>
          <Button variant="primary" onClick={runQuery} isDisabled={querying || !selectedConfig || invalidRange || invalidSize} isLoading={querying}>
            Query Alerts
          </Button>
        </FlexItem>
      </Flex>

      <Flex spaceItems={{ default: 'spaceItemsSm' }} style={{ marginTop: '0.75rem' }}>
        {filters.filter(filter => filter.key).map((filter, index) => {
          const label = ALERT_FILTER_OPTIONS.find(option => option.key === filter.key)?.label || filter.key;
          return (
            <FlexItem key={`${filter.key}-${index}`}>
              <Label
                color="blue"
                onClose={() => setFilters(current => current.filter((_, filterIndex) => filterIndex !== index))}
              >
                {label}: {filter.value || '(any)'}
              </Label>
            </FlexItem>
          );
        })}
        {filters.length > 0 && (
          <FlexItem>
            <Button variant="link" isInline onClick={() => setFilters([])}>
              Clear all filters
            </Button>
          </FlexItem>
        )}
      </Flex>

      <div style={{ marginTop: '1.5rem' }}>
        {querying ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><Spinner size="lg" /></div>
        ) : !hasQueried ? (
          <Alert variant="info" isInline title="Run a query to view alerts." />
        ) : filteredDocuments.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={DatabaseIcon} />
            <Title headingLevel="h3" size="md">{documents.length === 0 ? 'No alerts found' : 'No alerts match the filters'}</Title>
            <EmptyStateBody>
              {documents.length === 0 ? 'The alerts index returned no documents for this date range.' : 'Try removing or changing a filter.'}
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <>
            <Pagination
              itemCount={totalItems}
              perPage={perPage}
              page={page}
              onSetPage={handleSetPage}
              onPerPageSelect={handlePerPageSelect}
              variant={PaginationVariant.top}
              isCompact
            />
            <Table isStriped aria-label="Elasticsearch alert documents" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '40%' }} />
              </colgroup>
              <Thead>
                <Tr>
                  <Th>
                    <Button variant="plain" style={{ width: '100%', justifyContent: 'center' }} onClick={() => toggleSort('uuid')}>
                      UUID {sortColumn === 'uuid' ? (sortAscending ? '↑' : '↓') : '↕'}
                    </Button>
                  </Th>
                  <Th>
                    <Button variant="plain" style={{ width: '100%', justifyContent: 'center' }} onClick={() => toggleSort('phase')}>
                      Phase {sortColumn === 'phase' ? (sortAscending ? '↑' : '↓') : '↕'}
                    </Button>
                  </Th>
                  <Th>
                    <Button variant="plain" style={{ width: '100%', justifyContent: 'center' }} onClick={() => toggleSort('created_at')}>
                      Creation Timestamp {sortColumn === 'created_at' ? (sortAscending ? '↑' : '↓') : '↕'}
                    </Button>
                  </Th>
                  <Th style={{ minWidth: '10rem', textAlign: 'center' }}>
                    <Button variant="plain" style={{ width: '100%', justifyContent: 'center' }} onClick={() => toggleSort('severity')}>
                      Severity {sortColumn === 'severity' ? (sortAscending ? '↑' : '↓') : '↕'}
                    </Button>
                  </Th>
                  <Th>
                    <Button variant="plain" style={{ width: '100%', justifyContent: 'center' }} onClick={() => toggleSort('document')}>
                      Alert fields {sortColumn === 'document' ? (sortAscending ? '↑' : '↓') : '↕'}
                    </Button>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {paginatedData.map((document, index) => (
                  <Tr key={document.id || String(index)}>
                    <Td dataLabel="UUID" style={{ verticalAlign: 'top', overflowWrap: 'anywhere' }}>{alertSummaryField(document, 'run_uuid')}</Td>
                    <Td dataLabel="Phase" style={{ verticalAlign: 'top', overflowWrap: 'anywhere' }}>{alertSummaryField(document, 'phase')}</Td>
                    <Td dataLabel="Creation Timestamp" style={{ verticalAlign: 'top', overflowWrap: 'anywhere' }}>{formatAlertCreatedAt(document)}</Td>
                    <Td dataLabel="Severity" style={{ minWidth: '10rem', textAlign: 'center', verticalAlign: 'top' }}>
                      <Label color={alertSeverityColor(alertSeverity(document))} isCompact style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                        {alertSeverity(document)}
                      </Label>
                    </Td>
                    <Td dataLabel="Alert fields" style={{ verticalAlign: 'top', overflowWrap: 'anywhere' }}>
                      <div style={{ display: 'grid', gap: '0.25rem', overflowWrap: 'anywhere' }}>
                        {formatAlertFields(document.source).map(field => (
                          <div key={field.key}>
                            <strong>{field.key}:</strong> {field.value}
                          </div>
                        ))}
                      </div>
                    </Td>
                  </Tr>
              ))}
            </Tbody>
            </Table>
            <Pagination
              itemCount={totalItems}
              perPage={perPage}
              page={page}
              onSetPage={handleSetPage}
              onPerPageSelect={handlePerPageSelect}
              variant={PaginationVariant.bottom}
              isCompact
            />
          </>
        )}
      </div>
    </>
  );
}
