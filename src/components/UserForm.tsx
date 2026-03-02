import { useState } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  Button,
  ActionGroup,
  Radio,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import type { CreateUserRequest, UpdateUserRequest, UserDetails } from '../types/api';
import type { UserRole } from '../types/auth';

/**
 * User Form component props
 */
interface UserFormProps {
  /**
   * Initial user data for edit mode (undefined for create mode)
   */
  initialData?: UserDetails;
  /**
   * Submit handler that receives either CreateUserRequest or UpdateUserRequest
   */
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => Promise<void>;
  /**
   * Cancel handler to close the form
   */
  onCancel: () => void;
}

/**
 * User Form component
 *
 * Handles both create and edit modes for user accounts.
 * Provides comprehensive form validation, password handling, and
 * role-based field behavior.
 *
 * **Modes:**
 * - **Create Mode** (initialData is undefined):
 *   - All fields required except organization
 *   - Email field is editable
 *   - Password and confirmation are required
 * - **Edit Mode** (initialData is provided):
 *   - Email field is disabled (immutable)
 *   - Password is optional (leave blank to keep existing)
 *   - All other fields editable
 *
 * **Validation Rules:**
 *
 * **Email:**
 * - Required in create mode
 * - Must match email format: `username@domain.tld`
 * - Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
 *
 * **Password (Create Mode):**
 * - Required
 * - Minimum 8 characters
 * - Must match confirmation field
 *
 * **Password (Edit Mode):**
 * - Optional (leave blank to keep existing password)
 * - If provided, minimum 8 characters
 * - Must match confirmation if provided
 *
 * **Name Fields:**
 * - First name required
 * - Last name required
 * - Trimmed of whitespace
 *
 * **Role:**
 * - Required (radio selection)
 * - Options: 'user' or 'admin'
 *
 * **Organization:**
 * - Optional in both modes
 *
 * **Field Behavior:**
 * - All text inputs trimmed before submission
 * - Validation runs on submit
 * - Error messages displayed inline under fields
 * - Submit button disabled during submission
 *
 * @component
 *
 * @param props - Component props
 * @param props.initialData - User data for edit mode (optional)
 * @param props.onSubmit - Submit handler
 * @param props.onCancel - Cancel handler
 *
 * @example
 * ```tsx
 * // Create mode
 * <UserForm
 *   onSubmit={async (data) => {
 *     await usersApi.createUser(data as CreateUserRequest);
 *   }}
 *   onCancel={() => setIsFormOpen(false)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Edit mode
 * <UserForm
 *   initialData={selectedUser}
 *   onSubmit={async (data) => {
 *     await usersApi.updateUser(
 *       selectedUser.userId,
 *       data as UpdateUserRequest
 *     );
 *   }}
 *   onCancel={() => setIsFormOpen(false)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Wrapped in Modal (recommended)
 * <Modal
 *   variant={ModalVariant.medium}
 *   title={editingUser ? 'Edit User' : 'Create New User'}
 *   isOpen={isFormOpen}
 *   onClose={handleCancel}
 * >
 *   <UserForm
 *     initialData={editingUser || undefined}
 *     onSubmit={handleFormSubmit}
 *     onCancel={handleCancel}
 *   />
 * </Modal>
 * ```
 */
export function UserForm({ initialData, onSubmit, onCancel }: UserFormProps) {
  const [userId, setUserId] = useState(initialData?.userId || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState(initialData?.name || '');
  const [surname, setSurname] = useState(initialData?.surname || '');
  const [role, setRole] = useState<UserRole>(initialData?.role || 'user');
  const [organization, setOrganization] = useState(initialData?.organization || '');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!userId.trim()) {
      newErrors.userId = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId)) {
      newErrors.userId = 'Invalid email format';
    }

    // Password validation - CREATE MODE
    if (!initialData) {
      if (!password.trim()) {
        newErrors.password = 'Password is required';
      } else if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }

      if (!confirmPassword.trim()) {
        newErrors.confirmPassword = 'Please confirm password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else {
      // EDIT MODE - password optional
      if (password && password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }

      if (password && password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    // Name validation
    if (!name.trim()) {
      newErrors.name = 'First name is required';
    }

    if (!surname.trim()) {
      newErrors.surname = 'Last name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      if (initialData) {
        // EDIT MODE
        const data: UpdateUserRequest = {
          name: name.trim(),
          surname: surname.trim(),
          role,
          organization: organization.trim() || undefined,
        };

        // Include password only if it's being changed
        if (password.trim()) {
          data.password = password.trim();
        }

        await onSubmit(data);
      } else {
        // CREATE MODE
        const data: CreateUserRequest = {
          userId: userId.trim(),
          password: password.trim(),
          name: name.trim(),
          surname: surname.trim(),
          role,
          organization: organization.trim() || undefined,
        };
        await onSubmit(data);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form>
      <FormGroup label="Email" isRequired fieldId="userId">
        <TextInput
          id="userId"
          value={userId}
          onChange={(_event, value) => setUserId(value)}
          isRequired
          validated={errors.userId ? 'error' : 'default'}
          isDisabled={!!initialData}
        />
        {errors.userId && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.userId}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Password" isRequired={!initialData} fieldId="password">
        <TextInput
          type="password"
          id="password"
          value={password}
          onChange={(_event, value) => setPassword(value)}
          isRequired={!initialData}
          validated={errors.password ? 'error' : 'default'}
        />
        {!initialData && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>Minimum 8 characters</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
        {errors.password && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.password}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Confirm Password" isRequired={!initialData} fieldId="confirmPassword">
        <TextInput
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(_event, value) => setConfirmPassword(value)}
          isRequired={!initialData}
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

      <FormGroup label="First Name" isRequired fieldId="name">
        <TextInput
          id="name"
          value={name}
          onChange={(_event, value) => setName(value)}
          isRequired
          validated={errors.name ? 'error' : 'default'}
        />
        {errors.name && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.name}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Last Name" isRequired fieldId="surname">
        <TextInput
          id="surname"
          value={surname}
          onChange={(_event, value) => setSurname(value)}
          isRequired
          validated={errors.surname ? 'error' : 'default'}
        />
        {errors.surname && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.surname}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Role" isRequired fieldId="role">
        <Radio
          id="role-user"
          name="role"
          label="User"
          isChecked={role === 'user'}
          onChange={() => setRole('user')}
        />
        <Radio
          id="role-admin"
          name="role"
          label="Admin"
          isChecked={role === 'admin'}
          onChange={() => setRole('admin')}
        />
      </FormGroup>

      <FormGroup label="Organization" fieldId="organization">
        <TextInput
          id="organization"
          value={organization}
          onChange={(_event, value) => setOrganization(value)}
        />
      </FormGroup>

      <ActionGroup>
        <Button variant="primary" onClick={handleSubmit} isLoading={submitting} isDisabled={submitting}>
          {initialData ? 'Update User' : 'Create User'}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
}
