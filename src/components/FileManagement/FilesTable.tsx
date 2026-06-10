/**
 * FilesTable - Table view of all files
 *
 * Clean, readable table with essential columns and expandable rows for details
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
  Tooltip,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td, ExpandableRowContent } from '@patternfly/react-table';
import { FiFile, FiEdit, FiTrash2, FiRefreshCw, FiPlus, FiGlobe, FiLock } from 'react-icons/fi';
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Ensure files is always an array
  const filesList = Array.isArray(files) ? files : [];

  // Filter files based on search term
  const filteredFiles = filesList.filter(
    (file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpand = (fileName: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(fileName)) {
      newExpanded.delete(fileName);
    } else {
      newExpanded.add(fileName);
    }
    setExpandedRows(newExpanded);
  };

  if (filesList.length === 0) {
    return (
      <EmptyState>
        <EmptyStateHeader
          titleText="No files available"
          icon={<EmptyStateIcon icon={FiFile} />}
          headingLevel="h4"
        />
        <EmptyStateBody>
          No files are currently available. Create your first file to get started.
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
            <Th />
            <Th width={25}>Name</Th>
            <Th width={20}>File</Th>
            <Th width={15}>Type</Th>
            <Th width={20}>Access</Th>
            <Th width={20}>Actions</Th>
          </Tr>
        </Thead>
        {filteredFiles.map((file, rowIndex) => {
          const isExpanded = expandedRows.has(file.name);
          return (
            <Tbody key={file.name} isExpanded={isExpanded}>
              <Tr>
                <Td
                  expand={{
                    rowIndex,
                    isExpanded,
                    onToggle: () => toggleExpand(file.name),
                  }}
                />
                <Td dataLabel="Name">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FiFile style={{ color: 'var(--pf-v5-global--Color--200)' }} />
                    <strong>{file.name}</strong>
                  </div>
                </Td>
                <Td dataLabel="File">
                  <code style={{ fontSize: '0.9em', color: 'var(--pf-v5-global--Color--200)' }}>
                    {file.fileName}
                  </code>
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
                    <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85em' }}>—</span>
                  )}
                </Td>
                <Td dataLabel="Access">
                  {file.availableToAll ? (
                    <Tooltip content="Available to all users">
                      <Label color="green" isCompact icon={<FiGlobe />}>
                        Public
                      </Label>
                    </Tooltip>
                  ) : (
                    <Tooltip content={file.groups?.length ? `Only ${file.groups[0]} members` : 'No groups assigned'}>
                      <Label color="blue" isCompact icon={<FiLock />}>
                        {file.groups && file.groups.length > 0 ? file.groups[0] : 'Private'}
                      </Label>
                    </Tooltip>
                  )}
                </Td>
                <Td dataLabel="Actions" isActionCell>
                  <Flex spaceItems={{ default: 'spaceItemsNone' }}>
                    <FlexItem>
                      <Tooltip content="Edit file">
                        <Button
                          variant="plain"
                          onClick={() => onEditClick(file)}
                          aria-label="Edit file"
                          icon={<FiEdit />}
                        />
                      </Tooltip>
                    </FlexItem>
                    <FlexItem>
                      <Tooltip content="Delete file">
                        <Button
                          variant="plain"
                          onClick={() => onDeleteClick(file.name)}
                          aria-label="Delete file"
                          isDanger
                          icon={<FiTrash2 />}
                        />
                      </Tooltip>
                    </FlexItem>
                  </Flex>
                </Td>
              </Tr>
              <Tr isExpanded={isExpanded}>
                <Td />
                <Td colSpan={5}>
                  <ExpandableRowContent>
                    <div style={{ padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)' }}>
                      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                        <FlexItem>
                          <strong>Mount Path:</strong>
                          <code style={{ marginLeft: '0.5rem', fontSize: '0.9em' }}>{file.mountPath}</code>
                        </FlexItem>
                        {file.description && (
                          <FlexItem>
                            <strong>Description:</strong>
                            <span style={{ marginLeft: '0.5rem' }}>{file.description}</span>
                          </FlexItem>
                        )}
                        {file.content && (
                          <FlexItem>
                            <strong>Content Preview:</strong>
                            <pre style={{
                              marginTop: '0.5rem',
                              padding: '0.5rem',
                              backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)',
                              borderRadius: '4px',
                              fontSize: '0.85em',
                              maxHeight: '200px',
                              overflow: 'auto',
                            }}>
                              {file.content.slice(0, 500)}{file.content.length > 500 ? '...' : ''}
                            </pre>
                          </FlexItem>
                        )}
                      </Flex>
                    </div>
                  </ExpandableRowContent>
                </Td>
              </Tr>
            </Tbody>
          );
        })}
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
