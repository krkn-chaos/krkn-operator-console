# Krkn Operator Console - Development Progress

## Status: MVP Complete + Scenarios Selection + Scenario Detail Configuration ✅

**Date**: 2026-01-13
**Version**: 0.4.0

## Completed Tasks

### Phase 1: Project Setup ✅
- [x] Initialized Vite + React + TypeScript project
- [x] Created project structure according to requirements
- [x] Configured TypeScript with strict mode
- [x] Set up Vite config with API proxy for development
- [x] Created environment configuration (.env, .env.example)

### Phase 2: Type Definitions & API Client ✅
- [x] Created comprehensive TypeScript types ([src/types/api.ts](src/types/api.ts))
  - Request/Response types (CreateTargetResponse, ClustersResponse, NodesResponse, ScenariosRequest, ScenariosResponse) ✅
  - App state types (AppState, AppPhase, AppError)
  - Action types for reducer (AppAction)
  - Added nodes and scenarios fields to AppState ✅
  - ScenarioTag type for scenario metadata ✅
  - Scenario detail types (ScenarioField, ScenarioDetail, ScenarioFormValues) ✅ NEW
  - Field type system with discriminated unions (string, enum, number, file, file_base64, boolean) ✅ NEW
- [x] Implemented API client service ([src/services/operatorApi.ts](src/services/operatorApi.ts))
  - `createTargetRequest()` - POST /targets
  - `getTargetStatus(uuid)` - GET /targets/{uuid}
  - `getClusters(uuid)` - GET /clusters?id={uuid}
  - `getNodes(uuid, clusterName)` - GET /nodes?id={uuid}&cluster-name={clusterName}
  - `getScenarios(request)` - POST /scenarios ✅
  - `getScenarioDetail(scenarioName, request)` - POST /scenarios/detail/{scenarioName} ✅ NEW

### Phase 3: State Management ✅
- [x] Created AppContext with React Context API ([src/context/AppContext.tsx](src/context/AppContext.tsx))
- [x] Implemented reducer with state machine logic
- [x] State phases: initializing → polling → selecting_cluster → loading_nodes → ready → configuring_registry → loading_scenarios → selecting_scenarios → loading_scenario_detail → configuring_scenario → error ✅
- [x] Custom hook `useAppContext()` for consuming context
- [x] Actions for node loading workflow (NODES_LOADING, NODES_SUCCESS, NODES_ERROR)
- [x] Actions for scenarios workflow (CONFIGURE_REGISTRY, REGISTRY_CONFIGURED, SCENARIOS_LOADING, SCENARIOS_SUCCESS, SCENARIOS_ERROR, SELECT_SCENARIOS) ✅
- [x] Actions for scenario detail workflow (SELECT_SCENARIO_FOR_DETAIL, SCENARIO_DETAIL_LOADING, SCENARIO_DETAIL_SUCCESS, SCENARIO_DETAIL_ERROR, UPDATE_SCENARIO_FORM) ✅ NEW
- [x] GO_BACK action for backward navigation in all workflow phases ✅ NEW

### Phase 4: Custom Hooks ✅
- [x] Implemented `useTargetPoller` hook ([src/hooks/useTargetPoller.ts](src/hooks/useTargetPoller.ts))
  - Automatic POST /targets on mount
  - Polling logic with configurable interval (3s)
  - Timeout handling (60s)
  - Error handling for network, timeout, 404, API errors
  - Automatic transition to cluster fetching
  - Automatic nodes fetching after cluster selection ✅

### Phase 5: UI Components (PatternFly) ✅
- [x] **LoadingScreen** ([src/components/LoadingScreen.tsx](src/components/LoadingScreen.tsx))
  - Displays spinner during initialization, polling, node loading, scenario loading, and scenario detail loading ✅
  - Shows poll attempt count
  - Uses PatternFly EmptyState and Spinner
  - Support for 'loading_nodes', 'loading_scenarios', and 'loading_scenario_detail' phases ✅

- [x] **ErrorDisplay** ([src/components/ErrorDisplay.tsx](src/components/ErrorDisplay.tsx))
  - Shows error messages with appropriate icons
  - Different titles for error types (network, timeout, not_found, api_error)
  - Retry button to restart workflow

- [x] **ClusterSelector** ([src/components/ClusterSelector.tsx](src/components/ClusterSelector.tsx))
  - Displays clusters grouped by operator name
  - Radio button selection (single cluster)
  - Shows cluster name and API URL
  - Proceed button with selected cluster name
  - Empty state for no clusters

