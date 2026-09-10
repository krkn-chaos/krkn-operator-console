import { Nav, NavItem, NavList, NavExpandable } from '@patternfly/react-core';
import { CogIcon, TerminalIcon, PlayIcon, FolderIcon, EditIcon, KeyIcon, MoonIcon, SunIcon, PowerOffIcon, UserIcon, TopologyIcon, DatabaseIcon } from '@patternfly/react-icons';
import { MdWork } from 'react-icons/md';
import type { ReactNode } from 'react';
import type { SidebarNavProps } from './types';
import './SidebarPFNav.css';

/**
 * SidebarPFNav — sidebar variant built with PatternFly's native Nav.
 *
 * The menu chrome for the sidebar. Uses PatternFly's native Nav component
 * (no extra dependency) and inherits PatternFly theming/dark-mode. When collapsed,
 * labels are visually hidden but remain in the accessibility tree via aria-label
 * on each nav item. Expanding reveals the labels.
 *
 * This component is typically wrapped by AppSidebar for collapse/expand behaviour.
 * Direct usage is rare; prefer AppSidebar in most cases.
 *
 * @param activePhase - The current app phase; highlights the matching nav item
 * @param expanded - When true, labels are visible; when false, collapsed to icon rail
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
 * // Direct usage (rare; typically wrapped by AppSidebar)
 * <SidebarPFNav
 *   activePhase="jobs_list"
 *   expanded={true}
 *   isAdmin={true}
 *   userName="Alice Smith"
 *   isDarkTheme={false}
 *   onNavigateJobs={() => console.log('jobs')}
 *   onRunScenario={() => console.log('run')}
 *   onNavigateStudio={() => console.log('studio')}
 *   onOpenFiles={() => console.log('files')}
 *   onNavigateTerminal={() => console.log('terminal')}
 *   onNavigateElasticsearchData={() => console.log('elasticsearch data')}
 *   onNavigateSettings={() => console.log('settings')}
 *   onEditProfile={() => console.log('edit')}
 *   onChangePassword={() => console.log('password')}
 *   onToggleTheme={() => console.log('theme')}
 *   onLogout={() => console.log('logout')}
 * />
 */
export function SidebarPFNav({
  activePhase,
  expanded,
  isAdmin,
  userName,
  isDarkTheme,
  onNavigateJobs,
  onRunScenario,
  onNavigateStudio,
  onOpenFiles,
  onNavigateTerminal,
  onNavigateElasticsearchData,
  onNavigateSettings,
  onEditProfile,
  onChangePassword,
  onToggleTheme,
  onLogout,
}: SidebarNavProps) {
  const item = (icon: ReactNode, label: string) => (
    <span className="pf-sidebar__item">
      <span className="pf-sidebar__icon">{icon}</span>
      <span className="pf-sidebar__label">{label}</span>
    </span>
  );

  return (
    <div className={`pf-sidebar ${expanded ? 'pf-sidebar--expanded' : 'pf-sidebar--collapsed'}`}>
      <Nav aria-label="Primary navigation">
        <NavList>
          <NavItem isActive={activePhase === 'jobs_list'} onClick={onNavigateJobs} aria-label="Jobs">
            {item(<MdWork />, 'Jobs')}
          </NavItem>
          <NavItem onClick={onRunScenario} aria-label="Run Scenario">{item(<PlayIcon />, 'Run Scenario')}</NavItem>
          <NavItem isActive={activePhase === 'studio'} onClick={onNavigateStudio} aria-label="Chaos Studio">
            {item(<TopologyIcon />, 'Chaos Studio')}
          </NavItem>
          <NavItem onClick={onOpenFiles} aria-label="Files">{item(<FolderIcon />, 'Files')}</NavItem>
          <NavItem isActive={activePhase === 'terminal'} onClick={onNavigateTerminal} aria-label="Terminal">
            {item(<TerminalIcon />, 'Terminal')}
          </NavItem>
          <NavItem isActive={activePhase === 'elasticsearch_data'} onClick={onNavigateElasticsearchData} aria-label="Elasticsearch Data">
            {item(<DatabaseIcon />, 'ES Data')}
          </NavItem>
          {isAdmin && (
            <NavItem isActive={activePhase === 'settings'} onClick={onNavigateSettings} aria-label="Settings">
              {item(<CogIcon />, 'Settings')}
            </NavItem>
          )}
        </NavList>
      </Nav>

      <div className="app-sidebar__spacer" />

      <Nav aria-label="Account">
        <NavList>
          <NavExpandable title={userName || 'Account'} srText="Account menu">
            <NavItem onClick={onEditProfile} aria-label="Edit Profile">{item(<EditIcon />, 'Edit Profile')}</NavItem>
            <NavItem onClick={onChangePassword} aria-label="Change Password">{item(<KeyIcon />, 'Change Password')}</NavItem>
            <NavItem onClick={onToggleTheme} aria-label={isDarkTheme ? 'Light Theme' : 'Dark Theme'}>
              {item(isDarkTheme ? <SunIcon /> : <MoonIcon />, isDarkTheme ? 'Light Theme' : 'Dark Theme')}
            </NavItem>
            <NavItem onClick={onLogout} aria-label="Logout">{item(<PowerOffIcon />, 'Logout')}</NavItem>
          </NavExpandable>
        </NavList>
      </Nav>

      {/* Collapsed rail shows a user glyph in place of the expandable account menu */}
      <div className="pf-sidebar__collapsed-user">
        <UserIcon />
      </div>
    </div>
  );
}
