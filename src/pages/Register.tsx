/**
 * First admin registration page for krkn-operator-console
 *
 * Displayed when no admin user exists in the system.
 * Creates the first admin account.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LoginPage as PFLoginPage,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput,
  Button,
  Alert,
  ActionGroup,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [organization, setOrganization] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form validation errors
  const [errors, setErrors] = useState({
    userId: '',
    password: '',
    confirmPassword: '',
    name: '',
    surname: '',
  });

  const validateForm = (): boolean => {
    const newErrors = {
      userId: '',
      password: '',
      confirmPassword: '',
      name: '',
      surname: '',
    };

    let isValid = true;

    // Email validation
    if (!userId.trim()) {
      newErrors.userId = 'Email is required';
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userId)) {
        newErrors.userId = 'Please enter a valid email address';
        isValid = false;
      }
    }

    // Name validation
    if (!name.trim()) {
      newErrors.name = 'First name is required';
      isValid = false;
    }

    // Surname validation
    if (!surname.trim()) {
      newErrors.surname = 'Last name is required';
      isValid = false;
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Reset messages
    setErrorMessage('');
    setSuccessMessage('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await register({
        userId: userId.trim(),
        password,
        name: name.trim(),
        surname: surname.trim(),
        organization: organization.trim() || undefined,
        role: 'admin', // First user is always admin
      });

      setSuccessMessage('Registration successful! Redirecting to login...');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PFLoginPage
      brandImgSrc="/krkn-logo.png"
      brandImgAlt="Krkn Operator"
      backgroundImgSrc="/login-background.jpg"
      textContent="Chaos Engineering for Kubernetes"
      loginTitle="Create First Admin Account"
    >
      {errorMessage && (
        <Alert variant="danger" title="Registration Failed" isInline style={{ marginBottom: '1rem' }}>
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="Success" isInline style={{ marginBottom: '1rem' }}>
          {successMessage}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <FormGroup
          label="Email"
          isRequired
          fieldId="register-email"
        >
          <TextInput
            isRequired
            type="email"
            id="register-email"
            name="userId"
            value={userId}
            onChange={(_, value) => setUserId(value)}
            validated={errors.userId ? 'error' : 'default'}
            autoComplete="email"
          />
          {errors.userId && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  {errors.userId}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup
          label="First Name"
          isRequired
          fieldId="register-name"
        >
          <TextInput
            isRequired
            type="text"
            id="register-name"
            name="name"
            value={name}
            onChange={(_, value) => setName(value)}
            validated={errors.name ? 'error' : 'default'}
            autoComplete="given-name"
          />
          {errors.name && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  {errors.name}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup
          label="Last Name"
          isRequired
          fieldId="register-surname"
        >
          <TextInput
            isRequired
            type="text"
            id="register-surname"
            name="surname"
            value={surname}
            onChange={(_, value) => setSurname(value)}
            validated={errors.surname ? 'error' : 'default'}
            autoComplete="family-name"
          />
          {errors.surname && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  {errors.surname}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup label="Organization" fieldId="register-organization">
          <TextInput
            type="text"
            id="register-organization"
            name="organization"
            value={organization}
            onChange={(_, value) => setOrganization(value)}
            autoComplete="organization"
          />
        </FormGroup>

        <FormGroup
          label="Password"
          isRequired
          fieldId="register-password"
        >
          <TextInput
            isRequired
            type="password"
            id="register-password"
            name="password"
            value={password}
            onChange={(_, value) => setPassword(value)}
            validated={errors.password ? 'error' : 'default'}
            autoComplete="new-password"
          />
          {errors.password && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  {errors.password}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup
          label="Confirm Password"
          isRequired
          fieldId="register-confirm-password"
        >
          <TextInput
            isRequired
            type="password"
            id="register-confirm-password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(_, value) => setConfirmPassword(value)}
            validated={errors.confirmPassword ? 'error' : 'default'}
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  {errors.confirmPassword}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <ActionGroup>
          <Button
            variant="primary"
            type="submit"
            isBlock
            isDisabled={isLoading || !!successMessage}
          >
            {isLoading ? 'Creating Account...' : 'Create Admin Account'}
          </Button>
        </ActionGroup>
      </Form>
    </PFLoginPage>
  );
}
