import { useState, useEffect } from 'react';
import {
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
} from '@patternfly/react-core';
import { PlusCircleIcon, CubesIcon, TrashIcon, EditIcon } from '@patternfly/react-icons';
import { targetsApi } from '../services/targetsApi';
import { useNotifications } from '../hooks';
import { TargetForm } from './TargetForm';
import type { TargetResponse, CreateTargetRequest, UpdateTargetRequest } from '../types/api';

export function TargetsList() {
  const [targets, setTargets] = useState<TargetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetResponse | null>(null);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  const { showSuccess, showError } = useNotifications();

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    setLoading(true);
    try {
      const data = await targetsApi.listTargets();
      setTargets(data);
    } catch (error) {
      showError('Failed to load targets', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTarget(null);
    setIsFormOpen(true);
  };

  const handleEdit = (target: TargetResponse) => {
    setEditingTarget(target);
    setIsFormOpen(true);
  };

  const handleDelete = async (uuid: string, clusterName: string) => {
    if (!confirm(`Are you sure you want to delete target "${clusterName}"?`)) {
      return;
    }

    setDeletingUuid(uuid);
    try {
      await targetsApi.deleteTarget(uuid);
      showSuccess('Target deleted', `Target "${clusterName}" has been deleted successfully`);
      await loadTargets();
    } catch (error) {
      showError('Failed to delete target', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeletingUuid(null);
    }
  };

  const handleFormSubmit = async (data: CreateTargetRequest | UpdateTargetRequest) => {
    try {
      if (editingTarget) {
        await targetsApi.updateTarget(editingTarget.uuid, data as UpdateTargetRequest);
        showSuccess('Target updated', `Target "${data.clusterName}" has been updated successfully`);
      } else {
        await targetsApi.createTarget(data as CreateTargetRequest);
        showSuccess('Target created', `Target "${data.clusterName}" has been created successfully`);
      }
      setIsFormOpen(false);
      await loadTargets();
    } catch (error) {
      showError(
        editingTarget ? 'Failed to update target' : 'Failed to create target',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingTarget(null);
  };

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
          <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreate}>
            Add Target
          </Button>
        </FlexItem>
      </Flex>

      {targets.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={CubesIcon} />
          <Title headingLevel="h2" size="lg">
            No Targets Configured
          </Title>
          <EmptyStateBody>
            Add a cluster target to start running chaos scenarios on your clusters.
          </EmptyStateBody>
          <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreate}>
            Add Target
          </Button>
        </EmptyState>
      ) : (
        <DataList aria-label="Targets list" isCompact>
          {targets.map((target) => (
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
                        </div>
                        <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
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
                        <Label color={target.ready ? 'green' : 'orange'}>
                          {target.ready ? 'Ready' : 'Not Ready'}
                        </Label>
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
          ))}
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
    </>
  );
}
