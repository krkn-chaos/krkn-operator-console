# Krkn Operator Console - Requirements

## Overview
Web console for the krkn-operator that orchestrates chaos scenarios. The application interacts with the Operator REST API to manage chaos testing workflows.

## Technology Stack
- **Framework**: React
- **UI Library**: PatternFly (Red Hat's design system)
- **Language**: TypeScript (recommended) or JavaScript
- **Build Tool**: Vite or Create React App
- **HTTP Client**: fetch API or axios

## Architecture
- **Deployment**: Separate deployment from operator (NOT sidecar)
- **Communication**: REST API calls to operator service
- **API Endpoint**: `http://krkn-operator-controller-manager-api-service:8080` (in-cluster)
- **Exposure**: OpenShift Route or Kubernetes Ingress

## Functional Requirements

### 1. Application Initialization Workflow
The application MUST follow this exact paradigm when loading:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. POST /targets                                            │
│    → Get UUID                                               │
│    → Store UUID in app state                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Poll GET /targets/{UUID}                                 │
│    → Every 2-3 seconds                                      │
│    → Until response status = 200 OK                         │
│    → Show loading indicator during polling                 │
│    → Handle errors (404, 100 Continue, timeout)            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. GET /clusters?id={UUID}                                  │
│    → Retrieve available target clusters                    │
│    → Display cluster list to user                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. User selects cluster                                     │
│    → Proceed to chaos orchestration                        │
└─────────────────────────────────────────────────────────────┘
```

### 2. API Endpoints Integration

#### POST /targets
**Purpose**: Initialize a new target request

**Request**:
```http
POST /targets
```

**Response**:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Status Code**: 102 Processing

**UI Action**: Store UUID, transition to polling state

---

#### GET /targets/{UUID}
**Purpose**: Check target request completion status

**Request**:
```http
GET /targets/550e8400-e29b-41d4-a716-446655440000
```

**Status Codes**:
- `200 OK`: Target request completed, proceed to cluster selection
- `100 Continue`: Still processing, keep polling
- `404 Not Found`: UUID not found, show error
- `500 Internal Server Error`: Server error, show error

**UI Action**:
- 200 → Stop polling, fetch clusters
- 100 → Continue polling
- 404/500 → Show error message

---

#### GET /clusters
**Purpose**: Get list of available target clusters

**Request**:
```http
GET /clusters?id=550e8400-e29b-41d4-a716-446655440000
```

**Response**:
```json
{
  "targetData": {
    "acm-operator": [
      {
        "cluster-name": "cluster-1",
        "cluster-api-url": "https://api.cluster1.example.com"
      },
      {
        "cluster-name": "cluster-2",
        "cluster-api-url": "https://api.cluster2.example.com"
      }
    ]
  },
  "status": "Completed"
}
```

**Error Responses**:
```json
// 400 Bad Request
{
  "error": "bad_request",
  "message": "id parameter is required"
}

// 404 Not Found
{
  "error": "not_found",
  "message": "KrknTargetRequest with id 'xyz' not found"
}
```

**UI Action**: Display cluster list in PatternFly DataList or Table

---

#### GET /nodes (Optional - for future enhancement)
**Purpose**: Get nodes from selected cluster

**Request**:
```http
GET /nodes?id={UUID}&cluster-name={cluster-name}
```

**Response**:
```json
{
  "nodes": ["node-1", "node-2", "node-3"]
}
```

**UI Action**: Display node list (future feature)

---

### 3. UI Components

#### 3.1 Loading Screen / Poller Component
**Requirements**:
- Display during POST /targets and polling phase
- PatternFly Spinner component
- Progress message: "Initializing target request..."
- Polling message: "Waiting for target data... (attempt X)"
- Timeout after 60 seconds with error message
- Error handling for failed requests

**PatternFly Components**:
- `Spinner`
- `EmptyState`
- `Progress`

---

#### 3.2 Cluster Selector Component
**Requirements**:
- Display clusters grouped by operator name (e.g., "acm-operator")
- Show cluster name and API URL
- Allow user to select ONE cluster
- Button to proceed after selection
- Visual feedback for selected cluster

**PatternFly Components**:
- `DataList` or `Table`
- `Card` (for grouping by operator)
- `Button` (primary action)
- `Radio` or `Checkbox` (single selection)

**Layout Example**:
```
┌────────────────────────────────────────────────┐
│ Select Target Cluster                         │
├────────────────────────────────────────────────┤
│                                                │
│  ACM Operator                                  │
│  ○ cluster-1                                   │
│    https://api.cluster1.example.com            │
│  ● cluster-2 (selected)                        │
│    https://api.cluster2.example.com            │
│                                                │
│  [Proceed with cluster-2]                      │
└────────────────────────────────────────────────┘
```

---

#### 3.3 Error Handling Component
**Requirements**:
- Display errors from API calls
- Retry button for recoverable errors
- Clear error messages
- Different UI for different error types (404, timeout, network)

**PatternFly Components**:
- `Alert` (danger variant)
- `EmptyState` (with error icon)
- `Button` (retry action)

---

### 4. State Management

**Recommended State Structure**:
```typescript
interface AppState {
  // Workflow state
  phase: 'initializing' | 'polling' | 'selecting_cluster' | 'error';

  // Target request data
  uuid: string | null;
  pollAttempts: number;

  // Cluster data
  clusters: {
    [operatorName: string]: Array<{
      clusterName: string;
      clusterApiUrl: string;
    }>;
  } | null;

  selectedCluster: {
    operatorName: string;
    clusterName: string;
    clusterApiUrl: string;
  } | null;

  // Error state
  error: {
    message: string;
    type: 'network' | 'timeout' | 'api_error' | 'not_found';
  } | null;
}
```

**State Management Options**:
- React Context + useReducer (recommended for simplicity)
- Redux Toolkit (if app grows complex)
- Zustand (lightweight alternative)

---

### 5. Configuration

#### Environment Variables
```env
# API endpoint (configurable for different environments)
REACT_APP_API_URL=http://krkn-operator-controller-manager-api-service:8080

# Polling configuration
REACT_APP_POLL_INTERVAL=3000        # 3 seconds
REACT_APP_POLL_TIMEOUT=60000        # 60 seconds

# Feature flags (future)
REACT_APP_SHOW_NODES=false
```

#### API Service Client
Create a typed API client service:
```typescript
// src/services/operatorApi.ts
class OperatorApiClient {
  baseUrl: string;

  async createTargetRequest(): Promise<{ uuid: string }>;
  async getTargetStatus(uuid: string): Promise<number>; // status code
  async getClusters(uuid: string): Promise<ClustersResponse>;
  async getNodes(uuid: string, clusterName: string): Promise<NodesResponse>;
}
```

---

### 6. Non-Functional Requirements

#### 6.1 Performance
- Initial load < 2 seconds
- API calls with loading states
- Debounce user interactions
- Lazy load heavy PatternFly components

#### 6.2 Accessibility
- PatternFly components are WCAG 2.1 AA compliant by default
- Proper ARIA labels
- Keyboard navigation support
- Screen reader friendly

#### 6.3 Error Resilience
- Network error handling
- API timeout handling (60s)
- Graceful degradation
- Retry mechanisms

#### 6.4 Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ support required
- No IE11 support needed

---

### 7. Deployment

#### 7.1 Docker Container
**Requirements**:
- Nginx to serve static React build
- Nginx config with API proxy (to avoid CORS)
- Multi-stage build (build + serve)
- Small image size (< 50MB)

**Dockerfile Structure**:
```dockerfile
# Stage 1: Build React app
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

#### 7.2 Nginx Configuration
**Requirements**:
- Serve React app on port 8080
- Proxy `/api/*` to operator service (avoid CORS)
- SPA routing (fallback to index.html)

**nginx.conf Example**:
```nginx
server {
  listen 8080;

  location / {
    root /usr/share/nginx/html;
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://krkn-operator-controller-manager-api-service:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

#### 7.3 Kubernetes Deployment
**Required Manifests**:

1. **Deployment** (`k8s/deployment.yaml`)
   - Replicas: 2 (for HA)
   - Image: `quay.io/krkn-chaos/krkn-operator-console:latest`
   - Resources: CPU 100m-200m, Memory 128Mi-256Mi
   - Health probes: `/` endpoint

2. **Service** (`k8s/service.yaml`)
   - Type: ClusterIP
   - Port: 8080
   - Selector: app=krkn-console

3. **Route** (OpenShift) or **Ingress** (Kubernetes)
   - Expose console to external traffic
   - TLS termination

---

### 8. Development Workflow

#### 8.1 Project Structure
```
krkn-operator-console/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── LoadingScreen.tsx
│   │   ├── ClusterSelector.tsx
│   │   ├── ErrorDisplay.tsx
│   │   └── index.ts
│   ├── services/
│   │   ├── operatorApi.ts
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useTargetPoller.ts
│   │   └── index.ts
│   ├── types/
│   │   └── api.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── index.css
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── route.yaml
├── .env.example
├── .gitignore
├── Dockerfile
├── nginx.conf
├── package.json
├── tsconfig.json
├── README.md
└── REQUIREMENTS.md
```

#### 8.2 Development Commands
```bash
# Install dependencies
npm install

# Start development server (proxy to operator API)
npm start

# Build for production
npm run build

# Run tests
npm test

# Build Docker image
docker build -t quay.io/krkn-chaos/krkn-operator-console:latest .

# Push to registry
docker push quay.io/krkn-chaos/krkn-operator-console:latest
```

---

### 9. Testing Requirements

#### 9.1 Unit Tests
- Test API client service
- Test custom hooks (useTargetPoller)
- Test component logic

#### 9.2 Integration Tests
- Mock API responses
- Test full workflow: POST → Poll → GET clusters
- Test error scenarios

#### 9.3 E2E Tests (Optional)
- Cypress or Playwright
- Test against real operator API
- Test user interactions

---

### 10. Future Enhancements (Out of Scope for MVP)

- GET /nodes integration (display nodes after cluster selection)
- Chaos scenario configuration UI
- Real-time status updates (WebSocket)
- Multiple target request management
- Chaos scenario history
- Authentication/Authorization (OAuth, RBAC)
- Multi-language support (i18n)

---

## API Compatibility

**Supported Operator API Version**: v1alpha1

**Minimum Operator Version**: v0.1.0

**API Endpoints Used**:
- POST /targets
- GET /targets/{uuid}
- GET /clusters

---

## Success Criteria

The console is considered complete when:

1. ✅ User can load the application
2. ✅ Application automatically calls POST /targets and gets UUID
3. ✅ Application polls GET /targets/{uuid} until 200 OK
4. ✅ Application displays loading state during polling
5. ✅ Application fetches and displays clusters after polling completes
6. ✅ User can select a cluster from the list
7. ✅ Errors are handled gracefully with retry options
8. ✅ Application is deployable as Docker container
9. ✅ Kubernetes manifests deploy successfully
10. ✅ PatternFly components are used throughout

---

## References

- **Operator API Documentation**: See `krkn-operator/PROGRESS.md`
- **PatternFly React**: https://www.patternfly.org/v4/
- **Operator API Service**: `krkn-operator-controller-manager-api-service:8080`
- **Operator Repository**: `../krkn-operator/`

---

## Notes

- The console is a **client application** - it does NOT manage any chaos scenarios itself
- All chaos orchestration logic remains in the operator
- The console is purely for user interaction and visualization
- Keep the console lightweight and fast
- Follow PatternFly design patterns for consistency


## Scenarios 

### Description
I want to implement a section to select the available chaos scenarios. This must be done querying the 
/scenarios POST method that returns the available scenarios in the registry. The registry can be public or private, in case of private registry a form must be presented to the user to input the required values.

this is the input json payload (in go syntax):

```
type ScenariosRequest struct {
	// Username for private registry authentication (optional)
	Username *string `json:"username,omitempty"`
	// Password for private registry authentication (optional)
	Password *string `json:"password,omitempty"`
	// Token for private registry authentication (optional, alternative to username/password)
	Token *string `json:"token,omitempty"`
	// RegistryURL is the private registry URL (required if using private registry)
	RegistryURL string `json:"registryUrl,omitempty"`
	// ScenarioRepository is the scenario repository name (required if using private registry)
	ScenarioRepository string `json:"scenarioRepository,omitempty"`
	// SkipTLS skips TLS verification for private registry
	SkipTLS bool `json:"skipTls,omitempty"`
	// Insecure allows insecure connections to private registry
	Insecure bool `json:"insecure,omitempty"`
}
```

this is the response payload:

```
type ScenarioTag struct {
	// Name is the scenario tag/version name
	Name string `json:"name"`
	// Digest is the image digest (optional)
	Digest *string `json:"digest,omitempty"`
	// Size is the image size in bytes (optional)
	Size *int64 `json:"size,omitempty"`
	// LastModified is when the scenario was last updated (optional)
	LastModified *time.Time `json:"lastModified,omitempty"`
}
```

## Scenarios/detail

### Description
When a scenario is selected, the scenario detail must be pulled from the api with a POST 
/scenarios/detail/{scenario_id}, the payload must be the same as the /scenarios endpoint using the `ScenariosRequest` object if a private registry is selected or empty in case of quay.io.
The scenario will return an object of the format that can be found in @misc/scenario_detail.json. the purpose is to dynamically build a form based on the types that are available in the typing system.
All the fields types share the following properties:
- name
- short_description
- title
- - that is the label presented in the form for the field
- description
- variable
- - that is the environment variable with which the value will be mapped
- default
- - when provided is the default value for the field
- required
- - if true it's a required field
- type
- - can be:
- - - string
- - - enum
- - - number
- - - file
- - - file_base64
- - - boolean

then there are type specific fields

- string
- - validator
- - - a regex to validate the provided string
- - validation_message
- - - the message to be presented if the validation fails
- enum
- - separator
- - - the separator character used to split the `allowed_values`
- - allowed_values
- the values that the string value can have separated by `separator`
- file
- - the value is a file path
- file_base64
- - the value is a base64 encoded file

The purpose is to build a form based on the provided fields that the respects the above rules.
The type of the input types should be:

- number
- - text that must be validated as a number
- string
- - text that if has a validator must be validated against the provided regex in `validator` and present an error message represented by the `validation_message`
- enum
- - select 
- file
- - file picker
- file_base64
- - file picker (must be base64 encoded before setting the corresponding variable)

In the first iteration, after the form is sent a table with the variable and the value must be presented

## Refactoring action items

- add a back button in all the pages to go to the previous section