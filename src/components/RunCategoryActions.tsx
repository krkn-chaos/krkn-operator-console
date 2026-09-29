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
  Spinner,
  Tooltip,
} from '@patternfly/react-core';
import { EllipsisVIcon, TagIcon, TrashIcon } from '@patternfly/react-icons';
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
}: RunCategoryActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasLoadedCategoriesForOpenMenu = useRef(false);

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
    <Dropdown
      containsFlyout
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
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
  );
}

interface RunCategoryStripeProps {
  categories: CategoryResponse[];
}

// PatternFly's active sidebar marker uses BorderWidth--xl (4px by default).
const CATEGORY_STRIPE_NARROW_WIDTH = 'var(--pf-v5-global--BorderWidth--xl, 4px)';
const SIDEBAR_MARKER_NARROW_WIDTH_PX = 4;
const SIDEBAR_MARKER_NARROW_REFERENCE_MM = 2.8;
const CATEGORY_STRIPE_WIDE_REFERENCE_WIDTH_MM = 3.8;
const CATEGORY_STRIPE_WIDE_WIDTH = (
  SIDEBAR_MARKER_NARROW_WIDTH_PX
  * (CATEGORY_STRIPE_WIDE_REFERENCE_WIDTH_MM / SIDEBAR_MARKER_NARROW_REFERENCE_MM)
  * 0.85
).toFixed(2) + 'px';
const CATEGORY_STRIPE_TRANSITION_MS = 180;

/** Renders equal-height category color segments at the left of a run row. */
export function RunCategoryStripe({ categories }: RunCategoryStripeProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (categories.length === 0) return null;

  return (
    <Tooltip
      position="right"
      distance={0}
      entryDelay={CATEGORY_STRIPE_TRANSITION_MS + 20}
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
          width: isHovered ? CATEGORY_STRIPE_WIDE_WIDTH : CATEGORY_STRIPE_NARROW_WIDTH,
          transition: 'width ' + CATEGORY_STRIPE_TRANSITION_MS + 'ms ease-out',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 0,
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
