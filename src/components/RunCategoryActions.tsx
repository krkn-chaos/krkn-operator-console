import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
import { CaretDownIcon, DownloadIcon, ExclamationCircleIcon, FileAltIcon, FileCodeIcon, FilePdfIcon, RedoIcon, SearchIcon, TagIcon, TrashIcon } from '@patternfly/react-icons';
import { useReportActions } from '../hooks/useReportActions';
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
  isReplayJobsLoading?: boolean;
  onOpenReplayJobs?: () => void;
  onReplayScenario?: (jobId: string) => void;
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
  isReplayJobsLoading = false,
  onOpenReplayJobs,
  onReplayScenario,
  onReplayWorkflow,
  isWorkflowReplayDisabled = false,
}: RunCategoryActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasLoadedCategoriesForOpenMenu = useRef(false);
  const hasLoadedReplayJobsForOpenMenu = useRef(false);

  const report = useReportActions({ runId, runName, runPhase });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
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

  const handleReplayFlyout = () => {
    if (hasLoadedReplayJobsForOpenMenu.current) return;
    hasLoadedReplayJobsForOpenMenu.current = true;
    onOpenReplayJobs?.();
  };

  const handleWorkflowReplay = () => {
    if (!onReplayWorkflow) return;
    handleOpenChange(false);
    void onReplayWorkflow();
  };

  const replayableJobs = replayJobs.filter((job) => job.completionTime);

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
            <CaretDownIcon aria-hidden="true" />
          </MenuToggle>
        )}
      >
        <DropdownList aria-label={`Run actions for ${runName}`}>
          {onReplayScenario && (
            <DropdownItem
              key="replay-scenario"
              icon={<RedoIcon />}
              onShowFlyout={handleReplayFlyout}
              flyoutMenu={(
                <Menu id={`replay-clusters-${runName}`}>
                  <MenuContent>
                    <MenuList aria-label={`Replay ${runName} on a cluster`} aria-busy={isReplayJobsLoading}>
                      {isReplayJobsLoading ? (
                        <MenuItem key="replay-clusters-loading" isDisabled icon={<Spinner size="sm" />}>
                          Loading clusters…
                        </MenuItem>
                      ) : replayableJobs.length > 0 ? replayableJobs.map((job) => (
                        <MenuItem
                          key={job.jobId}
                          onClick={() => {
                            handleOpenChange(false);
                            onReplayScenario(job.jobId);
                          }}
                        >
                          {job.providerName}/{job.clusterName}
                        </MenuItem>
                      )) : (
                        <MenuItem key="replay-clusters-empty" isDisabled>
                          No completed clusters to replay
                        </MenuItem>
                      )}
                    </MenuList>
                  </MenuContent>
                </Menu>
              )}
            >
              Replay
            </DropdownItem>
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

// PatternFly's active sidebar marker uses BorderWidth--xl (4px by default).
const CATEGORY_STRIPE_NARROW_WIDTH = 'var(--pf-v5-global--BorderWidth--xl, 4px)';
const CATEGORY_STRIPE_WIDE_REFERENCE_WIDTH_MM = 3.8;
const CATEGORY_STRIPE_WIDE_WIDTH = (CATEGORY_STRIPE_WIDE_REFERENCE_WIDTH_MM * 0.85).toFixed(2) + 'mm';
const CATEGORY_STRIPE_TRANSITION_MS = 180;
const CATEGORY_TOOLTIP_CLOSE_DELAY_MS = 250;
const CATEGORY_TOOLTIP_VIEWPORT_GUTTER = 8;
const CATEGORY_TOOLTIP_MAX_WIDTH_REM = 18.75;
const CATEGORY_TOOLTIP_ARROW_OUTSET_REM = 0.6629;

interface TooltipPosition {
  left: number;
  top: number;
  maxWidth: number;
  side: 'left' | 'right';
}

function getCategoryStripeGradient(categories: CategoryResponse[]): string {
  const stops = categories.flatMap((category, index) => {
    const start = ((index / categories.length) * 100).toFixed(4);
    const end = (((index + 1) / categories.length) * 100).toFixed(4);
    const color = category.color || '#6c757d';
    return [`${color} ${start}%`, `${color} ${end}%`];
  });

  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

/** Renders equal-height category color segments at the left of a run row. */
export function RunCategoryStripe({ categories }: RunCategoryStripeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const tooltipId = useId();
  const stripeRef = useRef<HTMLDivElement>(null);
  const visualStripeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const revealTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const updateTooltipPosition = useCallback(() => {
    const visualStripeElement = visualStripeRef.current;
    if (!visualStripeElement) return;

    const visualStripeRect = visualStripeElement.getBoundingClientRect();
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const arrowOutset = rootFontSize * CATEGORY_TOOLTIP_ARROW_OUTSET_REM;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportGutter = Math.min(CATEGORY_TOOLTIP_VIEWPORT_GUTTER, viewportWidth / 2);
    const maxTooltipWidth = Math.max(1, Math.min(
      rootFontSize * CATEGORY_TOOLTIP_MAX_WIDTH_REM,
      viewportWidth - viewportGutter * 2,
    ));
    const anchorX = visualStripeRect.right;
    const availableRight = Math.max(1, viewportWidth - viewportGutter - anchorX - arrowOutset);
    const availableLeft = Math.max(1, anchorX - arrowOutset - viewportGutter);
    const side = availableRight >= availableLeft ? 'right' : 'left';
    const availableOnSide = side === 'right' ? availableRight : availableLeft;
    const tooltipMaxWidth = Math.min(maxTooltipWidth, availableOnSide);
    const tooltipWidth = Math.min(
      tooltipMaxWidth,
      tooltipRef.current?.getBoundingClientRect().width || tooltipMaxWidth,
    );

    setTooltipPosition((current) => {
      const next: TooltipPosition = {
        left: side === 'right' ? anchorX + arrowOutset : anchorX - arrowOutset - tooltipWidth,
        top: visualStripeRect.top + visualStripeRect.height / 2,
        maxWidth: tooltipMaxWidth,
        side,
      };
      if (current
        && Math.abs(current.left - next.left) < 0.5
        && Math.abs(current.top - next.top) < 0.5
        && Math.abs(current.maxWidth - next.maxWidth) < 0.5
        && current.side === next.side) {
        return current;
      }
      return next;
    });
  }, []);

  const revealTooltip = useCallback(() => {
    updateTooltipPosition();
    setIsTooltipVisible(true);
  }, [updateTooltipPosition]);

  const startHover = useCallback(() => {
    clearHideTimer();
    setIsHovered(true);
    if (revealTimerRef.current === null && !isTooltipVisible) {
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        revealTooltip();
      }, CATEGORY_STRIPE_TRANSITION_MS + 50);
    }
  }, [clearHideTimer, isTooltipVisible, revealTooltip]);

  const finishHover = useCallback(() => {
    clearRevealTimer();
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setIsHovered(false);
      setIsTooltipVisible(false);
    }, CATEGORY_TOOLTIP_CLOSE_DELAY_MS);
  }, [clearHideTimer, clearRevealTimer]);

  const endFocus = useCallback(() => {
    clearRevealTimer();
    clearHideTimer();
    setIsHovered(false);
    setIsTooltipVisible(false);
  }, [clearHideTimer, clearRevealTimer]);

  useEffect(() => {
    return () => {
      clearRevealTimer();
      clearHideTimer();
    };
  }, [clearHideTimer, clearRevealTimer]);

  useLayoutEffect(() => {
    if (!isTooltipVisible) return;

    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateTooltipPosition);
    if (observer && stripeRef.current) observer.observe(stripeRef.current);
    if (observer && visualStripeRef.current) observer.observe(visualStripeRef.current);

    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
      observer?.disconnect();
    };
  }, [isTooltipVisible, updateTooltipPosition]);

  if (categories.length === 0) return null;

  return (
    <div
      ref={stripeRef}
      role="group"
      tabIndex={0}
      aria-label={`Categories: ${categories.map((category) => category.name).join(', ')}`}
      aria-describedby={isTooltipVisible ? tooltipId : undefined}
      onMouseEnter={(event) => {
        if (tooltipRef.current?.contains(event.target as Node)) clearHideTimer();
        else startHover();
      }}
      onMouseLeave={finishHover}
      onFocus={() => {
        startHover();
      }}
      onBlur={endFocus}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        // Keep the hit area to the collapsed marker; the expanded visible stripe can overflow it.
        width: CATEGORY_STRIPE_NARROW_WIDTH,
      }}
    >
      <div
        ref={visualStripeRef}
        data-testid="category-stripe-visual"
        aria-hidden="true"
        onMouseEnter={startHover}
        onMouseLeave={finishHover}
        onTransitionEnd={(event) => {
          if (event.propertyName === 'width' && isHovered) {
            clearRevealTimer();
            revealTooltip();
          }
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: isHovered ? CATEGORY_STRIPE_WIDE_WIDTH : CATEGORY_STRIPE_NARROW_WIDTH,
          transition: 'width ' + CATEGORY_STRIPE_TRANSITION_MS + 'ms ease-out',
          overflow: 'hidden',
          borderRadius: 0,
          backgroundImage: getCategoryStripeGradient(categories),
        }}
      />
      {isTooltipVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={`pf-v5-c-tooltip pf-m-${tooltipPosition?.side ?? 'right'}`}
          onMouseEnter={clearHideTimer}
          onMouseLeave={finishHover}
          style={{
            position: 'fixed',
            left: `${tooltipPosition?.left ?? 0}px`,
            top: tooltipPosition?.top ?? 0,
            transform: 'translateY(-50%)',
            width: 'max-content',
            maxWidth: `${tooltipPosition?.maxWidth ?? 300}px`,
            boxSizing: 'border-box',
            overflowWrap: 'anywhere',
            zIndex: 9999,
          }}
        >
          <div
            className="pf-v5-c-tooltip__arrow"
            style={tooltipPosition?.side === 'left'
              ? { right: 0, left: 'auto' }
              : { left: 0, right: 'auto' }}
          />
          <div className="pf-v5-c-tooltip__content pf-m-text-align-left">
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
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{category.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
