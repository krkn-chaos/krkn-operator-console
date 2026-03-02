# User Management

## Overview

The User Management feature provides a comprehensive interface for managing user accounts in the krkn-operator-console. This feature allows administrators to create, edit, view, and delete user accounts while enforcing role-based access control (RBAC) and security policies.

User Management is critical for controlling access to the chaos orchestration platform, ensuring that only authorized personnel can execute chaos scenarios and that administrative functions are properly restricted.

## Access Control

The User Management feature implements role-based access control with two distinct roles:

### Admin Role
Administrators have full access to user management capabilities:
- View all users in the system
- Create new user accounts
- Edit existing user accounts (except email addresses)
- Delete user accounts (with safety restrictions)
- View detailed information for any user
- Assign roles (Admin or User) to accounts

### User Role
Regular users have limited access:
- View the list of all users
- View detailed information for any user
- **Cannot** create, edit, or delete user accounts

## Features

### User List

The User List provides a comprehensive overview of all user accounts in the system.

**Displayed Information:**
- User name (first and last name)
- Email address (used as unique user ID)
- Role (Admin or User) with color-coded labels
- Organization affiliation
- Account status (Enabled/Disabled) with visual indicators
- Last login timestamp (or "Never" for accounts that haven't logged in)

**Functionality:**
- Sortable and filterable table view
- Real-time user count display
- Quick actions: View Details, Edit (admin only), Delete (admin only)
- Empty state guidance when no users exist
- API availability detection with helpful error messages

### Create User (Admin Only)

Administrators can create new user accounts through a dedicated form interface.

**Required Fields:**
- **Email** - Must be a valid email format (e.g., user@example.com)
  - Used as the unique user ID
  - Cannot be changed after creation
  - Validated for proper email format (username@domain.tld)

- **Password** - Must meet minimum security requirements
  - Minimum 8 characters
  - Required for new users
  - Validated against confirmation field

- **Confirm Password** - Must match the password field exactly

- **First Name** - User's given name

- **Last Name** - User's surname

- **Role** - Select either "User" or "Admin"
  - User: Basic access to view data and execute authorized scenarios
  - Admin: Full administrative access including user management

**Optional Fields:**
- **Organization** - The user's organizational affiliation (e.g., "Engineering", "QA Team")

**Validation Rules:**
- Email format must be valid
- Password must be at least 8 characters
- Passwords must match
- First name and last name are required
- All fields are trimmed of leading/trailing whitespace

### Edit User

Administrators can modify existing user accounts to update information or change roles.

**Editable Fields:**
- First Name
- Last Name
- Role (Admin/User)
- Organization
- Password (optional - only change if user needs password reset)

**Non-Editable Fields:**
- Email address (immutable after account creation)

**Password Change Behavior:**
- Password field is optional during edit
- Leave blank to keep existing password
- If entering a new password, must meet minimum 8 character requirement
- Password confirmation is required if changing password

### View User Details

All authenticated users (both Admin and User roles) can view detailed information about any user account.

**Displayed Information:**
- Email address
- Full name (first and last)
- Role with color-coded label
- Organization
- Account status (Active/Disabled)
- Account creation timestamp
- Last login timestamp (or "Never" if account has never been used)

**Presentation:**
- Clean, read-only interface using PatternFly DescriptionList
- Modal dialog for focused viewing
- Color-coded labels for roles and status
- Formatted timestamps for better readability

### Delete User (Admin Only)

Administrators can delete user accounts with built-in safety mechanisms to prevent accidental or dangerous deletions.

**Safety Checks:**

1. **Self-Deletion Prevention**
   - Users cannot delete their own account
   - Prevents accidental lockout scenarios
   - Error message: "Cannot delete yourself - You cannot delete your own account"

2. **Last Admin Protection**
   - System prevents deletion of the last remaining admin account
   - Ensures administrative access is always maintained
   - Error message: "Cannot delete last admin - At least one admin must exist"

**Deletion Process:**
1. Click the "Delete" button on a user's row
2. Safety checks are performed automatically
3. Confirmation modal appears with the user's full name
4. Confirm deletion to proceed
5. User is permanently removed from the system
6. Success notification is displayed
7. User list automatically refreshes

## Usage Examples

### Creating a New User

1. Navigate to the User Management section in Settings
2. Click the "Create User" button (visible only to admins)
3. Fill in the required fields:
   ```
   Email: john.doe@example.com
   Password: SecurePass123
   Confirm Password: SecurePass123
   First Name: John
   Last Name: Doe
   Role: User
   Organization: Engineering Team
   ```
4. Click "Create User"
5. Success notification confirms user creation
6. New user appears in the user list
7. User can now log in with their credentials

### Editing a User

1. Locate the user in the User Management list
2. Click the "Edit" button for that user (admin only)
3. Modify the desired fields:
   - Update role from "User" to "Admin"
   - Change organization from "Engineering Team" to "QA Team"
   - Update password if needed (or leave blank to keep existing)
4. Click "Update User"
5. Success notification confirms the changes
6. User list refreshes with updated information

### Viewing User Details

1. Locate any user in the User Management list
2. Click the "View Details" button (available to all users)
3. Modal displays complete user information:
   - Email, name, role, organization
   - Account status and creation date
   - Last login timestamp
4. Review the information
5. Click "Close" to return to the user list

### Deleting a User

1. Locate the user to delete in the User Management list
2. Click the "Delete" button (admin only)
3. System performs automatic safety checks:
   - Prevents self-deletion
   - Prevents deletion of last admin
4. Confirmation modal appears if checks pass
5. Review the user's name in the confirmation message
6. Click "Delete" to confirm, or "Cancel" to abort
7. User is removed and list refreshes automatically

## Security Considerations

### Password Policies

**Minimum Length:** Passwords must be at least 8 characters long.

**Rationale:** While this is a basic requirement, it balances security with usability. Organizations may want to implement additional password complexity requirements at the backend level.

**Password Confirmation:** All password entries require confirmation to prevent typos during account creation or password resets.

**Password Storage:** Passwords are transmitted securely to the backend API and should be stored using industry-standard hashing algorithms (bcrypt, argon2, etc.). The frontend never stores or caches passwords.

### Access Control

**Role-Based Restrictions:**
- Admin-only actions are enforced both in the UI (hiding buttons) and at the API level
- Backend API endpoints must validate user roles before processing requests
- Frontend role checks are for UX only - not a security boundary

**Authentication:**
- All API requests require JWT Bearer token authentication
- Tokens should have appropriate expiration times
- Frontend handles token refresh and expiration gracefully

### Safety Mechanisms

**Self-Deletion Prevention:**
- Prevents users from accidentally locking themselves out
- Enforced in frontend before API call
- Should also be enforced at backend level

**Last Admin Protection:**
- Ensures at least one admin always exists in the system
- Frontend counts admin roles before allowing deletion
- Backend should also validate this constraint

**Audit Logging:**
- User creation, modification, and deletion events should be logged at the backend
- Logs should include: timestamp, acting user, action performed, target user
- Enable compliance and security auditing

### Data Validation

**Email Validation:**
- Frontend validates email format using regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Backend should also validate and sanitize email addresses
- Email addresses are case-sensitive for uniqueness checks

**Input Sanitization:**
- All text inputs are trimmed of whitespace before submission
- Backend should sanitize inputs to prevent injection attacks
- Special characters in names and organizations should be properly handled

## API Endpoints

The User Management feature interacts with the following backend API endpoints:

### Base URL
```
/api/v1/auth
```

### List Users
```http
GET /api/v1/users
Authorization: Bearer <JWT_TOKEN>
```

**Authorization:** Admin only

**Response:**
```json
{
  "users": [
    {
      "userId": "john.doe@example.com",
      "name": "John",
      "surname": "Doe",
      "role": "user",
      "organization": "Engineering Team",
      "enabled": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "lastLogin": "2024-02-27T09:15:00Z"
    },
    {
      "userId": "admin@example.com",
      "name": "Admin",
      "surname": "User",
      "role": "admin",
      "organization": "IT",
      "enabled": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLogin": "2024-02-27T14:30:00Z"
    }
  ]
}
```

### Get User
```http
GET /api/v1/users/{userId}
Authorization: Bearer <JWT_TOKEN>
```

**Authorization:** All authenticated users

**URL Parameters:**
- `userId` - The user's email address (URL encoded)

**Response:**
```json
{
  "userId": "john.doe@example.com",
  "name": "John",
  "surname": "Doe",
  "role": "user",
  "organization": "Engineering Team",
  "enabled": true,
  "createdAt": "2024-01-15T10:30:00Z",
  "lastLogin": "2024-02-27T09:15:00Z"
}
```

### Create User
```http
POST /api/v1/users
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Authorization:** Admin only

**Request Body:**
```json
{
  "userId": "john.doe@example.com",
  "password": "SecurePass123",
  "name": "John",
  "surname": "Doe",
  "role": "user",
  "organization": "Engineering Team"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "userId": "john.doe@example.com"
}
```

### Update User
```http
PUT /api/v1/users/{userId}
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Authorization:** Admin only

**URL Parameters:**
- `userId` - The user's email address (URL encoded)

**Request Body:**
```json
{
  "name": "John",
  "surname": "Doe",
  "role": "admin",
  "organization": "IT Department"
}
```

**Optional Password Update:**
```json
{
  "name": "John",
  "surname": "Doe",
  "role": "admin",
  "organization": "IT Department",
  "password": "NewSecurePass456"
}
```

**Response:**
```json
{
  "message": "User updated successfully",
  "userId": "john.doe@example.com"
}
```

### Delete User
```http
DELETE /api/v1/users/{userId}
Authorization: Bearer <JWT_TOKEN>
```

**Authorization:** Admin only

**URL Parameters:**
- `userId` - The user's email address (URL encoded)

**Response:**
```json
{
  "message": "User deleted successfully",
  "userId": "john.doe@example.com"
}
```

### Error Responses

All endpoints may return the following error responses:

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "User not found"
}
```

**400 Bad Request:**
```json
{
  "error": "Validation Error",
  "message": "Invalid email format"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Future Enhancements

The following features are planned for future releases:

### Enhanced Password Policies
- Configurable password complexity requirements
- Password expiration and rotation policies
- Password history to prevent reuse
- Integration with password strength meters

### Advanced User Management
- Bulk user import/export (CSV, LDAP sync)
- User groups and team management
- Custom roles with granular permissions
- User activity tracking and session management

### Account Features
- Account enable/disable toggle (without deletion)
- Account lockout after failed login attempts
- Two-factor authentication (2FA/MFA)
- Email verification workflow

### Audit and Compliance
- Comprehensive audit log viewer in UI
- User activity reports and analytics
- Compliance reporting (SOC2, HIPAA, etc.)
- Data retention policies

### Integration
- LDAP/Active Directory integration
- SAML/OAuth2 single sign-on (SSO)
- API key management for service accounts
- Webhook notifications for user events

### User Experience
- User avatar/profile pictures
- User preferences and settings
- Self-service password reset
- User profile pages with activity history

### Search and Filtering
- Advanced search with multiple criteria
- Filter by role, organization, status
- Sort by any column
- Saved filter presets

---

**Document Version:** 1.0
**Last Updated:** 2024-02-27
**Maintainer:** krkn-operator-console team
