/**
 * EditGroupModal Component
 *
 * Modal for editing existing group permissions and details.
 * Fetches group data on open and allows editing description and cluster permissions.
 *
 * **Features:**
 * - Pre-populates form with existing group data
 * - Name field is read-only (immutable after creation)
 * - Description is editable
 * - Cluster permissions table with checkboxes for view/run/cancel actions
 * - Fetches current targets to display available clusters
 * - Handles orphaned clusters (clusters in group but no longer in targets)
 * - Validates at least one cluster must have at least one action
 * - Success toast on successful update
 * - Inline error display on failure
 *
 * @component
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalVariant,
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Button,
  ActionGroup,
  Spinner,
  Alert,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { groupsApi } from '../services/groupsApi';
import { useClusterDiscovery } from '../hooks/useClusterDiscovery';
import type { GroupDetails, ClusterPermissions } from '../types/api';
import { ClusterPermissionsTable } from './ClusterPermissionsTable';

interface EditGroupModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Name of the group to edit */
  groupName: string;
  /** Callback when group is successfully updated */
  onSuccess?: () => void;
}

/**
 * EditGroupModal - Edit existing group permissions
 *
 * Provides a modal interface for updating group description and cluster permissions.
 * Fetches group data and available targets on mount.
 *
 * **Validation:**
 * - At least one cluster must have at least one action selected
 * - Description is optional
 *
 * **Orphaned Clusters:**
 * Clusters that exist in the group's permissions but are no longer in targets are:
 * - Displayed in the table with a warning badge
 * - Still editable (can be removed or kept)
 * - Preserved if user doesn't modify them
 *
 * @example
 * ```tsx
 * <EditGroupModal
 *   isOpen={isEditModalOpen}
 *   onClose={() => setIsEditModalOpen(false)}
 *   groupName="dev-team"
 *   onSuccess={() => {
 *     refreshGroupsList();
 *     showSuccessToast();
 *   }}
 * />
 * ```
 */
