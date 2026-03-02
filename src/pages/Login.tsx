/**
 * Login page for krkn-operator-console
 *
 * Provides user authentication with JWT tokens.
 * Features:
 * - Email and password login form
 * - Session expired notification
 * - Redirect to return URL after login
 * - Error handling with inline validation
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  LoginPage as PFLoginPage,
  LoginForm,
  Alert,
  Button,
  Title,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

export function Login() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

  // Check for session expired flag from AuthContext redirect
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setShowSessionExpired(true);
    }
  }, [searchParams]);

  // Check if admin is registered
  useEffect(() => {
    async function checkRegistration() {
      try {
        const registered = await authService.isRegistered();
        setIsRegistered(registered);
      } catch (error) {
        console.error('Failed to check registration:', error);
        // Assume registered on error to show login form
        setIsRegistered(true);
      }
    }
    checkRegistration();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    console.log('[Login useEffect] Auth state:', {
      isAuthenticated: state.isAuthenticated,
      loading: state.loading,
      user: state.user,
      returnUrl: searchParams.get('returnUrl')
    });

    if (state.isAuthenticated && !state.loading) {
      const returnUrl = searchParams.get('returnUrl') || '/app';
      console.log('[Login useEffect] Redirecting to:', returnUrl);
      navigate(returnUrl);
    }
  }, [state.isAuthenticated, state.loading, navigate, searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Reset error state
    setErrorMessage('');

    // Basic validation
    if (!userId.trim()) {
      setErrorMessage('Email is required');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userId)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    console.log('[Login handleSubmit] Starting login for:', userId.trim());
    setIsLoading(true);

    try {
      await login({ userId: userId.trim(), password });
      console.log('[Login handleSubmit] Login successful, waiting for useEffect to redirect');
      // Success - AuthContext will update state and useEffect will handle redirect
    } catch (error) {
      console.error('[Login handleSubmit] Login failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading spinner while checking initial auth state
  if (state.loading) {
    return null;
  }

  const helperText = errorMessage ? (
    <span style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>
      <ExclamationCircleIcon /> {errorMessage}
    </span>
  ) : undefined;

  return (
    <PFLoginPage
      header={
        <Title headingLevel="h1" size="3xl" style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--pf-v5-global--Color--100)' }}>
          Welcome to Krkn!
        </Title>
      }
      brandImgSrc="/logo.png"
      brandImgAlt="Krkn Operator"
      textContent="Chaos Engineering for Kubernetes"
      loginTitle="Log in to your account"
    >
      {showSessionExpired && (
        <Alert
          variant="warning"
          title="Session Expired"
          isInline
          style={{ marginBottom: '1rem' }}
        >
          Your session has expired. Please log in again.
        </Alert>
      )}

      <LoginForm
        showHelperText={!!errorMessage}
        helperText={helperText}
        helperTextIcon={<ExclamationCircleIcon />}
        usernameLabel="Email"
        usernameValue={userId}
        onChangeUsername={(_, value) => setUserId(value)}
        isValidUsername={!errorMessage}
        passwordLabel="Password"
        passwordValue={password}
        onChangePassword={(_, value) => setPassword(value)}
        isValidPassword={!errorMessage}
        isLoginButtonDisabled={isLoading}
        loginButtonLabel={isLoading ? 'Logging in...' : 'Log in'}
        onLoginButtonClick={handleSubmit}
      />

      {isRegistered === false && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
            No admin account exists yet.
          </p>
          <Link to="/register">
            <Button variant="secondary" isBlock>
              Create First Admin Account
            </Button>
          </Link>
        </div>
      )}
    </PFLoginPage>
  );
}
