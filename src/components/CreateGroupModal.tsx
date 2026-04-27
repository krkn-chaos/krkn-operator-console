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
  Spinner,
  Alert,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { groupsApi } from '../services/groupsApi';
import { useNotifications } from '../hooks/useNotifications';
import { useClusterDiscovery } from '../hooks/useClusterDiscovery';
import { ClusterPermissionsTable } from './ClusterPermissionsTable';
import type { ClusterPermissions } from '../types/api';

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
  const [clusterPermissions, setClusterPermissions] = useState<ClusterPermissions>({});

  // Cluster discovery hook
  const {
    clusters: discoveredClusters,
    discoveryUuid,
    isLoading: loadingTargets,
    error: targetsError,
    startDiscovery,
    retry: retryDiscovery,
    reset: resetDiscovery,
  } = useClusterDiscovery();

  // Transform to array for compatibility with ClusterPermissionsTable
  const targets = discoveredClusters || [];

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRunWithoutViewWarning, setShowRunWithoutViewWarning] = useState(false);
  const [missingViewPermissions, setMissingViewPermissions] = useState<string[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateClusters, setDuplicateClusters] = useState<string[]>([]);

  // Start cluster discovery when modal opens
  useEffect(() => {
    if (isOpen) {
      startDiscovery();
    } else {
      // Reset form and warning modals when modal closes
      setName('');
      setDescription('');
      setClusterPermissions({});
      setErrors({});
      setShowDuplicateWarning(false);
      setDuplicateClusters([]);
      setShowRunWithoutViewWarning(false);
      setMissingViewPermissions([]);
      resetDiscovery();
    }
  }, [isOpen, startDiscovery, resetDiscovery]);

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

  const checkDuplicateClusters = (): { hasDuplicates: boolean; duplicates: string[] } => {
    const duplicates: string[] = [];
    const selectedUrls = Object.keys(clusterPermissions).filter(
      (url) => clusterPermissions[url].actions.length > 0
    );

    // Check if the same API URL is selected more than once (from different sources)
    selectedUrls.forEach((url) => {
      // Find all clusters with this URL
      const clustersWithUrl = targets.filter((t) => t.clusterAPIURL === url);

      if (clustersWithUrl.length > 1) {
        // Same cluster from multiple sources
        const clusterNames = clustersWithUrl
          .map((c) => `${c.clusterName} (${c.operatorSource || 'unknown'})`)
          .join(', ');

        duplicates.push(`${url}: ${clusterNames}`);
      }
    });

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates
    };
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    // Check for duplicate clusters (same API URL from different sources)
    const { hasDuplicates, duplicates } = checkDuplicateClusters();
    if (hasDuplicates) {
      setDuplicateClusters(duplicates);
      setShowDuplicateWarning(true);
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
    setSubmitting(true);

    try {
      // Create group
      await groupsApi.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        clusterPermissions,
        discoveryUuid: discoveryUuid || undefined, // Pass UUID for backend cleanup
      });

      showSuccess('Group created', `Group "${name}" was created successfully`);
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create group';
      setErrors({ submit: errorMessage });
      showError('Group creation failed', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDuplicates = async () => {
    setShowDuplicateWarning(false);

    // Check for "run" or "cancel" without "view" warning after duplicates confirmed
    const { hasIssue, missingPermissions } = checkRunOrCancelWithoutView();
    if (hasIssue) {
      setMissingViewPermissions(missingPermissions);
      setShowRunWithoutViewWarning(true);
      return;
    }

    await performSubmit();
  };

  const handleConfirmRunWithoutView = () => {
    setShowRunWithoutViewWarning(false);
    performSubmit();
  };

  return (
    <>
      <Modal
        variant={ModalVariant.large}
        title="Create New Group"
        isOpen={isOpen}
        onClose={onClose}
      >
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
          {loadingTargets ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spinner size="lg" />
              <div style={{ marginTop: '1rem' }}>Discovering clusters...</div>
            </div>
          ) : targetsError ? (
            <Alert variant="danger" title="Failed to Load Clusters" isInline>
              {targetsError}
              <Button variant="link" onClick={retryDiscovery} style={{ marginLeft: '1rem' }}>
                Retry
              </Button>
            </Alert>
          ) : targets.length === 0 ? (
            <Alert variant="warning" title="No Clusters Available" isInline>
              No target clusters found. Please configure target clusters before creating groups.
            </Alert>
          ) : (
            <ClusterPermissionsTable
              targets={targets}
              clusterPermissions={clusterPermissions}
              onChange={setClusterPermissions}
              showOrphanedWarning={false}
              showBulkActions={false}
            />
          )}
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
      </Modal>

      {/* Warning Modal for duplicate clusters */}
      <Modal
        variant={ModalVariant.small}
        title="Duplicate Clusters Detected"
        isOpen={showDuplicateWarning}
        onClose={() => setShowDuplicateWarning(false)}
        actions={[
          <Button
            key="confirm"
            variant="warning"
            onClick={handleConfirmDuplicates}
          >
            Continue Anyway
          </Button>,
          <Button
            key="cancel"
            variant="link"
            onClick={() => setShowDuplicateWarning(false)}
          >
            Go Back
          </Button>,
        ]}
      >
        <p>The following clusters have been selected multiple times from different operators:</p>
        <ul style={{ marginTop: '1rem', marginLeft: '1.5rem' }}>
          {duplicateClusters.map((duplicate, index) => (
            <li key={index} style={{ marginBottom: '0.5rem' }}>
              <strong>{duplicate}</strong>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: '1rem' }}>
          This means the same cluster will receive permissions from multiple operator sources.
          Are you sure you want to continue?
        </p>
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