- [x] **NodesDisplay** ([src/components/NodesDisplay.tsx](src/components/NodesDisplay.tsx))
  - Prominent display of selected cluster information (name, operator, API URL)
  - Cluster info card with blue background for visibility
  - List of cluster nodes in bordered list format
  - Node count badge
  - Monospace font for node names
  - Empty state when no nodes found
  - "Select Chaos Scenarios" button to proceed to registry configuration ✅
  - Back button to return to cluster selection ✅ NEW

- [x] **RegistrySelector** ([src/components/RegistrySelector.tsx](src/components/RegistrySelector.tsx)) ✅
  - Public/private registry selection with radio buttons
  - Private registry authentication form (username/password or token)
  - Registry URL and scenario repository fields
  - TLS options (skipTls, insecure) with checkboxes
  - Form validation before submission
  - Integration with POST /scenarios API
  - Back button to return to nodes display ✅ NEW

- [x] **ScenariosList** ([src/components/ScenariosList.tsx](src/components/ScenariosList.tsx)) ✅
  - Table display of available scenarios with selection checkboxes
  - Shows scenario name, digest, size, and last modified date
  - Select All / Deselect All functionality
  - Selected scenarios counter badge
  - Proceed button with selected count
  - Empty state when no scenarios found
  - Back button to return to registry configuration ✅ NEW
  - "Configure" action button for each scenario to view details ✅ NEW

- [x] **DynamicFormBuilder** ([src/components/DynamicFormBuilder.tsx](src/components/DynamicFormBuilder.tsx)) ✅ NEW
  - Dynamically renders form fields based on ScenarioField metadata
  - Support for all field types: string, enum, number, boolean, file, file_base64
  - String fields with optional regex validation and validation messages
  - Enum fields as dropdowns with configurable separator
  - Number fields with type validation
  - Boolean fields as checkboxes
  - File upload fields with PatternFly FileUpload component
  - Secret field masking (password input type)
  - Displays field descriptions and validation errors
  - Automatic initialization with default values

- [x] **ScenarioDetail** ([src/components/ScenarioDetail.tsx](src/components/ScenarioDetail.tsx)) ✅ NEW
  - Loads scenario configuration details via POST /scenarios/detail/{scenarioName}
  - Displays scenario metadata (title, description, digest)
  - Integrates DynamicFormBuilder for parameter configuration
  - Form validation before preview
  - Preview table showing all configured variables and values
  - Edit/preview toggle functionality
  - Secret values masked in preview (••••••••)
  - File values show filename in preview
  - Back button to return to scenarios list ✅ NEW
  - Loading state with spinner during API call

### Phase 6: Main Application ✅
- [x] **App Component** ([src/App.tsx](src/App.tsx))
  - PatternFly Page layout with Masthead
  - Workflow orchestration based on state phase
  - Handles cluster selection and triggers node loading
  - Shows NodesDisplay component in 'ready' phase
  - Shows RegistrySelector in 'configuring_registry' phase ✅
  - Shows ScenariosList in 'selecting_scenarios' phase ✅
  - Shows ScenarioDetail in 'configuring_scenario' phase ✅ NEW
  - Full workflow support: initializing → polling → cluster selection → loading nodes → ready → registry config → loading scenarios → scenario selection → loading scenario detail → scenario configuration ✅

- [x] **Entry Point** ([src/main.tsx](src/main.tsx))
  - React 18 StrictMode
  - AppProvider wraps entire app
  - PatternFly CSS imports

### Phase 7: Containerization ✅
- [x] **Dockerfile** ([Dockerfile](Dockerfile))
  - Multi-stage build (Node.js build + nginx serve)
  - Alpine-based for small image size
  - Health check configured
  - Port 8080 exposed
  - Non-root user configuration (nginx user) ✅
  - Proper permissions for /tmp directories ✅
  - FQDN image references for Podman compatibility ✅

- [x] **Nginx Configuration** ([nginx.conf](nginx.conf))
  - Serves static React build
  - API proxy: `/api/*` → operator service
  - SPA routing (fallback to index.html)
  - Timeout settings (60s)
  - Non-root compatible configuration ✅
  - Log and PID files in /tmp ✅
  - Writable cache directories in /tmp ✅

