import { Page, PageSection, Masthead, MastheadMain, MastheadBrand } from '@patternfly/react-core';
import { useAppContext } from './context/AppContext';
import { useTargetPoller } from './hooks/useTargetPoller';
import { LoadingScreen, ErrorDisplay, ClusterSelector } from './components';

function App() {
  const { state, dispatch } = useAppContext();

  // Initialize and manage the workflow
  useTargetPoller();

  const handleRetry = () => {
    dispatch({ type: 'RETRY' });
  };

  const handleClusterSelect = (cluster: any) => {
    dispatch({ type: 'SELECT_CLUSTER', payload: cluster });
    // TODO: Navigate to chaos orchestration (future feature)
    console.log('Selected cluster:', cluster);
  };

  const renderContent = () => {
    switch (state.phase) {
      case 'initializing':
        return <LoadingScreen phase="initializing" />;

      case 'polling':
        return <LoadingScreen phase="polling" pollAttempts={state.pollAttempts} />;

      case 'selecting_cluster':
        if (state.selectedCluster) {
          // Cluster selected - show success message (future: navigate to chaos config)
          return (
            <PageSection>
              <h1>Cluster Selected</h1>
              <p>Selected: {state.selectedCluster.clusterName}</p>
              <p>API URL: {state.selectedCluster.clusterApiUrl}</p>
              <p>Operator: {state.selectedCluster.operatorName}</p>
              <p style={{ marginTop: '2rem', color: 'var(--pf-v5-global--Color--200)' }}>
                Future: Chaos orchestration UI will go here
              </p>
            </PageSection>
          );
        }
        return (
          <PageSection>
            <ClusterSelector clusters={state.clusters} onSelect={handleClusterSelect} />
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
