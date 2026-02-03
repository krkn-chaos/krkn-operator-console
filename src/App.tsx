import { Page, PageSection, Masthead, MastheadMain, MastheadBrand } from '@patternfly/react-core';
import { useAppContext } from './context/AppContext';
import { useTargetPoller } from './hooks';
import { useScenarioRunsPoller } from './hooks/useScenarioRunsPoller';
import { LoadingScreen, ErrorDisplay, ClusterMultiSelector, RegistrySelector, ScenariosList, JobsList } from './components';
import { ScenarioDetail } from './components/ScenarioDetail';
import { operatorApi } from './services/operatorApi';
import type { SelectedCluster } from './types/api';

function App() {
  const { state, dispatch } = useAppContext();

  // Initialize and manage the workflow
  useTargetPoller();
  useScenarioRunsPoller(); // NEW: Poll scenarioRuns instead of individual jobs

  const handleRetry = () => {
    dispatch({ type: 'RETRY' });
  };

  // Multi-cluster workflow handlers
  const handleClusterToggle = (cluster: SelectedCluster) => {
    dispatch({ type: 'TOGGLE_CLUSTER', payload: { cluster } });
  };

  const handleClustersProceed = () => {
    // No need to create multiple targets - we reuse the original targetRequestId
    dispatch({ type: 'CLUSTERS_SELECTED' });
  };

  const handleWorkflowCancel = () => {
    dispatch({ type: 'CANCEL_WORKFLOW' });
  };

  // Jobs management handlers
  const handleDeleteScenarioRun = async (scenarioRunName: string) => {
    try {
      await operatorApi.deleteScenarioRun(scenarioRunName);
      // Remove the scenario run from state immediately
      const updatedRuns = state.scenarioRuns.filter(
        (run) => run.scenarioRunName !== scenarioRunName
      );
      dispatch({
        type: 'LOAD_SCENARIO_RUNS_SUCCESS',
        payload: { runs: updatedRuns }
      });
    } catch (error) {
      console.error('Failed to delete scenario run:', error);
      // Don't dispatch error to avoid interrupting the UI
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await operatorApi.deleteJob(jobId);
      // The poller will update the scenario run status automatically
      // which will reflect the job deletion
    } catch (error) {
      console.error('Failed to delete job:', error);
      // Don't dispatch error to avoid interrupting the UI
    }
  };

  const handleCreateJob = async () => {
    // Create initial target for fetching clusters
    dispatch({ type: 'INIT_START' });

    try {
      const response = await operatorApi.createTargetRequest();
      dispatch({
        type: 'INIT_SUCCESS',
        payload: { uuid: response.uuid },
      });
    } catch (error) {
      dispatch({
        type: 'INIT_ERROR',
        payload: {
          type: 'network',
          message: error instanceof Error ? error.message : 'Failed to create target',
        },
      });
    }
  };

  const renderContent = () => {
    switch (state.phase) {
      case 'initializing':
        return <LoadingScreen phase="initializing" />;

      case 'polling':
        return <LoadingScreen phase="polling" pollAttempts={state.pollAttempts} />;

      case 'jobs_list': {
        return (
          <PageSection>
            <JobsList
              scenarioRuns={state.scenarioRuns}
              expandedRunIds={state.expandedRunIds}
              expandedJobIds={state.expandedClusterJobs}
              onToggleRunAccordion={(scenarioRunName) =>
                dispatch({ type: 'TOGGLE_RUN_ACCORDION', payload: { scenarioRunName } })
              }
              onToggleJobAccordion={(jobId) =>
                dispatch({ type: 'TOGGLE_CLUSTER_JOB_ACCORDION', payload: { jobId } })
              }
              onDeleteScenarioRun={handleDeleteScenarioRun}
              onDeleteJob={handleDeleteJob}
              onCreateJob={handleCreateJob}
            />
          </PageSection>
        );
      }

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
