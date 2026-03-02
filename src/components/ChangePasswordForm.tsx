/**
 * Change Password Form component
 *
 * Handles password changes for users with different validation
 * based on whether the user is changing their own password or
 * an admin is changing another user's password.
 *
 * **Modes:**
 * - Self-change: Requires current password + new password + confirmation
 * - Admin changing other user: Only new password + confirmation
 *
 * **Validation:**
 * - New password minimum 8 characters
 * - New password confirmation must match
 * - Current password required for self-change
 */

import { useState } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  Button,
  ActionGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import type { ChangePasswordRequest } from '../types/api';

interface ChangePasswordFormProps {
  isSelfChange: boolean; // true if user is changing their own password
  onSubmit: (data: ChangePasswordRequest) => Promise<void>;
  onCancel: () => void;
}

export function ChangePasswordForm({ isSelfChange, onSubmit, onCancel }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Current password required for self-change
    if (isSelfChange && !currentPassword.trim()) {
      newErrors.currentPassword = 'Current password is required';
    }

    // New password validation
    if (!newPassword.trim()) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    // Confirm password validation
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);

    try {
      const data: ChangePasswordRequest = {
        newPassword: newPassword.trim(),
      };

      // Include current password only for self-change
      if (isSelfChange) {
        data.currentPassword = currentPassword.trim();
      }

      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form>
      {isSelfChange && (
        <FormGroup label="Current Password" isRequired fieldId="currentPassword">
          <TextInput
            type="password"
            id="currentPassword"
            value={currentPassword}
            onChange={(_event, value) => setCurrentPassword(value)}
            isRequired
            validated={errors.currentPassword ? 'error' : 'default'}
          />
          {errors.currentPassword && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{errors.currentPassword}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      )}

      <FormGroup label="New Password" isRequired fieldId="newPassword">
        <TextInput
          type="password"
          id="newPassword"
          value={newPassword}
          onChange={(_event, value) => setNewPassword(value)}
          isRequired
          validated={errors.newPassword ? 'error' : 'default'}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Minimum 8 characters</HelperTextItem>
          </HelperText>
        </FormHelperText>
        {errors.newPassword && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.newPassword}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Confirm New Password" isRequired fieldId="confirmPassword">
        <TextInput
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(_event, value) => setConfirmPassword(value)}
          isRequired
          validated={errors.confirmPassword ? 'error' : 'default'}
        />
        {errors.confirmPassword && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.confirmPassword}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <ActionGroup>
        <Button variant="primary" onClick={handleSubmit} isLoading={submitting} isDisabled={submitting}>
          Change Password
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
}
