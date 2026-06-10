/**
 * FilesTable - Table view of all files
 *
 * Shows file list with columns:
 * - Name, File Name, Mount Path, Description, Groups, Public/Private
 * - Actions: View, Edit, Delete (permissions enforced by backend)
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
import type { FileResponse } from '../../types/api';

interface FilesTableProps {
  files: FileResponse[];
  fileTypes: Array<{ name: string; color: string }>; // For type badge colors
  onCreateClick: () => void;
  onEditClick: (file: FileResponse) => void;
  onDeleteClick: (fileName: string) => void;
  onRefresh: () => void;
}

export function FilesTable({
  files,
  fileTypes,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onRefresh,
}: FilesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Ensure files is always an array
  const filesList = Array.isArray(files) ? files : [];

  // Filter files based on search term
  const filteredFiles = filesList.filter(
    (file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filesList.length === 0) {
    return (
      <EmptyState>
        <EmptyStateHeader
          titleText="No files available"
          icon={<EmptyStateIcon icon={FiFile} />}
          headingLevel="h4"
        />
        <EmptyStateBody>
          No files are currently available to you. Create your first file to get started or contact your administrator for access.
        </EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="primary" onClick={onCreateClick} icon={<FiPlus />}>
              Create File
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
              placeholder="Search files..."
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
              Create File
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      <Table aria-label="Files table" variant="compact">
        <Thead>
          <Tr>
            <Th width={12}>Name</Th>
            <Th width={12}>File</Th>
            <Th width={10}>Type</Th>
            <Th width={18}>Mount Path</Th>
            <Th width={20}>Description</Th>
            <Th width={15}>Access</Th>
            <Th width={13}>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {filteredFiles.map((file) => (
            <Tr key={file.name}>
              <Td dataLabel="Name">
                <strong>{file.name}</strong>
              </Td>
              <Td dataLabel="File">
                <code style={{ fontSize: '0.9em' }}>{file.fileName}</code>
              </Td>
              <Td dataLabel="Type">
                {file.fileType ? (
                  <Label
                    color="grey"
                    isCompact
                    style={{
                      backgroundColor: fileTypes.find(t => t.name === file.fileType)?.color || '#6c757d',
                      color: '#fff',
                    }}
                  >
                    {file.fileType}
                  </Label>
                ) : (
                  <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85em' }}>-</span>
                )}
              </Td>
              <Td dataLabel="Mount Path" modifier="truncate">
                <code style={{ fontSize: '0.85em', color: 'var(--pf-v5-global--Color--200)' }}>
                  {file.mountPath}
                </code>
              </Td>
              <Td dataLabel="Description" modifier="truncate">
                {file.description || <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>-</span>}
              </Td>
              <Td dataLabel="Access">
                {file.availableToAll ? (
                  <Label color="green" isCompact>Public</Label>
                ) : (
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {file.groups && file.groups.length > 0 ? (
                      file.groups.map((group) => (
                        <Label key={group} color="blue" isCompact>
                          {group}
                        </Label>
                      ))
                    ) : (
                      <Label color="grey" isCompact>No groups</Label>
                    )}
                  </div>
                )}
              </Td>
              <Td dataLabel="Actions" isActionCell>
                <Flex spaceItems={{ default: 'spaceItemsNone' }}>
                  <FlexItem>
                    <Button
                      variant="plain"
                      onClick={() => onEditClick(file)}
                      aria-label="Edit file"
                      icon={<FiEdit />}
                    />
                  </FlexItem>
                  <FlexItem>
                    <Button
                      variant="plain"
                      onClick={() => onDeleteClick(file.name)}
                      aria-label="Delete file"
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

      {filteredFiles.length === 0 && searchTerm && (
        <EmptyState>
          <EmptyStateHeader
            titleText="No results found"
            headingLevel="h4"
          />
          <EmptyStateBody>
            No files match your search criteria. Try adjusting your search term.
          </EmptyStateBody>
        </EmptyState>
      )}
    </>
  );
}
