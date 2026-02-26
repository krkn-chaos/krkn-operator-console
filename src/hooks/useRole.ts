/**
 * Role checking hook for krkn-operator-console
 *
 * Provides utilities to check user role and permissions.
 */

import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export function useRole() {
  const { state, isAdmin } = useAuth();

  return {
    /**
     * Current user role
     */
    role: state.user?.role,

    /**
     * Check if user is admin
     */
    isAdmin: isAdmin(),

    /**
     * Check if user is regular user (non-admin)
     */
    isUser: state.user?.role === 'user',

    /**
     * Check if user has specific role
     */
    hasRole: (role: UserRole) => state.user?.role === role,

    /**
     * Check if user is authenticated
     */
    isAuthenticated: state.isAuthenticated,
  };
}
