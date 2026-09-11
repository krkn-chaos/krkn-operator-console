import { useCallback, useEffect, useState } from 'react';
import { operatorApi } from '../../services/operatorApi';
import { useRole } from '../../hooks/useRole';
import { isApiError } from '../../utils/apiClient';
import type { FileInfo, FileTypeResponse } from '../../types/api';

type ActiveTab = 'files-list' | 'file-types';

export function useFileManagementPage() {
  const { isAdmin, userGroups } = useRole();
  const [activeTab, setActiveTab] = useState<ActiveTab>('files-list');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileFormOpen, setFileFormOpen] = useState(false);
  const [fileFormMode, setFileFormMode] = useState<'create' | 'edit'>('create');
  const [fileTypes, setFileTypes] = useState<FileTypeResponse[]>([]);
  const [selectedFileType, setSelectedFileType] = useState<FileTypeResponse | null>(null);
  const [fileTypeFormOpen, setFileTypeFormOpen] = useState(false);
  const [fileTypeFormMode, setFileTypeFormMode] = useState<'create' | 'edit'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const response = await operatorApi.getAvailableFiles();
      setFiles(response.files || []);
    } catch (err) {
      console.error('[FileManagementPage] Error loading files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    }
  }, []);

  const loadFileTypes = useCallback(async () => {
    try {
      const response = await operatorApi.getFileTypes();
      setFileTypes(response.fileTypes || []);
    } catch (err) {
      console.error('[FileManagementPage] Error loading file types:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file types');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadFiles(), loadFileTypes()]).finally(() => setLoading(false));
  }, [loadFiles, loadFileTypes]);

  const openFileForm = (file: FileInfo | null, mode: 'create' | 'edit') => {
    setSelectedFile(file);
    setFileFormMode(mode);
    setFileFormOpen(true);
  };

  const openFileTypeForm = (fileType: FileTypeResponse | null, mode: 'create' | 'edit') => {
    setSelectedFileType(fileType);
    setFileTypeFormMode(mode);
    setFileTypeFormOpen(true);
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

  const handleDeleteFileType = async (typeName: string, usageCount: number) => {
    if (usageCount > 0) {
      alert(`Cannot delete type "${typeName}" - it is used by ${usageCount} file(s). Remove the type from all files first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete file type "${typeName}"? This action cannot be undone.`)) return;

    try {
      await operatorApi.deleteFileType(typeName);
      await loadFileTypes();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file type');
    }
  };

  const closeFileForm = () => {
    setFileFormOpen(false);
    setSelectedFile(null);
  };

  const closeFileTypeForm = () => {
    setFileTypeFormOpen(false);
    setSelectedFileType(null);
  };

  const handleFileFormSuccess = async () => {
    closeFileForm();
    await loadFiles();
    await loadFileTypes();
  };

  const handleFileTypeFormSuccess = async () => {
    closeFileTypeForm();
    await loadFileTypes();
  };

  const handleRequestNewFileType = () => {
    closeFileForm();
    setActiveTab('file-types');
    openFileTypeForm(null, 'create');
  };

  return {
    activeTab,
    error,
    fileFormMode,
    fileFormOpen,
    fileTypeFormMode,
    fileTypeFormOpen,
    fileTypes,
    files,
    isAdmin,
    loading,
    selectedFile,
    selectedFileType,
    userGroups,
    clearError: () => setError(null),
    closeFileForm,
    closeFileTypeForm,
    handleDeleteFile,
    handleDeleteFileType,
    handleFileFormSuccess,
    handleFileTypeFormSuccess,
    handleRequestNewFileType,
    loadFiles,
    loadFileTypes,
    openCreateFile: () => openFileForm(null, 'create'),
    openEditFile: (file: FileInfo) => openFileForm(file, 'edit'),
    openCreateFileType: () => openFileTypeForm(null, 'create'),
    openEditFileType: (fileType: FileTypeResponse) => openFileTypeForm(fileType, 'edit'),
    selectTab: (_event: React.MouseEvent, tabIndex: string | number) => setActiveTab(tabIndex as ActiveTab),
  };
}
