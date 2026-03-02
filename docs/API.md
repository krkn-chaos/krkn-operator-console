# API Documentation

This document describes the REST API endpoints used by the krkn-operator-console.

## Table of Contents

- [Authentication](#authentication)
- [User Management Endpoints](#user-management-endpoints)
- [Error Responses](#error-responses)

## Authentication

All API endpoints require authentication using JWT Bearer tokens.

**Header Format:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Token Acquisition:**
Tokens are obtained through the login endpoint and stored in the browser's session/local storage.

**Token Expiration:**
Tokens have a limited lifetime and should be refreshed before expiration. The frontend automatically handles token refresh where supported.

---

## User Management Endpoints

Base URL: `/api/v1/auth`

### List Users

Retrieves a complete list of all user accounts in the system.

**Endpoint:** `GET /api/v1/users`

**Authorization:** Admin only

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:** None

**Success Response:**

**Status Code:** `200 OK`

**Content-Type:** `application/json`

**Body:**
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
      "organization": "IT Department",
      "enabled": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLogin": "2024-02-27T14:30:00Z"
    }
  ]
}
```

**Response Fields:**
- `users` (array) - List of user objects
  - `userId` (string) - User's email address (unique identifier)
  - `name` (string) - First name
  - `surname` (string) - Last name
  - `role` (string) - User role: "user" or "admin"
  - `organization` (string, optional) - Organization affiliation
  - `enabled` (boolean) - Account status (true=active, false=disabled)
  - `createdAt` (string, ISO 8601) - Account creation timestamp
  - `lastLogin` (string, ISO 8601, optional) - Last successful login timestamp

**Example Request:**
```bash
curl -X GET \
  'https://api.example.com/api/v1/users' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

---

### Get User

Retrieves detailed information for a specific user account.

**Endpoint:** `GET /api/v1/users/{userId}`

**Authorization:** All authenticated users

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**URL Parameters:**
- `userId` (required) - User's email address (URL encoded)

**Query Parameters:** None

**Success Response:**

**Status Code:** `200 OK`

**Content-Type:** `application/json`

**Body:**
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

**Response Fields:**
- `userId` (string) - User's email address
- `name` (string) - First name
- `surname` (string) - Last name
- `role` (string) - User role: "user" or "admin"
- `organization` (string, optional) - Organization affiliation
- `enabled` (boolean) - Account status
- `createdAt` (string, ISO 8601) - Account creation timestamp
- `lastLogin` (string, ISO 8601, optional) - Last login timestamp

**Example Request:**
```bash
curl -X GET \
  'https://api.example.com/api/v1/users/john.doe%40example.com' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

---

### Create User

Creates a new user account with the specified credentials and profile information.

**Endpoint:** `POST /api/v1/users`

**Authorization:** Admin only

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "jane.smith@example.com",
  "password": "SecurePass123",
  "name": "Jane",
  "surname": "Smith",
  "role": "user",
  "organization": "QA Team"
}
```

**Request Fields:**
- `userId` (string, required) - Email address (unique identifier)
  - Must be valid email format
  - Will be validated for uniqueness
- `password` (string, required) - User password
  - Minimum 8 characters
  - Should meet security requirements
- `name` (string, required) - First name
- `surname` (string, required) - Last name
- `role` (string, required) - User role: "user" or "admin"
- `organization` (string, optional) - Organization affiliation

**Success Response:**

**Status Code:** `201 Created`

**Content-Type:** `application/json`

**Body:**
```json
{
  "message": "User created successfully",
  "userId": "jane.smith@example.com"
}
```

**Response Fields:**
- `message` (string) - Success message
- `userId` (string) - The created user's email address

**Example Request:**
```bash
curl -X POST \
  'https://api.example.com/api/v1/users' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "jane.smith@example.com",
    "password": "SecurePass123",
    "name": "Jane",
    "surname": "Smith",
    "role": "user",
    "organization": "QA Team"
  }'
```

---

### Update User

Updates an existing user's profile information and optionally changes their password.

**Endpoint:** `PUT /api/v1/users/{userId}`

**Authorization:** Admin only

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**URL Parameters:**
- `userId` (required) - User's email address (URL encoded)

**Request Body:**

**Update profile only:**
```json
{
  "name": "John",
  "surname": "Smith",
  "role": "admin",
  "organization": "IT Department"
}
```

**Update profile with password change:**
```json
{
  "name": "John",
  "surname": "Smith",
  "role": "admin",
  "organization": "IT Department",
  "password": "NewSecurePass456"
}
```

**Request Fields:**
- `name` (string, required) - First name
- `surname` (string, required) - Last name
- `role` (string, required) - User role: "user" or "admin"
- `organization` (string, optional) - Organization affiliation
- `password` (string, optional) - New password (min 8 characters if provided)

**Note:** The `userId` (email) cannot be changed. To change a user's email, create a new account and delete the old one.

**Success Response:**

**Status Code:** `200 OK`

**Content-Type:** `application/json`

**Body:**
```json
{
  "message": "User updated successfully",
  "userId": "john.doe@example.com"
}
```

**Response Fields:**
- `message` (string) - Success message
- `userId` (string) - The updated user's email address

