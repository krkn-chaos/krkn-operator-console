import { useRef, useState } from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalVariant,
  Spinner,
  Tooltip,
} from '@patternfly/react-core';
import { DownloadIcon, EllipsisVIcon, ExclamationCircleIcon, FileAltIcon, FileCodeIcon, FilePdfIcon, SearchIcon, TagIcon, TrashIcon } from '@patternfly/react-icons';
import { useReportActions } from '../hooks/useReportActions';
import type { CategoryResponse } from '../types/api';

interface RunCategoryActionsProps {
  runName: string;
  categories: CategoryResponse[];
  assignedCategoryNames: string[];
  isCategoriesLoading: boolean;
  categoriesError: string | null;
  isCategoryUpdating: boolean;
  isDeleting: boolean;
  onOpenCategories: () => void;
  onToggleCategory: (category: CategoryResponse) => void;
  onDelete: () => void;
  /** When set, report actions (preview/download) are shown in the menu. */
  runId?: string;
  /** Used to stop polling once the run completes. */
  runPhase?: string;
}

/**
 * Actions menu for a scenario or graph run, including category assignment.
 *
 * @example
 * <RunCategoryActions
 *   runName="run-123"
 *   categories={categories}
 *   assignedCategoryNames={['resilience']}
 *   isCategoriesLoading={false}
 *   categoriesError={null}
 *   isCategoryUpdating={false}
 *   isDeleting={false}
 *   onOpenCategories={loadCategories}
 *   onToggleCategory={(category) => toggleCategory('scenario-runs', 'run-123', category)}
 *   onDelete={() => deleteRun('run-123')}
 * />
 */
