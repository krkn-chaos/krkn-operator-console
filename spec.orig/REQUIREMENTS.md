# Multiple targets refactoring

I want to modify the current frontend implementation in a way that is possible to select multiple targets. 
This will affect mainly /targets/run where the UUID will become an array instead of a single target.
- The landing page must be a list of currently running jobs (reporting all the info and the status icon per each row)
- - each row must be an accordion row , on click must be expanded and must show the live logs of the job and a cancel button that must interrupt the job
- in the landing page there must be a Create button that starts the job creation workflow as it is now.
- - Current cluster selection must become a check box instead of a radio button
- Node query on the target can be remove (was only there for demo purposes)

# jobs list refactoring

- jobs list must have two levels ScenarioRun -> jobs
- a new API has been implemented for that purpose `GET api/v1/scenarios/run` returns the list of scenario runs

```json
{
  "scenarioRuns": [
    {
      "scenarioRunName": "node-cpu-hog-8dd43da1",
      "scenarioName": "node-cpu-hog",
      "phase": "Running",
      "totalTargets": 2,
      "successfulJobs": 0,
      "failedJobs": 0,
      "runningJobs": 2,
      "createdAt": "2026-02-03T10:31:53Z"
    }
  ]
}
```

`GET v1/scenarios/run/node-cpu-hog-8dd43da1` returns the list of each job belonging to the scenario run

```json
{
  "scenarioRunName": "node-cpu-hog-8dd43da1",
  "phase": "Running",
  "totalTargets": 2,
  "successfulJobs": 0,
  "failedJobs": 0,
  "runningJobs": 2,
  "clusterJobs": [
    {
      "clusterName": "local-cluster",
      "jobId": "2dead3f6-982a-4534-97e5-c5be2a151382",
      "podName": "krkn-job-2dead3f6-982a-4534-97e5-c5be2a151382",
      "phase": "Running",
      "startTime": "2026-02-03T10:31:53Z"
    },
    {
      "clusterName": "managed-cluster-krkn",
      "jobId": "e5b104bc-c655-4cb4-9464-4da7d9ea8f75",
      "podName": "krkn-job-e5b104bc-c655-4cb4-9464-4da7d9ea8f75",
      "phase": "Running",
      "startTime": "2026-02-03T10:31:53Z"
    }
  ]
}
```

each row must reflect this hierarchy


# jobs and pod deletion

a new deletion logic has been implemented 
-  a deletion button must be placed on the main row, this will delete the whole Scenario run calling the `DELETE scenarios/run/{scenarioRunName}`, the button will be always present
- a deletion button must be add for each sub-rows (if they are running) that will call the `DELETE /v1/scenarios/run/jobs/{jobId}`. The delete button under the logs must be kept and call the same jobId deletion method.

# Adding graphics

I want to add krkn logo placed in static/logo.png in the top bar and a favicon placed in static/logo.ico if needed move the files in the standard folder for static contents


# KrknTarget CRUD

## Description

I want to have a settings icon in the top bar that links to the settings page.
The settings have a user settings section (TODO: let's add a placeholder for the moment), and a cluster settings section. It must allow creation, update and deletion of cluster interacting with the API described below

## API Definition

# KrknOperatorTarget CRUD API - Frontend Requirements

**Base URL**: `http://localhost:8080/api/v1/operator`
**Content-Type**: `application/json`

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/targets` | Create a new target cluster |
| GET | `/targets` | List all target clusters |
| GET | `/targets/{uuid}` | Get a specific target by UUID |
| PUT | `/targets/{uuid}` | Update an existing target |
| DELETE | `/targets/{uuid}` | Delete a target |

---

## 1. Create Target

**Endpoint**: `POST /api/v1/operator/targets`

**Description**: Creates a new target cluster with auto-generated UUID and associated kubeconfig Secret.

### Request Body

```typescript
interface CreateTargetRequest {
  // Required fields
  clusterName: string;        // Unique cluster name
  secretType: "kubeconfig" | "token" | "credentials";  // Authentication method

  // Optional fields (required based on secretType)
  clusterAPIURL?: string;     // API URL (required for token/credentials)
  caBundle?: string;          // Base64-encoded CA bundle (optional)

  // Credentials (provide ONE based on secretType)
  kubeconfig?: string;        // Base64-encoded kubeconfig (for secretType="kubeconfig")
  token?: string;             // Service account token (for secretType="token")
  username?: string;          // Username (for secretType="credentials")
  password?: string;          // Password (for secretType="credentials")
}
```

### Validation Rules

1. **clusterName** is required and must be unique
2. **secretType** is required and must be one of: `kubeconfig`, `token`, `credentials`
3. **Duplicate Prevention**: No two targets can have:
   - Same `clusterName`
   - Same `clusterAPIURL`

4. **For secretType = "kubeconfig"**:
   - `kubeconfig` (base64) is required
   - `clusterAPIURL` is extracted automatically from kubeconfig

5. **For secretType = "token"**:
   - `token` is required
   - `clusterAPIURL` is required
   - `caBundle` is optional (if not provided, TLS verification is skipped)

6. **For secretType = "credentials"**:
   - `username` and `password` are required
   - `clusterAPIURL` is required
   - `caBundle` is optional (if not provided, TLS verification is skipped)

### Example Requests

#### Example 1: Create with Kubeconfig

```bash
curl -X POST http://localhost:8080/api/v1/operator/targets \
  -H "Content-Type: application/json" \
  -d '{
    "clusterName": "production-cluster",
    "secretType": "kubeconfig",
    "kubeconfig": "YXBpVmVyc2lvbjogdjEKa2luZDogQ29uZmlnCmN..."
  }'
