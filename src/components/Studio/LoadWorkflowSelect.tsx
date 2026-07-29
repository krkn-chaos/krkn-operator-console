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
import { workflowsApi } from '../../services/workflowsApi';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import type { WorkflowInfo } from '../../types/api';

/**
 * Dropdown select for loading saved workflow templates from the cluster.
 *
 * Fetches available templates via `workflowsApi.getAvailableWorkflows` on open
 * and provides a searchable list. The toggle label shows the loaded workflow's
 * name when one is active, or "Load Workflow" otherwise.
 *
 * Prompts the user for confirmation only when there are unsaved changes
 * (dirty saved workflow or unsaved canvas with nodes).
 *
 * @example
 * ```tsx
 * // Used inside StudioProvider, typically in the Workflow Templates card:
 * <LoadWorkflowSelect />
 * ```
 */
export function LoadWorkflowSelect() {
  const { workflow, loadWorkflow, savedWorkflow, isDirty } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState<WorkflowInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !fetchedRef.current) {
      fetchedRef.current = true;
      setIsLoading(true);
      workflowsApi.getAvailableWorkflows()
        .then(response => setTemplates(response.workflows || []))
        .catch(() => setTemplates([]))
        .finally(() => setIsLoading(false));
    }
    if (!isOpen) {
      fetchedRef.current = false;
    }
  }, [isOpen]);

  const handleSelect = async (_event: React.MouseEvent | undefined, workflowId: string | number | undefined) => {
    if (!workflowId || typeof workflowId !== 'string') return;

    const hasUnsavedChanges = (savedWorkflow && isDirty) || (!savedWorkflow && workflow.nodes.length > 0);
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Loading a new workflow will discard them. Continue?')) {
        return;
      }
    }

    setIsLoadingWorkflow(true);
    try {
      const wfResponse = await workflowsApi.getWorkflow(workflowId);

      const canvas = wfResponse.studioLayout;
      if (canvas && (!Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges) || typeof canvas.nextNodeNumber !== 'number')) {
        throw new Error('Invalid workflow format');
      }
      if (!canvas) {
        throw new Error('This workflow has no studio layout and cannot be opened in the visual editor');
      }

      loadWorkflow(canvas, {
        workflowId: wfResponse.workflowId,
        workflowName: wfResponse.workflowName,
        description: wfResponse.description,
        availableToAll: wfResponse.availableToAll,
        groups: wfResponse.groups,
        savedAt: wfResponse.updatedAt || wfResponse.createdAt || new Date().toISOString(),
      });
      showSuccess('Workflow loaded', `"${wfResponse.workflowName}" loaded successfully`);
    } catch (err) {
      showError('Load failed', err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setIsLoadingWorkflow(false);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const filtered = templates.filter(t =>
    t.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          {isLoadingWorkflow ? 'Loading...' : savedWorkflow ? savedWorkflow.workflowName : 'Load Workflow'}
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
            <SelectOption key={t.workflowId} value={t.workflowId}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.workflowName}</div>
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