export function RunCategoryActions({
  runName,
  categories,
  assignedCategoryNames,
  isCategoriesLoading,
  categoriesError,
  isCategoryUpdating,
  isDeleting,
  onOpenCategories,
  onToggleCategory,
  onDelete,
  runId,
  runPhase,
}: RunCategoryActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasLoadedCategoriesForOpenMenu = useRef(false);

  const report = useReportActions({ runId, runName, runPhase });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      hasLoadedCategoriesForOpenMenu.current = false;
    }
  };

  const handleCategoryFlyout = () => {
    if (hasLoadedCategoriesForOpenMenu.current) return;
    hasLoadedCategoriesForOpenMenu.current = true;
    onOpenCategories();
  };

  return (
    <>
      <Dropdown
        containsFlyout
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        popperProps={{ position: 'right' }}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            variant="plain"
            aria-label={`Actions for run ${runName}`}
            isExpanded={isOpen}
            isDisabled={isDeleting || isCategoryUpdating}
            onClick={() => handleOpenChange(!isOpen)}
          >
            <EllipsisVIcon />
          </MenuToggle>
        )}
      >
        <DropdownList aria-label={`Run actions for ${runName}`}>
          {runId && report.error && (
            <DropdownItem
              key="report-error"
              icon={<ExclamationCircleIcon color="var(--pf-v5-global--danger-color--100)" />}
              onClick={() => { handleOpenChange(false); report.retry(); }}
            >
              Reports failed — Retry
            </DropdownItem>
          )}
          {runId && !report.error && (
            <DropdownItem
              key="reports"
              icon={report.isLoading ? <Spinner size="sm" /> : <FileAltIcon />}
              isDisabled={report.isLoading || !report.hasReports || report.isDownloading !== null || report.isPreviewing !== null}
              flyoutMenu={report.hasReports ? (
                <Menu id={`reports-${runName}`}>
                  <MenuContent>
                    <MenuList aria-label={`Reports for run ${runName}`}>
                      {report.hasHtml && (
                        <>
                          <MenuItem key="preview-html" icon={<SearchIcon />} onClick={() => { handleOpenChange(false); void report.handlePreview('html'); }}>
                            Preview HTML
                          </MenuItem>
                          <MenuItem key="download-html" icon={<FileCodeIcon />} onClick={() => { handleOpenChange(false); void report.handleDownload('html'); }}>
                            Download HTML
                          </MenuItem>
                        </>
                      )}
                      {report.hasPdf && (
                        <>
                          <MenuItem key="preview-pdf" icon={<FilePdfIcon />} onClick={() => { handleOpenChange(false); void report.handlePreview('pdf'); }}>
                            Preview PDF
                          </MenuItem>
                          <MenuItem key="download-pdf" icon={<DownloadIcon />} onClick={() => { handleOpenChange(false); void report.handleDownload('pdf'); }}>
                            Download PDF
                          </MenuItem>
                        </>
                      )}
                    </MenuList>
                  </MenuContent>
                </Menu>
              ) : undefined}
            >
              {report.isLoading ? 'Checking reports…' : 'Reports'}
            </DropdownItem>
          )}
          <DropdownItem
            key="category"
            icon={<TagIcon />}
            onShowFlyout={handleCategoryFlyout}
            flyoutMenu={(
              <Menu id={`categories-${runName}`}>
                <MenuContent>
                  <MenuList aria-label={`Categories for run ${runName}`} aria-busy={isCategoriesLoading}>
                    {categories.length > 0 ? categories.map((category) => {
                      const isAssigned = assignedCategoryNames.includes(category.name);
                      return (
                        <MenuItem
                          key={category.name}
                          hasCheckbox
                          isSelected={isAssigned}
                          isDisabled={isCategoryUpdating}
                          aria-label={`${isAssigned ? 'Remove' : 'Add'} category ${category.name}`}
                          icon={(
                            <span
                              aria-hidden="true"
                              style={{
                                width: '0.75rem',
                                height: '0.75rem',
                                borderRadius: '50%',
                                backgroundColor: category.color || '#6c757d',
                                display: 'inline-block',
                              }}
                            />
                          )}
                          onClick={() => onToggleCategory(category)}
                        >
                          {category.name}
                        </MenuItem>
                      );
                    }) : isCategoriesLoading ? (
                      <MenuItem key="categories-loading" isDisabled icon={<Spinner size="sm" />}>
                        Loading categories…
                      </MenuItem>
                    ) : categoriesError ? (
                      <MenuItem key="categories-error" isDisabled>
                        Categories could not be loaded
                      </MenuItem>
                    ) : (
                      <MenuItem key="categories-empty" isDisabled>
                        No categories available
                      </MenuItem>
                    )}
                  </MenuList>
                </MenuContent>
              </Menu>
            )}
          >
            Category
          </DropdownItem>
          <DropdownItem
            key="delete"
            icon={<TrashIcon />}
            isDanger
            isDisabled={isDeleting}
            onClick={() => {
              handleOpenChange(false);
              onDelete();
            }}
          >
            Delete
          </DropdownItem>
        </DropdownList>
      </Dropdown>
      {report.preview && (
        <Modal
          title={report.preview.format.toUpperCase() + ' report preview'}
          variant={ModalVariant.large}
          isOpen
          onClose={report.closePreview}
        >
          <iframe
            src={report.preview.url}
            title={report.preview.format.toUpperCase() + ' report preview'}
            style={{ width: '100%', height: '70vh', border: 0 }}
            sandbox={report.preview.format === 'html' ? '' : undefined}
          />
        </Modal>
      )}
    </>
  );
}

interface RunCategoryStripeProps {
  categories: CategoryResponse[];
}

/** Renders equal-height category color segments at the left of a run row. */
export function RunCategoryStripe({ categories }: RunCategoryStripeProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (categories.length === 0) return null;

  return (
    <Tooltip
      position="right"
      content={(
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <strong>Categories:</strong>
          {categories.map((category) => (
            <span key={category.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  backgroundColor: category.color || '#6c757d',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {category.name}
            </span>
          ))}
        </div>
      )}
    >
      <div
        role="img"
        tabIndex={0}
        aria-label={`Categories: ${categories.map((category) => category.name).join(', ')}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: isHovered ? 'calc(0.35rem + 30px)' : '0.35rem',
          transition: 'width 180ms ease-out',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
        }}
      >
        {categories.map((category) => (
          <span
            key={category.name}
            style={{
              flex: 1,
              minHeight: 0,
              backgroundColor: category.color || '#6c757d',
            }}
          />
        ))}
      </div>
    </Tooltip>
  );
}
