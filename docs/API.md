# API Documentation

This document describes the REST API endpoints used by the krkn-operator-console.

## Table of Contents

- [Authentication](#authentication)
- [Registry Management Endpoints](#registry-management-endpoints)
- [Scenario Endpoints](#scenario-endpoints)
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

## Registry Management Endpoints

Base URL: `/api/v1/registries`

Private container registry management allows administrators to configure registries for chaos scenario images and control access via group membership.

### List Registries (Admin)

Retrieves all private registries configured in the system.

**Endpoint:** `GET /api/v1/registries`

**Authorization:** Admin only

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Success Response:**

**Status Code:** `200 OK`

**Body:**
```json
{
  "registries": [
    {
      "name": "production-registry",
      "registryUrl": "registry.example.com",
      "scenarioRepository": "myorg/chaos-scenarios",
      "authType": "token",
      "description": "Production private registry for team scenarios",
      "skipTls": false,
      "insecure": false,
      "groups": ["ops-team", "qa-team"],
      "availableToAll": false,
      "createdAt": "2024-03-01T10:00:00Z",
      "createdBy": "admin@example.com"
    }
  ]
}
```

**Response Fields:**
- `registries` (array) - List of registry configurations
  - `name` (string) - Registry identifier (RFC 1123 compliant)
  - `registryUrl` (string) - Container registry URL
  - `scenarioRepository` (string) - Repository path (format: org/repo)
  - `authType` (string) - Authentication type: "token" or "password"
  - `description` (string, optional) - Registry description
  - `skipTls` (boolean) - Skip TLS verification flag
  - `insecure` (boolean) - Allow insecure HTTP connections
  - `groups` (array of strings) - Groups with access
  - `availableToAll` (boolean) - If true, all users can access
  - `createdAt` (string, ISO 8601, optional) - Creation timestamp
  - `createdBy` (string, optional) - Creator email

**Note:** Credentials (token, username, password) are never returned in responses for security.

---

### Get Registry (Admin)

Retrieves a specific registry configuration.

**Endpoint:** `GET /api/v1/registries/{name}`

**Authorization:** Admin only

**URL Parameters:**
- `name` (required) - Registry name

**Success Response:**

**Status Code:** `200 OK`

**Body:** Same as single registry object from list endpoint

---

### Create Registry (Admin)

Creates a new private registry configuration.

**Endpoint:** `POST /api/v1/registries`

**Authorization:** Admin only

**Request Body (Token Auth):**
```json
{
  "name": "my-registry",
  "registryUrl": "registry.example.com",
  "scenarioRepository": "myorg/scenarios",
  "authType": "token",
  "token": "my-secret-token",
  "description": "Private registry for team A",
  "skipTls": false,
  "insecure": false,
  "groups": ["team-a"],
  "availableToAll": false
}
```

**Request Body (Password Auth):**
```json
{
  "name": "dockerhub-private",
  "registryUrl": "registry.hub.docker.com",
  "scenarioRepository": "myuser/scenarios",
  "authType": "password",
  "username": "myusername",
  "password": "mypassword",
  "availableToAll": true
}
```

**Request Fields:**
- `name` (string, required) - Registry name (RFC 1123: lowercase alphanumeric, -, .)
- `registryUrl` (string, required) - Valid URL
- `scenarioRepository` (string, required) - Format: org/repo
- `authType` (string, required) - "token" or "password"
- `token` (string, required if authType=token) - Registry token
- `username` (string, required if authType=password) - Username
- `password` (string, required if authType=password) - Password
- `description` (string, optional) - Description
- `skipTls` (boolean, optional) - Skip TLS verification (default: false)
- `insecure` (boolean, optional) - Allow HTTP (default: false)
- `groups` (array of strings, optional) - Groups with access
- `availableToAll` (boolean, optional) - All users access (default: false)

**Success Response:**

**Status Code:** `201 Created`

**Body:**
```json
{
  "name": "my-registry",
  "message": "Registry created successfully"
}
```

---

### Update Registry (Admin)

Updates an existing registry configuration.

**Endpoint:** `PUT /api/v1/registries/{name}`

**Authorization:** Admin only

**URL Parameters:**
- `name` (required) - Registry name (immutable)

**Request Body:**
All fields from create are optional in update. Credentials can be omitted to keep existing values.

```json
{
  "description": "Updated description",
  "groups": ["team-a", "team-b"]
}
```

**Success Response:**

**Status Code:** `200 OK`

**Body:**
```json
{
  "name": "my-registry",
  "message": "Registry updated successfully"
}
```

---

### Delete Registry (Admin)

Permanently deletes a registry configuration.

**Endpoint:** `DELETE /api/v1/registries/{name}`

**Authorization:** Admin only

**URL Parameters:**
- `name` (required) - Registry name

**Success Response:**

**Status Code:** `200 OK`

**Body:**
```json
{
  "name": "my-registry",
  "message": "Registry deleted successfully"
}
```

**Warning:** Deleting a registry may cause active scenario runs using it to fail.

---

### Get Available Registries (User)

Retrieves registries accessible to the current user based on group membership.

**Endpoint:** `GET /api/v1/registries/available`

**Authorization:** All authenticated users

**Success Response:**

**Status Code:** `200 OK`

**Body:**
```json
{
  "registries": [
    {
      "name": "team-registry",
      "registryUrl": "registry.example.com",
      "scenarioRepository": "team/scenarios",
      "description": "Team private registry"
    }
  ]
}
```

**Response Fields:**
- `name` (string) - Registry name
- `registryUrl` (string) - Container registry URL
- `scenarioRepository` (string) - Repository path
- `description` (string, optional) - Description

**Note:** Response excludes credentials, authType, and group membership for security.

**Access Rules:**
- Users see registries where they are members of assigned groups
- Users see all registries with `availableToAll=true`
- Admins see all registries

---

## Scenario Endpoints

Base URL: `/api/v1/scenarios`

### Load Scenarios

Retrieves available chaos scenarios from a registry.

**Endpoint:** `POST /api/v1/scenarios`

**Authorization:** All authenticated users

**Request Body:**
```json
{
  "registryName": "my-registry"
}
```

**Request Fields:**
- `registryName` (string, optional) - Name of configured private registry. If omitted, defaults to public quay.io

**Success Response:**

**Status Code:** `200 OK`

**Body:**
```json
{
  "scenarios": [
    {
      "name": "pod-scenarios",
      "digest": "sha256:abc123...",
      "size": 1234567,
      "lastModified": "2024-03-01T10:00:00Z"
    }
  ]
}
```

---

### Get Scenario Detail

Retrieves detailed schema for a specific scenario.

**Endpoint:** `POST /api/v1/scenarios/detail/{name}`

**URL Parameters:**
- `name` (required) - Scenario name

**Request Body:**
```json
{
  "registryName": "my-registry"
}
```

**Success Response:**

**Status Code:** `200 OK`

**Body:** Scenario field schema (see types/api.ts for full schema)

---

### Run Scenario

Executes a chaos scenario on selected clusters.

**Endpoint:** `POST /api/v1/scenarios/run`

**Request Body:**
```json
{
  "targetRequestId": "uuid",
  "targetClusters": {
    "krkn-operator": ["cluster-1", "cluster-2"]
  },
  "scenarioImage": "krkn-hub:pod-scenarios",
  "scenarioName": "pod-scenarios",
  "kubeconfigPath": "/home/krkn/.kube/config",
  "environment": {
    "SCENARIO_TYPE": "pod_delete"
  },
  "registryName": "my-registry"
}
```

**Request Fields:**
- `registryName` (string, optional) - Private registry name. If omitted, uses default quay.io

**Success Response:**

**Status Code:** `200 OK`

**Body:**
```json
{
  "scenarioRunName": "run-abc123",
  "targetClusters": {
    "krkn-operator": ["cluster-1", "cluster-2"]
  },
  "totalTargets": 2
}
```

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

**Endpoint:** `PATCH /api/v1/users/{userId}`

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
