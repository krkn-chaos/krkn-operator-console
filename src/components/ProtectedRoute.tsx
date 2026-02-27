/**
 * Protected route component for krkn-operator-console
 *
 * Wraps routes that require authentication.
 * Redirects to login if user is not authenticated.
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Bullseye, EmptyState, EmptyStateIcon, Spinner, Title } from '@patternfly/react-core';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { state } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] Checking access:', {
    pathname: location.pathname,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    hasUser: !!state.user
  });

  // Show loading spinner while checking authentication
  if (state.loading) {
    console.log('[ProtectedRoute] Still loading, showing spinner');
    return (
      <Bullseye>
        <EmptyState>
          <EmptyStateIcon icon={() => <Spinner size="xl" />} />
          <Title headingLevel="h2" size="lg">
            Loading...
          </Title>
        </EmptyState>
      </Bullseye>
    );
  }

  // Redirect to login if not authenticated
  if (!state.isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to login');
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // User is authenticated - render children
  console.log('[ProtectedRoute] Authenticated, rendering protected content');
  return <>{children}</>;
}
