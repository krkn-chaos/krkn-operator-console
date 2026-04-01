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
import { targetsApi } from '../services/targetsApi';
import type { GroupDetails, ClusterPermissions, TargetResponse } from '../types/api';
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

  // Form state
  const [description, setDescription] = useState('');
  const [clusterPermissions, setClusterPermissions] = useState<ClusterPermissions>({});

  // Data fetching state
  const [groupData, setGroupData] = useState<GroupDetails | null>(null);
  const [targets, setTargets] = useState<TargetResponse[]>([]);

  // Fetch group data and targets when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setDescription('');
      setClusterPermissions({});
      setGroupData(null);
      setTargets([]);
      setError('');
      setValidationError('');
      setSuccessMessage('');
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError('');

      try {
        // Fetch group data and targets in parallel
        const [group, targetsData] = await Promise.all([
          groupsApi.getGroup(groupName),
          targetsApi.listTargets(),
        ]);

        setGroupData(group);
        setDescription(group.description || '');
        setClusterPermissions(group.clusterPermissions || {});
        setTargets(targetsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load group data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, groupName]);

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

  const checkRunWithoutView = (): boolean => {
    // Check if any cluster has "run" permission without "view" permission
    return Object.values(clusterPermissions).some(
      (perms) => perms.actions.includes('run') && !perms.actions.includes('view')
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check for "run" without "view" warning
    if (checkRunWithoutView()) {
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

  return (
    <>
      <Modal
        variant={ModalVariant.large}
        title={`Edit Group: ${groupName}`}
        isOpen={isOpen}
        onClose={handleCancel}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="xl" />
            <div style={{ marginTop: '1rem' }}>Loading group data...</div>
          </div>
        ) : error && !groupData ? (
          <Alert variant="danger" title="Failed to Load Group" isInline>
            {error}
          </Alert>
        ) : (
          <Form onSubmit={handleSubmit}>
            {error && !successMessage && (
              <Alert variant="danger" title="Update Failed" isInline style={{ marginBottom: '1rem' }}>
                {error}
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
              <ClusterPermissionsTable
                targets={targets}
                clusterPermissions={clusterPermissions}
                onChange={setClusterPermissions}
                showOrphanedWarning
                showBulkActions={false}
              />
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

      {/* Warning Modal for "run" without "view" */}
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
        By selecting <strong>Run</strong> permission without <strong>View</strong> permission, users in this group will not be able to properly view scenario run creation and status. Are you sure you want to continue?
      </Modal>
    </>
  );
}
