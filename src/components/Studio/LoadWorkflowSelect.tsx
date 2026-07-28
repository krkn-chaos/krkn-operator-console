import { useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Button,
  Spinner,
} from '@patternfly/react-core';
import { FiX } from 'react-icons/fi';
import { FolderOpenIcon } from '@patternfly/react-icons';
import { operatorApi } from '../../services/operatorApi';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import type { FileInfo, StudioWorkflow } from '../../types/api';

export function LoadWorkflowSelect() {
  const { workflow, loadWorkflow } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !fetchedRef.current) {
      fetchedRef.current = true;
      setIsLoading(true);
      operatorApi.getAvailableFiles('workflow-template')
        .then(response => setTemplates(response.files || []))
        .catch(() => setTemplates([]))
        .finally(() => setIsLoading(false));
    }
    if (!isOpen) {
      fetchedRef.current = false;
    }
  }, [isOpen]);

  const handleSelect = async (_event: React.MouseEvent | undefined, fileId: string | number | undefined) => {
    if (!fileId || typeof fileId !== 'string') return;

    const hasUnsavedWork = workflow.nodes.length > 0;
    if (hasUnsavedWork) {
      if (!confirm('Loading a workflow will replace the current canvas. Continue?')) {
        return;
      }
    }

    setIsLoadingWorkflow(true);
    try {
      const file = await operatorApi.getFile(fileId);
      const parsed: StudioWorkflow = JSON.parse(file.content);
      if (!parsed.nodes || !parsed.edges) {
        throw new Error('Invalid workflow format');
      }
      loadWorkflow(parsed, {
        fileId,
        fileName: file.fileName,
        description: file.description,
        availableToAll: file.availableToAll,
        groups: file.groups,
        savedAt: new Date().toISOString(),
      });
      showSuccess('Workflow loaded', `"${file.fileName}" loaded successfully`);
    } catch (err) {
      showError('Load failed', err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setIsLoadingWorkflow(false);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const filtered = templates.filter(t =>
    t.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Select
      isOpen={isOpen}
      onSelect={handleSelect}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSearchTerm('');
      }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsOpen(!isOpen)}
          isExpanded={isOpen}
          isDisabled={isLoadingWorkflow}
          icon={isLoadingWorkflow ? <Spinner size="sm" /> : <FolderOpenIcon />}
        >
          {isLoadingWorkflow ? 'Loading...' : 'Load Workflow'}
        </MenuToggle>
      )}
    >
      <div style={{ padding: '0.5rem' }}>
        <TextInputGroup>
          <TextInputGroupMain
            value={searchTerm}
            onChange={(_e, val) => setSearchTerm(val)}
            placeholder="Search workflows..."
          />
          {searchTerm && (
            <TextInputGroupUtilities>
              <Button
                variant="plain"
                onClick={() => setSearchTerm('')}
                icon={<FiX />}
                aria-label="Clear search"
              />
            </TextInputGroupUtilities>
          )}
        </TextInputGroup>
      </div>
      <SelectList style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {isLoading ? (
          <SelectOption isDisabled value="loading">
            <Spinner size="sm" /> Loading...
          </SelectOption>
        ) : filtered.length === 0 ? (
          <SelectOption isDisabled value="empty">
            {searchTerm ? 'No matching workflows' : 'No saved workflows'}
          </SelectOption>
        ) : (
          filtered.map(t => (
            <SelectOption key={t.fileId} value={t.fileId}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.fileName}</div>
                {t.description && (
                  <div style={{ fontSize: '0.85em', color: 'var(--pf-v5-global--Color--200)' }}>
                    {t.description}
                  </div>
                )}
              </div>
            </SelectOption>
          ))
        )}
      </SelectList>
    </Select>
  );
}
