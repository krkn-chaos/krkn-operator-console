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
    role: state.user?.role,
    isAdmin: isAdmin(),
    isUser: state.user?.role === 'user',
    hasRole: (role: UserRole) => state.user?.role === role,
    isAuthenticated: state.isAuthenticated,
    userGroups: state.user?.groups || [],
  };
}
