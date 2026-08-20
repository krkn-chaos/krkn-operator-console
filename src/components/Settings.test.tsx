import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Settings } from './Settings';

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    state: { providers: [], providerConfigStatus: 'idle' },
    dispatch: vi.fn(),
  }),
}));
vi.mock('../hooks/useRole', () => ({ useRole: () => ({ isAdmin: true }) }));
vi.mock('../hooks/useProviderConfigPoller', () => ({ useProviderConfigPoller: () => {} }));
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
vi.mock('../services/providersApi', () => ({
  providersApi: { listProviders: vi.fn().mockResolvedValue([]) },
}));
vi.mock('./TargetsList', () => ({ TargetsList: () => <div>Targets content</div> }));
vi.mock('./UserManagement', () => ({ UserManagement: () => <div>Users content</div> }));
vi.mock('./RegistriesCard', () => ({ RegistriesCard: () => <div>Registries content</div> }));
vi.mock('./SignatureVerificationSettings', () => ({ SignatureVerificationSettings: () => <div>Signature content</div> }));
vi.mock('./ElasticsearchConfigsCard', () => ({ ElasticsearchConfigsCard: () => <div>Elasticsearch content</div> }));
vi.mock('./CloudCredentialsCard', () => ({ CloudCredentialsCard: () => <div>Credentials content</div> }));
vi.mock('./ProviderConfigTab', () => ({ ProviderConfigTab: () => <div>Provider content</div> }));
vi.mock('./WorkspacesCard', () => ({ WorkspacesCard: () => <div>Workspaces content</div> }));
vi.mock('./BackupRestoreCard', () => ({ BackupRestoreCard: () => <div>Backup content</div> }));
vi.mock('./VisualizeInstallCard', () => ({ VisualizeInstallCard: () => <div>Visualize content</div> }));

describe('Settings tabs', () => {
  it('renders the krkn-visualize tab for admins', () => {
    render(<Settings />);

    expect(screen.getByRole('tab', { name: 'krkn-visualize' })).toBeInTheDocument();
  });

  it('selects Workspaces and Backup & Restore independently', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    const workspacesTab = screen.getByRole('tab', { name: 'Workspaces' });
    const backupTab = screen.getByRole('tab', { name: 'Backup & Restore' });

    await user.click(workspacesTab);
    expect(workspacesTab).toHaveAttribute('aria-selected', 'true');
    expect(backupTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Workspaces content')).toBeVisible();
    const inactiveBackupContent = screen.queryByText('Backup content');
    if (inactiveBackupContent) expect(inactiveBackupContent).not.toBeVisible();

    await user.click(backupTab);
    expect(workspacesTab).toHaveAttribute('aria-selected', 'false');
    expect(backupTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Backup content')).toBeVisible();
    const inactiveWorkspaceContent = screen.queryByText('Workspaces content');
    if (inactiveWorkspaceContent) expect(inactiveWorkspaceContent).not.toBeVisible();
  });
});
