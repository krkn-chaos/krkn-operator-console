import { Page, PageSection, Masthead, MastheadMain, MastheadBrand, MastheadToggle, Alert, AlertActionCloseButton, AlertGroup, Button, Modal, ModalVariant } from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { useTargetPoller } from './hooks';
import { useScenarioRunsPoller } from './hooks/useScenarioRunsPoller';
import { useGraphRunsPoller } from './hooks/useGraphRunsPoller';
import { LoadingScreen, ErrorDisplay, ClusterMultiSelector, RegistrySelector, ScenariosList, JobsList, Settings, TerminalContent, Studio } from './components';
import { FileManagementModal } from './components/FileManagement';
import { AppSidebar, SIDEBAR_RAIL_WIDTH } from './components/AppSidebar';
import { useRole } from './hooks/useRole';
import { studioLeaveGuard } from './components/Studio/studioLeaveGuard';
import { ScenarioDetail } from './components/ScenarioDetail';
import { UserForm } from './components/UserForm';
import { ChangePasswordForm } from './components/ChangePasswordForm';
import { operatorApi } from './services/operatorApi';
import { graphRunsApi } from './services';
import { usersApi } from './services/usersApi';
import { useNotifications } from './hooks';
import { isApiError } from './utils/apiClient';
import type { SelectedCluster, UpdateUserRequest, ChangePasswordRequest, ScenarioRunState } from './types/api';

/**
 * Resolves the notification title/message for a failed delete operation.
 * A 403 ApiError is reported as a permission error; anything else falls
 * back to the backend message (or a generic one for non-Error rejections).
 */
function getDeleteErrorNotification(
  error: unknown,
  resourceLabel: string
): { title: string; message: string } {
  if (isApiError(error) && error.status === 403) {
    return {
      title: 'Permission denied',
      message: `You do not have permission to delete this ${resourceLabel}`,
    };
  }

  const errorMessage = error instanceof Error ? error.message : `Failed to delete ${resourceLabel}`;
  return { title: `Failed to delete ${resourceLabel}`, message: errorMessage };
}

