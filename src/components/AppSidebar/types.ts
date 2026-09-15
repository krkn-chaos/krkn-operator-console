import type { AppPhase } from '../../types/api';

/**
 * Shared props for both sidebar variants (react-pro-sidebar and PatternFly Nav).
 *
 * The AppSidebar wrapper owns collapse/expand state and passes `expanded` down;
 * each variant only renders the menu chrome and wires items to these handlers.
 */
export interface SidebarNavProps {
  /** Current app phase, used to highlight the active menu item */
  activePhase: AppPhase;
  /** Whether the sidebar is expanded (labels visible) or a collapsed icon rail */
  expanded: boolean;
  /** Whether the current user has admin privileges (gates Settings) */
  isAdmin: boolean;
  /** Display name shown in the user section */
  userName: string;
  /** Current theme, controls the light/dark toggle label + icon */
  isDarkTheme: boolean;

  // Navigation / feature handlers (reuse existing App.tsx handlers)
  onNavigateJobs: () => void;
  onRunScenario: () => void;
  onNavigateStudio: () => void;
  onOpenFiles: () => void;
  onNavigateTerminal: () => void;
  onNavigateElasticsearchData: () => void;
  onNavigateSettings: () => void;
  onEditProfile: () => void;
  onChangePassword: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}

/** Width of the collapsed icon rail, in pixels. Kept in sync with AppSidebar.css. */
export const SIDEBAR_RAIL_WIDTH = 64;
/** Width of the expanded sidebar, in pixels. Kept in sync with AppSidebar.css. */
export const SIDEBAR_EXPANDED_WIDTH = 200;

/** Sidebar implementation. Locked to PatternFly native Nav. */
export const SIDEBAR_VARIANT = 'pf' as const;
