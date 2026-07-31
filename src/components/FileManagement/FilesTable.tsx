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
  Tooltip,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { FiFile, FiEdit, FiTrash2, FiRefreshCw, FiPlus, FiGlobe, FiLock, FiGitBranch, FiBarChart2 } from 'react-icons/fi';
import type { FileInfo } from '../../types/api';

const FILE_PURPOSE_CONFIG: Record<string, { icon: typeof FiFile; color: string; label: string }> = {
  'file': { icon: FiFile, color: 'var(--pf-v5-global--palette--blue-300)', label: 'File' },
  'workflow-template': { icon: FiGitBranch, color: 'var(--pf-v5-global--palette--purple-400)', label: 'Workflow' },
  'resiliency-score': { icon: FiBarChart2, color: 'var(--pf-v5-global--palette--green-400)', label: 'Resiliency' },
};

function canModifyFile(file: FileInfo, userGroups: string[], isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (file.availableToAll) return true;
  if (file.groups && file.groups.length > 0) {
    return file.groups.some(g => userGroups.includes(g));
  }
  return false;
}

interface FilesTableProps {
  files: FileInfo[];
  fileTypes: Array<{ name: string; color: string }>;
  isAdmin: boolean;
  userGroups: string[];
  onCreateClick: () => void;
  onEditClick: (file: FileInfo) => void;
  onDeleteClick: (fileId: string) => void;
  onRefresh: () => void;
}

export function FilesTable({
  files,
  fileTypes,
  isAdmin,
  userGroups,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onRefresh,
}: FilesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filesList = Array.isArray(files) ? files : [];

  const filteredFiles = filesList.filter(
    (file) =>
      file.fileId.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

      <Table
        aria-label="Files table"
        borders
        variant="compact"
      >
        <Thead>
          <Tr>
            <Th width={40}>File Name</Th>
            <Th width={15}>Type</Th>
            <Th width={20}>Access</Th>
            <Th width={25}>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {filteredFiles.map((file) => {
            const purposeKey = file.filePurpose || 'file';
            const purposeCfg = FILE_PURPOSE_CONFIG[purposeKey] || FILE_PURPOSE_CONFIG['file'];
            const PurposeIcon = purposeCfg.icon;
            const canModify = canModifyFile(file, userGroups, isAdmin);
            const disabledTooltip = `You don't have permission (file belongs to ${file.groups?.[0] || 'another group'})`;

            return (
              <Tr key={file.fileId}>
                <Td dataLabel="File Name">
                  <Tooltip content={file.description || 'No description'} position="top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <PurposeIcon style={{ color: purposeCfg.color, flexShrink: 0 }} />
                      <code style={{
                        fontSize: '0.875rem',
                        padding: '0.125rem 0.25rem',
                        backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                        borderRadius: '3px',
                        cursor: 'help',
                      }}>
                        {file.fileName}
                      </code>
                      {purposeKey !== 'file' && (
                        <Label isCompact color={purposeKey === 'workflow-template' ? 'purple' : 'green'}>
                          {purposeCfg.label}
                        </Label>
                      )}
                    </div>
                  </Tooltip>
                </Td>
                <Td dataLabel="Type">
                  {file.fileType ? (
                    <Label
                      isCompact
                      style={{
                        backgroundColor: fileTypes.find(t => t.name === file.fileType)?.color || '#6c757d',
                        color: '#fff',
                      }}
                    >
                      {file.fileType}
                    </Label>
                  ) : (
                    <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>—</span>
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
                    <Tooltip content={file.groups?.length ? `Only ${file.groups[0]} members` : 'No groups'}>
                      <Label color="blue" isCompact icon={<FiLock />}>
                        {file.groups && file.groups.length > 0 ? file.groups[0] : 'Private'}
                      </Label>
                    </Tooltip>
                  )}
                </Td>
                <Td isActionCell>
                  <div style={{ display: 'flex', gap: '0', alignItems: 'center' }}>
                    <Tooltip content={canModify ? 'Edit file' : disabledTooltip}>
                      <Button
                        variant="plain"
                        onClick={() => onEditClick(file)}
                        aria-label="Edit file"
                        icon={<FiEdit />}
                        style={{ padding: '0.25rem' }}
                        isDisabled={!canModify}
                      />
                    </Tooltip>
                    <Tooltip content={canModify ? 'Delete file' : disabledTooltip}>
                      <Button
                        variant="plain"
                        onClick={() => onDeleteClick(file.fileId)}
                        aria-label="Delete file"
                        isDanger
                        icon={<FiTrash2 />}
                        style={{ padding: '0.25rem' }}
                        isDisabled={!canModify}
                      />
                    </Tooltip>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>

      {filteredFiles.length === 0 && searchTerm && (
        <EmptyState>
          <EmptyStateHeader titleText="No results found" headingLevel="h4" />
          <EmptyStateBody>
            No files match your search criteria. Try adjusting your search term.
          </EmptyStateBody>
        </EmptyState>
      )}
    </>
  );
}
