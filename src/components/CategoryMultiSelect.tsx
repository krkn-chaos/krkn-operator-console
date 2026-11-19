import { useState } from 'react';
import {
  Alert,
  Button,
  FormGroup,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Spinner,
} from '@patternfly/react-core';
import type { CategoryResponse } from '../types/api';
import type { CategoryLoadStatus } from '../hooks/useVisibleCategories';

interface CategoryMultiSelectProps {
  id: string;
  label: string;
  categories: CategoryResponse[];
  status: CategoryLoadStatus;
  selectedCategories: string[];
  onSelectionChange: (categories: string[]) => void;
  onRetry: () => void;
  /**
   * What happens to stored associations when the category list cannot load.
   * A create flow assigns nothing; an edit flow that omits the field keeps the
   * existing associations. The error message must describe the real outcome.
   */
  preserveExistingOnError?: boolean;
}

/**
 * Multi-select for categories visible to the current user.
 *
 * @example
 * ```tsx
 * <CategoryMultiSelect
 *   id="run-categories"
 *   label="Categories for this run"
 *   categories={visibleCategories}
 *   status={categoryLoadStatus}
 *   selectedCategories={selectedCategories}
 *   onSelectionChange={setSelectedCategories}
 *   onRetry={reloadCategories}
 * />
 * ```
 */
export function CategoryMultiSelect({
  id,
  label,
  categories,
  status,
  selectedCategories,
  onSelectionChange,
  onRetry,
  preserveExistingOnError = false,
}: CategoryMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Selections can outlive the options: a stored association may not be in the
  // visible list (stale list, or an operator that does not filter private
  // categories). Count only what the user can actually see and toggle, so the
  // label never claims selections that have no checkbox. Unlisted names stay in
  // the selection so they are preserved on save.
  const selectableNames = new Set(categories.map((category) => category.name));
  const selectableSelectionCount = selectedCategories.filter((name) =>
    selectableNames.has(name)).length;

  const toggleCategory = (name: string) => {
    onSelectionChange(
      selectedCategories.includes(name)
        ? selectedCategories.filter((category) => category !== name)
        : [...selectedCategories, name],
    );
  };

  return (
    <FormGroup label={label} fieldId={id}>
      {status === 'loading' && (
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Spinner size="sm" /> Loading categories…
        </div>
      )}

      {status === 'error' && (
        <Alert variant="warning" isInline isPlain title="Categories could not be loaded">
          {preserveExistingOnError
            ? 'The existing categories will be kept unchanged.'
            : 'No categories will be assigned.'}{' '}
          Retry to load the categories visible to you.{' '}
          <Button variant="link" onClick={onRetry}>
            Retry
          </Button>
        </Alert>
      )}

      {status === 'ready' && categories.length === 0 && (
        <div style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
          No categories are available to you. You can continue without assigning one.
        </div>
      )}

      {status === 'ready' && categories.length > 0 && (
        <Select
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          onSelect={(_event, value) => toggleCategory(value as string)}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              id={id}
              onClick={() => setIsOpen((open) => !open)}
              isExpanded={isOpen}
              aria-label={label}
              style={{ minWidth: '240px' }}
            >
              {selectableSelectionCount === 0
                ? 'No categories selected'
                : `${selectableSelectionCount} ${selectableSelectionCount === 1 ? 'category' : 'categories'} selected`}
            </MenuToggle>
          )}
        >
          <SelectList>
            {categories.map((category) => (
              <SelectOption
                key={category.name}
                value={category.name}
                hasCheckbox
                isSelected={selectedCategories.includes(category.name)}
                icon={(
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: '0.75rem',
                      height: '0.75rem',
                      borderRadius: '50%',
                      backgroundColor: category.color || 'var(--pf-v5-global--Color--200)',
                    }}
                  />
                )}
              >
                {category.name}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      )}
    </FormGroup>
  );
}
