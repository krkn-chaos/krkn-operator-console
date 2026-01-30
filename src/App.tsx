import { Page, PageSection, Masthead, MastheadMain, MastheadBrand } from '@patternfly/react-core';
import { useAppContext } from './context/AppContext';
import { useTargetPoller, useJobsPoller } from './hooks';
import { LoadingScreen, ErrorDisplay, ClusterSelector, RegistrySelector, ScenariosList, ScenarioRunning, JobsList } from './components';
import { NodesDisplay } from './components/NodesDisplay';
import { ScenarioDetail } from './components/ScenarioDetail';
import { operatorApi } from './services/operatorApi';

function App() {
  const { state, dispatch } = useAppContext();

  // Initialize and manage the workflow
  useTargetPoller();
  useJobsPoller();

  const handleRetry = () => {
    dispatch({ type: 'RETRY' });
  };

  const handleClusterSelect = (cluster: any) => {
    dispatch({ type: 'SELECT_CLUSTER', payload: cluster });
    dispatch({ type: 'NODES_LOADING' });
  };

  // Jobs management handlers
  const handleCancelJob = async (jobId: string) => {
    try {
      await operatorApi.cancelJob(jobId);
      const updated = await operatorApi.getJobStatus(jobId);
      dispatch({ type: 'UPDATE_JOB', payload: { job: updated } });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to cancel job');
    }
  };

  const handleToggleJobAccordion = (jobId: string) => {
    dispatch({ type: 'TOGGLE_JOB_ACCORDION', payload: { jobId } });
  };

  const handleCreateJob = () => {
    dispatch({ type: 'START_CREATE_WORKFLOW' });
  };

  const renderContent = () => {
    switch (state.phase) {
      case 'initializing':
        return <LoadingScreen phase="initializing" />;

      case 'polling':
        return <LoadingScreen phase="polling" pollAttempts={state.pollAttempts} />;

      case 'jobs_list':
        return (
          <PageSection>
            <JobsList
              jobs={state.jobs}
              expandedJobIds={state.expandedJobIds}
              onToggleAccordion={handleToggleJobAccordion}
              onCancelJob={handleCancelJob}
              onCreateJob={handleCreateJob}
            />
          </PageSection>
        );

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

      case 'running_scenario':
        return (
          <PageSection>
            <ScenarioRunning />
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
