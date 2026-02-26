/**
 * AdminOnly component for krkn-operator-console
 *
 * Conditionally renders children only if the current user has admin role.
 * Used to hide admin-only UI elements from regular users.
 */

import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

interface AdminOnlyProps {
  children: ReactNode;
  /**
   * Optional fallback content to show when user is not admin
   */
  fallback?: ReactNode;
}

export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const { isAdmin } = useAuth();

  if (!isAdmin()) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
