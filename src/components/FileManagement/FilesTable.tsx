/**
 * FilesTable - Table view of all files
 *
 * Shows file list with columns:
 * - Name, File Name, Mount Path, Description, Groups, Public/Private
 * - Actions: View, Edit (admin), Delete (admin)
 */

import { useState } from 'react';
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
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
import { FiFile, FiEdit, FiTrash2, FiRefreshCw, FiPlus } from 'react-icons/fi';
import type { FileResponse } from '../../types/api';

interface FilesTableProps {
  files: FileResponse[];
  isAdmin: boolean;
  onCreateClick: () => void;
  onEditClick: (file: FileResponse) => void;
  onDeleteClick: (fileName: string) => void;
  onRefresh: () => void;
}

export function FilesTable({
  files,
  isAdmin,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onRefresh,
}: FilesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter files based on search term
  const filteredFiles = files.filter(
    (file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (files.length === 0) {
    return (
      <EmptyState>
        <EmptyStateHeader
          titleText="No files available"
          icon={<EmptyStateIcon icon={FiFile} />}
          headingLevel="h4"
        />
        <EmptyStateBody>
          {isAdmin
            ? 'No files have been created yet. Create your first file to get started.'
            : 'No files are currently available to you. Contact your administrator for access.'}
        </EmptyStateBody>
        {isAdmin && (
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary" onClick={onCreateClick} icon={<FiPlus />}>
                Create File
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        )}
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
          {isAdmin && (
            <ToolbarItem>
              <Button variant="primary" onClick={onCreateClick} icon={<FiPlus />}>
                Create File
              </Button>
            </ToolbarItem>
          )}
        </ToolbarContent>
      </Toolbar>

      <Table aria-label="Files table" variant="compact">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>File Name</Th>
            <Th>Mount Path</Th>
            <Th>Description</Th>
            <Th>Access</Th>
            {isAdmin && <Th>Actions</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {filteredFiles.map((file) => (
            <Tr key={file.name}>
              <Td dataLabel="Name">{file.name}</Td>
              <Td dataLabel="File Name">
                <code>{file.fileName}</code>
              </Td>
              <Td dataLabel="Mount Path">
                <code>{file.mountPath}</code>
              </Td>
              <Td dataLabel="Description">{file.description || '-'}</Td>
              <Td dataLabel="Access">
                <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'wrap' }}>
                  {file.availableToAll ? (
                    <FlexItem>
                      <Label color="green">Public</Label>
                    </FlexItem>
                  ) : (
                    <>
                      {file.groups?.map((group) => (
                        <FlexItem key={group}>
                          <Label color="blue">{group}</Label>
                        </FlexItem>
                      ))}
                      {(!file.groups || file.groups.length === 0) && (
                        <FlexItem>
                          <Label color="grey">No groups</Label>
                        </FlexItem>
                      )}
                    </>
                  )}
                </Flex>
              </Td>
              {isAdmin && (
                <Td dataLabel="Actions">
                  <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                    <FlexItem>
                      <Button
                        variant="link"
                        isInline
                        onClick={() => onEditClick(file)}
                        icon={<FiEdit />}
                      >
                        Edit
                      </Button>
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="link"
                        isInline
                        isDanger
                        onClick={() => onDeleteClick(file.name)}
                        icon={<FiTrash2 />}
                      >
                        Delete
                      </Button>
                    </FlexItem>
                  </Flex>
                </Td>
              )}
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