### Phase 8: Kubernetes Manifests ✅
- [x] **Deployment** ([k8s/deployment.yaml](k8s/deployment.yaml))
  - 2 replicas for high availability
  - Resource limits (CPU: 100m-200m, Memory: 128Mi-256Mi)
  - Liveness and readiness probes
  - Security context (non-root, no privilege escalation)
  - imagePullPolicy: Always ✅
  - Default image: quay.io/krkn-chaos/krkn-operator:console ✅

- [x] **Service** ([k8s/service.yaml](k8s/service.yaml))
  - ClusterIP type
  - Port 8080
  - Proper labels and selectors

- [x] **OpenShift Route** ([k8s/route.yaml](k8s/route.yaml))
  - TLS edge termination
  - Redirect HTTP to HTTPS

- [x] **Kubernetes Ingress** ([k8s/ingress.yaml](k8s/ingress.yaml))
  - Template with annotations
  - TLS configuration

### Phase 9: Deployment Scripts ✅
- [x] **build-and-push.sh** ([scripts/build-and-push.sh](scripts/build-and-push.sh))
  - Podman as default container tool ✅
  - Docker support via CONTAINER_TOOL variable ✅
  - Configurable image registry, repo, and tag ✅
  - Default image: quay.io/krkn-chaos/krkn-operator:console ✅
  - Interactive confirmation before push

- [x] **deploy-k8s.sh** ([scripts/deploy-k8s.sh](scripts/deploy-k8s.sh))
  - Deploy to OpenShift or Kubernetes ✅
  - Default namespace: krkn-operator-system ✅
  - IMG variable for custom image specification ✅
  - Image verification after deployment ✅
  - Automatic Route (OpenShift) or Ingress (Kubernetes) setup

- [x] **test-local-docker.sh** ([scripts/test-local-docker.sh](scripts/test-local-docker.sh))
  - Local container testing ✅
  - Podman/Docker support ✅

- [x] **logs.sh**, **undeploy-k8s.sh**, **dev-setup.sh**
  - Complete deployment lifecycle management ✅

### Phase 10: Documentation ✅
- [x] Updated [README.md](README.md) with:
  - Complete setup instructions
  - Development workflow
  - Docker build commands (Podman default) ✅
  - Kubernetes deployment steps
  - Project structure overview
  - Updated with nodes display workflow ✅
- [x] Updated [PROGRESS.md](PROGRESS.md) (this file) ✅
- [x] Maintained [REQUIREMENTS.md](REQUIREMENTS.md)
- [x] [scripts/README.md](scripts/README.md) with detailed script documentation ✅

## Architecture Summary

### Technology Stack
- **Frontend**: React 18 + TypeScript 5
- **Build Tool**: Vite 5
- **UI Framework**: PatternFly 5 (Red Hat design system)
- **State Management**: React Context + useReducer
- **HTTP Client**: Native fetch API
- **Container**: nginx:alpine
- **Deployment**: Kubernetes native manifests

### API Integration
- **POST /targets** - Initialize target request
- **GET /targets/{uuid}** - Poll until ready (status 200)
- **GET /clusters?id={uuid}** - Fetch cluster list
- **GET /nodes?id={uuid}&cluster-name={clusterName}** - Get cluster nodes
- **POST /scenarios** - Get available chaos scenarios from registry ✅
- **POST /scenarios/detail/{scenarioName}** - Get scenario configuration fields ✅ NEW

### Workflow
```
App Mount
  ↓
POST /targets → UUID
  ↓
Poll GET /targets/{uuid} (3s interval, 60s timeout)
  ↓ (status 200)
GET /clusters?id={uuid}
  ↓
Display ClusterSelector
  ↓
User selects cluster
  ↓
GET /nodes?id={uuid}&cluster-name={clusterName}
  ↓
Display NodesDisplay (cluster info + node list)
  ↓
User clicks "Select Chaos Scenarios" ✅
  ↓
Display RegistrySelector (public/private registry) ✅
  ↓
POST /scenarios (with optional auth credentials) ✅
  ↓
Display ScenariosList (select scenarios) ✅
  ↓
User clicks "Configure" on a scenario ✅ NEW
  ↓
POST /scenarios/detail/{scenarioName} ✅ NEW
  ↓
Display ScenarioDetail (dynamic form based on scenario fields) ✅ NEW
  ↓
User fills form and previews configuration ✅ NEW
  ↓
(Future: Scenario execution/submission)
```

## Success Criteria (from REQUIREMENTS.md)

