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
import { downloadResiliencyHistoryPdf } from './resiliencyHistoryReport';
import './resiliencyHistory.css';

interface ClusterOption {
  name: string;
  providerName: string;
}

interface AppliedFilters {
  categories: string[];
  clusters: ClusterOption[];
}

function toClusterOptions(clusters: TargetResponse[] | null): ClusterOption[] {
  const options = new Map<string, ClusterOption>();
  (clusters ?? []).forEach((cluster) => {
    const providerName = cluster.operatorSource || 'krkn-operator';
    const key = providerName + '\u0000' + cluster.clusterName;
    options.set(key, { name: cluster.clusterName, providerName });
  });

  return [...options.values()]
    .sort((left, right) => left.name.localeCompare(right.name) || left.providerName.localeCompare(right.providerName));
}

function clusterIdentity(cluster: ClusterOption): string {
  return cluster.providerName + '\u0000' + cluster.name;
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
  const [exportLoading, setExportLoading] = useState(false);
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
    setExportLoading(false);
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

    const selectedClusterOptions = clusterOptions.filter((cluster) => selectedClusters.includes(clusterIdentity(cluster)));
    const filters: AppliedFilters = {
      categories: [...selectedCategories],
      clusters: selectedClusterOptions,
    };
    const selectedClusterNames = [...new Set(selectedClusterOptions.map((cluster) => cluster.name))];
    const selectedProvidersByName = new Map<string, string[]>();
    selectedClusterOptions.forEach((cluster) => {
      if (clusterOptions.filter((option) => option.name === cluster.name).length > 1) {
        const providers = selectedProvidersByName.get(cluster.name) ?? [];
        providers.push(cluster.providerName);
        selectedProvidersByName.set(cluster.name, providers);
      }
    });
    const clusterProviders = Object.fromEntries(selectedProvidersByName);
    const requestId = ++queryRequestId.current;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setAppliedFilters(null);
    setGeneratedAt(null);
    setExportError(null);
    setExportLoading(false);

    try {
      const response = await operatorApi.queryResiliencyHistory({
        categories: filters.categories,
        clusters: selectedClusterNames,
        ...(Object.keys(clusterProviders).length > 0 ? { clusterProviders } : {}),
      });
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

  const exportPdf = async () => {
    if (!queryResult || !hasHistoryData(queryResult)) {
      setExportError('Apply filters that return score history before exporting.');
      return;
    }
    setExportError(null);
    setExportLoading(true);
    try {
      await downloadResiliencyHistoryPdf({
        queryResult,
        categories: appliedFilters?.categories ?? [],
        clusters: appliedFilters?.clusters ?? [],
        charts,
        chartMode,
        showBaselines,
        queriedAt: generatedAt,
        reportGeneratedAt: new Date().toLocaleString(),
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Unable to generate the PDF report.');
    } finally {
      setExportLoading(false);
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
                      key={clusterIdentity(cluster)}
                      id={`resiliency-cluster-${index}`}
                      label={(
                        <span className="resiliency-history__option-label">
                          <span>{cluster.name}</span>
                          <small className="resiliency-history__option-detail">{cluster.providerName}</small>
                        </span>
                      )}
                      isChecked={selectedClusters.includes(clusterIdentity(cluster))}
                      onChange={() => toggleCluster(clusterIdentity(cluster))}
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
                  <strong>Clusters:</strong> {appliedFilters.clusters.map((cluster) => `${cluster.providerName} / ${cluster.name}`).join(', ')}
                </p>
              </div>
              <Button
                className="resiliency-history__export-button"
                variant="secondary"
                onClick={exportPdf}
                isDisabled={!hasResults || exportLoading}
                isLoading={exportLoading}
              >
                {exportLoading ? 'Generating PDF…' : 'Export PDF'}
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
                  Downloads a paginated report with score summaries, vector charts and effective configurations.
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
