import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  AlertActionLink,
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Flex,
  FlexItem,
  Label,
  Modal,
  ModalVariant,
  Spinner,
  Tooltip,
} from '@patternfly/react-core';
import {
  PlusCircleIcon,
  SyncIcon,
  TopologyIcon,
  TrashIcon,
  EditIcon,
} from '@patternfly/react-icons';
import { targetsApi } from '../services/targetsApi';
import { operatorApi } from '../services/operatorApi';
import { useClusterDiscovery } from '../hooks/useClusterDiscovery';
import { useNotifications } from '../hooks';
import { TargetForm } from './TargetForm';
import { ClusterHealthIndicator } from './ClusterHealthIndicator';
import {
  describeTargetAvailability,
  type TargetAvailability,
  type TargetAvailabilityState,
} from '../utils/targetAvailability';
import type {
  TargetResponse,
  CreateTargetRequest,
  UpdateTargetRequest,
} from '../types/api';

const availabilityLabels: Record<
  TargetAvailabilityState,
  { text: string; color: 'grey' | 'green' | 'red' | 'orange' }
> = {
  checking: { text: 'Checking…', color: 'grey' },
  available: { text: 'Available', color: 'green' },
  unavailable: { text: 'Unavailable', color: 'red' },
  'not-discovered': { text: 'Not available', color: 'orange' },
  unknown: { text: 'Unknown', color: 'grey' },
};

