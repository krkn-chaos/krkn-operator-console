import { useCallback, useMemo, useState } from 'react';
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
import type { CategoryResponse, FileInfo } from '../../types/api';
import type { ComponentType } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { CategoryStripe } from '../CategoryStripe';

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
  /** Category definitions for the current user; supplies colors for named categories. */
  categories?: CategoryResponse[];
  /** Whether the deployed operator persists category associations on files. */
  categoriesSupported?: boolean;
  isAdmin: boolean;
  userGroups: string[];
  onCreateClick: () => void;
  onEditClick: (file: FileInfo) => void;
  onDeleteClick: (fileId: string) => void;
  onRefresh: () => void;
}

export function FilesTable({
  files,
  categories = [],
  categoriesSupported = true,
  isAdmin,
  userGroups,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onRefresh,
}: FilesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);
  const [isAccessFilterOpen, setIsAccessFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);

  const filesList = useMemo(() => Array.isArray(files) ? files : [], [files]);
  const accessOptions = useMemo(
    () => [
      { value: 'public', label: 'Public' },
      ...Array.from(new Set(filesList.flatMap((file) => file.groups || [])))
        .sort()
        .map((group) => ({ value: `group:${group}`, label: group })),
    ],
    [filesList],
  );
  // Files reference categories by name; the definitions supply the stripe colors
  // and are the only categories the user is allowed to know about. Names without
  // a visible definition are dropped, matching how the runs list renders
  // categories (see JobsList.getRunCategories).
  const categoriesByName = useMemo(
    () => new Map(categories.map((category) => [category.name, category])),
    [categories],
  );
  const categoriesForFile = useCallback(
    (file: FileInfo): CategoryResponse[] => (file.categories || [])
      .map((name) => categoriesByName.get(name))
      .filter((category): category is CategoryResponse => category !== undefined),
    [categoriesByName],
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(filesList.flatMap((file) => categoriesForFile(file).map((c) => c.name))))
      .sort()
      .map((category) => ({ value: category, label: category })),
    [filesList, categoriesForFile],
  );

  const filteredFiles = useMemo(() => filesList.filter(
    (file) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (
        file.fileId.toLowerCase().includes(term) ||
        file.fileName.toLowerCase().includes(term) ||
        file.workflowName?.toLowerCase().includes(term) ||
        file.description?.toLowerCase().includes(term) ||
        categoriesForFile(file).some((category) => category.name.toLowerCase().includes(term))
      );
      const matchesAccess = selectedAccess.length === 0 || (
        (file.availableToAll && selectedAccess.includes('public')) ||
        (file.groups || []).some((group) => selectedAccess.includes(`group:${group}`))
      );
      const matchesCategory = selectedCategories.length === 0 ||
        categoriesForFile(file).some((category) => selectedCategories.includes(category.name));
      return matchesSearch && matchesAccess && matchesCategory;
    }
  ), [filesList, searchTerm, selectedAccess, selectedCategories, categoriesForFile]);

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
              ariaLabel="Filter files by access"
              label="Filter by access"
              options={accessOptions}
              selected={selectedAccess}
              isOpen={isAccessFilterOpen}
              onToggle={setIsAccessFilterOpen}
              onSelect={(value) => toggleSelection(value, setSelectedAccess)}
            />
          </ToolbarItem>
          {categoriesSupported && (
            <ToolbarItem>
              <MultiFilter
                ariaLabel="Filter files by category"
                label="Filter by category"
                options={categoryOptions}
                selected={selectedCategories}
                isOpen={isCategoryFilterOpen}
                onToggle={setIsCategoryFilterOpen}
                onSelect={(value) => toggleSelection(value, setSelectedCategories)}
              />
            </ToolbarItem>
          )}
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
            <Th width={25}>File Name</Th>
            <Th width={40}>Description</Th>
            <Th width={20}>Access</Th>
            <Th width={15}>Actions</Th>
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
            const fileCategories = categoriesForFile(file);

            return (
              <Tr key={file.fileId}>
                <Td dataLabel="File Name" style={{ position: 'relative' }}>
                  <CategoryStripe categories={fileCategories} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <PurposeIcon style={{ color: purposeCfg.color, flexShrink: 0 }} />
                    <code style={{
                      fontSize: '0.875rem',
                      padding: '0.125rem 0.25rem',
                      backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
                      borderRadius: '3px',
                    }}>
                      {displayName}
                    </code>
                    {purposeKey !== 'file' && (
                      <Label isCompact color={purposeKey === 'workflow-template' ? 'purple' : 'green'}>
                        {purposeCfg.label}
                      </Label>
                    )}
                  </div>
                </Td>
                <Td dataLabel="Description">
                  {file.description ? (
                    <Tooltip content={file.description} position="top">
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {file.description}
                      </span>
                    </Tooltip>
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

      {filteredFiles.length === 0 && (searchTerm || selectedAccess.length > 0 || selectedCategories.length > 0) && (
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
