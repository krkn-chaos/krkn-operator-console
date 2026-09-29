import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Radio,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { operatorApi } from '../../services/operatorApi';
import { useClusterDiscovery } from '../../hooks/useClusterDiscovery';
import type { CategoryResponse, ResiliencyHistoryQueryResponse, TargetResponse } from '../../types/api';
import { buildResiliencyHistoryCharts, type ResiliencyHistoryChartMode } from './resiliencyHistoryUtils';
import { ResiliencyHistoryChart } from './ResiliencyHistoryChart';
import './resiliencyHistory.css';

interface ClusterOption {
  name: string;
  operators: string[];
}

interface AppliedFilters {
  categories: string[];
  clusters: string[];
}

function toClusterOptions(clusters: TargetResponse[] | null): ClusterOption[] {
  const options = new Map<string, Set<string>>();
  (clusters ?? []).forEach((cluster) => {
    const operators = options.get(cluster.clusterName) ?? new Set<string>();
    operators.add(cluster.operatorSource || 'Krkn Operator');
    options.set(cluster.clusterName, operators);
  });

  return [...options.entries()]
    .map(([name, operators]) => ({ name, operators: [...operators].sort() }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function hasHistoryData(response: ResiliencyHistoryQueryResponse): boolean {
  return Object.values(response.clusters).some((categoryMap) =>
    Object.values(categoryMap).some((points) => points.length > 0),
  );
}

/** Dedicated page for selecting visible categories and clusters to query. */
export function ResiliencyHistoryPage() {
  const clusterDiscovery = useClusterDiscovery();
  const startClusterDiscovery = clusterDiscovery.startDiscovery;
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<ResiliencyHistoryQueryResponse | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters | null>(null);
  const [chartMode, setChartMode] = useState<ResiliencyHistoryChartMode>('separate');
  const [showBaselines, setShowBaselines] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const categoryRequestId = useRef(0);
  const queryRequestId = useRef(0);
  const clusterDiscoveryStarted = useRef(false);

  const loadCategories = useCallback(async () => {
    const requestId = ++categoryRequestId.current;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const response = await operatorApi.getCategories();
      if (requestId === categoryRequestId.current) {
        setCategories(response.categories ?? []);
      }
    } catch (error) {
      if (requestId === categoryRequestId.current) {
        setCategoriesError(error instanceof Error ? error.message : 'Failed to load visible categories');
      }
    } finally {
      if (requestId === categoryRequestId.current) setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
    return () => {
      categoryRequestId.current += 1;
      queryRequestId.current += 1;
    };
  }, [loadCategories]);

  useEffect(() => {
    if (clusterDiscoveryStarted.current) return;
    clusterDiscoveryStarted.current = true;
    void startClusterDiscovery();
  }, [startClusterDiscovery]);

  const clusterOptions = useMemo(
    () => toClusterOptions(clusterDiscovery.clusters),
    [clusterDiscovery.clusters],
  );
  const canApply = selectedCategories.length > 0 && selectedClusters.length > 0;

  const invalidateQuery = () => {
    queryRequestId.current += 1;
    setQueryLoading(false);
    setQueryError(null);
    setQueryResult(null);
    setAppliedFilters(null);
    setGeneratedAt(null);
    setExportError(null);
  };

  const toggleCategory = (name: string) => {
    invalidateQuery();
    setSelectedCategories((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name]);
  };

  const toggleCluster = (name: string) => {
    invalidateQuery();
    setSelectedClusters((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name]);
  };

  const applyFilters = async () => {
    if (!canApply) return;

    const filters = {
      categories: [...selectedCategories],
      clusters: [...selectedClusters],
    };
    const requestId = ++queryRequestId.current;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setAppliedFilters(null);
    setGeneratedAt(null);
    setExportError(null);

    try {
      const response = await operatorApi.queryResiliencyHistory(filters);
      if (requestId === queryRequestId.current) {
        setQueryResult(response);
        setAppliedFilters(filters);
        setGeneratedAt(new Date().toLocaleString());
      }
    } catch (error) {
      if (requestId === queryRequestId.current) {
        setQueryError(error instanceof Error ? error.message : 'Failed to load resiliency history');
      }
    } finally {
      if (requestId === queryRequestId.current) setQueryLoading(false);
    }
  };

  const exportPdf = () => {
    if (!queryResult || !hasHistoryData(queryResult)) {
      setExportError('Apply filters that return score history before exporting.');
      return;
    }
    setExportError(null);
    try {
      if (typeof window.print !== 'function') throw new Error('PDF export is unavailable in this browser.');
      window.print();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Unable to open the PDF export dialog.');
    }
  };

  const charts = useMemo(() => {
    if (!queryResult || !appliedFilters) return [];
    return buildResiliencyHistoryCharts(
      queryResult,
      appliedFilters.categories,
      appliedFilters.clusters,
      chartMode,
    );
  }, [queryResult, appliedFilters, chartMode]);
  const hasResults = queryResult !== null && hasHistoryData(queryResult);

  return (
    <main className="resiliency-history" aria-labelledby="resiliency-history-title">
      <header className="resiliency-history__page-header">
        <Title headingLevel="h1" size="2xl" id="resiliency-history-title">Resiliency History</Title>
        <p>Compare historical resiliency scores across the categories and clusters visible to you.</p>
      </header>

      <Card className="resiliency-history__controls">
        <CardTitle><Title headingLevel="h2" size="lg">Choose filters</Title></CardTitle>
        <CardBody>
          <div className="resiliency-history__filter-grid">
            <fieldset className="resiliency-history__filter-group" aria-busy={categoriesLoading}>
              <legend>Categories</legend>
              {categoriesLoading ? (
                <div className="resiliency-history__loading"><Spinner size="md" aria-label="Loading categories" /></div>
              ) : categoriesError ? (
                <Alert variant="danger" isInline title="Unable to load categories">
                  <p>{categoriesError}</p>
                  <Button variant="link" onClick={() => void loadCategories()}>Retry categories</Button>
                </Alert>
              ) : categories.length === 0 ? (
                <EmptyState variant="sm">
                  <EmptyStateIcon icon={CubesIcon} />
                  <Title headingLevel="h3" size="md">No visible categories</Title>
                  <EmptyStateBody>Categories available to your account will appear here.</EmptyStateBody>
                </EmptyState>
              ) : (
                <div className="resiliency-history__options" role="group" aria-label="Select categories">
                  {categories.map((category, index) => (
                    <Checkbox
                      key={category.name}
                      id={`resiliency-category-${index}`}
                      label={(
                        <span className="resiliency-history__option-label">
                          {category.color && <span className="resiliency-history__category-color" style={{ backgroundColor: category.color }} aria-hidden="true" />}
                          {category.name}
                        </span>
                      )}
                      isChecked={selectedCategories.includes(category.name)}
                      onChange={() => toggleCategory(category.name)}
                    />
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="resiliency-history__filter-group" aria-busy={clusterDiscovery.isLoading}>
              <legend>Clusters</legend>
              {clusterDiscovery.isLoading ? (
                <div className="resiliency-history__loading"><Spinner size="md" aria-label="Loading clusters" /></div>
              ) : clusterDiscovery.error ? (
                <Alert variant="danger" isInline title="Unable to load clusters">
                  <p>{clusterDiscovery.error}</p>
                  <Button variant="link" onClick={() => clusterDiscovery.retry()}>Retry cluster discovery</Button>
                </Alert>
              ) : clusterOptions.length === 0 ? (
                <EmptyState variant="sm">
                  <EmptyStateIcon icon={CubesIcon} />
                  <Title headingLevel="h3" size="md">No clusters discovered</Title>
                  <EmptyStateBody>No clusters are currently visible to this console.</EmptyStateBody>
                  <Button variant="link" onClick={() => void startClusterDiscovery()}>Refresh clusters</Button>
                </EmptyState>
              ) : (
                <div className="resiliency-history__options" role="group" aria-label="Select clusters">
                  {clusterOptions.map((cluster, index) => (
                    <Checkbox
                      key={cluster.name}
                      id={`resiliency-cluster-${index}`}
                      label={(
                        <span className="resiliency-history__option-label">
                          <span>{cluster.name}</span>
                          {cluster.operators.length > 0 && (
                            <small className="resiliency-history__option-detail">{cluster.operators.join(', ')}</small>
                          )}
                        </span>
                      )}
                      isChecked={selectedClusters.includes(cluster.name)}
                      onChange={() => toggleCluster(cluster.name)}
                    />
                  ))}
                </div>
              )}
            </fieldset>
          </div>

          <div className="resiliency-history__apply-row">
            <Button
              variant="primary"
              onClick={() => void applyFilters()}
              isDisabled={!canApply || queryLoading || categoriesLoading || clusterDiscovery.isLoading}
              isLoading={queryLoading}
            >
              Apply filters
            </Button>
            {!canApply && <span>Select at least one category and one cluster.</span>}
          </div>
        </CardBody>
      </Card>

      <section className="resiliency-history__results" aria-live="polite" aria-busy={queryLoading}>
        {queryLoading && (
          <div className="resiliency-history__loading resiliency-history__query-loading">
            <Spinner size="lg" aria-label="Loading resiliency history" />
            <span>Loading resiliency history…</span>
          </div>
        )}
        {queryError && <Alert variant="danger" isInline title="Unable to load resiliency history">{queryError}</Alert>}
        {exportError && <Alert variant="danger" isInline title="PDF export failed">{exportError}</Alert>}

        {queryResult && appliedFilters && (
          <>
            <div className="resiliency-history__result-header">
              <div>
                <Title headingLevel="h2" size="xl">Score history</Title>
                <p className="resiliency-history__applied-filters">
                  <strong>Categories:</strong> {appliedFilters.categories.join(', ')}<br />
                  <strong>Clusters:</strong> {appliedFilters.clusters.join(', ')}
                </p>
              </div>
              <Button
                className="resiliency-history__export-button"
                variant="secondary"
                onClick={exportPdf}
                isDisabled={!hasResults}
              >
                Export PDF
              </Button>
            </div>
            {!hasResults && (
              <EmptyState variant="sm">
                <EmptyStateIcon icon={CubesIcon} />
                <Title headingLevel="h3" size="md">No resiliency history found</Title>
                <EmptyStateBody>No scored runs match the selected categories and clusters.</EmptyStateBody>
              </EmptyState>
            )}
            {hasResults && (
              <>
                <p id="resiliency-history-export-help" className="resiliency-history__export-help">
                  Export the currently displayed charts using your browser’s Save as PDF option.
                </p>
                <div className="resiliency-history__mode-controls" role="group" aria-label="Chart configuration mode">
                  <Radio
                    id="history-mode-separate"
                    name="history-mode"
                    label="Separate configuration groups"
                    isChecked={chartMode === 'separate'}
                    onChange={() => setChartMode('separate')}
                  />
                  <Radio
                    id="history-mode-collapsed"
                    name="history-mode"
                    label="Combine configurations by category"
                    isChecked={chartMode === 'collapsed'}
                    onChange={() => setChartMode('collapsed')}
                  />
                </div>
                <div className="resiliency-history__baseline-controls">
                  <Checkbox
                    id="history-show-baselines"
                    label="Show baseline comparisons"
                    isChecked={showBaselines}
                    onChange={(_event, checked) => setShowBaselines(checked)}
                  />
                </div>
                <div className="resiliency-history__print-summary">
                  <p><strong>Categories:</strong> {appliedFilters.categories.join(', ')}</p>
                  <p><strong>Clusters:</strong> {appliedFilters.clusters.join(', ')}</p>
                  <p><strong>Configuration mode:</strong> {chartMode === 'separate' ? 'Separate configuration groups' : 'Mixed configurations by category'}</p>
                  <p><strong>Baseline comparisons:</strong> {showBaselines ? 'Shown' : 'Hidden'}</p>
                  <p><strong>Generated at:</strong> {generatedAt}</p>
                </div>
                <div className="resiliency-history__charts" aria-label="Resiliency history charts">
                  {charts.map((chart) => (
                    <ResiliencyHistoryChart key={chart.key} chart={chart} showBaselines={showBaselines} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
