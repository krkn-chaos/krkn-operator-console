/**
 * Registration check page for krkn-operator-console
 *
 * Checks if an admin user exists and redirects accordingly:
 * - If admin exists: redirect to login
 * - If no admin: redirect to registration page
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bullseye,
  EmptyState,
  EmptyStateIcon,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

export function RegistrationCheck() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkRegistration() {
      console.log('[RegistrationCheck] Running check:', {
        isAuthenticated: state.isAuthenticated,
        loading: state.loading
      });

      // If user is already authenticated, go to app
      if (state.isAuthenticated && !state.loading) {
        console.log('[RegistrationCheck] User authenticated, redirecting to /app');
        navigate('/app', { replace: true });
        return;
      }

      // If still loading auth state, wait
      if (state.loading) {
        console.log('[RegistrationCheck] Still loading, waiting...');
        return;
      }

      // User not authenticated - check if admin exists
      console.log('[RegistrationCheck] User not authenticated, checking if admin registered');
      try {
        const isRegistered = await authService.isRegistered();
        console.log('[RegistrationCheck] Admin registered:', isRegistered);

        if (isRegistered) {
          // Admin exists - redirect to login
          console.log('[RegistrationCheck] Admin exists, redirecting to /login');
          navigate('/login', { replace: true });
        } else {
          // No admin - redirect to registration
          console.log('[RegistrationCheck] No admin, redirecting to /register');
          navigate('/register', { replace: true });
        }
      } catch (err) {
        console.error('[RegistrationCheck] Failed to check registration status:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to server');
      }
    }

    checkRegistration();
  }, [navigate, state.isAuthenticated, state.loading]);

  if (error) {
    return (
      <Bullseye>
        <EmptyState>
          <Title headingLevel="h2" size="lg">
            Connection Error
          </Title>
          <p>{error}</p>
          <p>Please check that the backend server is running.</p>
        </EmptyState>
      </Bullseye>
    );
  }

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
