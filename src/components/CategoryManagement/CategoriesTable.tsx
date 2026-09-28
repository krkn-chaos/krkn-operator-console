import { useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateHeader,
  EmptyStateIcon,
  Label,
  Pagination,
  PaginationVariant,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { FiEdit, FiGlobe, FiLock, FiPlus, FiRefreshCw, FiTag, FiTrash2 } from 'react-icons/fi';
import type { CategoryResponse } from '../../types/api';
import { usePagination } from '../../hooks/usePagination';

interface CategoriesTableProps {
  categories: CategoryResponse[];
  currentUserId: string;
  isAdmin: boolean;
  onCreateClick: () => void;
  onEditClick: (category: CategoryResponse) => void;
  onDeleteClick: (name: string) => void;
  onRefresh: () => void;
}

/**
 * Searchable category list with visibility and creator-aware actions.
 *
 * @example
 * <CategoriesTable
 *   categories={categories}
 *   currentUserId={currentUserId}
 *   isAdmin={isAdmin}
 *   onCreateClick={openCreateCategory}
 *   onEditClick={openEditCategory}
 *   onDeleteClick={deleteCategory}
 *   onRefresh={reloadCategories}
 * />
 */
export function CategoriesTable({
  categories,
  currentUserId,
  isAdmin,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onRefresh,
}: CategoriesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const categoriesList = useMemo(() => Array.isArray(categories) ? categories : [], [categories]);
  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return categoriesList;
    return categoriesList.filter((category) =>
      category.name.toLowerCase().includes(term)
      || (category.groups || []).some((group) => group.toLowerCase().includes(term))
      || category.createdBy?.toLowerCase().includes(term),
    );
  }, [categoriesList, searchTerm]);
  const {
    paginatedData,
    page,
    perPage,
    totalItems,
    totalPages,
    handleSetPage,
    handlePerPageSelect,
  } = usePagination(filteredCategories, { initialPerPage: 25 });

  if (categoriesList.length === 0) {
    return (
      <EmptyState>
        <EmptyStateHeader
          titleText="No categories available"
          icon={<EmptyStateIcon icon={FiTag} />}
          headingLevel="h4"
        />
        <EmptyStateBody>Create a category to start grouping Krkn entities.</EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="primary" onClick={onCreateClick} icon={<FiPlus />}>
              Create Category
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    );
  }

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem variant="search-filter">
            <SearchInput
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(_event, value) => setSearchTerm(value)}
              onClear={() => setSearchTerm('')}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="secondary" onClick={onRefresh} icon={<FiRefreshCw />}>
              Refresh
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="primary" onClick={onCreateClick} icon={<FiPlus />}>
              Create Category
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filteredCategories.length === 0 ? (
        <EmptyState>
          <EmptyStateHeader titleText="No matching categories" headingLevel="h4" />
          <EmptyStateBody>Try a different search term.</EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          {totalPages > 1 && (
            <Pagination
              itemCount={totalItems}
              perPage={perPage}
              page={page}
              onSetPage={handleSetPage}
              onPerPageSelect={handlePerPageSelect}
              variant={PaginationVariant.top}
            />
          )}
          <div style={{ overflowX: 'auto' }}>
            <Table aria-label="Categories table" borders variant="compact">
              <Thead>
                <Tr>
                  <Th width={45}>Category</Th>
                  <Th width={30}>Visibility</Th>
                  <Th width={25}>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {paginatedData.map((category) => {
                  const canManage = isAdmin || category.createdBy === currentUserId;
                  return (
                    <Tr key={category.name}>
                      <Td dataLabel="Category">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            aria-hidden="true"
                            style={{
                              backgroundColor: category.color || '#6c757d',
                              borderRadius: '50%',
                              display: 'inline-block',
                              flexShrink: 0,
                              height: '0.75rem',
                              width: '0.75rem',
                            }}
                          />
                          <code>{category.name}</code>
                        </div>
                      </Td>
                      <Td dataLabel="Visibility">
                        {category.availableToAll ? (
                          <Label color="green" isCompact icon={<FiGlobe />}>
                            Public
                          </Label>
                        ) : (
                          <Label color="blue" isCompact icon={<FiLock />}>
                            {category.groups?.join(', ') || 'Group'}
                          </Label>
                        )}
                      </Td>
                      <Td isActionCell>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Tooltip content={canManage ? 'Edit category' : 'Only the creator or an admin can edit'}>
                            <Button
                              variant="plain"
                              aria-label={`Edit category ${category.name}`}
                              isDisabled={!canManage}
                              onClick={() => onEditClick(category)}
                              icon={<FiEdit />}
                            />
                          </Tooltip>
                          <Tooltip content={canManage ? 'Delete category' : 'Only the creator or an admin can delete'}>
                            <Button
                              variant="plain"
                              aria-label={`Delete category ${category.name}`}
                              isDisabled={!canManage}
                              onClick={() => onDeleteClick(category.name)}
                              icon={<FiTrash2 />}
                            />
                          </Tooltip>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </div>
          {totalPages > 1 && (
            <Pagination
              itemCount={totalItems}
              perPage={perPage}
              page={page}
              onSetPage={handleSetPage}
              onPerPageSelect={handlePerPageSelect}
              variant={PaginationVariant.bottom}
            />
          )}
        </>
      )}
    </>
  );
}