export function TargetsList() {
  const [targets, setTargets] = useState<TargetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetResponse | null>(null);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ uuid: string; clusterName: string } | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const { showSuccess, showError } = useNotifications();

  // Live reachability/health, from the same discovery flow the cluster picker
  // uses. Kept separate from `targets` because discovery covers every operator,
  // while this tab only lists the targets configured in this operator.
  const {
    clusters: discoveredClusters,
    discoveryUuid,
    isLoading: isCheckingAvailability,
    error: discoveryError,
    startDiscovery,
  } = useClusterDiscovery();

  // Discovery creates a short-lived target request CR; track its UUID so the
  // previous request can be cleaned up on refresh and unmount.
  const discoveryUuidRef = useRef<string | null>(null);
  useEffect(() => {
    discoveryUuidRef.current = discoveryUuid;
  }, [discoveryUuid]);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await targetsApi.listTargets();
      setTargets(data);
      setApiAvailable(true);
    } catch (error) {
      setTargets([]);
      setApiAvailable(false);
      // Don't show error notification on initial load - the empty state will handle it
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAvailability = useCallback(() => {
    const previousUuid = discoveryUuidRef.current;
    if (previousUuid) {
      discoveryUuidRef.current = null;
      // Best effort: a stale discovery request must not fail the refresh.
      operatorApi.deleteTargetRequest(previousUuid).catch(() => {});
    }
    void startDiscovery();
  }, [startDiscovery]);

  // Release this discovery request if the user leaves Settings before it is used.
  useEffect(() => {
    return () => {
      const uuid = discoveryUuidRef.current;
      if (uuid) {
        discoveryUuidRef.current = null;
        operatorApi.deleteTargetRequest(uuid).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    void loadTargets();
    refreshAvailability();
  }, [loadTargets, refreshAvailability]);

  const handleRefresh = () => {
    void loadTargets();
    refreshAvailability();
  };

  const handleCreate = () => {
    setEditingTarget(null);
    setIsFormOpen(true);
  };

  const handleEdit = (target: TargetResponse) => {
    setEditingTarget(target);
    setIsFormOpen(true);
  };

  const handleDelete = (uuid: string, clusterName: string) => {
    setConfirmDeleteTarget({ uuid, clusterName });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;

    setDeletingUuid(confirmDeleteTarget.uuid);
    setConfirmDeleteTarget(null);

    try {
      await targetsApi.deleteTarget(confirmDeleteTarget.uuid);
      showSuccess('Target deleted', `Target "${confirmDeleteTarget.clusterName}" has been deleted successfully`);
      await loadTargets();
      refreshAvailability();
    } catch (error) {
      showError('Failed to delete target', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeletingUuid(null);
    }
  };

  const handleFormSubmit = async (data: CreateTargetRequest | UpdateTargetRequest) => {
    if (editingTarget) {
      await targetsApi.updateTarget(editingTarget.uuid, data as UpdateTargetRequest);
      showSuccess('Target updated', `Target "${data.clusterName}" has been updated successfully`);
    } else {
      await targetsApi.createTarget(data as CreateTargetRequest);
      showSuccess('Target created', `Target "${data.clusterName}" has been created successfully`);
    }
    setIsFormOpen(false);
    await loadTargets();
    refreshAvailability();
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingTarget(null);
  };

  const availabilityByTarget = useMemo(() => {
    const resolved = new Map<string, TargetAvailability>();
    targets.forEach((target) => {
      resolved.set(
        target.uuid,
        describeTargetAvailability(
          target,
          discoveredClusters,
          discoveryError,
          isCheckingAvailability
        )
      );
    });
    return resolved;
  }, [targets, discoveredClusters, discoveryError, isCheckingAvailability]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} style={{ marginBottom: '1rem' }}>
        <FlexItem>
          <Title headingLevel="h2" size="md">
            Cluster Targets ({targets.length})
          </Title>
        </FlexItem>
        <FlexItem>
          <Flex spaceItems={{ default: 'spaceItemsSm' }}>
            <FlexItem>
              <Button
                variant="secondary"
                icon={<SyncIcon />}
                onClick={handleRefresh}
                isDisabled={loading || isCheckingAvailability}
              >
                Refresh
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreate}>
                Add Target
              </Button>
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>

      {discoveryError && targets.length > 0 && (
        <Alert
          variant="warning"
          isInline
          title="Live cluster status unavailable"
          style={{ marginBottom: '1rem' }}
          actionLinks={
            <AlertActionLink onClick={handleRefresh}>Retry status check</AlertActionLink>
          }
        >
          {discoveryError}. Cluster statuses below are unknown until the check succeeds.
        </Alert>
      )}

      {targets.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={TopologyIcon} />
          <Title headingLevel="h2" size="lg">
            {apiAvailable ? 'No Targets Configured' : 'Targets API Not Available'}
          </Title>
          <EmptyStateBody>
            {apiAvailable
              ? 'Click "Add Target" in the toolbar above to start adding cluster targets.'
              : 'The targets API endpoint is not available. Make sure the backend service is running and the API is properly configured.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <DataList aria-label="Targets list" isCompact>
          {targets.map((target) => {
            const availability = availabilityByTarget.get(target.uuid);
            const state = availability?.state ?? 'unknown';
            const label = availabilityLabels[state];

            return (
              <DataListItem key={target.uuid}>
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="name" width={2}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong style={{ fontSize: 'var(--pf-v5-global--FontSize--md)' }}>
                              {target.clusterName}
                            </strong>
                            <ClusterHealthIndicator status={availability?.cluster?.clusterStatus} />
                          </div>
                          <div
                            title={target.clusterAPIURL}
                            style={{
                              fontSize: 'var(--pf-v5-global--FontSize--sm)',
                              color: 'var(--pf-v5-global--Color--200)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {target.clusterAPIURL}
                          </div>
                        </div>
                      </DataListCell>,
                      <DataListCell key="type" width={1}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Type:</strong>
                          </div>
                          <Label color="blue">{target.secretType}</Label>
                        </div>
                      </DataListCell>,
                      <DataListCell key="status" width={1}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Status:</strong>
                          </div>
                          <Tooltip content={availability?.detail ?? 'Status could not be determined.'} position="top">
                            <span aria-label={`Target availability: ${label.text}`} tabIndex={0}>
                              <Label color={label.color}>{label.text}</Label>
                            </span>
                          </Tooltip>
                        </div>
                      </DataListCell>,
                      <DataListCell key="created" width={1}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Created:</strong>
                          </div>
                          <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                            {target.createdAt ? new Date(target.createdAt).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                      </DataListCell>,
                      <DataListCell key="actions" width={1}>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Button
                              variant="secondary"
                              icon={<EditIcon />}
                              onClick={() => handleEdit(target)}
                              size="sm"
                            >
                              Edit
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="danger"
                              icon={<TrashIcon />}
                              onClick={() => handleDelete(target.uuid, target.clusterName)}
                              isLoading={deletingUuid === target.uuid}
                              isDisabled={deletingUuid === target.uuid}
                              size="sm"
                            >
                              Delete
                            </Button>
                          </FlexItem>
                        </Flex>
                      </DataListCell>,
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
            );
          })}
        </DataList>
      )}

      <Modal
        variant={ModalVariant.medium}
        title={editingTarget ? 'Edit Target' : 'Add New Target'}
        isOpen={isFormOpen}
        onClose={handleFormCancel}
      >
        <TargetForm
          initialData={editingTarget || undefined}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      </Modal>

      {/* Confirmation Modal for Target Deletion */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Target"
        isOpen={confirmDeleteTarget !== null}
        onClose={() => setConfirmDeleteTarget(null)}
        actions={[
          <Button
            key="confirm"
            variant="danger"
            onClick={handleConfirmDelete}
            isLoading={deletingUuid !== null}
            isDisabled={deletingUuid !== null}
          >
            {deletingUuid !== null ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setConfirmDeleteTarget(null)}>
            Cancel
          </Button>,
        ]}
      >
        Are you sure you want to delete target <strong>{confirmDeleteTarget?.clusterName}</strong>?
      </Modal>
    </>
  );
}
