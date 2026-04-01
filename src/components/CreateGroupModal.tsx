/**
 * CreateGroupModal Component
 *
 * Modal for creating new groups with cluster permissions.
 * Fetches available clusters from targets API and allows users to select
 * which actions (view, run, cancel) to grant for each cluster.
 *
 * **Features:**
 * - Group name and description fields
 * - Dynamic cluster list from targets API
 * - Action checkboxes (view, run, cancel) per cluster
 * - Form validation (name required, at least one cluster with actions)
 * - Success/error handling with toast notifications
 *
 * **Validation Rules:**
 * - Group name is required
 * - At least one cluster must have at least one action selected
 * - clusterPermissions uses cluster API URL as key
 *
 * @component
 *
 * @example
 * ```tsx
 * <CreateGroupModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   onSuccess={() => {
 *     setIsModalOpen(false);
 *     refreshGroupsList();
 *   }}
 * />
 * ```
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
  FormHelperText,
  HelperText,
  HelperTextItem,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { groupsApi } from '../services/groupsApi';
import { targetsApi } from '../services/targetsApi';
import { useNotifications } from '../hooks/useNotifications';
import { ClusterPermissionsTable } from './ClusterPermissionsTable';
import type { TargetResponse, ClusterPermissions } from '../types/api';

interface CreateGroupModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  /**
   * Handler called when modal should close
   */
  onClose: () => void;
  /**
   * Handler called on successful group creation
   */
  onSuccess: () => void;
}

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
  const { showSuccess, showError } = useNotifications();

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Cluster data
  const [targets, setTargets] = useState<TargetResponse[]>([]);
  const [clusterPermissions, setClusterPermissions] = useState<ClusterPermissions>({});
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [targetsError, setTargetsError] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch targets when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTargets();
    } else {
      // Reset form when modal closes
      setName('');
      setDescription('');
      setClusterPermissions({});
      setErrors({});
      setTargets([]);
      setTargetsError(null);
    }
  }, [isOpen]);

  const fetchTargets = async () => {
    setLoadingTargets(true);
    setTargetsError(null);

    try {
      const data = await targetsApi.listTargets();
      setTargets(data);
      setClusterPermissions({});
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      setTargetsError(error instanceof Error ? error.message : 'Failed to load clusters');
    } finally {
      setLoadingTargets(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!name.trim()) {
      newErrors.name = 'Group name is required';
    }

    // Cluster permissions validation
    const hasAnyPermission = Object.values(clusterPermissions).some(
      (perms) => perms.actions && perms.actions.length > 0
    );
    if (!hasAnyPermission) {
      newErrors.clusters = 'At least one cluster must have at least one action selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      // Create group
      await groupsApi.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        clusterPermissions,
      });

      showSuccess('Group created', `Group "${name}" was created successfully`);
      onSuccess();
    } catch (error) {
      console.error('Failed to create group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create group';
      setErrors({ submit: errorMessage });
      showError('Group creation failed', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    if (loadingTargets) {
      return (
        <EmptyState>
          <EmptyStateIcon icon={Spinner} />
          <Title headingLevel="h2" size="lg">
            Loading Clusters...
          </Title>
          <EmptyStateBody>
            Fetching available target clusters
          </EmptyStateBody>
        </EmptyState>
      );
    }

    if (targetsError) {
      return (
        <EmptyState>
          <EmptyStateIcon icon={ExclamationCircleIcon} color="var(--pf-v5-global--danger-color--100)" />
          <Title headingLevel="h2" size="lg">
            Failed to Load Clusters
          </Title>
          <EmptyStateBody>
            {targetsError}
          </EmptyStateBody>
          <Button variant="primary" onClick={fetchTargets}>
            Retry
          </Button>
        </EmptyState>
      );
    }

    if (targets.length === 0) {
      return (
        <EmptyState>
          <EmptyStateIcon icon={ExclamationCircleIcon} />
          <Title headingLevel="h2" size="lg">
            No Clusters Available
          </Title>
          <EmptyStateBody>
            No target clusters found. Please configure target clusters before creating groups.
          </EmptyStateBody>
        </EmptyState>
      );
    }

    return (
      <Form>
        <FormGroup label="Group Name" isRequired fieldId="group-name">
          <TextInput
            id="group-name"
            value={name}
            onChange={(_event, value) => setName(value)}
            isRequired
            validated={errors.name ? 'error' : 'default'}
            isDisabled={submitting}
          />
          {errors.name && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{errors.name}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup label="Description" fieldId="group-description">
          <TextArea
            id="group-description"
            value={description}
            onChange={(_event, value) => setDescription(value)}
            isDisabled={submitting}
            rows={3}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>Optional description for this group</HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <FormGroup
          label="Cluster Permissions"
          isRequired
          fieldId="cluster-permissions"
        >
          <ClusterPermissionsTable
            targets={targets}
            clusterPermissions={clusterPermissions}
            onChange={setClusterPermissions}
            showOrphanedWarning={false}
            showBulkActions={false}
          />
          {errors.clusters && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  {errors.clusters}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        {errors.submit && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.submit}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}

        <ActionGroup>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={submitting}
            isDisabled={submitting}
          >
            Create Group
          </Button>
          <Button
            variant="link"
            onClick={onClose}
            isDisabled={submitting}
          >
            Cancel
          </Button>
        </ActionGroup>
      </Form>
    );
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="Create New Group"
      isOpen={isOpen}
      onClose={onClose}
    >
      {renderContent()}
    </Modal>
  );
}
