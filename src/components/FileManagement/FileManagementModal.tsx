/**
 * FileManagementModal - Main modal for file management
 *
 * Large modal containing complete file CRUD interface:
 * - Files table (list view)
 * - Create/Edit forms
 * - Delete confirmation
 * - Search/filter
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
import { operatorApi } from '../../services/operatorApi';
import type { FileResponse } from '../../types/api';

interface FileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ActiveTab = 'list' | 'create' | 'edit';

export function FileManagementModal({
  isOpen,
  onClose,
}: FileManagementModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('list');
  const [files, setFiles] = useState<FileResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileResponse | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Always use getAvailableFiles - backend handles group-based filtering
      const response = await operatorApi.getAvailableFiles();

      // Backend returns { files: [...] }
      setFiles(response.files || []);
    } catch (err) {
      console.error('[FileManagementModal] Error loading files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load files when modal opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    loadFiles();
  }, [isOpen, loadFiles]);

  const handleCreateClick = () => {
    setSelectedFile(null);
    setActiveTab('create');
  };

  const handleEditClick = (file: FileResponse) => {
    setSelectedFile(file);
    setActiveTab('edit');
  };

  const handleDeleteClick = async (fileName: string) => {
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

  const handleFormSuccess = async () => {
    setActiveTab('list');
    setSelectedFile(null);
    await loadFiles();
  };

  const handleFormCancel = () => {
    setActiveTab('list');
    setSelectedFile(null);
  };

  const handleTabSelect = (_event: React.MouseEvent, tabIndex: string | number) => {
    if (tabIndex === 'list' || tabIndex === 'create') {
      setActiveTab(tabIndex as ActiveTab);
      if (tabIndex === 'list') {
        setSelectedFile(null);
      }
    }
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="File Management"
      isOpen={isOpen}
      onClose={onClose}
      description="Manage ConfigMap-based files for chaos scenarios"
    >
      {error && (
        <Alert
          variant="danger"
          isInline
          title="Error"
          style={{ marginBottom: '1rem' }}
        >
          {error}
        </Alert>
      )}

      {loading && activeTab === 'list' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="lg" aria-label="Loading files" />
        </div>
      ) : (
        <Tabs
          activeKey={activeTab}
          onSelect={handleTabSelect}
          aria-label="File management tabs"
        >
          <Tab
            eventKey="list"
            title={<TabTitleText>Files</TabTitleText>}
            aria-label="Files list"
          >
            <div style={{ marginTop: '1rem' }}>
              <FilesTable
                files={files}
                onCreateClick={handleCreateClick}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                onRefresh={loadFiles}
              />
            </div>
          </Tab>

          <Tab
            eventKey="create"
            title={<TabTitleText>Create File</TabTitleText>}
            aria-label="Create new file"
          >
            <div style={{ marginTop: '1rem' }}>
              <FileForm
                mode="create"
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </div>
          </Tab>

          {activeTab === 'edit' && selectedFile && (
            <Tab
              eventKey="edit"
              title={<TabTitleText>Edit File</TabTitleText>}
              aria-label="Edit file"
            >
              <div style={{ marginTop: '1rem' }}>
                <FileForm
                  mode="edit"
                  initialData={selectedFile}
                  onSuccess={handleFormSuccess}
                  onCancel={handleFormCancel}
                />
              </div>
            </Tab>
          )}
        </Tabs>
      )}
    </Modal>
  );
}
