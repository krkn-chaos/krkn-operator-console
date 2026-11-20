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
} from '@patternfly/react-core';
import { EllipsisVIcon, DownloadIcon, ExclamationCircleIcon, FileAltIcon, FileCodeIcon, FilePdfIcon, RedoIcon, SearchIcon, TagIcon, TrashIcon } from '@patternfly/react-icons';
import { useReportActions } from '../hooks/useReportActions';
import { RollbackConfirmation, RollbackMenuAction, type RollbackAttempt } from './RollbackMenuAction';
import type { CategoryResponse, ClusterJob } from '../types/api';

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
  replayJobs?: ClusterJob[];
  rollbackEnabled?: boolean;
  isReplayJobsLoading?: boolean;
  onOpenReplayJobs?: () => void;
  onReplayScenario?: () => void;
  onReplayWorkflow?: () => Promise<void>;
  isWorkflowReplayDisabled?: boolean;
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
  replayJobs = [],
  rollbackEnabled = false,
  isReplayJobsLoading = false,
  onOpenReplayJobs,
  onReplayScenario,
  onReplayWorkflow,
  isWorkflowReplayDisabled = false,
}: RunCategoryActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState<RollbackAttempt | null>(null);
  const hasLoadedCategoriesForOpenMenu = useRef(false);
  const hasLoadedReplayJobsForOpenMenu = useRef(false);

  const report = useReportActions({ runId, runName, runPhase });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && runId && rollbackEnabled && replayJobs.length === 0 && !hasLoadedReplayJobsForOpenMenu.current) {
      hasLoadedReplayJobsForOpenMenu.current = true;
      onOpenReplayJobs?.();
    }
    if (!open) {
      hasLoadedCategoriesForOpenMenu.current = false;
      hasLoadedReplayJobsForOpenMenu.current = false;
    }
  };

  const handleCategoryFlyout = () => {
    if (hasLoadedCategoriesForOpenMenu.current) return;
    hasLoadedCategoriesForOpenMenu.current = true;
    onOpenCategories();
  };

  const handleWorkflowReplay = () => {
    if (!onReplayWorkflow) return;
    handleOpenChange(false);
    void onReplayWorkflow();
  };

  const handleScenarioReplay = () => {
    if (!onReplayScenario) return;
    handleOpenChange(false);
    onReplayScenario();
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
            className="run-category-actions__toggle"
            variant="plain"
            aria-label={`Actions for run ${runName}`}
            isExpanded={isOpen}
            isDisabled={isDeleting || isCategoryUpdating}
            onClick={() => handleOpenChange(!isOpen)}
          >
            <EllipsisVIcon  aria-hidden="true" />
          </MenuToggle>
        )}
      >
        <DropdownList aria-label={`Run actions for ${runName}`}>
          {onReplayScenario && (
            <DropdownItem
              key="replay-scenario"
              icon={<RedoIcon />}
              onClick={handleScenarioReplay}
            >
              Replay
            </DropdownItem>
          )}
          {runId && (
            <RollbackMenuAction
              runName={runName}
              rollbackEnabled={rollbackEnabled}
              jobs={replayJobs}
              isJobsLoading={isReplayJobsLoading}
              isMenuOpen={isOpen}
              onConfirm={(attempt) => {
                setConfirmRollback(attempt);
                handleOpenChange(false);
              }}
            />
          )}
          {onReplayWorkflow && (
            <DropdownItem
              key="replay-workflow"
              icon={<RedoIcon />}
              isDisabled={isWorkflowReplayDisabled}
              onClick={handleWorkflowReplay}
            >
              Replay
            </DropdownItem>
          )}
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
      {runId && (
        <RollbackConfirmation
          runName={runName}
          attempt={confirmRollback}
          onClose={() => setConfirmRollback(null)}
        />
      )}
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