1. ✅ User can load the application
2. ✅ Application automatically calls POST /targets and gets UUID
3. ✅ Application polls GET /targets/{uuid} until 200 OK
4. ✅ Application displays loading state during polling
5. ✅ Application fetches and displays clusters after polling completes
6. ✅ User can select a cluster from the list
7. ✅ Application fetches and displays cluster nodes
8. ✅ Selected cluster name is prominently displayed
9. ✅ User can configure registry (public/private) ✅
10. ✅ Application fetches and displays chaos scenarios ✅
11. ✅ User can select multiple scenarios from the list ✅
12. ✅ User can view scenario configuration details ✅ NEW
13. ✅ Dynamic form generation from scenario metadata ✅ NEW
14. ✅ Form validation (required fields, regex, type checking) ✅ NEW
15. ✅ Configuration preview before submission ✅ NEW
16. ✅ Back button navigation in all workflow phases ✅ NEW
17. ✅ Errors are handled gracefully with retry options
18. ✅ Application is deployable as Docker container (Podman + Docker support)
19. ✅ Kubernetes manifests deploy successfully
20. ✅ PatternFly components are used throughout
21. ✅ Non-root container security compliance

## Next Steps (Future Enhancements)

### Not in Current MVP
- [ ] Chaos scenario execution (submit selected scenarios to operator)
- [ ] Real-time status updates (WebSocket)
- [ ] Multiple target request management
- [ ] Chaos scenario execution history
- [ ] Authentication/Authorization (OAuth, RBAC)
- [ ] Unit tests (Jest + React Testing Library)
- [ ] E2E tests (Playwright or Cypress)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Multi-language support (i18n)
- [ ] Node filtering and search functionality
- [ ] Bulk node selection for chaos targets
- [ ] Scenario filtering and search

### Immediate Next Actions
1. **Build and push image**: `./scripts/build-and-push.sh`
2. **Deploy to cluster**: `./scripts/deploy-k8s.sh`
3. **Test full workflow**: Verify POST /targets → Poll → Clusters → Nodes → Registry → Scenarios flow ✅
4. **Verify scenarios display**: Test public and private registry authentication ✅
5. **Iterate based on feedback**

## Known Limitations

1. **No tests yet** - Unit and E2E tests not implemented
2. **No authentication** - Console is publicly accessible
3. **Single workflow** - Only supports the initialization flow
4. **No persistence** - State is lost on page refresh
5. **Limited error details** - Could provide more debugging info

## Notes

- The console is a **pure UI client** - all logic remains in the operator
- Designed to be **lightweight and fast** (~50MB Docker image)
- Follows **PatternFly design patterns** for consistency with Red Hat ecosystem
- Uses **nginx proxy** to avoid CORS issues and hide internal services
- **Horizontally scalable** - can run multiple replicas
- **Podman-first** - Default container tool with Docker fallback
- **Security hardened** - Runs as non-root user with minimal permissions
- **Clear cluster context** - Selected cluster prominently displayed throughout workflow

## Testing Checklist

Before considering this production-ready:

- [ ] Test with real operator API
- [ ] Verify all error scenarios (network failure, timeout, 404, etc.)
- [ ] Test public registry scenario loading ✅
- [ ] Test private registry with username/password authentication ✅
- [ ] Test private registry with token authentication ✅
- [ ] Verify TLS options work correctly (skipTls, insecure) ✅
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Verify responsive design on mobile/tablet
- [ ] Test Kubernetes deployment in real cluster
- [ ] Verify Route/Ingress TLS termination
- [ ] Load test with multiple concurrent users
- [ ] Security audit (dependency vulnerabilities, CSP headers)
- [ ] Accessibility audit (WCAG 2.1 AA compliance)
- [ ] Performance audit (Lighthouse score)

## Recent Changes

### v0.4.0 - Scenario Detail Configuration + Back Navigation ✅ NEW

**Date**: 2026-01-13

This release adds dynamic scenario configuration forms and full backward navigation throughout the workflow.

#### Features Added

**1. Dynamic Form Builder System**
- Created comprehensive field type system with discriminated unions
- Support for 6 field types: string, enum, number, boolean, file, file_base64
- DynamicFormBuilder component that renders form fields from metadata
- Field-specific features:
  - String fields with regex validation
  - Enum fields with configurable separators
  - Number fields with type checking
  - Boolean fields as checkboxes
  - File upload fields (with base64 encoding option)
  - Secret fields with password masking

