/**
 * FileTypesTable - Table view of all file types
 *
 * Shows file types with:
 * - Name, Color preview (badge), Usage count, Created date
 * - Actions: Edit, Delete (with usage validation)
 */

import { useState } from 'react';
import {
  Button,
  EmptyState,
  EmptyStateHeader,
  EmptyStateIcon,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  Label,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { FiFile, FiEdit, FiTrash2, FiRefreshCw, FiPlus } from 'react-icons/fi';
import type { FileTypeResponse } from '../../types/api';

interface FileTypesTableProps {
  fileTypes: FileTypeResponse[];
  onCreateClick: () => void;
  onEditClick: (fileType: FileTypeResponse) => void;
  onDeleteClick: (typeName: string, usageCount: number) => void;
  onRefresh: () => void;
}

export function FileTypesTable({
  fileTypes,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onRefresh,
}: FileTypesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Ensure fileTypes is always an array
  const typesList = Array.isArray(fileTypes) ? fileTypes : [];

  // Filter types based on search term
  const filteredTypes = typesList.filter((type) =>
    type.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Get badge color (fallback to grey if empty)
  const getBadgeColor = (color: string): string => {
    return color || '#6c757d'; // grey default
  };

  if (typesList.length === 0) {
    return (
      <EmptyState>
        <EmptyStateHeader
          titleText="No file types available"
          icon={<EmptyStateIcon icon={FiFile} />}
          headingLevel="h4"
        />
        <EmptyStateBody>
          No file types have been created yet. File types are auto-created when you create a file with a type, or you can create them manually.
        </EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="primary" onClick={onCreateClick} icon={<FiPlus />}>
              Create Type
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
              placeholder="Search types..."
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
              Create Type
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      <Table aria-label="File types table" variant="compact">
        <Thead>
          <Tr>
            <Th width={20}>Name</Th>
            <Th width={20}>Preview</Th>
            <Th width={20}>Color</Th>
            <Th width={15}>Usage</Th>
            <Th width={15}>Created</Th>
            <Th width={10}>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {filteredTypes.map((type) => (
            <Tr key={type.name}>
              <Td dataLabel="Name">
                <strong>{type.name}</strong>
              </Td>
              <Td dataLabel="Preview">
                <Label
                  color="grey"
                  isCompact
                  style={{
                    backgroundColor: getBadgeColor(type.color),
                    color: '#fff',
                  }}
                >
                  {type.name}
                </Label>
              </Td>
              <Td dataLabel="Color">
                <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '3px',
                        backgroundColor: getBadgeColor(type.color),
                        border: '1px solid var(--pf-v5-global--BorderColor--100)',
                      }}
                    />
                  </FlexItem>
                  <FlexItem>
                    <code style={{ fontSize: '0.85em', color: 'var(--pf-v5-global--Color--200)' }}>
                      {type.color || '(default)'}
                    </code>
                  </FlexItem>
                </Flex>
              </Td>
              <Td dataLabel="Usage">
                <Label color={type.usageCount > 0 ? 'blue' : 'grey'} isCompact>
                  {type.usageCount} {type.usageCount === 1 ? 'file' : 'files'}
                </Label>
              </Td>
              <Td dataLabel="Created">{formatDate(type.createdAt)}</Td>
              <Td dataLabel="Actions" isActionCell>
                <Flex spaceItems={{ default: 'spaceItemsNone' }}>
                  <FlexItem>
                    <Button
                      variant="plain"
                      onClick={() => onEditClick(type)}
                      aria-label="Edit type"
                      icon={<FiEdit />}
                    />
                  </FlexItem>
                  <FlexItem>
                    <Button
                      variant="plain"
                      onClick={() => onDeleteClick(type.name, type.usageCount)}
                      aria-label="Delete type"
                      isDanger
                      icon={<FiTrash2 />}
                    />
                  </FlexItem>
                </Flex>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {filteredTypes.length === 0 && searchTerm && (
        <EmptyState>
          <EmptyStateHeader titleText="No results found" headingLevel="h4" />
          <EmptyStateBody>
            No file types match your search criteria. Try adjusting your search term.
          </EmptyStateBody>
        </EmptyState>
      )}
    </>
  );
}
