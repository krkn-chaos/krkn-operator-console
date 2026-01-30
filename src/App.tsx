import { Page, PageSection, Masthead, MastheadMain, MastheadBrand } from '@patternfly/react-core';
import { useAppContext } from './context/AppContext';
import { useTargetPoller, useJobsPoller } from './hooks';
import { LoadingScreen, ErrorDisplay, ClusterMultiSelector, RegistrySelector, ScenariosList, JobsList } from './components';
import { ScenarioDetail } from './components/ScenarioDetail';
import { operatorApi } from './services/operatorApi';
import type { SelectedCluster } from './types/api';

function App() {
  const { state, dispatch } = useAppContext();

  // Initialize and manage the workflow
  useTargetPoller();
  useJobsPoller();

  const handleRetry = () => {
    dispatch({ type: 'RETRY' });
  };

  // Multi-cluster workflow handlers
  const handleClusterToggle = (cluster: SelectedCluster) => {
    dispatch({ type: 'TOGGLE_CLUSTER', payload: { cluster } });
  };

  const handleClustersProceed = () => {
    dispatch({ type: 'TARGETS_CREATING' });
    createTargetsForClusters();
  };

  const handleWorkflowCancel = () => {
    dispatch({ type: 'CANCEL_WORKFLOW' });
  };

  // Target creation for selected clusters
  const createTargetsForClusters = async () => {
    const { selectedClusters } = state;

    try {
      // Create target for each selected cluster
      const targetPromises = selectedClusters.map(() =>
        operatorApi.createTargetRequest()
      );

      const responses = await Promise.all(targetPromises);
      const targetUUIDs = responses.map((r) => r.uuid);

      // Store UUIDs and transition to registry config
      dispatch({
        type: 'TARGETS_CREATED',
        payload: { targetUUIDs },
      });
    } catch (error) {
      dispatch({
        type: 'TARGETS_ERROR',
        payload: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'Failed to create targets',
        },
      });
    }
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

      case 'selecting_clusters':
        return (
          <PageSection>
            <ClusterMultiSelector
              clusters={state.clusters}
              selectedClusters={state.selectedClusters}
              onToggle={handleClusterToggle}
              onProceed={handleClustersProceed}
              onCancel={handleWorkflowCancel}
            />
          </PageSection>
        );

      case 'creating_targets':
        return <LoadingScreen phase="creating_targets" />;

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
