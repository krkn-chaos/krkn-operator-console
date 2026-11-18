import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Flex,
  FlexItem,
  MenuToggle,
  Select,
  SelectGroup,
  SelectOption,
  Spinner,
  Title,
} from '@patternfly/react-core';
import {
  ChartLineIcon,
  ExternalLinkAltIcon,
  SyncAltIcon,
} from '@patternfly/react-icons';
import { visualizeApi } from '../services/visualizeApi';
import { useNotifications } from '../hooks';
import type { GrafanaDashboard, VisualizeConfig } from '../types/api';

/** Toolbar + embedded Grafana dashboard frame heights, tuned to the sidebar layout. */
const FRAME_HEIGHT = 'calc(100vh - 13rem)';

/**
 * VisualizePage — embedded Grafana dashboards for krkn-visualize instances.
 *
 * Guides the user through a two-step selection before loading any panels:
 * 1. Pick a krkn-visualize instance (one per target cluster); only Ready
 *    instances are selectable.
 * 2. Pick one of the dashboards installed in that instance's Grafana; the
 *    first dashboard is auto-selected so panels appear immediately.
 *
 * The selected dashboard is then rendered in an iframe using Grafana's kiosk
 * mode. The operator proxies Grafana's search API for the dashboard list, and
 * the deployed Grafana allows embedding with anonymous Viewer access, so no
 * credentials are handled here.
 *
 * @example
 * import { VisualizePage } from './components';
 * <VisualizePage />
 */
