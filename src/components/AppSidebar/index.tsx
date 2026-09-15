import { useState } from 'react';
import { SidebarPFNav } from './SidebarPFNav';
import type { SidebarNavProps } from './types';
import './AppSidebar.css';

export { SIDEBAR_VARIANT, SIDEBAR_RAIL_WIDTH } from './types';
export type { SidebarNavProps } from './types';

/** Props the wrapper needs on top of the nav props. */
type AppSidebarProps = Omit<SidebarNavProps, 'expanded'> & {
  /** When pinned, the sidebar stays expanded regardless of hover. */
  pinned: boolean;
};

/**
 * AppSidebar — fixed-position overlay sidebar wrapper.
 *
 * The central navigation hub for the console. Owns the collapse/expand behaviour
 * (expand on hover, or stay expanded when pinned) and delegates the menu chrome
 * to the PatternFly Nav variant. Rendered as a fixed overlay so expanding floats
 * over content instead of compressing it.
 *
 * The sidebar is collapsed by default (64px rail, icons only) and expands to 200px
 * on hover or when pinned. When expanded, it overlays content with a subtle shadow.
 *
 * @param pinned - When true, sidebar stays expanded regardless of hover state
 * @param activePhase - The current app phase; highlights the matching nav item
 * @param isAdmin - When true, renders the Settings menu item
 * @param userName - Display name shown in the Account expandable section
 * @param isDarkTheme - Current theme; controls the theme toggle label and icon
 * @param onNavigateJobs - Called when Jobs menu item is clicked
 * @param onRunScenario - Called when Run Scenario menu item is clicked
 * @param onNavigateStudio - Called when Chaos Studio menu item is clicked
 * @param onOpenFiles - Called when Files menu item is clicked
 * @param onNavigateTerminal - Called when Terminal menu item is clicked
 * @param onNavigateElasticsearchData - Called when Elasticsearch Data menu item is clicked
 * @param onNavigateSettings - Called when Settings menu item is clicked
 * @param onEditProfile - Called when Edit Profile menu item is clicked
 * @param onChangePassword - Called when Change Password menu item is clicked
 * @param onToggleTheme - Called when theme toggle is clicked
 * @param onLogout - Called when Logout menu item is clicked
 *
 * @example
 * import { AppSidebar } from './components/AppSidebar';
 *
 * <AppSidebar
 *   pinned={isSidebarPinned}
 *   activePhase="jobs_list"
 *   isAdmin={true}
 *   userName="Ada Lovelace"
 *   isDarkTheme={false}
 *   onNavigateJobs={() => dispatch({ type: 'JOBS_LIST_READY' })}
 *   onRunScenario={() => dispatch({ type: 'INIT_START' })}
 *   onNavigateStudio={() => dispatch({ type: 'NAVIGATE_TO_STUDIO' })}
 *   onOpenFiles={() => setIsFileManagementOpen(true)}
 *   onNavigateTerminal={() => dispatch({ type: 'NAVIGATE_TO_TERMINAL' })}
 *   onNavigateElasticsearchData={() => dispatch({ type: 'NAVIGATE_TO_ELASTICSEARCH_DATA' })}
 *   onNavigateSettings={() => dispatch({ type: 'NAVIGATE_TO_SETTINGS' })}
 *   onEditProfile={() => setIsEditProfileOpen(true)}
 *   onChangePassword={() => setIsChangePasswordOpen(true)}
 *   onToggleTheme={() => setIsDarkTheme(!isDarkTheme)}
 *   onLogout={handleLogout}
 * />
 */
export function AppSidebar({ pinned, ...navProps }: AppSidebarProps) {
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  return (
    <div
      className={`app-sidebar ${expanded ? 'app-sidebar--expanded' : 'app-sidebar--collapsed'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="app-sidebar__inner">
        <SidebarPFNav {...navProps} expanded={expanded} />
      </div>
    </div>
  );
}
