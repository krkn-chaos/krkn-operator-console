import { useMemo, useState } from 'react';
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
  MenuToggle,
  Pagination,
  PaginationVariant,
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { FiFile, FiEdit, FiTrash2, FiRefreshCw, FiPlus, FiGlobe, FiLock, FiBarChart2 } from 'react-icons/fi';
import { TopologyIcon } from '@patternfly/react-icons';
import type { FileInfo } from '../../types/api';
import type { ComponentType } from 'react';
import { usePagination } from '../../hooks/usePagination';

const FILES_PER_PAGE = 25;

interface MultiFilterProps {
  ariaLabel: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  onSelect: (value: string) => void;
}

function MultiFilter({ ariaLabel, label, options, selected, isOpen, onToggle, onSelect }: MultiFilterProps) {
  return (
    <Select
      isOpen={isOpen}
      selected={selected}
      role="menu"
      onSelect={(_event, value) => {
        if (value !== undefined) onSelect(String(value));
      }}
      onOpenChange={onToggle}
      aria-label={ariaLabel}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => onToggle(!isOpen)}
          isExpanded={isOpen}
        >
          {selected.length > 0 ? `${label} (${selected.length})` : label}
        </MenuToggle>
      )}
    >
      <SelectList>
        {options.map((option) => (
          <SelectOption
            key={option.value}
            value={option.value}
            hasCheckbox
            isSelected={selected.includes(option.value)}
          >
            {option.label}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
}

const FILE_PURPOSE_CONFIG: Record<string, { icon: ComponentType<{ style?: React.CSSProperties }>; color: string; label: string }> = {
  'file': { icon: FiFile, color: 'var(--pf-v5-global--palette--blue-300)', label: 'File' },
  'workflow-template': { icon: TopologyIcon, color: 'var(--pf-v5-global--palette--purple-400)', label: 'Workflow' },
  'resiliency-score': { icon: FiBarChart2, color: 'var(--pf-v5-global--palette--green-400)', label: 'Resiliency' },
};

function canModifyFile(file: FileInfo, userGroups: string[], isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (file.availableToAll) return true;
  if (userGroups.length === 0) return true;
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
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);
  const [isAccessFilterOpen, setIsAccessFilterOpen] = useState(false);

  const filesList = useMemo(() => Array.isArray(files) ? files : [], [files]);
  const typeOptions = useMemo(
    () => Array.from(new Set([
      ...fileTypes.map((type) => type.name),
      ...filesList.flatMap((file) => file.fileType ? [file.fileType] : []),
    ])).sort(),
    [fileTypes, filesList],
  );
  const accessOptions = useMemo(
    () => [
      { value: 'public', label: 'Public' },
      ...Array.from(new Set(filesList.flatMap((file) => file.groups || [])))
        .sort()
        .map((group) => ({ value: `group:${group}`, label: group })),
    ],
    [filesList],
  );

  const filteredFiles = useMemo(() => filesList.filter(
    (file) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (
        file.fileId.toLowerCase().includes(term) ||
        file.fileName.toLowerCase().includes(term) ||
        file.workflowName?.toLowerCase().includes(term) ||
        file.description?.toLowerCase().includes(term)
      );
      const matchesType = selectedTypes.length === 0 || (file.fileType && selectedTypes.includes(file.fileType));
      const matchesAccess = selectedAccess.length === 0 || (
        (file.availableToAll && selectedAccess.includes('public')) ||
        (file.groups || []).some((group) => selectedAccess.includes(`group:${group}`))
      );
      return matchesSearch && matchesType && matchesAccess;
    }
  ), [filesList, searchTerm, selectedTypes, selectedAccess]);

  const {
    paginatedData: paginatedFiles,
    page,
    perPage,
    totalItems,
    totalPages,
    handleSetPage,
    handlePerPageSelect,
  } = usePagination(filteredFiles, { initialPerPage: FILES_PER_PAGE });

  const toggleSelection = (value: string, setSelection: React.Dispatch<React.SetStateAction<string[]>>) => {
    setSelection((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
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
            <MultiFilter
              ariaLabel="Filter files by type"
              label="Filter by type"
              options={typeOptions.map((typeName) => ({ value: typeName, label: typeName }))}
              selected={selectedTypes}
              isOpen={isTypeFilterOpen}
              onToggle={setIsTypeFilterOpen}
              onSelect={(value) => toggleSelection(value, setSelectedTypes)}
            />
          </ToolbarItem>
          <ToolbarItem>
            <MultiFilter
              ariaLabel="Filter files by access"
              label="Filter by access"
              options={accessOptions}
              selected={selectedAccess}
              isOpen={isAccessFilterOpen}
              onToggle={setIsAccessFilterOpen}
              onSelect={(value) => toggleSelection(value, setSelectedAccess)}
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
          {paginatedFiles.map((file) => {
            const purposeKey = file.filePurpose || 'file';
            const purposeCfg = FILE_PURPOSE_CONFIG[purposeKey] || FILE_PURPOSE_CONFIG['file'];
            const PurposeIcon = purposeCfg.icon;
            const displayName = (purposeKey === 'workflow-template' && file.workflowName) ? file.workflowName : file.fileName;
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
                        {displayName}
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
                         {file.groups && file.groups.length > 0 ? file.groups[0] : 'No group'}
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

      {filteredFiles.length === 0 && (searchTerm || selectedTypes.length > 0 || selectedAccess.length > 0) && (
        <EmptyState>
          <EmptyStateHeader titleText="No results found" headingLevel="h4" />
          <EmptyStateBody>
            No files match your filters. Try adjusting your search or type selection.
          </EmptyStateBody>
        </EmptyState>
      )}
    </>
  );
}
