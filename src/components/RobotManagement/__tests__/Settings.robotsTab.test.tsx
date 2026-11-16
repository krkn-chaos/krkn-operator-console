import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Settings } from '../../Settings';
import { useRole } from '../../../hooks/useRole';
import { useNotifications } from '../../../hooks/useNotifications';

vi.mock('../../TargetsList', () => ({ TargetsList: () => <div data-testid="targets" /> }));
vi.mock('../../UserManagement', () => ({ UserManagement: () => <div data-testid="users" /> }));
vi.mock('../../RegistriesCard', () => ({ RegistriesCard: () => <div data-testid="registries" /> }));
vi.mock('../../ElasticsearchConfigsCard', () => ({
  ElasticsearchConfigsCard: () => <div data-testid="elasticsearch" />,
}));
vi.mock('../../ProviderConfigTab', () => ({
  ProviderConfigTab: () => <div data-testid="provider-config" />,
}));
vi.mock('../RobotsCard', () => ({ RobotsCard: () => <div data-testid="robots-card" /> }));

vi.mock('../../../hooks/useRole');
vi.mock('../../../hooks/useNotifications');
vi.mock('../../../hooks/useProviderConfigPoller', () => ({
  useProviderConfigPoller: () => ({}),
}));
vi.mock('../../../services/providersApi', () => ({
  providersApi: { listProviders: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../../context/AppContext', () => ({
  useAppContext: () => ({ state: {}, dispatch: vi.fn() }),
}));

describe('Settings MCP Robots tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotifications).mockReturnValue({
      showNotification: vi.fn(),
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showWarning: vi.fn(),
      showInfo: vi.fn(),
      hideNotification: vi.fn(),
    });
  });

  it('renders the MCP Robots tab for admins', () => {
    vi.mocked(useRole).mockReturnValue({
      role: 'admin',
      isAdmin: true,
      isUser: false,
      hasRole: vi.fn(),
      isAuthenticated: true,
      userGroups: [],
    });

    render(<Settings />);

    expect(screen.getByRole('tab', { name: 'MCP Robots' })).toBeInTheDocument();
  });

  it('hides the MCP Robots tab for non-admins', () => {
    vi.mocked(useRole).mockReturnValue({
      role: 'user',
      isAdmin: false,
      isUser: true,
      hasRole: vi.fn(),
      isAuthenticated: true,
      userGroups: [],
    });

    render(<Settings />);

    expect(screen.queryByRole('tab', { name: 'MCP Robots' })).not.toBeInTheDocument();
  });
});