```

#### Example 2: Create with Token

```bash
curl -X POST http://localhost:8080/api/v1/operator/targets \
  -H "Content-Type: application/json" \
  -d '{
    "clusterName": "dev-cluster",
    "secretType": "token",
    "clusterAPIURL": "https://api.dev-cluster.example.com:6443",
    "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ik...",
    "caBundle": "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t..."
  }'
```

#### Example 3: Create with Credentials

```bash
curl -X POST http://localhost:8080/api/v1/operator/targets \
  -H "Content-Type: application/json" \
  -d '{
    "clusterName": "test-cluster",
    "secretType": "credentials",
    "clusterAPIURL": "https://api.test-cluster.example.com:6443",
    "username": "admin",
    "password": "secure-password"
  }'
```

### Success Response

**Status Code**: `201 Created`

```json
{
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Target created successfully"
}
```

### Error Responses

#### 400 Bad Request - Missing Required Field

```json
{
  "error": "bad_request",
  "message": "clusterName is required"
}
```

#### 400 Bad Request - Invalid SecretType

```json
{
  "error": "bad_request",
  "message": "secretType must be one of: kubeconfig, token, credentials"
}
```

#### 400 Bad Request - Missing Credentials

```json
{
  "error": "bad_request",
  "message": "token is required when secretType is 'token'"
}
```

#### 409 Conflict - Duplicate Cluster Name

```json
{
  "error": "conflict",
  "message": "Target with clusterName 'production-cluster' already exists"
}
```

#### 409 Conflict - Duplicate API URL

```json
{
  "error": "conflict",
  "message": "Target with clusterAPIURL 'https://api.example.com:6443' already exists"
}
```

#### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "Failed to create secret: <error details>"
}
```

---

## 2. List Targets

**Endpoint**: `GET /api/v1/operator/targets`

**Description**: Returns a list of all registered target clusters.

### Request

No request body required.

### Example Request

```bash
curl -X GET http://localhost:8080/api/v1/operator/targets
```

### Success Response

**Status Code**: `200 OK`

```json
{
  "targets": [
    {
      "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "clusterName": "production-cluster",
      "clusterAPIURL": "https://api.prod.example.com:6443",
      "secretType": "kubeconfig",
      "ready": true,
      "createdAt": "2026-02-06T10:30:00Z"
    },
    {
      "uuid": "b2c3d4e5-f6g7-8901-bcde-fg2345678901",
      "clusterName": "dev-cluster",
      "clusterAPIURL": "https://api.dev.example.com:6443",
      "secretType": "token",
      "ready": true,
      "createdAt": "2026-02-06T11:00:00Z"
    }
  ]
}
```

### Response Fields

```typescript
interface TargetResponse {
  uuid: string;           // Unique identifier
  clusterName: string;    // Cluster name
  clusterAPIURL: string;  // API server URL
  secretType: string;     // "kubeconfig" | "token" | "credentials"
  ready: boolean;         // Whether target is ready to use
  createdAt?: string;     // ISO 8601 timestamp
}

interface ListTargetsResponse {
  targets: TargetResponse[];
}
```

### Error Response

#### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "Failed to list targets: <error details>"
}
```

---

## 3. Get Target by UUID

**Endpoint**: `GET /api/v1/operator/targets/{uuid}`

**Description**: Returns details of a specific target cluster.

### Path Parameters

- `uuid` (string, required): The target UUID

### Example Request

```bash
curl -X GET http://localhost:8080/api/v1/operator/targets/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Success Response

**Status Code**: `200 OK`

