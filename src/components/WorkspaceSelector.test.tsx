import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSelector } from './WorkspaceSelector';
import { workspacesApi } from '../services/workspacesApi';

vi.mock('../services/workspacesApi');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(workspacesApi.listAvailable).mockResolvedValue([{ name: 'current', displayName: 'Current data', availableToAll: true, available: true }]);
});

describe('WorkspaceSelector', () => {
  it('shows only available workspaces and sends their alias', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkspaceSelector id="workspace" onChange={onChange} />);
    await screen.findByRole('option', { name: 'Current data' });
    await user.selectOptions(screen.getByLabelText('Workspace'), 'current');
    expect(onChange).toHaveBeenCalledWith({ name: 'current' });
  });

  it('keeps a missing replay binding pinned until the user explicitly changes it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkspaceSelector id="workspace" value={{ name: 'removed', workspaceUid: 'old-uid', claimUid: 'old-pvc-uid' }} onChange={onChange} />);
    expect(await screen.findByText('Saved workspace is unavailable or no longer visible')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Workspace'), 'current');
    expect(onChange).toHaveBeenCalledWith({ name: 'current' });
  });
});
