import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  Modal,
  ModalVariant,
  Spinner,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Flex,
  FlexItem,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Label,
} from '@patternfly/react-core';
import {
  PlusCircleIcon,
  RegistryIcon,
  EditIcon,
  TrashIcon,
  EllipsisVIcon,
  SortAmountDownIcon,
  SortAmountUpIcon,
} from '@patternfly/react-icons';
import { registriesApi } from '../services/registriesApi';
import { useNotifications } from '../hooks';
import { RegistryForm } from './RegistryForm';
import type { RegistryDetails } from '../types/api';

/**
 * RegistriesCard component
 *
 * Displays a card containing a table of all private registries with CRUD operations.
 * Provides registry management functionality for administrators.
 *
 * **Features:**
 * - List all registries with details (name, URL, repository, auth type, groups)
 * - Create new registries with authentication
 * - Edit existing registries
 * - Delete registries with confirmation
 * - Search/filter registries by name
 * - Sort by name
 * - Empty state with helpful guidance
 * - Loading skeleton while fetching
 *
 * **Table Columns:**
 * - Name: Registry name with description (sortable)
 * - Registry URL: Container registry endpoint
 * - Repository: Scenario repository path
 * - Auth Type: token or password
 * - Groups: Associated groups (or "All Users")
 * - Actions: Edit and Delete buttons
 *
 * **Access Control:**
 * - Admin only (enforced by API)
 *
 * @component
 *
 * @example
 * ```tsx
 * import { RegistriesCard } from './RegistriesCard';
 *
 * function SettingsPage() {
 *   return (
 *     <div>
 *       <RegistriesCard />
 *     </div>
 *   );
 * }
 * ```
 */
