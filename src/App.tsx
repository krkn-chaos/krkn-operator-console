import { Page, PageSection, Masthead, MastheadMain, MastheadBrand } from '@patternfly/react-core';
import { useAppContext } from './context/AppContext';
import { useTargetPoller } from './hooks/useTargetPoller';
import { LoadingScreen, ErrorDisplay, ClusterSelector, RegistrySelector, ScenariosList } from './components';
import { NodesDisplay } from './components/NodesDisplay';
import { ScenarioDetail } from './components/ScenarioDetail';

function App() {
  const { state, dispatch } = useAppContext();

  // Initialize and manage the workflow
  useTargetPoller();

  const handleRetry = () => {
    dispatch({ type: 'RETRY' });
  };

  const handleClusterSelect = (cluster: any) => {
    dispatch({ type: 'SELECT_CLUSTER', payload: cluster });
    dispatch({ type: 'NODES_LOADING' });
  };

  const renderContent = () => {
    switch (state.phase) {
      case 'initializing':
        return <LoadingScreen phase="initializing" />;

      case 'polling':
        return <LoadingScreen phase="polling" pollAttempts={state.pollAttempts} />;

      case 'selecting_cluster':
        return (
          <PageSection>
            <ClusterSelector clusters={state.clusters} onSelect={handleClusterSelect} />
          </PageSection>
        );

      case 'loading_nodes':
        return <LoadingScreen phase="loading_nodes" />;

      case 'ready':
        return (
          <PageSection>
            {state.selectedCluster && (
              <NodesDisplay selectedCluster={state.selectedCluster} nodes={state.nodes} />
            )}
          </PageSection>
        );

      case 'configuring_registry':
        return (
          <PageSection>
            <RegistrySelector />
          </PageSection>
        );

      case 'loading_scenarios':
        return <LoadingScreen phase="loading_scenarios" />;

      case 'selecting_scenarios':
        return (
          <PageSection>
            <ScenariosList />
          </PageSection>
        );

      case 'loading_scenario_detail':
      case 'configuring_scenario':
        return (
          <PageSection>
            {state.selectedScenario && (
              <ScenarioDetail
                scenarioName={state.selectedScenario}
                registryConfig={state.registryConfig}
              />
            )}
          </PageSection>
        );

      case 'error':
        return (
          <PageSection>
            {state.error && <ErrorDisplay error={state.error} onRetry={handleRetry} />}
          </PageSection>
        );

      default:
        return null;
    }
  };

  const header = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>
            Krkn Operator Console
          </div>
        </MastheadBrand>
      </MastheadMain>
    </Masthead>
  );

  return (
    <Page header={header}>
      <PageSection isFilled>{renderContent()}</PageSection>
    </Page>
  );
}

export default App;
