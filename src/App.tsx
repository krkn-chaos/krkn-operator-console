import { Page, PageSection, Masthead, MastheadMain, MastheadBrand, MastheadContent, Toolbar, ToolbarContent, ToolbarItem, Alert, AlertActionCloseButton, AlertGroup, Dropdown, DropdownItem, DropdownList, MenuToggle, Modal, ModalVariant } from '@patternfly/react-core';
import { CogIcon, EditIcon, KeyIcon, MoonIcon, SunIcon } from '@patternfly/react-icons';
import { HiOutlineUserCircle } from 'react-icons/hi2';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { useTargetPoller } from './hooks';
import { useScenarioRunsPoller } from './hooks/useScenarioRunsPoller';
import { LoadingScreen, ErrorDisplay, ClusterMultiSelector, RegistrySelector, ScenariosList, JobsList, Settings, AdminOnly } from './components';
import { ScenarioDetail } from './components/ScenarioDetail';
import { UserForm } from './components/UserForm';
import { ChangePasswordForm } from './components/ChangePasswordForm';
import { operatorApi } from './services/operatorApi';
import { usersApi } from './services/usersApi';
import { useNotifications } from './hooks';
import type { SelectedCluster, UpdateUserRequest, ChangePasswordRequest } from './types/api';

function App() {
  const { state, dispatch } = useAppContext();
  const { state: authState, logout } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
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

  const handleHideNotification = (id: string) => {
    dispatch({ type: 'HIDE_NOTIFICATION', payload: { id } });
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

      case 'settings':
        return <Settings />;

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

  const handleNavigateToSettings = () => {
    dispatch({ type: 'NAVIGATE_TO_SETTINGS' });
  };

  const handleNavigateToHome = () => {
    dispatch({ type: 'JOBS_LIST_READY' });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEditProfile = () => {
    setIsEditProfileOpen(true);
    setIsUserMenuOpen(false);
  };

  const handleChangePassword = () => {
    setIsChangePasswordOpen(true);
    setIsUserMenuOpen(false);
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

  const userMenuItems = (
    <DropdownList>
      <AdminOnly>
        <DropdownItem
          key="settings"
          icon={<CogIcon />}
          onClick={() => {
            handleNavigateToSettings();
            setIsUserMenuOpen(false);
          }}
        >
          Admin Settings
        </DropdownItem>
      </AdminOnly>
      <DropdownItem key="editProfile" icon={<EditIcon />} onClick={handleEditProfile}>
        Edit Profile
      </DropdownItem>
      <DropdownItem key="changePassword" icon={<KeyIcon />} onClick={handleChangePassword}>
        Change Password
      </DropdownItem>
      <DropdownItem
        key="theme"
        icon={isDarkTheme ? <SunIcon /> : <MoonIcon />}
        onClick={() => setIsDarkTheme(!isDarkTheme)}
      >
        {isDarkTheme ? 'Light Theme' : 'Dark Theme'}
      </DropdownItem>
      <DropdownItem key="logout" onClick={handleLogout}>
        Logout
      </DropdownItem>
    </DropdownList>
  );

  const header = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <div
            onClick={handleNavigateToHome}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          >
            <img
              src="/logo.png"
              alt="Krkn Logo"
              style={{ height: '32px', width: 'auto' }}
            />
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>
              Krkn Operator Console
            </div>
          </div>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar isFullHeight isStatic>
          <ToolbarContent>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <Dropdown
                isOpen={isUserMenuOpen}
                onOpenChange={(isOpen) => setIsUserMenuOpen(isOpen)}
                popperProps={{
                  minWidth: '200px',
                  enableFlip: true,
                  appendTo: () => document.body
                }}
                toggle={(toggleRef) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    variant="plain"
                    style={{ color: 'white' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <HiOutlineUserCircle style={{ fontSize: '1.5rem' }} />
                      <span>{authState.user?.name} {authState.user?.surname}</span>
                    </div>
                  </MenuToggle>
                )}
              >
                {userMenuItems}
              </Dropdown>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  return (
    <Page header={header}>
      {/* Global notifications - appears right below header */}
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

      {/* Edit Profile Modal */}
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
              active: true, // Active status not stored in session, assume active
              created: undefined,
              lastLogin: undefined,
            }}
            onSubmit={handleProfileSubmit}
            onCancel={() => setIsEditProfileOpen(false)}
            isSelfEdit={true}
          />
        )}
      </Modal>

      {/* Change Password Modal */}
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
