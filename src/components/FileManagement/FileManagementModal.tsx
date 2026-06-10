/**
 * FileManagementModal - Main modal for file and file types management
 *
 * Large modal with 2 fixed tabs:
 * - Files List
 * - File Types List
 *
 * Opens child modals for create/edit operations (FileFormModal, FileTypeFormModal)
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
import { FileFormModal } from './FileFormModal';
import { FileTypesTable } from '../FileTypesManagement/FileTypesTable';
import { FileTypeFormModal } from '../FileTypesManagement/FileTypeFormModal';
import { operatorApi } from '../../services/operatorApi';
import type { FileResponse, FileTypeResponse } from '../../types/api';

interface FileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ActiveTab = 'files-list' | 'file-types';

export function FileManagementModal({
  isOpen,
  onClose,
}: FileManagementModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('files-list');

  // Files state
  const [files, setFiles] = useState<FileResponse[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileResponse | null>(null);
  const [fileFormOpen, setFileFormOpen] = useState(false);
  const [fileFormMode, setFileFormMode] = useState<'create' | 'edit'>('create');

  // File Types state
  const [fileTypes, setFileTypes] = useState<FileTypeResponse[]>([]);
  const [selectedFileType, setSelectedFileType] = useState<FileTypeResponse | null>(null);
  const [fileTypeFormOpen, setFileTypeFormOpen] = useState(false);
  const [fileTypeFormMode, setFileTypeFormMode] = useState<'create' | 'edit'>('create');

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
    setFileFormOpen(true);
  };

  const handleEditFileClick = (file: FileResponse) => {
    setSelectedFile(file);
    setFileFormMode('edit');
    setFileFormOpen(true);
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
    setFileFormOpen(false);
    setSelectedFile(null);
    await loadFiles();
    await loadFileTypes(); // Refresh types in case new one was auto-created
  };

  const handleFileFormClose = () => {
    setFileFormOpen(false);
    setSelectedFile(null);
  };

  // ============================================================================
  // File Types handlers
  // ============================================================================

  const handleCreateFileTypeClick = () => {
    setSelectedFileType(null);
    setFileTypeFormMode('create');
    setFileTypeFormOpen(true);
  };

  const handleEditFileTypeClick = (fileType: FileTypeResponse) => {
    setSelectedFileType(fileType);
    setFileTypeFormMode('edit');
    setFileTypeFormOpen(true);
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
    setFileTypeFormOpen(false);
    setSelectedFileType(null);
    await loadFileTypes();
  };

  const handleFileTypeFormClose = () => {
    setFileTypeFormOpen(false);
    setSelectedFileType(null);
  };

  // ============================================================================
  // Navigation between File Form and File Types
  // ============================================================================

  /**
   * Called from FileFormModal when user clicks "Manage Types"
   * Closes file form modal and opens file type create modal
   */
  const handleRequestNewFileType = () => {
    setFileFormOpen(false); // Close file form modal
    setActiveTab('file-types'); // Switch to File Types tab
    handleCreateFileTypeClick(); // Open file type create modal
  };

  const handleTabSelect = (_event: React.MouseEvent, tabIndex: string | number) => {
    setActiveTab(tabIndex as ActiveTab);
  };

  return (
    <>
      {/* Main Modal - 2 Fixed Tabs */}
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
            {/* Files List Tab (fixed) */}
            <Tab
              eventKey="files-list"
              title={<TabTitleText>Files</TabTitleText>}
              aria-label="Files list"
            >
              <div style={{ marginTop: '1rem' }}>
                <FilesTable
                  files={files}
                  fileTypes={fileTypes}
                  onCreateClick={handleCreateFileClick}
                  onEditClick={handleEditFileClick}
                  onDeleteClick={handleDeleteFileClick}
                  onRefresh={loadFiles}
                />
              </div>
            </Tab>

            {/* File Types Tab (fixed) */}
            <Tab
              eventKey="file-types"
              title={<TabTitleText>File Types</TabTitleText>}
              aria-label="File types management"
            >
              <div style={{ marginTop: '1rem' }}>
                <FileTypesTable
                  fileTypes={fileTypes}
                  onCreateClick={handleCreateFileTypeClick}
                  onEditClick={handleEditFileTypeClick}
                  onDeleteClick={handleDeleteFileTypeClick}
                  onRefresh={loadFileTypes}
                />
              </div>
            </Tab>
          </Tabs>
        )}
      </Modal>

      {/* Child Modal: File Form (Create/Edit) */}
      <FileFormModal
        isOpen={fileFormOpen}
        mode={fileFormMode}
        initialData={selectedFile || undefined}
        availableFileTypes={fileTypes}
        onClose={handleFileFormClose}
        onSuccess={handleFileFormSuccess}
        onRequestNewFileType={handleRequestNewFileType}
      />

      {/* Child Modal: File Type Form (Create/Edit) */}
      <FileTypeFormModal
        isOpen={fileTypeFormOpen}
        mode={fileTypeFormMode}
        initialData={selectedFileType || undefined}
        onClose={handleFileTypeFormClose}
        onSuccess={handleFileTypeFormSuccess}
      />
    </>
  );
}
