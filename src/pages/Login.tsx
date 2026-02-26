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
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LoginPage as PFLoginPage,
  LoginForm,
  Alert,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  // Check for session expired flag from AuthContext redirect
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setShowSessionExpired(true);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (state.isAuthenticated && !state.loading) {
      const returnUrl = searchParams.get('returnUrl') || '/';
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

    setIsLoading(true);

    try {
      await login({ userId: userId.trim(), password });

      // Success - AuthContext will update state and redirect via useEffect
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl);
    } catch (error) {
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
      brandImgSrc="/krkn-logo.png"
      brandImgAlt="Krkn Operator"
      backgroundImgSrc="/login-background.jpg"
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
    </PFLoginPage>
  );
}