**Example Request:**
```bash
curl -X PUT \
  'https://api.example.com/api/v1/users/john.doe%40example.com' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "John",
    "surname": "Smith",
    "role": "admin",
    "organization": "IT Department"
  }'
```

---

### Delete User

Permanently deletes a user account from the system.

**Endpoint:** `DELETE /api/v1/users/{userId}`

**Authorization:** Admin only

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**URL Parameters:**
- `userId` (required) - User's email address (URL encoded)

**Request Body:** None

**Success Response:**

**Status Code:** `200 OK`

**Content-Type:** `application/json`

**Body:**
```json
{
  "message": "User deleted successfully",
  "userId": "old.user@example.com"
}
```

**Response Fields:**
- `message` (string) - Success message
- `userId` (string) - The deleted user's email address

**Safety Checks:**
The backend should enforce these safety restrictions:
- Users cannot delete their own account (self-deletion prevention)
- Cannot delete the last remaining admin account (system protection)

These checks are performed in both the frontend and backend for defense in depth.

**Example Request:**
```bash
curl -X DELETE \
  'https://api.example.com/api/v1/users/old.user%40example.com' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

---

## Error Responses

All endpoints may return the following standard error responses:

### 400 Bad Request

Indicates validation errors or malformed requests.

**Status Code:** `400 Bad Request`

**Content-Type:** `application/json`

**Common Scenarios:**
- Invalid email format
- Password too short
- Missing required fields
- Validation constraint violations
- Attempting to delete self or last admin

**Example Response:**
```json
{
  "error": "Validation Error",
  "message": "Invalid email format"
}
```

**Additional Examples:**
```json
{
  "error": "Validation Error",
  "message": "Password must be at least 8 characters"
}
```

```json
{
  "error": "Validation Error",
  "message": "Cannot delete yourself"
}
```

```json
{
  "error": "Validation Error",
  "message": "Cannot delete last admin - at least one admin must exist"
}
```

---

### 401 Unauthorized

Indicates missing or invalid authentication credentials.

**Status Code:** `401 Unauthorized`

**Content-Type:** `application/json`

**Common Scenarios:**
- Missing Authorization header
- Invalid JWT token
- Expired JWT token
- Malformed token

**Example Response:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**Additional Examples:**
```json
{
  "error": "Unauthorized",
  "message": "No authorization token provided"
}
```

---

### 403 Forbidden

Indicates insufficient permissions for the requested operation.

**Status Code:** `403 Forbidden`

**Content-Type:** `application/json`

**Common Scenarios:**
- Non-admin user attempting admin-only operations
- Role-based access control (RBAC) denial
- Valid authentication but insufficient privileges

**Example Response:**
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

**Additional Examples:**
```json
{
  "error": "Forbidden",
  "message": "Admin role required for this operation"
}
```

---

### 404 Not Found

Indicates the requested resource does not exist.

**Status Code:** `404 Not Found`

**Content-Type:** `application/json`

**Common Scenarios:**
- User ID not found in database
- Invalid endpoint path
- Deleted user referenced

**Example Response:**
```json
{
  "error": "Not Found",
  "message": "User not found"
}
```

**Additional Examples:**
```json
{
  "error": "Not Found",
  "message": "User with email 'missing@example.com' does not exist"
}
```

---

### 409 Conflict

Indicates a conflict with the current state of the resource.

**Status Code:** `409 Conflict`

**Content-Type:** `application/json`

**Common Scenarios:**
- Attempting to create user with existing email
- Duplicate resource creation
- Concurrent modification conflicts

**Example Response:**
```json
{
  "error": "Conflict",
  "message": "User already exists"
}
```

**Additional Examples:**
```json
{
  "error": "Conflict",
  "message": "A user with email 'john.doe@example.com' already exists"
}
```

---

### 500 Internal Server Error

Indicates an unexpected server-side error.

**Status Code:** `500 Internal Server Error`

**Content-Type:** `application/json`

**Common Scenarios:**
- Database connection failures
- Unhandled exceptions
- Service unavailability
- Configuration errors

**Example Response:**
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

**Additional Examples:**
```json
{
  "error": "Internal Server Error",
  "message": "Database connection failed"
}
```

---

## Best Practices

### Frontend Error Handling

The frontend should handle API errors gracefully:

```typescript
try {
  const response = await usersApi.createUser(userData);
  showSuccess('User created successfully');
} catch (error) {
  if (error instanceof Error) {
    // Parse error message from API
    showError('Failed to create user', error.message);
  } else {
    showError('Failed to create user', 'Unknown error');
  }
}
```

### Token Management

- Store JWT tokens securely (httpOnly cookies preferred, or sessionStorage)
- Implement automatic token refresh before expiration
- Clear tokens on logout
- Redirect to login on 401 errors

### Rate Limiting

Clients should implement:
- Exponential backoff on failures
- Request throttling for bulk operations
- Respect retry-after headers if provided

### Security

- Always use HTTPS in production
- Never log or display JWT tokens
- Validate all user inputs before sending
- Sanitize error messages shown to users

---

**Document Version:** 1.0
**Last Updated:** 2024-02-27
**API Version:** v1
