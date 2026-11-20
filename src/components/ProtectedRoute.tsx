/**
 * Protected route component for krkn-operator-console
 *
 * Wraps routes that require authentication.
 * Redirects to login if user is not authenticated.
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Bullseye, Button, EmptyState, EmptyStateBody, EmptyStateIcon, Spinner, Title } from '@patternfly/react-core';
import { UsersIcon } from '@patternfly/react-icons';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { state, logout } = useAuth();
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

  if (state.user?.provider && state.user.groups?.length === 0) {
    return <Bullseye><EmptyState>
      <EmptyStateIcon icon={UsersIcon} />
      <Title headingLevel="h2" size="lg">No groups assigned</Title>
      <EmptyStateBody>Your identity is valid, but no external group is mapped to a local group with permissions. Contact an administrator to request access.</EmptyStateBody>
      <Button variant="primary" onClick={() => window.location.reload()}>Refresh access</Button>{' '}
      <Button variant="link" onClick={logout}>Log out</Button>
    </EmptyState></Bullseye>;
  }

  // User is authenticated - render children
  return <>{children}</>;
}