export function EditGroupModal({ isOpen, onClose, groupName, onSuccess }: EditGroupModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showRunWithoutViewWarning, setShowRunWithoutViewWarning] = useState(false);
  const [missingViewPermissions, setMissingViewPermissions] = useState<string[]>([]);

  // Form state
  const [description, setDescription] = useState('');
  const [clusterPermissions, setClusterPermissions] = useState<ClusterPermissions>({});

  // Data fetching state
  const [groupData, setGroupData] = useState<GroupDetails | null>(null);

  // Cluster discovery hook
  const {
    clusters: discoveredClusters,
    isLoading: loadingClusters,
    error: clustersError,
    startDiscovery,
    retry: retryDiscovery,
    reset: resetDiscovery,
  } = useClusterDiscovery();

  // Transform to array for compatibility with ClusterPermissionsTable
  const targets = discoveredClusters || [];

  // Fetch group data and start cluster discovery when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setDescription('');
      setClusterPermissions({});
      setGroupData(null);
      setError('');
      setValidationError('');
      setSuccessMessage('');
      resetDiscovery();
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError('');

      try {
        // Fetch group data and start cluster discovery in parallel
        const groupPromise = groupsApi.getGroup(groupName);
        const discoveryPromise = startDiscovery();

        const [group] = await Promise.all([groupPromise, discoveryPromise]);

        setGroupData(group);
        setDescription(group.description || '');
        setClusterPermissions(group.clusterPermissions || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load group data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, groupName, startDiscovery, resetDiscovery]);

  const validateForm = (): boolean => {
    // Check if at least one cluster has at least one action
    const hasPermissions = Object.values(clusterPermissions).some(
      (perms) => perms.actions && perms.actions.length > 0
    );

    if (!hasPermissions) {
      setValidationError('At least one cluster must have at least one action selected');
      return false;
    }

    setValidationError('');
    return true;
  };

  const checkRunOrCancelWithoutView = (): { hasIssue: boolean; missingPermissions: string[] } => {
    const issues: string[] = [];

    const hasRunWithoutView = Object.values(clusterPermissions).some(
      (perms) => perms.actions.includes('run') && !perms.actions.includes('view')
    );

    const hasCancelWithoutView = Object.values(clusterPermissions).some(
      (perms) => perms.actions.includes('cancel') && !perms.actions.includes('view')
    );

    if (hasRunWithoutView) {
      issues.push('Run');
    }

    if (hasCancelWithoutView) {
      issues.push('Cancel');
    }

    return {
      hasIssue: issues.length > 0,
      missingPermissions: issues
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check for "run" or "cancel" without "view" warning
    const { hasIssue, missingPermissions } = checkRunOrCancelWithoutView();
    if (hasIssue) {
      setMissingViewPermissions(missingPermissions);
      setShowRunWithoutViewWarning(true);
      return;
    }

    await performSubmit();
  };

  const performSubmit = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await groupsApi.updateGroup(groupName, {
        description: description.trim() || undefined,
        clusterPermissions,
      });

      setSuccessMessage('Group updated successfully');

      // Call success callback after a brief delay to show success message
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmRunWithoutView = () => {
    setShowRunWithoutViewWarning(false);
    performSubmit();
  };

  const handleCancel = () => {
    onClose();
  };

  // Combined loading state
  const isFullyLoading = isLoading || loadingClusters;
  const combinedError = error || clustersError;

  return (
    <>
      <Modal
        variant={ModalVariant.large}
        title={`Edit Group: ${groupName}`}
        isOpen={isOpen}
        onClose={handleCancel}
      >
        {isFullyLoading && !groupData ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="xl" />
            <div style={{ marginTop: '1rem' }}>
              {isLoading && loadingClusters
                ? 'Loading group and discovering clusters...'
                : isLoading
                ? 'Loading group data...'
                : 'Discovering clusters...'}
            </div>
          </div>
        ) : combinedError && !groupData ? (
          <Alert variant="danger" title="Failed to Load" isInline>
            {combinedError}
          </Alert>
        ) : (
          <Form onSubmit={handleSubmit}>
            {error && !successMessage && (
              <Alert variant="danger" title="Update Failed" isInline style={{ marginBottom: '1rem' }}>
                {error}
              </Alert>
            )}

            {clustersError && (
              <Alert variant="warning" title="Cluster Discovery Failed" isInline style={{ marginBottom: '1rem' }}>
                {clustersError}
                <Button variant="link" onClick={retryDiscovery} style={{ marginLeft: '1rem' }}>
                  Retry Discovery
                </Button>
              </Alert>
            )}

            {successMessage && (
              <Alert variant="success" title="Success" isInline style={{ marginBottom: '1rem' }}>
                {successMessage}
              </Alert>
            )}

            {validationError && (
              <Alert variant="warning" title="Validation Error" isInline style={{ marginBottom: '1rem' }}>
                {validationError}
              </Alert>
            )}

            <FormGroup label="Group Name" isRequired fieldId="edit-group-name">
              <TextInput
                isRequired
                type="text"
                id="edit-group-name"
                name="name"
                value={groupName}
                isDisabled
                aria-label="Group name (read-only)"
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>Group name cannot be changed after creation</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>

            <FormGroup label="Description" fieldId="edit-group-description">
              <TextArea
                id="edit-group-description"
                name="description"
                value={description}
                onChange={(_, value) => setDescription(value)}
                rows={3}
                placeholder="Optional description for this group"
              />
            </FormGroup>

            <FormGroup
              label="Cluster Permissions"
              isRequired
              fieldId="edit-group-permissions"
            >
              {loadingClusters ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Spinner size="lg" />
                  <div style={{ marginTop: '1rem' }}>Discovering clusters...</div>
                </div>
              ) : (
                <ClusterPermissionsTable
                  targets={targets}
                  clusterPermissions={clusterPermissions}
                  onChange={setClusterPermissions}
                  showOrphanedWarning
                  showBulkActions={false}
                />
              )}
              <FormHelperText>
                <HelperText>
                  <HelperTextItem icon={<ExclamationCircleIcon />}>
                    At least one cluster must have at least one action selected
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>

            <ActionGroup>
              <Button
                variant="primary"
                type="submit"
                isDisabled={isSaving || isLoading}
                isLoading={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="link" onClick={handleCancel} isDisabled={isSaving}>
                Cancel
              </Button>
            </ActionGroup>
          </Form>
        )}
      </Modal>

      {/* Warning Modal for "run" or "cancel" without "view" */}
      <Modal
        variant={ModalVariant.small}
        title="Permission Warning"
        isOpen={showRunWithoutViewWarning}
        onClose={() => setShowRunWithoutViewWarning(false)}
        actions={[
          <Button
            key="confirm"
            variant="warning"
            onClick={handleConfirmRunWithoutView}
          >
            Continue Anyway
          </Button>,
          <Button
            key="cancel"
            variant="link"
            onClick={() => setShowRunWithoutViewWarning(false)}
          >
            Go Back
          </Button>,
        ]}
      >
        {missingViewPermissions.length === 1 ? (
          missingViewPermissions[0] === 'Run' ? (
            <>
              By selecting <strong>Run</strong> permission without <strong>View</strong> permission, users in this group will not be able to properly view scenario run creation and status. Are you sure you want to continue?
            </>
          ) : (
            <>
              By selecting <strong>Cancel</strong> permission without <strong>View</strong> permission, users in this group will not be able to see scenario runs to cancel them. Are you sure you want to continue?
            </>
          )
        ) : (
          <>
            By selecting <strong>Run</strong> and <strong>Cancel</strong> permissions without <strong>View</strong> permission, users in this group will not be able to view scenario runs or their status. Are you sure you want to continue?
          </>
        )}
      </Modal>
    </>
  );
}