export function RegistriesCard() {
  const [registries, setRegistries] = useState<RegistryDetails[]>([]);
  const [filteredRegistries, setFilteredRegistries] = useState<RegistryDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRegistryName, setEditingRegistryName] = useState<string | null>(null);
  const [confirmDeleteRegistry, setConfirmDeleteRegistry] = useState<{ name: string } | null>(null);
  const [deletingRegistryName, setDeletingRegistryName] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const { showSuccess, showError } = useNotifications();

  const loadRegistries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await registriesApi.listRegistries();
      setRegistries(data);
    } catch (error) {
      showError('Failed to load registries', error instanceof Error ? error.message : 'Unknown error');
      setRegistries([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadRegistries();
  }, [loadRegistries]);

  // Filter and sort registries based on search value and sort direction
  useEffect(() => {
    let result = registries;

    // Apply search filter
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      result = result.filter(
        (registry) =>
          registry.name.toLowerCase().includes(searchLower) ||
          (registry.description && registry.description.toLowerCase().includes(searchLower)) ||
          registry.registryUrl.toLowerCase().includes(searchLower)
      );
    }

    // Sort alphabetically by name
    result = [...result].sort((a, b) => {
      const compareValue = a.name.localeCompare(b.name);
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    setFilteredRegistries(result);
  }, [registries, searchValue, sortDirection]);

  const handleCreate = () => {
    setIsCreateModalOpen(true);
  };

  const handleEdit = (registry: RegistryDetails) => {
    setEditingRegistryName(registry.name);
  };

  const handleDelete = (name: string) => {
    setConfirmDeleteRegistry({ name });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteRegistry) return;

    setDeletingRegistryName(confirmDeleteRegistry.name);
    setConfirmDeleteRegistry(null);

    try {
      await registriesApi.deleteRegistry(confirmDeleteRegistry.name);
      showSuccess('Registry deleted', `Registry "${confirmDeleteRegistry.name}" has been deleted successfully`);
      await loadRegistries();
    } catch (error) {
      showError('Failed to delete registry', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeletingRegistryName(null);
    }
  };

  const handleCreateSuccess = async () => {
    setIsCreateModalOpen(false);
    await loadRegistries();
  };

  const handleEditSuccess = async () => {
    setEditingRegistryName(null);
    await loadRegistries();
  };

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <Title headingLevel="h2" size="lg">
              Private Registries ({registries.length})
            </Title>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreate}>
              Create Registry
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="xl" />
          </div>
        ) : (
          <>
            <Toolbar>
              <ToolbarContent>
                <ToolbarItem>
                  <SearchInput
                    placeholder="Filter by name or URL"
                    value={searchValue}
                    onChange={(_event, value) => setSearchValue(value)}
                    onClear={() => setSearchValue('')}
                  />
                </ToolbarItem>
                <ToolbarItem>
                  <Button
                    variant="plain"
                    aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
                    onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortDirection === 'asc' ? <SortAmountUpIcon /> : <SortAmountDownIcon />}
                  </Button>
                </ToolbarItem>
              </ToolbarContent>
            </Toolbar>

            {filteredRegistries.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon icon={RegistryIcon} />
                <Title headingLevel="h2" size="lg">
                  {searchValue
                    ? 'No registries match your filter'
                    : 'No private registries yet. Create your first registry to get started.'}
                </Title>
                <EmptyStateBody>
                  {searchValue
                    ? 'Try adjusting your search criteria.'
                    : 'Private registries store scenario images with authentication. Click "Create Registry" to get started.'}
                </EmptyStateBody>
              </EmptyState>
            ) : (
              <DataList aria-label="Registries list" isCompact>
                {filteredRegistries.map((registry) => {
                  const groupsDisplay = registry.availableToAll
                    ? 'All Users'
                    : registry.groups.length > 0
                      ? registry.groups.join(', ')
                      : 'No groups';

                  return (
                    <DataListItem key={registry.name}>
                      <DataListItemRow>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key="name" width={2}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong style={{ fontSize: 'var(--pf-v5-global--FontSize--md)' }}>
                                    {registry.name}
                                  </strong>
                                </div>
                                <div
                                  style={{
                                    fontSize: 'var(--pf-v5-global--FontSize--sm)',
                                    color: 'var(--pf-v5-global--Color--200)',
                                  }}
                                >
                                  {registry.description || 'No description'}
                                </div>
                              </div>
                            </DataListCell>,
                            <DataListCell key="url" width={2}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>Registry URL:</strong>
                                </div>
                                <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                  {registry.registryUrl}
                                </div>
                              </div>
                            </DataListCell>,
                            <DataListCell key="repo" width={2}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>Repository:</strong>
                                </div>
                                <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                  {registry.scenarioRepository}
                                </div>
                              </div>
                            </DataListCell>,
                            <DataListCell key="auth" width={1}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>Auth:</strong>
                                </div>
                                <div>
                                  <Label color={registry.authType === 'token' ? 'blue' : 'green'}>
                                    {registry.authType}
                                  </Label>
                                </div>
                              </div>
                            </DataListCell>,
                            <DataListCell key="groups" width={2}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>Access:</strong>
                                </div>
                                <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                  {groupsDisplay}
                                </div>
                              </div>
                            </DataListCell>,
                            <DataListCell key="actions" width={1}>
                              <Dropdown
                                isOpen={openDropdownId === registry.name}
                                onOpenChange={(isOpen) => setOpenDropdownId(isOpen ? registry.name : null)}
                                toggle={(toggleRef) => (
                                  <MenuToggle
                                    ref={toggleRef}
                                    onClick={() =>
                                      setOpenDropdownId(openDropdownId === registry.name ? null : registry.name)
                                    }
                                    variant="plain"
                                    aria-label="Registry actions"
                                    isDisabled={deletingRegistryName === registry.name}
                                  >
                                    <EllipsisVIcon />
                                  </MenuToggle>
                                )}
                              >
                                <DropdownList>
                                  <DropdownItem
                                    key="edit"
                                    icon={<EditIcon />}
                                    onClick={() => {
                                      handleEdit(registry);
                                      setOpenDropdownId(null);
                                    }}
                                  >
                                    Edit
                                  </DropdownItem>
                                  <DropdownItem
                                    key="delete"
                                    icon={<TrashIcon />}
                                    onClick={() => {
                                      handleDelete(registry.name);
                                      setOpenDropdownId(null);
                                    }}
                                    style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
                                  >
                                    Delete
                                  </DropdownItem>
                                </DropdownList>
                              </Dropdown>
                            </DataListCell>,
                          ]}
                        />
                      </DataListItemRow>
                    </DataListItem>
                  );
                })}
              </DataList>
            )}
          </>
        )}
      </CardBody>

      {/* Create Registry Modal */}
      {isCreateModalOpen && (
        <Modal
          variant={ModalVariant.medium}
          title="Create Private Registry"
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
        >
          <RegistryForm onSubmit={handleCreateSuccess} onCancel={() => setIsCreateModalOpen(false)} />
        </Modal>
      )}

      {/* Edit Registry Modal */}
      {editingRegistryName && (
        <Modal
          variant={ModalVariant.medium}
          title="Edit Registry"
          isOpen={true}
          onClose={() => setEditingRegistryName(null)}
        >
          <RegistryForm
            registryName={editingRegistryName}
            onSubmit={handleEditSuccess}
            onCancel={() => setEditingRegistryName(null)}
          />
        </Modal>
      )}

      {/* Confirmation Modal for Registry Deletion */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Registry"
        isOpen={confirmDeleteRegistry !== null}
        onClose={() => setConfirmDeleteRegistry(null)}
        actions={[
          <Button
            key="confirm"
            variant="danger"
            onClick={handleConfirmDelete}
            isLoading={deletingRegistryName !== null}
            isDisabled={deletingRegistryName !== null}
          >
            {deletingRegistryName !== null ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setConfirmDeleteRegistry(null)}>
            Cancel
          </Button>,
        ]}
      >
        Are you sure you want to delete registry <strong>{confirmDeleteRegistry?.name}</strong>? This action cannot
        be undone. If this registry is used by active scenario runs, they may fail.
      </Modal>
    </Card>
  );
}
