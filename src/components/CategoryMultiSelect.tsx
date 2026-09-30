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
}: CategoryMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

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
          No categories will be assigned. Retry to load the categories visible to you.{' '}
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
              {selectedCategories.length === 0
                ? 'No categories selected'
                : `${selectedCategories.length} ${selectedCategories.length === 1 ? 'category' : 'categories'} selected`}
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
