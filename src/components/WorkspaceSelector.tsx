import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FormGroup, FormSelect, FormSelectOption, Spinner } from '@patternfly/react-core';
import { workspacesApi } from '../services/workspacesApi';
import type { WorkspaceInfo, WorkspaceSelection } from '../types/api';

interface WorkspaceSelectorProps {
  value?: WorkspaceSelection;
  onChange: (value?: WorkspaceSelection) => void;
  id: string;
}

/** Selects a visible, currently available workspace by its platform name. */
export function WorkspaceSelector({ value, onChange, id }: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkspaces(await workspacesApi.listAvailable());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selectedAvailable = !value || workspaces.some((item) => item.name === value.name);

  return (
    <FormGroup label="Workspace" fieldId={id}>
      <div style={{ marginBottom: '0.5rem' }}>Optional shared storage, isolated in a directory for this run and cluster. Mounted at <code>/var/lib/krkn/workspace</code>.</div>
      {loading ? <Spinner size="sm" aria-label="Loading workspaces" /> : error ? (
        <Alert variant="danger" title="Unable to load workspaces" isInline actionLinks={<Button variant="link" onClick={() => void load()}>Retry</Button>}>{error}</Alert>
      ) : (
        <>
          {!selectedAvailable && <Alert variant="warning" title="Saved workspace is unavailable or no longer visible" isInline style={{ marginBottom: '0.5rem' }}>
            {value?.name} cannot be selected now. Replay with its pinned identity may fail; choose another workspace or continue without one.
          </Alert>}
          <FormSelect id={id} value={value?.name ?? ''} onChange={(_event, selected) => onChange(selected ? { name: selected } : undefined)} aria-label="Workspace">
            <FormSelectOption value="" label="No workspace" />
            {!selectedAvailable && <FormSelectOption value={value?.name ?? ''} label={`${value?.name} (saved; unavailable)`} isDisabled />}
            {workspaces.map((workspace) => <FormSelectOption key={workspace.name} value={workspace.name} label={workspace.name} />)}
          </FormSelect>
          {value?.workspaceUid && <Button variant="link" onClick={() => onChange({ name: value.name })}>Use current binding instead of saved binding</Button>}
        </>
      )}
    </FormGroup>
  );
}
