/**
 * FileTypesManagementModal - Main modal for file types management
 *
 * Large modal containing complete file types CRUD interface:
 * - Types table (list view with usage counts)
 * - Create/Edit forms
 * - Delete with usage validation
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
import { FileTypesTable } from './FileTypesTable';
import { FileTypeForm } from './FileTypeForm';
import { operatorApi } from '../../services/operatorApi';
import type { FileTypeResponse } from '../../types/api';

interface FileTypesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ActiveTab = 'list' | 'create' | 'edit';

export function FileTypesManagementModal({
  isOpen,
  onClose,
}: FileTypesManagementModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('list');
  const [fileTypes, setFileTypes] = useState<FileTypeResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<FileTypeResponse | null>(null);

  const loadFileTypes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await operatorApi.getFileTypes();
      setFileTypes(response.fileTypes || []);
    } catch (err) {
      console.error('[FileTypesManagementModal] Error loading file types:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file types');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load file types when modal opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    loadFileTypes();
  }, [isOpen, loadFileTypes]);

  const handleCreateClick = () => {
    setSelectedType(null);
    setActiveTab('create');
  };

  const handleEditClick = (fileType: FileTypeResponse) => {
    setSelectedType(fileType);
    setActiveTab('edit');
  };

  const handleDeleteClick = async (typeName: string, usageCount: number) => {
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

  const handleFormSuccess = async () => {
    setActiveTab('list');
    setSelectedType(null);
    await loadFileTypes();
  };

  const handleFormCancel = () => {
    setActiveTab('list');
    setSelectedType(null);
  };

  const handleTabSelect = (_event: React.MouseEvent, tabIndex: string | number) => {
    if (tabIndex === 'list' || tabIndex === 'create') {
      setActiveTab(tabIndex as ActiveTab);
      if (tabIndex === 'list') {
        setSelectedType(null);
      }
    }
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="File Types Management"
      isOpen={isOpen}
      onClose={onClose}
      description="Manage file type metadata (colors and icons)"
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
          <Spinner size="lg" aria-label="Loading file types" />
        </div>
      ) : (
        <Tabs
          activeKey={activeTab}
          onSelect={handleTabSelect}
          aria-label="File types management tabs"
        >
          <Tab
            eventKey="list"
            title={<TabTitleText>File Types</TabTitleText>}
            aria-label="File types list"
          >
            <div style={{ marginTop: '1rem' }}>
              <FileTypesTable
                fileTypes={fileTypes}
                onCreateClick={handleCreateClick}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                onRefresh={loadFileTypes}
              />
            </div>
          </Tab>

          <Tab
            eventKey="create"
            title={<TabTitleText>Create Type</TabTitleText>}
            aria-label="Create new file type"
          >
            <div style={{ marginTop: '1rem' }}>
              <FileTypeForm
                mode="create"
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </div>
          </Tab>

          {activeTab === 'edit' && selectedType && (
            <Tab
              eventKey="edit"
              title={<TabTitleText>Edit Type</TabTitleText>}
              aria-label="Edit file type"
            >
              <div style={{ marginTop: '1rem' }}>
                <FileTypeForm
                  mode="edit"
                  initialData={selectedType}
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