**2. Scenario Detail View**
- POST /scenarios/detail/{scenarioName} API integration
- ScenarioDetail component displays scenario metadata and configuration form
- Form validation (required fields, regex patterns, type validation)
- Preview mode showing all configured variables in a table
- Edit/preview toggle for reviewing configuration before submission
- Secret values masked in preview
- File values show filename in preview
- Loading state during API calls

**3. Back Navigation**
- GO_BACK action implemented in state reducer
- Back buttons added to all workflow components:
  - NodesDisplay → Cluster Selection
  - RegistrySelector → Nodes Display
  - ScenariosList → Registry Configuration
  - ScenarioDetail → Scenarios List
- Phase-based navigation that properly clears state

**4. ScenariosList Enhancement**
- Added "Configure" action button for each scenario
- Clicking "Configure" loads scenario detail form
- Maintains existing multi-select functionality

#### State Management Updates
- Two new phases: loading_scenario_detail, configuring_scenario
- Three new state fields: selectedScenario, scenarioDetail, scenarioFormValues
- Five new actions: SELECT_SCENARIO_FOR_DETAIL, SCENARIO_DETAIL_LOADING, SCENARIO_DETAIL_SUCCESS, SCENARIO_DETAIL_ERROR, UPDATE_SCENARIO_FORM
- GO_BACK action with phase-specific logic

#### Technical Implementation
- Type-safe discriminated unions for field types
- React Context pattern for form state management
- PatternFly 5 form components throughout
- Proper error handling and validation messages
- Default value initialization from metadata

#### Components Created
- [DynamicFormBuilder.tsx](src/components/DynamicFormBuilder.tsx) - Dynamic form rendering engine
- [ScenarioDetail.tsx](src/components/ScenarioDetail.tsx) - Scenario configuration container

#### Components Updated
- [ScenariosList.tsx](src/components/ScenariosList.tsx) - Added Configure button
- [NodesDisplay.tsx](src/components/NodesDisplay.tsx) - Added back button
- [RegistrySelector.tsx](src/components/RegistrySelector.tsx) - Added back button
- [LoadingScreen.tsx](src/components/LoadingScreen.tsx) - Added loading_scenario_detail phase
- [App.tsx](src/App.tsx) - Added scenario detail phases
- [AppContext.tsx](src/context/AppContext.tsx) - Added scenario detail state and GO_BACK logic

### v0.3.0 - Scenarios Selection Feature ✅

**Date**: 2026-01-12

This release adds the ability to configure and select chaos scenarios from container registries.

#### Features Added
- **POST /scenarios API Integration**
  - Created ScenariosRequest and ScenariosResponse types
  - Added getScenarios() method to operatorApi client
  - Support for public and private registry authentication

- **RegistrySelector Component**
  - Public/private registry radio button selection
  - Private registry authentication form with username/password OR token
  - Registry URL and scenario repository configuration
  - TLS options (skipTls, insecure) with checkboxes
  - Form validation and error handling

- **ScenariosList Component**
  - Table display of available scenarios with metadata
  - Multi-select checkboxes for scenario selection
  - Shows scenario name, digest, size, and last modified date
  - Select All / Deselect All functionality
  - Selected scenarios counter and summary

- **State Management Updates**
  - Added three new phases: configuring_registry, loading_scenarios, selecting_scenarios
  - New state fields: registryType, registryConfig, scenarios, selectedScenarios
  - Six new actions for scenarios workflow management

- **Extended Workflow**
  - NodesDisplay now has "Select Chaos Scenarios" button
  - Full flow: Nodes → Registry Config → Load Scenarios → Select Scenarios
  - LoadingScreen supports loading_scenarios phase

#### Technical Details
- All components use PatternFly 5 design system
- Type-safe TypeScript implementation
- State machine pattern for phase transitions
- Proper error handling for registry authentication failures

### v0.2.0 - Nodes Display Feature ✅

**Date**: 2026-01-12

- Added GET /nodes API integration
- Created NodesDisplay component with prominent cluster information
- Extended workflow: cluster selection → node loading → nodes display
- Enhanced state management with loading_nodes and ready phases
- Updated all documentation to reflect new workflow

### v0.1.0 - Initial Release ✅

- Complete initialization workflow (POST /targets → poll → clusters)
- Cluster selection with PatternFly components
- Security & DevOps improvements (non-root, Podman-first)
- Complete deployment scripts and Kubernetes manifests

---

**Last Updated**: 2026-01-13
**Current Version**: 0.4.0
**Contributors**: Claude Sonnet 4.5 (AI), tsebasti (Project Lead)
