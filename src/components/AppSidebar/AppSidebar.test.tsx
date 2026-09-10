import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { AppSidebar } from './index';
import type { SidebarNavProps } from './types';

/**
 * Tests for the central-navigation AppSidebar (PatternFly Nav variant).
 *
 * The sidebar is the app's single navigation hub, so these tests cover the
 * behaviour the rest of the console relies on: every menu item is rendered and
 * wired to its handler, the admin-only Settings item is gated on `isAdmin`, the
 * theme toggle reflects the current theme, and hovering expands the rail.
 */
type Handlers = Omit<SidebarNavProps, 'activePhase' | 'expanded' | 'isAdmin' | 'userName' | 'isDarkTheme'>;

const makeHandlers = (): Handlers => ({
  onNavigateJobs: vi.fn(),
  onRunScenario: vi.fn(),
  onNavigateStudio: vi.fn(),
  onOpenFiles: vi.fn(),
  onNavigateTerminal: vi.fn(),
  onNavigateElasticsearchData: vi.fn(),
  onNavigateSettings: vi.fn(),
  onEditProfile: vi.fn(),
  onChangePassword: vi.fn(),
  onToggleTheme: vi.fn(),
  onLogout: vi.fn(),
});

function renderSidebar(overrides: Partial<SidebarNavProps & { pinned: boolean }> = {}) {
  const handlers = makeHandlers();
  const props = {
    pinned: true, // start expanded so labels are queryable without hover
    activePhase: 'jobs_list' as const,
    isAdmin: true,
    userName: 'Ada Lovelace',
    isDarkTheme: false,
    ...handlers,
    ...overrides,
  };
  const result = render(<AppSidebar {...props} />);
  return { handlers, props, ...result };
}

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all primary navigation items', () => {
    renderSidebar();
    expect(screen.getByText('Jobs')).toBeInTheDocument();
    expect(screen.getByText('Run Scenario')).toBeInTheDocument();
    expect(screen.getByText('Chaos Studio')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('hides the Settings item for non-admins', () => {
    renderSidebar({ isAdmin: false });
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows the Settings item when the user is an admin', () => {
    renderSidebar({ isAdmin: true });
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('fires the matching handler when a nav item is clicked', async () => {
    const user = userEvent.setup();
    const { handlers } = renderSidebar();

    await user.click(screen.getByText('Jobs'));
    expect(handlers.onNavigateJobs).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Run Scenario'));
    expect(handlers.onRunScenario).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Chaos Studio'));
    expect(handlers.onNavigateStudio).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Files'));
    expect(handlers.onOpenFiles).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Terminal'));
    expect(handlers.onNavigateTerminal).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Settings'));
    expect(handlers.onNavigateSettings).toHaveBeenCalledTimes(1);
  });

  it('renders the account section with the user name', () => {
    renderSidebar({ userName: 'Ada Lovelace' });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('falls back to "Account" when no user name is provided', () => {
    renderSidebar({ userName: '' });
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('shows "Dark Theme" toggle in light mode', () => {
    renderSidebar({ isDarkTheme: false });
    expect(screen.getByText('Dark Theme')).toBeInTheDocument();
    expect(screen.queryByText('Light Theme')).not.toBeInTheDocument();
  });

  it('shows "Light Theme" toggle in dark mode', () => {
    renderSidebar({ isDarkTheme: true });
    expect(screen.getByText('Light Theme')).toBeInTheDocument();
    expect(screen.queryByText('Dark Theme')).not.toBeInTheDocument();
  });

  it('marks the active phase item as current', () => {
    const { container } = renderSidebar({ activePhase: 'terminal' });
    const current = container.querySelector('.pf-m-current');
    expect(current).not.toBeNull();
    expect(current).toHaveTextContent('Terminal');
  });

  it('is collapsed by default and expands on hover', async () => {
    const user = userEvent.setup();
    const handlers = makeHandlers();
    const { container } = render(
      <AppSidebar
        pinned={false}
        activePhase="jobs_list"
        isAdmin
        userName="Ada"
        isDarkTheme={false}
        {...handlers}
      />
    );

    const sidebar = container.querySelector('.app-sidebar');
    expect(sidebar).toHaveClass('app-sidebar--collapsed');

    await user.hover(sidebar as Element);
    expect(sidebar).toHaveClass('app-sidebar--expanded');

    await user.unhover(sidebar as Element);
    expect(sidebar).toHaveClass('app-sidebar--collapsed');
  });

  it('stays expanded when pinned regardless of hover', async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar({ pinned: true });
    const sidebar = container.querySelector('.app-sidebar');
    expect(sidebar).toHaveClass('app-sidebar--expanded');

    await user.unhover(sidebar as Element);
    expect(sidebar).toHaveClass('app-sidebar--expanded');
  });
});
