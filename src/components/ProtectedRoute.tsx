/**
 * Protected route component for krkn-operator-console
 *
 * Wraps routes that require authentication.
 * Redirects to login if user is not authenticated.
 */

import { ReactNode, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Bullseye, Button, EmptyState, EmptyStateBody, EmptyStateIcon, Spinner, Title } from '@patternfly/react-core';
import { UsersIcon } from '@patternfly/react-icons';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { state, logout } = useAuth();
  const location = useLocation();
  const [logoutError, setLogoutError] = useState(false);

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
      <EmptyStateBody>No external group was mapped to a local group with permissions at the last session check. Contact an administrator to request access, then refresh.</EmptyStateBody>
      {logoutError && <Alert variant="danger" title="Logout failed. Your session is still active; please try again." isInline />}
      <Button variant="primary" onClick={() => window.location.reload()}>Refresh access</Button>{' '}
      <Button variant="link" onClick={() => {
        setLogoutError(false);
        void logout().catch(() => setLogoutError(true));
      }}>Log out</Button>
    </EmptyState></Bullseye>;
  }

  // User is authenticated - render children
  return <>{children}</>;
}