```json
{
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "clusterName": "production-cluster",
  "clusterAPIURL": "https://api.prod.example.com:6443",
  "secretType": "kubeconfig",
  "ready": true,
  "createdAt": "2026-02-06T10:30:00Z"
}
```

**Note**: The kubeconfig/token/credentials are **NEVER** returned in the response for security reasons. Only the UUID is used for operations.

### Error Responses

#### 400 Bad Request - Missing UUID

```json
{
  "error": "bad_request",
  "message": "UUID is required"
}
```

#### 404 Not Found

```json
{
  "error": "error",
  "message": "target with UUID 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' not found"
}
```

---

## 4. Update Target

**Endpoint**: `PUT /api/v1/operator/targets/{uuid}`

**Description**: Updates an existing target's credentials and configuration. The kubeconfig Secret is replaced with new credentials.

### Path Parameters

- `uuid` (string, required): The target UUID

### Request Body

Same as `CreateTargetRequest` (all fields are required as this is a full update).

```typescript
interface UpdateTargetRequest {
  clusterName?: string;       // Optional: update cluster name
  secretType: string;         // Required: authentication method
  clusterAPIURL?: string;     // Required for token/credentials
  caBundle?: string;          // Optional

  // Credentials (provide ONE based on secretType)
  kubeconfig?: string;
  token?: string;
  username?: string;
  password?: string;
}
```

### Example Request

```bash
curl -X PUT http://localhost:8080/api/v1/operator/targets/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Content-Type: application/json" \
  -d '{
    "clusterName": "production-cluster-v2",
    "secretType": "token",
    "clusterAPIURL": "https://api.prod-v2.example.com:6443",
    "token": "new-token-here",
    "caBundle": "LS0tLS1CRUdJTi..."
  }'
```

### Success Response

**Status Code**: `200 OK`

```json
{
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Target updated successfully"
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": "bad_request",
  "message": "Invalid request body: <error details>"
}
```

#### 404 Not Found

```json
{
  "error": "error",
  "message": "target with UUID 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' not found"
}
```

#### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "Failed to update secret: <error details>"
}
```

---

## 5. Delete Target

**Endpoint**: `DELETE /api/v1/operator/targets/{uuid}`

**Description**: Deletes a target cluster and its associated kubeconfig Secret.

### Path Parameters

- `uuid` (string, required): The target UUID

### Example Request

```bash
curl -X DELETE http://localhost:8080/api/v1/operator/targets/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Success Response

**Status Code**: `200 OK`

```json
{
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Target deleted successfully"
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": "bad_request",
  "message": "UUID is required"
}
```

#### 404 Not Found

```json
{
  "error": "error",
  "message": "target with UUID 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' not found"
}
```

#### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "Failed to delete target: <error details>"
}
```

---

## Security Considerations

### 🔒 Credentials Handling

1. **Never Exposed**: Kubeconfig, tokens, and passwords are **NEVER** returned in GET responses
2. **UUID-Based Operations**: All operations after creation use only the UUID
3. **Secret Storage**: Credentials are stored securely in Kubernetes Secrets
4. **Base64 Encoding**: Kubeconfig must be base64-encoded when sent to the API
5. **TLS Verification**: When `caBundle` is not provided for token/credentials, TLS verification is skipped (use with caution)

### 🔐 Best Practices

1. **Use HTTPS**: Always use HTTPS in production for the operator API
2. **Token Rotation**: Regularly rotate service account tokens
3. **Minimal Permissions**: Use service accounts with minimal required permissions
4. **Audit Logging**: Monitor and log all CRUD operations
5. **Access Control**: Implement authentication/authorization for the API endpoints

---

## Frontend Implementation Guide

### TypeScript Types

```typescript
// Request types
type SecretType = "kubeconfig" | "token" | "credentials";

interface CreateTargetRequest {
  clusterName: string;
  secretType: SecretType;
  clusterAPIURL?: string;
  caBundle?: string;
  kubeconfig?: string;
  token?: string;
  username?: string;
  password?: string;
}

interface UpdateTargetRequest extends CreateTargetRequest {}

// Response types
interface TargetResponse {
  uuid: string;
  clusterName: string;
  clusterAPIURL: string;
  secretType: string;
  ready: boolean;
  createdAt?: string;
}

interface CreateTargetResponse {
  uuid: string;
  message?: string;
}

interface ListTargetsResponse {
  targets: TargetResponse[];
}

interface ErrorResponse {
  error: string;
  message: string;
}
```

### Example React Hook

```typescript
import { useState } from 'react';

const API_BASE = 'http://localhost:8080/api/v1/operator';

