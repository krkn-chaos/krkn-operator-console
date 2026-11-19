import { useCallback, useEffect, useState } from 'react';
import { operatorApi } from '../../services/operatorApi';
import { useRole } from '../../hooks/useRole';
import { useVisibleCategories } from '../../hooks/useVisibleCategories';
import { isApiError } from '../../utils/apiClient';
import type { FileInfo } from '../../types/api';

export function useFileManagementPage() {
  const { isAdmin, userGroups } = useRole();
  // Category definitions carry the colors used by the row marker; files only
  // reference categories by name.
  const { categories } = useVisibleCategories();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileFormOpen, setFileFormOpen] = useState(false);
  const [fileFormMode, setFileFormMode] = useState<'create' | 'edit'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Operators that support file categories always return the field, even when
  // a file has none. When every listed file omits it, the deployed operator is
  // older and the category controls would silently drop input. An empty list
  // carries no signal, so the controls stay available.
  const [categoriesSupported, setCategoriesSupported] = useState(true);

  const loadFiles = useCallback(async () => {
    try {
      const response = await operatorApi.getAvailableFiles();
      const loadedFiles = response.files || [];
      setFiles(loadedFiles);
      setCategoriesSupported(
        loadedFiles.length === 0 || loadedFiles.some((file) => file.categories !== undefined),
      );
    } catch (err) {
      console.error('[FileManagementPage] Error loading files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadFiles().finally(() => setLoading(false));
  }, [loadFiles]);

  const openFileForm = (file: FileInfo | null, mode: 'create' | 'edit') => {
    setSelectedFile(file);
    setFileFormMode(mode);
    setFileFormOpen(true);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await operatorApi.deleteFile(fileId);
      await loadFiles();
      setError(null);
    } catch (err) {
      setError(isApiError(err) && err.status === 403
        ? 'You do not have permission to delete this file'
        : err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const closeFileForm = () => {
    setFileFormOpen(false);
    setSelectedFile(null);
  };

  const handleFileFormSuccess = async () => {
    closeFileForm();
    await loadFiles();
  };

  return {
    error,
    fileFormMode,
    fileFormOpen,
    files,
    categories,
    categoriesSupported,
    isAdmin,
    loading,
    selectedFile,
    userGroups,
    clearError: () => setError(null),
    closeFileForm,
    handleDeleteFile,
    handleFileFormSuccess,
    loadFiles,
    openCreateFile: () => openFileForm(null, 'create'),
    openEditFile: (file: FileInfo) => openFileForm(file, 'edit'),
  };
}