function App() {
  const { state, dispatch } = useAppContext();
  const { state: authState, logout } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const { isAdmin } = useRole();
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  // Apply theme to document root
  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.classList.add('pf-v5-theme-dark');
    } else {
      document.documentElement.classList.remove('pf-v5-theme-dark');
    }
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  // Initialize and manage the workflow
  useTargetPoller();
  const { fetchRunDetails } = useScenarioRunsPoller();
  useGraphRunsPoller(); // Poll graph runs for status updates

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

  const handleHideNotification = (id: string) => {
    dispatch({ type: 'HIDE_NOTIFICATION', payload: { id } });
  };

  // Jobs management handlers
  const handleDeleteScenarioRun = async (scenarioRunName: string) => {
    try {
      await operatorApi.deleteScenarioRun(scenarioRunName);
      // Remove the scenario run from state only after successful deletion
      const updatedRuns = state.scenarioRuns.filter(
        (run) => run.scenarioRunName !== scenarioRunName
      );
      dispatch({
        type: 'LOAD_SCENARIO_RUNS_SUCCESS',
        payload: { runs: updatedRuns }
      });
      showSuccess('Scenario run deleted', `Successfully deleted ${scenarioRunName}`);
    } catch (error) {
      const { title, message } = getDeleteErrorNotification(error, 'scenario run');
      showError(title, message);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await operatorApi.deleteJob(jobId);
      // The poller will update the scenario run status automatically
      // which will reflect the job deletion
      showSuccess('Job deleted', `Successfully deleted job ${jobId}`);
    } catch (error) {
      const { title, message } = getDeleteErrorNotification(error, 'job');
      showError(title, message);
    }
  };

  const handleDeleteGraphRun = async (graphRunName: string) => {
    try {
      await graphRunsApi.deleteGraphRun(graphRunName);
      // Remove the graph run from state immediately
      dispatch({
        type: 'DELETE_GRAPH_RUN',
        payload: { graphRunName }
      });
      showSuccess('Graph run deleted', `Successfully deleted ${graphRunName}`);
    } catch (error) {
      const { title, message } = getDeleteErrorNotification(error, 'graph run');
      showError(title, message);
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

  const handleRerunScenario = async (run: ScenarioRunState, jobId: string) => {
    dispatch({ type: 'INIT_START' });

    try {
      const config = await operatorApi.getJobConfig(jobId);

      const clusters = Object.entries(config.targetClusters).flatMap(
        ([operatorName, clusterNames]) =>
          clusterNames.map(clusterName => ({ operatorName, clusterName }))
      );

      dispatch({
        type: 'RERUN_SCENARIO',
        payload: {
          scenarioName: config.scenarioName,
          registryName: run.registryName,
          clusters,
          environment: config.environment,
          scenarioImage: config.scenarioImage,
          kubeconfigPath: config.kubeconfigPath,
        },
      });

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
          message: error instanceof Error ? error.message : 'Failed to start re-run',
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
              expandedRunIds={state.expandedRunIds}
              expandedJobIds={state.expandedClusterJobs}
              onToggleRunAccordion={(scenarioRunName) => {
                const isExpanding = !state.expandedRunIds.has(scenarioRunName);
                dispatch({ type: 'TOGGLE_RUN_ACCORDION', payload: { scenarioRunName } });
                if (isExpanding) {
                  const run = state.scenarioRuns.find(r => r.scenarioRunName === scenarioRunName);
                  if (run && (!run.clusterJobs || run.clusterJobs.length === 0)) {
                    fetchRunDetails(scenarioRunName, run);
                  }
                }
              }}
              onToggleJobAccordion={(jobId) =>
                dispatch({ type: 'TOGGLE_CLUSTER_JOB_ACCORDION', payload: { jobId } })
              }
              onDeleteScenarioRun={handleDeleteScenarioRun}
              onDeleteJob={handleDeleteJob}
              onRerunScenario={handleRerunScenario}
              expandedGraphRunIds={state.expandedGraphRunIds}
              onToggleGraphRunAccordion={(graphRunName) =>
                dispatch({ type: 'TOGGLE_GRAPH_RUN_ACCORDION', payload: { graphRunName } })
              }
              onDeleteGraphRun={handleDeleteGraphRun}
              loadingRunDetails={state.loadingRunDetails}
            />
          </PageSection>
        );
      }

      case 'settings':
        return <Settings />;

      case 'terminal':
        return (
          <PageSection isFilled padding={{ default: 'noPadding' }} style={{ height: '100%' }}>
            <div className="terminal-page">
              <TerminalContent isOpen={true} onClose={handleNavigateToHome} />
            </div>
          </PageSection>
        );

      case 'files':
        return (
          <PageSection isFilled padding={{ default: 'noPadding' }} style={{ height: '100%' }}>
            <div style={{ padding: '1rem' }}>
              <FileManagementModal
                isOpen={true}
                onClose={handleNavigateToHome}
              />
            </div>
          </PageSection>
        );

      case 'studio':
        return (
          <PageSection>
            <Studio />
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

  const checkStudioGuard = (proceed: () => void): boolean => {
    if (state.phase !== 'studio') return true;
    if (studioLeaveGuard.current && !studioLeaveGuard.current(proceed)) return false;
    return true;
  };

  const handleNavigateToSettings = () => {
    const proceed = () => dispatch({ type: 'NAVIGATE_TO_SETTINGS' });
    if (!checkStudioGuard(proceed)) return;
    proceed();
  };

  const handleNavigateToStudio = () => {
    dispatch({ type: 'NAVIGATE_TO_STUDIO' });
  };

  const handleNavigateToTerminal = () => {
    const proceed = () => dispatch({ type: 'NAVIGATE_TO_TERMINAL' });
    if (!checkStudioGuard(proceed)) return;
    proceed();
  };

  const handleNavigateToFiles = () => {
    const proceed = () => dispatch({ type: 'NAVIGATE_TO_FILES' });
    if (!checkStudioGuard(proceed)) return;
    proceed();
  };

  const handleNavigateToHome = () => {
    const proceed = () => dispatch({ type: 'JOBS_LIST_READY' });
    if (!checkStudioGuard(proceed)) return;
    proceed();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEditProfile = () => {
    setIsEditProfileOpen(true);
    
  };

  const handleChangePassword = () => {
    setIsChangePasswordOpen(true);
   
  };

  const handleProfileSubmit = async (data: UpdateUserRequest) => {
    if (!authState.user) return;

    try {
      await usersApi.updateUser(authState.user.userId, data);
      showSuccess('Profile updated', 'Your profile has been updated successfully');
      setIsEditProfileOpen(false);
      // Reload user data - for now just close the modal
      // In a real app, you'd want to refresh the user data in AuthContext
    } catch (error) {
      showError('Failed to update profile', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handlePasswordChangeSubmit = async (data: ChangePasswordRequest) => {
    if (!authState.user) return;

    try {
      await usersApi.changePassword(authState.user.userId, data);
      showSuccess('Password changed', 'Your password has been changed successfully');
      setIsChangePasswordOpen(false);
    } catch (error) {
      showError('Failed to change password', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  

  const appSidebar = (
    <AppSidebar
      pinned={isSidebarPinned}
      activePhase={state.phase}
      isAdmin={isAdmin}
      userName={`${authState.user?.name ?? ''} ${authState.user?.surname ?? ''}`.trim()}
      isDarkTheme={isDarkTheme}
      onNavigateJobs={handleNavigateToHome}
      onRunScenario={handleCreateJob}
      onNavigateStudio={handleNavigateToStudio}
      onOpenFiles={handleNavigateToFiles}
      onNavigateTerminal={handleNavigateToTerminal}
      onNavigateSettings={handleNavigateToSettings}
      onEditProfile={handleEditProfile}
      onChangePassword={handleChangePassword}
      onToggleTheme={() => setIsDarkTheme(!isDarkTheme)}
      onLogout={handleLogout}
    />
  );

  const header = (
    <Masthead>
      <MastheadToggle>
        <Button
          variant="plain"
          onClick={() => setIsSidebarPinned(prev => !prev)}
          aria-label="Pin or unpin sidebar"
          style={{ color: 'white' }}
        >
          <BarsIcon />
        </Button>
      </MastheadToggle>
      <MastheadMain>
        <MastheadBrand>
          <div
            onClick={handleNavigateToHome}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Krkn Logo"
              style={{ height: '32px', width: 'auto' }}
            />
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>
              Krkn Operator Console
            </div>
          </div>
        </MastheadBrand>
      </MastheadMain>
    </Masthead>
  );

  return (
    <Page header={header}>
      {appSidebar}
      <div className="app-content--with-sidebar" style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingLeft: SIDEBAR_RAIL_WIDTH }}>
        {state.notifications.length > 0 && (
          <div style={{ padding: '1rem 1rem 0 1rem' }}>
            <AlertGroup>
              {state.notifications.map((notification) => (
                <Alert
                  key={notification.id}
                  variant={notification.variant}
                  title={notification.title}
                  actionClose={
                    <AlertActionCloseButton onClose={() => handleHideNotification(notification.id)} />
                  }
                  isInline
                >
                  {notification.message}
                </Alert>
              ))}
            </AlertGroup>
          </div>
        )}
        <PageSection isFilled>{renderContent()}</PageSection>
      </div>

      <Modal
        variant={ModalVariant.medium}
        title="Edit Profile"
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      >
        {authState.user && (
          <UserForm
            initialData={{
              ...authState.user,
              active: true,
              created: undefined,
              lastLogin: undefined,
            }}
            onSubmit={handleProfileSubmit}
            onCancel={() => setIsEditProfileOpen(false)}
            isSelfEdit={true}
          />
        )}
      </Modal>

      <Modal
        variant={ModalVariant.small}
        title="Change Password"
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      >
        <ChangePasswordForm
          isSelfChange={true}
          onSubmit={handlePasswordChangeSubmit}
          onCancel={() => setIsChangePasswordOpen(false)}
        />
      </Modal>
    </Page>
  );
}

export default App;
