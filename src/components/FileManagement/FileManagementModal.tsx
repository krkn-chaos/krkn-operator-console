/**
 * FileManagementModal - Main modal for file and file types management
 *
 * Large modal containing complete file CRUD interface + file types management:
 * - Files list and create/edit
 * - File Types management (integrated)
 * - Workflow: create new type from file form
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalVariant,
  Tabs,
  Tab,
  TabTitleText,
  Alert,
  Spinner,
} from '@patternfly/react-core';
import { FilesTable } from './FilesTable';
import { FileForm } from './FileForm';
import { FileTypesTable } from '../FileTypesManagement/FileTypesTable';
import { FileTypeForm } from '../FileTypesManagement/FileTypeForm';
import { operatorApi } from '../../services/operatorApi';
import type { FileResponse, FileTypeResponse } from '../../types/api';

interface FileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ActiveTab = 'files-list' | 'file-form' | 'file-types';
type FileFormMode = 'create' | 'edit' | null;
type FileTypeFormMode = 'create' | 'edit' | null;

export function FileManagementModal({
  isOpen,
  onClose,
}: FileManagementModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('files-list');

  // Files state
  const [files, setFiles] = useState<FileResponse[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileResponse | null>(null);
  const [fileFormMode, setFileFormMode] = useState<FileFormMode>(null);

  // File Types state
  const [fileTypes, setFileTypes] = useState<FileTypeResponse[]>([]);
  const [selectedFileType, setSelectedFileType] = useState<FileTypeResponse | null>(null);
  const [fileTypeFormMode, setFileTypeFormMode] = useState<FileTypeFormMode>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const response = await operatorApi.getAvailableFiles();
      setFiles(response.files || []);
    } catch (err) {
      console.error('[FileManagementModal] Error loading files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    }
  }, []);

  const loadFileTypes = useCallback(async () => {
    try {
      const response = await operatorApi.getFileTypes();
      setFileTypes(response.fileTypes || []);
    } catch (err) {
      console.error('[FileManagementModal] Error loading file types:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file types');
    }
  }, []);

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([loadFiles(), loadFileTypes()]).finally(() => {
      setLoading(false);
    });
  }, [isOpen, loadFiles, loadFileTypes]);

  // ============================================================================
  // Files handlers
  // ============================================================================

  const handleCreateFileClick = () => {
    setSelectedFile(null);
    setFileFormMode('create');
    setActiveTab('file-form');
  };

  const handleEditFileClick = (file: FileResponse) => {
    setSelectedFile(file);
    setFileFormMode('edit');
    setActiveTab('file-form');
  };

  const handleDeleteFileClick = async (fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete file "${fileName}"?`)) {
      return;
    }

    try {
      await operatorApi.deleteFile(fileName);
      await loadFiles();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const handleFileFormSuccess = async () => {
    setActiveTab('files-list');
    setSelectedFile(null);
    setFileFormMode(null);
    await loadFiles();
  };

  const handleFileFormCancel = () => {
    setActiveTab('files-list');
    setSelectedFile(null);
    setFileFormMode(null);
  };

  // ============================================================================
  // File Types handlers
  // ============================================================================

  const handleCreateFileTypeClick = () => {
    setSelectedFileType(null);
    setFileTypeFormMode('create');
    setActiveTab('file-types');
  };

  const handleEditFileTypeClick = (fileType: FileTypeResponse) => {
    setSelectedFileType(fileType);
    setFileTypeFormMode('edit');
    setActiveTab('file-types');
  };

  const handleDeleteFileTypeClick = async (typeName: string, usageCount: number) => {
    if (usageCount > 0) {
      alert(`Cannot delete type "${typeName}" - it is used by ${usageCount} file(s). Remove the type from all files first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete file type "${typeName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await operatorApi.deleteFileType(typeName);
      await loadFileTypes();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file type');
    }
  };

  const handleFileTypeFormSuccess = async () => {
    setFileTypeFormMode(null);
    setSelectedFileType(null);
    await loadFileTypes();
  };

  const handleFileTypeFormCancel = () => {
    setFileTypeFormMode(null);
    setSelectedFileType(null);
  };

  // ============================================================================
  // Navigation between File Form and File Types
  // ============================================================================

  /**
   * Called from FileForm when user selects "+ Add New Type" from file type select
   * Switches to File Types tab in create mode
   */
  const handleRequestNewFileType = () => {
    handleCreateFileTypeClick();
  };

  const handleTabSelect = (_event: React.MouseEvent, tabIndex: string | number) => {
    setActiveTab(tabIndex as ActiveTab);

    // Reset form modes when switching tabs manually
    if (tabIndex === 'files-list') {
      setFileFormMode(null);
      setSelectedFile(null);
    }
    if (tabIndex === 'file-types') {
      // Don't reset fileTypeFormMode - might be in create mode from file form
    }
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="File Management"
      isOpen={isOpen}
      onClose={onClose}
      description="Manage ConfigMap-based files and file types"
    >
      {error && (
        <Alert
          variant="danger"
          isInline
          title="Error"
          style={{ marginBottom: '1rem' }}
          actionClose={{ onClose: () => setError(null) }}
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="lg" aria-label="Loading" />
        </div>
      ) : (
        <Tabs
          activeKey={activeTab}
          onSelect={handleTabSelect}
          aria-label="File management tabs"
        >
          {/* Files List Tab */}
          <Tab
            eventKey="files-list"
            title={<TabTitleText>Files</TabTitleText>}
            aria-label="Files list"
          >
            <div style={{ marginTop: '1rem' }}>
              <FilesTable
                files={files}
                onCreateClick={handleCreateFileClick}
                onEditClick={handleEditFileClick}
                onDeleteClick={handleDeleteFileClick}
                onRefresh={loadFiles}
              />
            </div>
          </Tab>

          {/* File Form Tab (Create/Edit) */}
          {fileFormMode && (
            <Tab
              eventKey="file-form"
              title={<TabTitleText>{fileFormMode === 'create' ? 'Create File' : 'Edit File'}</TabTitleText>}
              aria-label={fileFormMode === 'create' ? 'Create file' : 'Edit file'}
            >
              <div style={{ marginTop: '1rem' }}>
                <FileForm
                  mode={fileFormMode}
                  initialData={selectedFile || undefined}
                  availableFileTypes={fileTypes}
                  onSuccess={handleFileFormSuccess}
                  onCancel={handleFileFormCancel}
                  onRequestNewFileType={handleRequestNewFileType}
                />
              </div>
            </Tab>
          )}

          {/* File Types Tab */}
          <Tab
            eventKey="file-types"
            title={<TabTitleText>File Types</TabTitleText>}
            aria-label="File types management"
          >
            <div style={{ marginTop: '1rem' }}>
              {fileTypeFormMode ? (
                <FileTypeForm
                  mode={fileTypeFormMode}
                  initialData={selectedFileType || undefined}
                  onSuccess={handleFileTypeFormSuccess}
                  onCancel={handleFileTypeFormCancel}
                />
              ) : (
                <FileTypesTable
                  fileTypes={fileTypes}
                  onCreateClick={handleCreateFileTypeClick}
                  onEditClick={handleEditFileTypeClick}
                  onDeleteClick={handleDeleteFileTypeClick}
                  onRefresh={loadFileTypes}
                />
              )}
            </div>
          </Tab>
        </Tabs>
      )}
    </Modal>
  );
}
