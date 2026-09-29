import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Checkbox, FormGroup, Spinner } from '@patternfly/react-core';
import { operatorApi } from '../services/operatorApi';

interface RunCategorySelectorProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

export function RunCategorySelector({ selectedCategories, onChange }: RunCategorySelectorProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await operatorApi.getCategories();
      setCategories(response.categories.map((category) => category.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const handleToggle = (category: string, checked: boolean) => {
    onChange(checked
      ? [...selectedCategories, category]
      : selectedCategories.filter((selected) => selected !== category));
  };

  return (
    <FormGroup label="Run categories" fieldId="run-categories">
      <div role="group" aria-label="Run categories">
        {isLoading && <Spinner size="sm" aria-label="Loading categories" />}
        {error && (
          <Alert
            variant="danger"
            isInline
            title="Unable to load categories"
            actionLinks={<Button variant="link" onClick={() => void loadCategories()}>Retry</Button>}
          >
            {error}
          </Alert>
        )}
        {!isLoading && !error && categories.length === 0 && <p>No categories available.</p>}
        {!isLoading && !error && categories.map((category) => (
          <Checkbox
            key={category}
            id={`run-category-${category}`}
            label={category}
            isChecked={selectedCategories.includes(category)}
            onChange={(_event, checked) => handleToggle(category, checked)}
          />
        ))}
      </div>
    </FormGroup>
  );
}
