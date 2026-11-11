import { useCallback, useEffect, useState } from 'react';
import { operatorApi } from '../../services/operatorApi';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../hooks/useRole';
import { isApiError } from '../../utils/apiClient';
import type { CategoryResponse } from '../../types/api';

/** Loads categories and coordinates their create, edit, and delete flows. */
export function useCategoryManagementPage() {
  const { state: authState } = useAuth();
  const { isAdmin } = useRole();
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const response = await operatorApi.getCategories();
      setCategories(response.categories || []);
      setError(null);
    } catch (err) {
      console.error('[CategoryManagementPage] Error loading categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadCategories().finally(() => setLoading(false));
  }, [loadCategories]);

  const retryLoadCategories = async () => {
    setLoading(true);
    await loadCategories();
    setLoading(false);
  };

  const openForm = (category: CategoryResponse | null, mode: 'create' | 'edit') => {
    setSelectedCategory(category);
    setFormMode(mode);
    setFormOpen(true);
  };

  const handleDeleteCategory = async (name: string) => {
    if (!window.confirm(
      `Delete category "${name}"?\n\nThis will also remove the category from all associated scenario and graph runs.`,
    )) return;

    try {
      await operatorApi.deleteCategory(name);
      await loadCategories();
    } catch (err) {
      setError(isApiError(err) && err.status === 403
        ? 'Only the category creator or an admin can delete this category'
        : err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedCategory(null);
  };

  const handleFormSuccess = async () => {
    closeForm();
    await loadCategories();
  };

  return {
    categories,
    clearError: () => setError(null),
    closeForm,
    currentUserId: authState.user?.userId || '',
    error,
    formMode,
    formOpen,
    handleDeleteCategory,
    handleFormSuccess,
    isAdmin,
    loadCategories,
    loading,
    openCreateCategory: () => openForm(null, 'create'),
    openEditCategory: (category: CategoryResponse) => openForm(category, 'edit'),
    retryLoadCategories,
    selectedCategory,
  };
}
