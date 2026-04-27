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

  // Show loading spinner while checking authentication
  if (state.loading) {
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
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // User is authenticated - render children
  return <>{children}</>;
}