export function useTargets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorResponse | null>(null);

  const createTarget = async (data: CreateTargetRequest): Promise<CreateTargetResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err);
        return null;
      }

      return await response.json();
    } catch (err) {
      setError({ error: 'network_error', message: String(err) });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const listTargets = async (): Promise<TargetResponse[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/targets`);

      if (!response.ok) {
        const err = await response.json();
        setError(err);
        return [];
      }

      const data: ListTargetsResponse = await response.json();
      return data.targets;
    } catch (err) {
      setError({ error: 'network_error', message: String(err) });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getTarget = async (uuid: string): Promise<TargetResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/targets/${uuid}`);

      if (!response.ok) {
        const err = await response.json();
        setError(err);
        return null;
      }

      return await response.json();
    } catch (err) {
      setError({ error: 'network_error', message: String(err) });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateTarget = async (uuid: string, data: UpdateTargetRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/targets/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err);
        return false;
      }

      return true;
    } catch (err) {
      setError({ error: 'network_error', message: String(err) });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteTarget = async (uuid: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/targets/${uuid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err);
        return false;
      }

      return true;
    } catch (err) {
      setError({ error: 'network_error', message: String(err) });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createTarget,
    listTargets,
    getTarget,
    updateTarget,
    deleteTarget,
  };
}
```

### Form Validation Example

```typescript
function validateCreateTarget(data: CreateTargetRequest): string[] {
  const errors: string[] = [];

  if (!data.clusterName) {
    errors.push('Cluster name is required');
  }

  if (!data.secretType) {
    errors.push('Secret type is required');
  }

  switch (data.secretType) {
    case 'kubeconfig':
      if (!data.kubeconfig) {
        errors.push('Kubeconfig is required for kubeconfig auth');
      }
      break;

    case 'token':
      if (!data.token) {
        errors.push('Token is required for token auth');
      }
      if (!data.clusterAPIURL) {
        errors.push('Cluster API URL is required for token auth');
      }
      break;

    case 'credentials':
      if (!data.username || !data.password) {
        errors.push('Username and password are required for credentials auth');
      }
      if (!data.clusterAPIURL) {
        errors.push('Cluster API URL is required for credentials auth');
      }
      break;

    default:
      errors.push('Invalid secret type');
  }

  return errors;
}
```

---

## Testing with cURL

### Complete Test Flow

```bash
# 1. Create a target
UUID=$(curl -s -X POST http://localhost:8080/api/v1/operator/targets \
  -H "Content-Type: application/json" \
  -d '{
    "clusterName": "test-cluster",
    "secretType": "token",
    "clusterAPIURL": "https://api.test.com:6443",
    "token": "test-token"
  }' | jq -r '.uuid')

echo "Created target with UUID: $UUID"

# 2. List all targets
curl -s http://localhost:8080/api/v1/operator/targets | jq

# 3. Get specific target
curl -s http://localhost:8080/api/v1/operator/targets/$UUID | jq

# 4. Update target
curl -s -X PUT http://localhost:8080/api/v1/operator/targets/$UUID \
  -H "Content-Type: application/json" \
  -d '{
    "clusterName": "test-cluster-updated",
    "secretType": "token",
    "clusterAPIURL": "https://api.test-v2.com:6443",
    "token": "new-token"
  }' | jq

# 5. Delete target
curl -s -X DELETE http://localhost:8080/api/v1/operator/targets/$UUID | jq
```

---

## FAQ

### Q: How do I encode a kubeconfig file to base64?

```bash
# Linux/macOS
base64 -w 0 kubeconfig.yaml

# Or in the API call
KUBECONFIG_BASE64=$(cat kubeconfig.yaml | base64 -w 0)
```

### Q: Can I update just the cluster name without changing credentials?

No, the PUT endpoint requires all fields. You must provide the complete configuration including credentials.

### Q: What happens to the Secret when I delete a target?

The associated Kubernetes Secret is automatically deleted along with the KrknOperatorTarget CR.

### Q: How do I know if a target is ready to use?

Check the `ready` field in the response. A target is ready when `ready: true`.

### Q: Can I have multiple targets pointing to the same cluster?

No, duplicate `clusterAPIURL` values are not allowed. Each API URL must be unique.

### Q: What is the UUID used for?

The UUID is the unique identifier for the target. It's used as:
- The name of the KrknOperatorTarget CR
- The reference in scenario runs (targetUUIDs array)
- The lookup key for all CRUD operations

---

## Related Documentation

- [Scenario Run API](./API_SCENARIOS.md) - How to use target UUIDs in scenario runs
- [KrknTargetRequest Flow](./IMPLEMENTATION_PLAN_KRKN_TARGET_REQUEST.md) - How targets are populated into KrknTargetRequest
- [Security Best Practices](./SECURITY.md) - Security considerations for production deployments