export function VisualizePage() {
  const { showError } = useNotifications();
  const [instances, setInstances] = useState<VisualizeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [instancesError, setInstancesError] = useState<string | null>(null);

  const [selectedInstance, setSelectedInstance] = useState<VisualizeConfig | null>(null);
  const [isInstanceSelectOpen, setIsInstanceSelectOpen] = useState(false);

  const [dashboards, setDashboards] = useState<GrafanaDashboard[]>([]);
  const [loadingDashboards, setLoadingDashboards] = useState(false);
  const [dashboardsError, setDashboardsError] = useState<string | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<GrafanaDashboard | null>(null);
  const [isDashboardSelectOpen, setIsDashboardSelectOpen] = useState(false);

  // Bumped to force the iframe to reload without remounting the page.
  const [frameReloadKey, setFrameReloadKey] = useState(0);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    try {
      const data = await visualizeApi.listInstances();
      setInstances(data);
      setInstancesError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load krkn-visualize instances';
      setInstancesError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const readyInstances = useMemo(
    () => instances.filter((instance) => instance.status === 'Ready'),
    [instances]
  );

  const fetchDashboards = useCallback(
    async (instance: VisualizeConfig) => {
      setLoadingDashboards(true);
      setDashboardsError(null);
      try {
        const data = await visualizeApi.listDashboards(instance.name);
        setDashboards(data);
        // Auto-select the first dashboard so panels load immediately.
        setSelectedDashboard(data[0] ?? null);
        if (data.length === 0) {
          showError('No dashboards found', `Grafana for "${instance.name}" reported no dashboards`);
        }
      } catch (err) {
        setDashboards([]);
        setSelectedDashboard(null);
        const message = err instanceof Error ? err.message : 'Unable to load dashboards';
        setDashboardsError(message);
      } finally {
        setLoadingDashboards(false);
      }
    },
    [showError]
  );

  const handleInstanceSelect = (_event: unknown, value: string | number | undefined) => {
    setIsInstanceSelectOpen(false);
    const instance = readyInstances.find((i) => i.name === value);
    if (!instance || instance.name === selectedInstance?.name) {
      return;
    }
    setSelectedInstance(instance);
    setDashboards([]);
    setSelectedDashboard(null);
    setDashboardsError(null);
    fetchDashboards(instance);
  };

  const handleDashboardSelect = (_event: unknown, value: string | number | undefined) => {
    setIsDashboardSelectOpen(false);
    const dashboard = dashboards.find((d) => d.uid === value);
    if (dashboard) {
      setSelectedDashboard(dashboard);
    }
  };

  // Dashboards grouped by Grafana folder (Chaos, General, k8s) for the picker.
  const dashboardsByFolder = useMemo(() => {
    const groups = new Map<string, GrafanaDashboard[]>();
    for (const dashboard of dashboards) {
      const folder = dashboard.folderTitle || 'Dashboards';
      const group = groups.get(folder) ?? [];
      group.push(dashboard);
      groups.set(folder, group);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [dashboards]);

  const embedUrl = useMemo(() => {
    if (!selectedInstance?.grafanaUrl || !selectedDashboard) {
      return null;
    }
    const base = selectedInstance.grafanaUrl.replace(/\/+$/, '');
    // scenes=1 forces Grafana's scenes renderer, which keeps the variables row
    // and time range picker visible in kiosk mode (the legacy renderer used by
    // Grafana 10.x hides variables whenever any kiosk mode is active).
    // kiosk=1 removes all remaining navigation chrome.
    // Note: on Grafana 11+ the scenes param is redundant and full kiosk hides
    // the controls row again; there, kiosk=tv is the mode that keeps them.
    return `${base}${selectedDashboard.url}?kiosk=1&scenes=1&orgId=1`;
  }, [selectedInstance, selectedDashboard]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Spinner size="xl" />
      </div>
    );
  }

  if (instancesError) {
    return (
      <Card>
        <CardBody>
          <EmptyState>
            <EmptyStateIcon icon={ChartLineIcon} />
            <Title headingLevel="h3" size="lg">
              Failed to load krkn-visualize instances
            </Title>
            <EmptyStateBody>{instancesError}</EmptyStateBody>
            <Button variant="primary" onClick={fetchInstances}>
              Retry
            </Button>
          </EmptyState>
        </CardBody>
      </Card>
    );
  }

  if (instances.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState>
            <EmptyStateIcon icon={ChartLineIcon} />
            <Title headingLevel="h3" size="lg">
              No krkn-visualize instances
            </Title>
            <EmptyStateBody>
              Install krkn-visualize on a target cluster to visualize chaos experiment results and
              cluster metrics here. Instances are managed by administrators in{' '}
              <strong>Settings → krkn-visualize</strong>.
            </EmptyStateBody>
          </EmptyState>
        </CardBody>
      </Card>
    );
  }

  if (readyInstances.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState>
            <EmptyStateIcon icon={ChartLineIcon} />
            <Title headingLevel="h3" size="lg">
              No krkn-visualize instances are ready
            </Title>
            <EmptyStateBody>
              {instances.length} instance{instances.length === 1 ? ' is' : 's are'} registered but
              none has finished installing. Check installation status and logs in{' '}
              <strong>Settings → krkn-visualize</strong>, or retry once installation completes.
            </EmptyStateBody>
            <Button variant="primary" onClick={fetchInstances}>
              Refresh
            </Button>
          </EmptyState>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
          wrap="wrap"
        >
          <Flex
            gap={{ default: 'gapLg' }}
            alignItems={{ default: 'alignItemsCenter' }}
            wrap="wrap"
          >
            <FlexItem>
              <Select
                id="visualize-instance-select"
                aria-label="Select krkn-visualize instance"
                isOpen={isInstanceSelectOpen}
                onOpenChange={setIsInstanceSelectOpen}
                selected={selectedInstance?.name ?? ''}
                onSelect={handleInstanceSelect}
                toggle={(toggleRef) => (
                  <MenuToggle
                    ref={toggleRef}
                    id="visualize-instance-toggle"
                    aria-label="Select krkn-visualize instance"
                    onClick={() => setIsInstanceSelectOpen((open) => !open)}
                    isExpanded={isInstanceSelectOpen}
                    isFullWidth={false}
                    style={{ minWidth: '16rem' }}
                  >
                    {selectedInstance
                      ? `${selectedInstance.name} (${selectedInstance.targetCluster})`
                      : 'Select instance'}
                  </MenuToggle>
                )}
              >
                {readyInstances.map((instance) => (
                  <SelectOption key={instance.name} value={instance.name}>
                    <strong>{instance.name}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
                      {instance.targetCluster} · {instance.namespace}
                    </div>
                  </SelectOption>
                ))}
              </Select>
            </FlexItem>
            <FlexItem>
              <Select
                id="visualize-dashboard-select"
                aria-label="Select dashboard"
                isOpen={isDashboardSelectOpen}
                onOpenChange={setIsDashboardSelectOpen}
                selected={selectedDashboard?.uid ?? ''}
                onSelect={handleDashboardSelect}
                toggle={(toggleRef) => (
                  <MenuToggle
                    ref={toggleRef}
                    id="visualize-dashboard-toggle"
                    aria-label="Select dashboard"
                    onClick={() => setIsDashboardSelectOpen((open) => !open)}
                    isExpanded={isDashboardSelectOpen}
                    isDisabled={!selectedInstance || loadingDashboards || dashboards.length === 0}
                    isFullWidth={false}
                    style={{ minWidth: '16rem' }}
                  >
                    {loadingDashboards
                      ? 'Loading dashboards…'
                      : selectedDashboard
                        ? selectedDashboard.title
                        : selectedInstance
                          ? 'Select dashboard'
                          : 'Select an instance first'}
                  </MenuToggle>
                )}
              >
                {dashboardsByFolder.map(([folder, group]) => (
                  <SelectGroup key={folder} label={folder}>
                    {group.map((dashboard) => (
                      <SelectOption key={dashboard.uid} value={dashboard.uid}>
                        {dashboard.title}
                      </SelectOption>
                    ))}
                  </SelectGroup>
                ))}
              </Select>
            </FlexItem>
            {loadingDashboards && (
              <FlexItem>
                <Spinner size="md" />
              </FlexItem>
            )}
          </Flex>
          <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
            {selectedInstance?.grafanaUrl && (
              <FlexItem>
                <Button
                  variant="link"
                  component="a"
                  href={selectedInstance.grafanaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  icon={<ExternalLinkAltIcon />}
                  iconPosition="right"
                >
                  Open in Grafana
                </Button>
              </FlexItem>
            )}
            <FlexItem>
              <Button
                variant="secondary"
                icon={<SyncAltIcon />}
                isDisabled={!embedUrl}
                onClick={() => setFrameReloadKey((key) => key + 1)}
              >
                Refresh
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </CardTitle>
      <CardBody>
        {dashboardsError && (
          <Alert
            variant="danger"
            title="Failed to load dashboards"
            isInline
            style={{ marginBottom: '1rem' }}
            actionLinks={
              <Button
                variant="link"
                isInline
                onClick={() => selectedInstance && fetchDashboards(selectedInstance)}
              >
                Retry
              </Button>
            }
          >
            {dashboardsError}
          </Alert>
        )}
        {selectedInstance && !selectedInstance.grafanaUrl && (
          <Alert
            variant="warning"
            title="Grafana URL unavailable"
            isInline
            style={{ marginBottom: '1rem' }}
          >
            The Grafana route for &quot;{selectedInstance.name}&quot; could not be resolved. Try
            refreshing, or open the instance from Settings → krkn-visualize for details.
          </Alert>
        )}
        {embedUrl ? (
          <iframe
            key={`${selectedDashboard?.uid}-${frameReloadKey}`}
            src={embedUrl}
            title={`${selectedDashboard?.title ?? 'Grafana'} dashboard`}
            aria-label={`Embedded Grafana dashboard: ${selectedDashboard?.title ?? ''}`}
            style={{
              width: '100%',
              height: FRAME_HEIGHT,
              border: '1px solid var(--pf-v5-global--BorderColor--100)',
              borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
              display: 'block',
            }}
          />
        ) : (
          !dashboardsError && (
            <EmptyState>
              <EmptyStateIcon icon={ChartLineIcon} />
              <Title headingLevel="h3" size="lg">
                {selectedInstance ? 'No dashboard selected' : 'Select an instance to visualize'}
              </Title>
              <EmptyStateBody>
                {selectedInstance
                  ? 'Choose a dashboard to view its panels.'
                  : 'Pick a krkn-visualize instance (one per target cluster) to browse its Grafana dashboards.'}
              </EmptyStateBody>
            </EmptyState>
          )
        )}
      </CardBody>
    </Card>
  );
}
