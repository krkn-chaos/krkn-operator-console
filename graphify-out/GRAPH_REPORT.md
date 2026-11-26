# Graph Report - console  (2026-11-26)

## Corpus Check
- 413 files · ~330,358 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .css 16, (none) 6, .jsonl 2)

## Summary
- 2598 nodes · 7043 edges · 139 communities (125 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b95cc9dc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CreateRun.tsx
- operatorApi.ts
- TerminalContent.tsx
- krknAiState.ts
- useNotifications
- groupsApi.ts
- resiliencyHistoryReport.ts
- vitest
- VisualizeInstallCard.tsx
- services/index.ts
- API Documentation
- handlers.ts
- Completed Tasks
- API Endpoints
- CloudCredentialsCard.tsx
- provider.ts
- ResiliencyHistoryChart.tsx
- GraphRunDetail.tsx
- UsersCard.tsx
- api.ts
- RunCategoryActions.tsx
- JobsList.tsx
- Provider Configuration API Specification
- DynamicFormBuilder.tsx
- ElasticsearchDataView.tsx
- IdentityManagement.tsx
- operatorApi
- ElasticsearchAlertsTab.tsx
- krknAiApi.ts
- App.tsx
- CloudCredentialsCard.tsx
- authService
- StudioCanvas.tsx
- ResiliencyHistoryConfigurationTooltip.tsx
- authService.ts
- Frontend Authentication Tasks - Import Guide
- package.json
- RunDetail.tsx
- websocketHandlers.ts
- websocketService
- ScenarioDetail.test.tsx
- operatorApi
- registriesApi.ts
- StudioContext.tsx
- useAuth
- ScenarioExplorer.tsx
- ScenariosList.tsx
- components/JobsList.test.tsx
- graphRunsApi.ts
- CLAUDE.md - Project Instructions
- RunList.tsx
- devDependencies
- Deployment Scripts
- componentsApi.ts
- ResiliencyHistoryChart.tsx
- StudioNodeEditorModal.tsx
- visualizeApi.ts
- KrknAIApiClient
- workflowsApi.ts
- compilerOptions
- Krkn Operator Console - Architecture
- dependencies
- Krkn Operator Console - Requirements
- ScenarioConfigStep.tsx
- AuthContext.tsx
- BaseApiClient
- FileInfo
- KrknAIPage.test.tsx
- useScenarioRunsPoller.ts
- ScenarioDetail.tsx
- @patternfly/react-icons
- useKrknAIOrigins.ts
- krknAiArchive.ts
- UI Style Guide
- index.tsx
- krknAiWebsocketHandlers.ts
- Studio.tsx
- ScenarioHealthCharts.tsx
- useReportActions.ts
- KrknAIRunResource
- VisualizeInstallCard.tsx
- MockWebSocket
- scripts
- KrknOperatorTarget CRUD API - Frontend Requirements
- BackupRestoreCard.test.tsx
- CategoryResponse
- Login.tsx
- useWebSocket.test.tsx
- identityApi
- terminalValidation.ts
- KrknAIRunSummary
- studioRecovery.ts
- UserManagement.test.tsx
- @patternfly/react-core
- mockServiceWorker.js
- Development
- Functional Requirements
- useClusterDiscovery.ts
- 4. Update Target
- ScenarioConfigStep.test.tsx
- AppContext.tsx
- REQUIREMENTS.md
- 1. Create Target
- 5. Delete Target
- Studio/WorkflowDetailsPanel.test.tsx
- krknAiHandlers.ts
- hooks/useJobs.ts
- compilerOptions
- 2. List Targets
- 3. Get Target by UUID
- Error Responses
- FAQ
- FileSelector.tsx
- Agent Instructions
- FileForm.test.tsx
- JobStatsSummary.tsx
- 2. API Endpoints Integration
- 6. Non-Functional Requirements
- description
- LoadWorkflowSelect.test.tsx
- RollbackAvailability
- allowScripts
- 3. UI Components
- 7. Deployment
- 9. Testing Requirements
- fieldUtils.ts
- setup.ts
- TARGET_PROVIDER_CONFIG_SPEC.md
- RollbackMenuAction.tsx
- TargetForm.tsx
- apiClient.test.ts
- vite-env.d.ts
- build-and-push.sh
- deploy-k8s.sh
- dev-setup.sh
- logs.sh
- test-local-docker.sh
- undeploy-k8s.sh

## God Nodes (most connected - your core abstractions)
1. `vitest` - 161 edges
2. `react` - 129 edges
3. `@patternfly/react-core` - 115 edges
4. `@testing-library/react` - 112 edges
5. `operatorApi` - 80 edges
6. `useNotifications()` - 73 edges
7. `@patternfly/react-icons` - 71 edges
8. `@testing-library/user-event` - 67 edges
9. `OperatorApiClient` - 49 edges
10. `authService` - 42 edges

## Surprising Connections (you probably didn't know these)
- `Phase 3: State Management ✅` --references--> `useAppContext()`  [INFERRED]
  spec.orig/agent-specs/PROGRESS-MVP.md → src/context/AppContext.tsx
- `Request Body` --references--> `CreateTargetRequest`  [INFERRED]
  spec.orig/REQUIREMENTS.md → src/types/api.ts
- `Description` --references--> `ScenariosRequest`  [INFERRED]
  spec.orig/agent-specs/REQUIREMENTS-MVP.md → src/types/api.ts
- `Phase 4: Custom Hooks ✅` --references--> `useTargetPoller()`  [INFERRED]
  spec.orig/agent-specs/PROGRESS-MVP.md → src/hooks/useTargetPoller.ts
- `Error state` --references--> `useNotifications()`  [INFERRED]
  src/UI_STYLE_GUIDE.md → src/hooks/useNotifications.ts

## Import Cycles
- None detected.

## Communities (139 total, 14 thin omitted)

### Community 0 - "CreateRun.tsx"
Cohesion: 0.06
Nodes (57): yaml, ClusterComponentsEditor(), ClusterComponentsEditorProps, ComponentLocation, NamespaceComponent, withDisabledFlag(), withNamespaceDisabled(), componentData() (+49 more)

### Community 1 - "operatorApi.ts"
Cohesion: 0.06
Nodes (21): OperatorApiClient, AvailableCommandsResponse, CategoriesListResponse, CategoryEntityAssociationResponse, ClustersResponse, CreateCategoryRequest, CreateScenarioRunResponse, CreateTargetResponse (+13 more)

### Community 2 - "TerminalContent.tsx"
Cohesion: 0.20
Nodes (13): ClusterHealthIndicator(), ClusterHealthIndicatorProps, healthStatusDetails, ClusterMultiSelector(), ClusterMultiSelectorProps, clusters, renderSelector(), RunWorkflowModalProps (+5 more)

### Community 3 - "krknAiState.ts"
Cohesion: 0.12
Nodes (34): buildState(), capturePartialMeasurements(), clone(), commitScenario(), configFiles, configs, createPreviewAiRun(), deletePreviewAiRun() (+26 more)

### Community 4 - "useNotifications"
Cohesion: 0.22
Nodes (15): BackupRestoreCard(), formatBytes(), configEntryCellStyle, ElasticsearchConfigForm(), ElasticsearchConfigsCard(), groupIdentifier(), ProviderConfigTab(), ProviderConfigTabProps (+7 more)

### Community 5 - "groupsApi.ts"
Cohesion: 0.16
Nodes (14): AddMembersModal(), AddMembersModalProps, GroupsCard(), GroupsCardProps, mockGroups, UserManagement(), ViewGroupMembersModal(), ViewGroupMembersModalProps (+6 more)

### Community 6 - "resiliencyHistoryReport.ts"
Cohesion: 0.13
Nodes (44): jspdf, addPageFooters(), buildResiliencyHistoryPdf(), buildSnapshotRows(), clusterDisplayName(), collectConfigurations(), COLORS, ConfigurationRunType (+36 more)

### Community 7 - "vitest"
Cohesion: 0.09
Nodes (17): @testing-library/react, @testing-library/user-event, vitest, appMocks, mockCredentials, filesResponse, defaultProps, defaultProps (+9 more)

### Community 8 - "VisualizeInstallCard.tsx"
Cohesion: 0.10
Nodes (21): ElasticsearchAlertsTabProps, config, renderAlerts(), result, showError, ElasticsearchConfigFormProps, mockAlertsResult, mockConfigs (+13 more)

### Community 9 - "services/index.ts"
Cohesion: 0.07
Nodes (27): mockConnectionState, mockDispatch, mockGraphRuns, sendWsMessage(), mockBuildResourceUrl, mockConnect, mockDisconnect, mockGetState (+19 more)

### Community 10 - "API Documentation"
Cohesion: 0.05
Nodes (36): 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 500 Internal Server Error, API Documentation, Authentication (+28 more)

### Community 11 - "handlers.ts"
Cohesion: 0.07
Nodes (29): msw, config, handlers, mockCategories, mockClusters, mockDummyWorkflowDetail, mockFiles, mockGraphRunDetails (+21 more)

### Community 12 - "Completed Tasks"
Cohesion: 0.05
Nodes (35): API Integration, Architecture Summary, Completed Tasks, Components Created, Components Updated, Features Added, Features Added, Immediate Next Actions (+27 more)

### Community 13 - "API Endpoints"
Cohesion: 0.05
Nodes (37): Access Control, Access Control, Account Features, Admin Role, Advanced User Management, API Endpoints, Audit and Compliance, Base URL (+29 more)

### Community 14 - "CloudCredentialsCard.tsx"
Cohesion: 0.17
Nodes (10): CloudCredentialFormProps, cloudCredentialsApi, fetchJson(), mockFetchJson, CloudCredential, CloudCredentialOperationResponse, CloudCredentialProvider, CreateCloudCredentialRequest (+2 more)

### Community 15 - "provider.ts"
Cohesion: 0.10
Nodes (24): pollConfigStatus(), providersApi, FieldType, CreateProviderConfigResponse, CustomSchemaField, GetProviderConfigResponse, JsonSchema, JsonSchemaProperty (+16 more)

### Community 16 - "ResiliencyHistoryChart.tsx"
Cohesion: 0.10
Nodes (28): history, AppliedFilters, clusterIdentity(), ClusterOption, hasHistoryData(), ResiliencyHistoryPage(), emptyHistory, mocks (+20 more)

### Community 17 - "GraphRunDetail.tsx"
Cohesion: 0.05
Nodes (56): ClusterScoresSection(), getLayoutedElements(), GraphRunDetail(), GraphRunDetailProps, nodeTypes, ScenarioNode(), ResiliencyScoreBox(), ResiliencyScoreBoxProps (+48 more)

### Community 18 - "UsersCard.tsx"
Cohesion: 0.11
Nodes (22): ChangePasswordForm(), ChangePasswordFormProps, mockGroups, mockUsers, UserDetails(), UserDetailsProps, UserForm(), UserFormProps (+14 more)

### Community 19 - "api.ts"
Cohesion: 0.06
Nodes (38): AddGroupMemberRequest, AuthType, AvailableRegistriesResponse, BaseField, BooleanField, CreateFileRequest, CreateFileResponse, DEFAULT_WORKLOAD_IMAGE_TAGS (+30 more)

### Community 20 - "RunCategoryActions.tsx"
Cohesion: 0.11
Nodes (17): JobDiagnosticAlertProps, RollbackActionsProps, RollbackAttempt, RollbackMenuActionProps, getCategoryStripeGradient(), RunCategoryActionsProps, RunCategoryStripe(), RunCategoryStripeProps (+9 more)

### Community 21 - "JobsList.tsx"
Cohesion: 0.10
Nodes (31): anser, JobDiagnosticAlert(), GRAPH_RUN_TERMINAL_PHASES, JobsList(), rollbackProgress(), toUnifiedRunItem(), UnifiedRunItem, LogLine (+23 more)

### Community 22 - "Provider Configuration API Specification"
Cohesion: 0.06
Nodes (30): 1. List Available Providers (Optional), 1. List Providers, 2. Create Config Request, 2. Get Provider Config Status, 2. Update Provider Status, 3. Create Provider Config Request, 3. Poll for Completion, 3. Update Provider Configuration (+22 more)

### Community 23 - "DynamicFormBuilder.tsx"
Cohesion: 0.18
Nodes (14): DynamicFormBuilder(), DynamicFormBuilderProps, ScrollableFieldGroup(), DynamicFormBuilderWithTracking(), DynamicFormBuilderWithTrackingProps, ScrollableFieldGroupWithTracking(), ScenarioParameterSectionsProps, ScenarioConfigStepProps (+6 more)

### Community 24 - "ElasticsearchDataView.tsx"
Cohesion: 0.13
Nodes (23): buildClusterConfigRows(), buildPodRecoveryData(), ClusterConfigTable(), displayValue(), ElasticsearchDataView(), FILTER_CATEGORIES, findExpectedRecoveryTime(), flattenEntries() (+15 more)

### Community 25 - "IdentityManagement.tsx"
Cohesion: 0.11
Nodes (22): AccountLoadState(), emptyProvider, failure(), hasMapping(), IdentityManagement(), confirmAction(), confirmMapping(), loadMoreRemoteGroups() (+14 more)

### Community 26 - "operatorApi"
Cohesion: 0.25
Nodes (14): react-icons, useCategoryManagementPage(), useFileManagementPage(), SaveWorkflowModal(), SaveWorkflowModalProps, buildGraph(), saveWorkflowModalStyles, savedWorkflow (+6 more)

### Community 27 - "ElasticsearchAlertsTab.tsx"
Cohesion: 0.17
Nodes (19): ALERT_FILTER_OPTIONS, alertSeverity(), alertSeverityColor(), AlertSortColumn, alertSummaryField(), ElasticsearchAlertsTab(), formatAlertCreatedAt(), formatAlertFields() (+11 more)

### Community 28 - "krknAiApi.ts"
Cohesion: 0.12
Nodes (23): FitnessChart(), FitnessChartProps, formatFitness(), getExpandedDomain(), KrknAIApiRequestOptions, KrknAIArtifactStatus, KrknAIConfigRequest, KrknAIConfigResponse (+15 more)

### Community 29 - "App.tsx"
Cohesion: 0.18
Nodes (13): Phase 4: Custom Hooks ✅, App(), ErrorDisplay(), LoadingScreen(), LoadingScreenProps, RegistrySelector(), ScenariosList(), studioLeaveGuard (+5 more)

### Community 30 - "CloudCredentialsCard.tsx"
Cohesion: 0.10
Nodes (26): CloudCredentialForm(), CloudCredentialsCard(), credentialAccessLabel(), credentialsCellStyle, credentialsHeaderCellStyle, credentialsTableStyle, mutedTextStyle, PROVIDER_ACCENT_COLORS (+18 more)

### Community 31 - "authService"
Cohesion: 0.15
Nodes (8): AuthState, authService, AuthSession, clearAuthStorage(), emptySession(), hasLegacyAuth(), parseCookieSession(), User

### Community 32 - "StudioCanvas.tsx"
Cohesion: 0.12
Nodes (13): reactflow, signatureState, signedNode, unsignedNode, StudioCanvasProps, StudioNode(), formatValue(), StudioNodeConfigModal() (+5 more)

### Community 33 - "ResiliencyHistoryConfigurationTooltip.tsx"
Cohesion: 0.14
Nodes (18): ConfigRows(), ConfigurationRunType, displayValue(), GraphConfiguration(), GraphNode(), ResiliencyHistoryConfigurationTooltip(), RunConfiguration, ScenarioConfiguration() (+10 more)

### Community 34 - "authService.ts"
Cohesion: 0.15
Nodes (16): AuthContextValue, { createRootMock, workerStartMock }, AUTH_STORAGE_KEY_LIST, AuthSessionRecord, readLegacySession(), readUserFromStorage(), AUTH_SESSION_STORAGE_KEY, AUTH_STORAGE_KEYS (+8 more)

### Community 35 - "Frontend Authentication Tasks - Import Guide"
Cohesion: 0.08
Nodes (24): 1. Initialize Beads (if not already done), 2. Import the Frontend Tasks, 3. Verify Import, API Reference, Documentation, Frontend Authentication Tasks - Import Guide, Need Help?, Notes (+16 more)

### Community 36 - "package.json"
Cohesion: 0.07
Nodes (26): msw, workerDirectory, name, private, type, version, dagre, eslint (+18 more)

### Community 37 - "RunDetail.tsx"
Cohesion: 0.18
Nodes (20): errorText(), isActive(), KrknAIPage(), mergeSummaryIntoRun(), phaseOf(), MetadataPanel(), MetadataPanelProps, ConfigState (+12 more)

### Community 38 - "websocketHandlers.ts"
Cohesion: 0.09
Nodes (21): enablePreviewMode(), worker, krknAiWebsocketHandlers, server, server, createRunsMessage(), dashboardHandler, dashboardWs (+13 more)

### Community 39 - "websocketService"
Cohesion: 0.11
Nodes (15): UseWebSocketOptions, UseWebSocketReturn, DEFAULT_OPTIONS, websocketService, ClientMessage, ConnectionState, ConnectionStateHandler, ManagedConnection (+7 more)

### Community 40 - "ScenarioDetail.test.tsx"
Cohesion: 0.10
Nodes (21): @patternfly/react-table, CategoriesTable(), CategoriesTableProps, CategoryForm(), CategoryFormModal(), CategoryFormModalProps, CategoryManagementPage(), FormModal() (+13 more)

### Community 41 - "operatorApi"
Cohesion: 0.15
Nodes (9): groupsResponse, RollbackActions(), job, useRollbackAvailability(), operatorApi, mockFetch, mockFetch, mockFetch (+1 more)

### Community 42 - "registriesApi.ts"
Cohesion: 0.12
Nodes (16): RegistryForm(), RegistryFormProps, mocks, RFC-1123, RegistrySelectorStepProps, registriesApi, RFC-1123, fetchJson() (+8 more)

### Community 43 - "StudioContext.tsx"
Cohesion: 0.16
Nodes (14): clearAutosave(), saveAutosave(), workflow, detectCircularDependencies(), mergeVisibleCategorySelection(), normalizeCategoryNames(), SavedWorkflowMetadata, StudioContext (+6 more)

### Community 44 - "useAuth"
Cohesion: 0.30
Nodes (6): react-router-dom, AppRouter(), Register(), RegistrationCheck(), renderRegister(), renderRegistrationCheck()

### Community 45 - "ScenarioExplorer.tsx"
Cohesion: 0.22
Nodes (20): CalculationStatus(), CancelledFitnessValue(), columns, displayValue(), formatFitness(), isBaselineScenario(), isCalculationPending(), isGenerationFinalized() (+12 more)

### Community 46 - "ScenariosList.tsx"
Cohesion: 0.22
Nodes (8): SortOption, SignatureStatusIcon(), SignatureStatusIconProps, statusDetails, SignatureStatus, BLOCKED_EXACT, BLOCKED_PREFIXES, isScenarioBlocked()

### Community 47 - "components/JobsList.test.tsx"
Cohesion: 0.13
Nodes (13): defaultProps, noopSet, resetJobsMock(), setMockIsLoading(), setMockJobs(), setMockPagination(), setMockSnapshotVersion(), setMockStats() (+5 more)

### Community 48 - "graphRunsApi.ts"
Cohesion: 0.15
Nodes (8): GraphRunsApiClient, fetch(), fetchJson(), mockFetch, mockFetchJson, GraphRunDetail, GraphScenarioNode, ListGraphRunsFilters

### Community 49 - "CLAUDE.md - Project Instructions"
Cohesion: 0.10
Nodes (19): Architecture Principles, Before Committing, Before Writing Code, CLAUDE.md - Project Instructions, Code Organization & Reusability, Code Quality Standards, Communication, Critical Rules (+11 more)

### Community 50 - "RunList.tsx"
Cohesion: 0.26
Nodes (11): FitnessValue(), getClusterName(), phaseColor(), RunActionsMenu(), RunList(), dateTimeFormatter, formatDateTime(), preciseDateTimeFormatter (+3 more)

### Community 51 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, jsdom, msw, @testing-library/jest-dom, @testing-library/react (+11 more)

### Community 52 - "Deployment Scripts"
Cohesion: 0.11
Nodes (17): `build-and-push.sh`, Common Workflows, `deploy-k8s.sh`, Deployment Scripts, `dev-setup.sh`, 🔧 Development, 🐳 Docker, First Time Deployment (+9 more)

### Community 53 - "componentsApi.ts"
Cohesion: 0.22
Nodes (6): consoleComponentManifest, consoleComponentName, ComponentDescription, ComponentManifest, componentsApi, ListComponentsResponse

### Community 54 - "ResiliencyHistoryChart.tsx"
Cohesion: 0.21
Nodes (15): ActiveTooltip, ChartDomain, CLUSTER_COLORS, formatDate(), formatDateTick(), formatDelta(), getFullDomain(), getScoreTicks() (+7 more)

### Community 55 - "StudioNodeEditorModal.tsx"
Cohesion: 0.12
Nodes (17): react, SignatureVerificationSettings(), { mockGetSettings, mockUpdateSettings }, NodeMetadataStep(), RegistrySelectorStep(), ScenariosListStep(), ScenariosListStepProps, signatureState (+9 more)

### Community 56 - "visualizeApi.ts"
Cohesion: 0.16
Nodes (9): mockDashboards, mockInstances, visualizeApi, GrafanaDashboard, ListVisualizeResponse, VisualizeConfig, VisualizeDashboardsResponse, VisualizeLogsResponse (+1 more)

### Community 57 - "KrknAIApiClient"
Cohesion: 0.14
Nodes (3): createKrknAIHttpError(), KrknAIApiClient, KrknAIConfigValidationError

### Community 58 - "workflowsApi.ts"
Cohesion: 0.16
Nodes (10): fetchJson(), mockFetchJson, WorkflowsApiClient, AvailableWorkflowsResponse, CreateWorkflowRequest, CreateWorkflowResponse, DeleteWorkflowResponse, UpdateWorkflowRequest (+2 more)

### Community 59 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 60 - "Krkn Operator Console - Architecture"
Cohesion: 0.11
Nodes (17): Build & Deploy, Component Responsibilities, Data Flow, Development vs Production, Frontend, Initialization Flow, Krkn Operator Console - Architecture, Kubernetes Resources (+9 more)

### Community 61 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, anser, dagre, jspdf, @patternfly/patternfly, @patternfly/react-charts, @patternfly/react-core, @patternfly/react-icons (+10 more)

### Community 62 - "Krkn Operator Console - Requirements"
Cohesion: 0.11
Nodes (17): API Compatibility, Architecture, DELETE methods, Description, Description, description, Krkn Operator Console - Requirements, Notes (+9 more)

### Community 63 - "ScenarioConfigStep.tsx"
Cohesion: 0.19
Nodes (14): canReuseCacheEntry(), extractDefaultValues(), ScenarioConfigStep(), fetchScenarioDetail(), scenarioDetailCache, ScenarioDetailCacheEntry, scenarioDetailCacheKey(), renderStep() (+6 more)

### Community 64 - "AuthContext.tsx"
Cohesion: 0.14
Nodes (18): AdminOnly(), AdminOnlyProps, ProtectedRoute(), ProtectedRouteProps, AuthAction, AuthContext, AuthProvider(), AuthProviderProps (+10 more)

### Community 65 - "BaseApiClient"
Cohesion: 0.16
Nodes (8): signatureVerificationApi, fetchJson(), mockFetchJson, SignatureVerificationSettingsRequest, SignatureVerificationSettingsResponse, authenticatedFetch(), BaseApiClient, createApiError()

### Community 66 - "FileInfo"
Cohesion: 0.22
Nodes (13): FileForm(), loadFile(), FileFormProps, FileFormModal(), FileFormModalProps, FileManagementPage(), canModifyFile(), FILE_PURPOSE_CONFIG (+5 more)

### Community 67 - "KrknAIPage.test.tsx"
Cohesion: 0.16
Nodes (17): advance(), flushReact(), makeIndex(), makeRun(), makeScenarioDetail(), makeScenarioRow(), makeSummary(), mockRunResources (+9 more)

### Community 68 - "useScenarioRunsPoller.ts"
Cohesion: 0.11
Nodes (12): JobsListProps, mockGetScenarioRunStatus, mockConnectionState, mockDispatch, mockScenarioRuns, hasChanges(), TERMINAL_PHASES, useScenarioRunsPoller() (+4 more)

### Community 69 - "ScenarioDetail.tsx"
Cohesion: 0.25
Nodes (11): ClusterConflictWarning(), ClusterConflictWarningProps, readFileAsBase64(), ScenarioDetail(), ScenarioDetailProps, ScenarioParameterSections(), useVisibleCategories(), ScenarioReference (+3 more)

### Community 70 - "@patternfly/react-icons"
Cohesion: 0.26
Nodes (8): @patternfly/react-icons, ActiveRunsModal(), ActiveRunsModalProps, ActiveRunsSummary(), ActiveRunsSummaryProps, ErrorDisplayProps, ActiveRunsResponse, AppError

### Community 71 - "useKrknAIOrigins.ts"
Cohesion: 0.22
Nodes (10): mocks, RunFixture, ChildOrigins, errorMessage(), httpStatus(), isOptionalOriginLookupFailure(), labelValue(), useKrknAIOrigins() (+2 more)

### Community 72 - "krknAiArchive.ts"
Cohesion: 0.24
Nodes (12): buildKrknAiArchiveFiles(), crc32(), CRC_TABLE, createKrknAiZipArchive(), jsonFile(), KrknAiArchiveFile, safeFileSegment(), textFile() (+4 more)

### Community 73 - "UI Style Guide"
Cohesion: 0.12
Nodes (15): 1. Buttons & Icons, 2. Loaders & States, 3. Tables, Forms & Modals, 4. Accessibility & general, Button variants, Empty state, Error state, Forms (+7 more)

### Community 74 - "index.tsx"
Cohesion: 0.23
Nodes (11): Handlers, makeHandlers(), renderSidebar(), AppSidebar(), AppSidebarProps, SidebarPFNav(), SIDEBAR_EXPANDED_WIDTH, SIDEBAR_RAIL_WIDTH (+3 more)

### Community 75 - "krknAiWebsocketHandlers.ts"
Cohesion: 0.28
Nodes (11): getPreviewAiRun(), listPreviewAiChildren(), childLogsHandler, childLogsWs, initialLines(), LogSocket, orchestratorLogsHandler, orchestratorLogsWs (+3 more)

### Community 76 - "Studio.tsx"
Cohesion: 0.14
Nodes (23): LoadWorkflowSelect(), RunWorkflowModal(), renderModal(), SaveWorkflowConfirmModal(), SaveWorkflowConfirmModalProps, Studio(), StudioContent(), loadAutosave() (+15 more)

### Community 77 - "ScenarioHealthCharts.tsx"
Cohesion: 0.29
Nodes (12): colors, formatNumber(), MeasuredSample, measurementDetails(), MeasurementField, measurementFields(), MeasurementTooltip(), OutcomeMeasurement() (+4 more)

### Community 78 - "useReportActions.ts"
Cohesion: 0.25
Nodes (6): mockDownloadReportHTML, mockDownloadReportPDF, mockGetReportStatus, UseReportActionsOptions, UseReportActionsResult, ReportStatus

### Community 79 - "KrknAIRunResource"
Cohesion: 0.19
Nodes (14): CreateRunProps, RunDetailProps, KrknAIRunListEntry, RunListProps, ScenarioExplorerProps, KrknAiArchiveSnapshot, PreviewKrknAIRun, RunState (+6 more)

### Community 80 - "VisualizeInstallCard.tsx"
Cohesion: 0.19
Nodes (12): TargetFormProps, StatusBadge(), VisualizeInstallCard(), VisualizeInstallForm(), VisualizeInstallFormProps, targetsApi, CreateTargetRequest, CreateVisualizeRequest (+4 more)

### Community 82 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, build:preview, dev, dev:preview, lint, preview, test (+4 more)

### Community 83 - "KrknOperatorTarget CRUD API - Frontend Requirements"
Cohesion: 0.17
Nodes (12): 🔐 Best Practices, Complete Test Flow, 🔒 Credentials Handling, Endpoints Overview, Example React Hook, Form Validation Example, Frontend Implementation Guide, KrknOperatorTarget CRUD API - Frontend Requirements (+4 more)

### Community 84 - "BackupRestoreCard.test.tsx"
Cohesion: 0.20
Nodes (4): mockShowError, mockShowSuccess, backupRestoreApi, RestoreResponse

### Community 85 - "CategoryResponse"
Cohesion: 0.36
Nodes (8): CategoryFormProps, CategoryMultiSelect(), CategoryMultiSelectProps, categories, Harness(), StudioContextType, CategoryLoadStatus, CategoryResponse

### Community 86 - "Login.tsx"
Cohesion: 0.26
Nodes (6): useCooldown(), Login(), toRouterRelativeReturnUrl(), renderLogin(), renderLogin(), LoginProvider

### Community 87 - "useWebSocket.test.tsx"
Cohesion: 0.17
Nodes (11): mockConnect, mockDisconnect, mockGetState, mockOffMessage, mockOffRawMessage, mockOffStateChange, mockOnMessage, mockOnRawMessage (+3 more)

### Community 89 - "terminalValidation.ts"
Cohesion: 0.29
Nodes (10): ALLOWED_COMMANDS, BLOCKED_COMMANDS, BLOCKED_FLAGS, findBlockedFlag(), getAllowedCommands(), hasStreamingFlags(), isWriteCommand(), parseCommand() (+2 more)

### Community 90 - "KrknAIRunSummary"
Cohesion: 0.38
Nodes (8): ResultsDownloadButton(), ResultsDownloadButtonProps, completeSummary, useKrknAIResultsDownload(), UseKrknAIResultsDownloadOptions, krknAiApi, KrknAIRunPhase, KrknAIRunSummary

### Community 91 - "studioRecovery.ts"
Cohesion: 0.50
Nodes (3): getStudioRecoveryState(), StudioRecoveryState, workflow

### Community 92 - "UserManagement.test.tsx"
Cohesion: 0.18
Nodes (10): mockAuthState, mockCreateUser, mockDeleteUser, mockGetUser, mockIsAdmin, mockListGroups, mockListUsers, mockShowError (+2 more)

### Community 93 - "@patternfly/react-core"
Cohesion: 0.27
Nodes (8): @patternfly/react-core, ComponentVersionsAccess(), ComponentVersionsCard(), ComponentVersionsModal(), ComponentVersionsModalProps, TerminalDrawer(), TerminalDrawerProps, renderDrawer()

### Community 94 - "mockServiceWorker.js"
Cohesion: 0.36
Nodes (8): activeClientIds, getResponse(), handleRequest(), IS_MOCKED_RESPONSE, resolveMainClient(), respondWithMock(), sendToClient(), serializeRequest()

### Community 95 - "Development"
Cohesion: 0.20
Nodes (9): Development, Environment Variables, Krkn-AI run integration, krkn-operator-console, License, Mock development and PR previews, Other Commands, Prerequisites (+1 more)

### Community 96 - "Functional Requirements"
Cohesion: 0.20
Nodes (10): 10. Future Enhancements (Out of Scope for MVP), 1. Application Initialization Workflow, 4. State Management, 5. Configuration, 8.1 Project Structure, 8.2 Development Commands, 8. Development Workflow, API Service Client (+2 more)

### Community 97 - "useClusterDiscovery.ts"
Cohesion: 0.19
Nodes (14): ClusterOfflineIndicator(), ClusterOfflineIndicatorProps, formatCheckedAt(), Action, ClusterPermissionsTable(), ClusterPermissionsTableProps, CreateGroupModal(), CreateGroupModalProps (+6 more)

### Community 98 - "4. Update Target"
Cohesion: 0.22
Nodes (9): 400 Bad Request, 404 Not Found, 4. Update Target, 500 Internal Server Error, Error Responses, Example Request, Path Parameters, Request Body (+1 more)

### Community 99 - "ScenarioConfigStep.test.tsx"
Cohesion: 0.17
Nodes (7): UseScenariosFetchResult, mockFetch, ScenarioDetail, ScenarioGlobals, ScenariosRequest, ScenariosResponse, ScenarioTag

### Community 100 - "AppContext.tsx"
Cohesion: 0.19
Nodes (12): renderApp(), AppContextType, AppProvider(), AppProviderProps, appReducer(), initialState, renderWithProvider(), StateReader() (+4 more)

### Community 101 - "REQUIREMENTS.md"
Cohesion: 0.25
Nodes (7): Adding graphics, API Definition, Description, jobs and pod deletion, jobs list refactoring, KrknTarget CRUD, Multiple targets refactoring

### Community 102 - "1. Create Target"
Cohesion: 0.25
Nodes (8): 1. Create Target, Example 1: Create with Kubeconfig, Example 2: Create with Token, Example 3: Create with Credentials, Example Requests, Request Body, Success Response, Validation Rules

### Community 103 - "5. Delete Target"
Cohesion: 0.25
Nodes (8): 400 Bad Request, 404 Not Found, 500 Internal Server Error, 5. Delete Target, Error Responses, Example Request, Path Parameters, Success Response

### Community 104 - "Studio/WorkflowDetailsPanel.test.tsx"
Cohesion: 0.25
Nodes (6): baseSavedWorkflow, baseWorkflow, mockSetIsEditingDetails, mockSetSavedWorkflow, mockShowError, mockShowSuccess

### Community 105 - "krknAiHandlers.ts"
Cohesion: 0.24
Nodes (9): clustersField(), JsonRecord, krknAiHandlers, record(), registryContextField(), requestBody(), stringField(), getPreviewAiConfigFile() (+1 more)

### Community 106 - "hooks/useJobs.ts"
Cohesion: 0.22
Nodes (7): graphJob, mockConnectionState, scenarioJob, EMPTY_CATEGORIES, EMPTY_PAGINATION, EMPTY_STATS, useJobs()

### Community 107 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 108 - "2. List Targets"
Cohesion: 0.29
Nodes (7): 2. List Targets, 500 Internal Server Error, Error Response, Example Request, Request, Response Fields, Success Response

### Community 109 - "3. Get Target by UUID"
Cohesion: 0.29
Nodes (7): 3. Get Target by UUID, 400 Bad Request - Missing UUID, 404 Not Found, Error Responses, Example Request, Path Parameters, Success Response

### Community 110 - "Error Responses"
Cohesion: 0.29
Nodes (7): 400 Bad Request - Invalid SecretType, 400 Bad Request - Missing Credentials, 400 Bad Request - Missing Required Field, 409 Conflict - Duplicate API URL, 409 Conflict - Duplicate Cluster Name, 500 Internal Server Error, Error Responses

### Community 111 - "FAQ"
Cohesion: 0.29
Nodes (7): FAQ, Q: Can I have multiple targets pointing to the same cluster?, Q: Can I update just the cluster name without changing credentials?, Q: How do I encode a kubeconfig file to base64?, Q: How do I know if a target is ready to use?, Q: What happens to the Secret when I delete a target?, Q: What is the UUID used for?

### Community 112 - "FileSelector.tsx"
Cohesion: 0.18
Nodes (8): FileSelector(), FileSelectorProps, mockAvailableFiles, ResiliencyScoreModal(), ResiliencyScoreModalProps, AvailableFilesResponse, FileReference, ResiliencyScoreConfig

### Community 113 - "Agent Instructions"
Cohesion: 0.33
Nodes (5): Agent Instructions, graphify, Landing the Plane (Session Completion), Quick Reference, UI Conventions

### Community 115 - "JobStatsSummary.tsx"
Cohesion: 0.36
Nodes (5): JobStatsSummary(), JobStatsSummaryProps, StatCardId, statCards, JobStatsSummary

### Community 116 - "2. API Endpoints Integration"
Cohesion: 0.40
Nodes (5): 2. API Endpoints Integration, GET /clusters, GET /nodes (Optional - for future enhancement), GET /targets/{UUID}, POST /targets

### Community 117 - "6. Non-Functional Requirements"
Cohesion: 0.40
Nodes (5): 6.1 Performance, 6.2 Accessibility, 6.3 Error Resilience, 6.4 Browser Support, 6. Non-Functional Requirements

### Community 118 - "description"
Cohesion: 0.40
Nodes (5): description, job deletion, job logs, job status, scenarios/run

### Community 119 - "LoadWorkflowSelect.test.tsx"
Cohesion: 0.40
Nodes (4): defaultContext, mockLoadWorkflow, mockShowError, mockShowSuccess

### Community 120 - "RollbackAvailability"
Cohesion: 0.36
Nodes (4): parseRollbackAvailability(), rollbackStates, ROLLBACK_STATES, RollbackAvailability

### Community 121 - "allowScripts"
Cohesion: 0.50
Nodes (4): allowScripts, esbuild@0.21.5, esbuild@0.27.3, fsevents@2.3.3

### Community 122 - "3. UI Components"
Cohesion: 0.50
Nodes (4): 3.1 Loading Screen / Poller Component, 3.2 Cluster Selector Component, 3.3 Error Handling Component, 3. UI Components

### Community 123 - "7. Deployment"
Cohesion: 0.50
Nodes (4): 7.1 Docker Container, 7.2 Nginx Configuration, 7.3 Kubernetes Deployment, 7. Deployment

### Community 124 - "9. Testing Requirements"
Cohesion: 0.50
Nodes (4): 9.1 Unit Tests, 9.2 Integration Tests, 9.3 E2E Tests (Optional), 9. Testing Requirements

### Community 125 - "fieldUtils.ts"
Cohesion: 0.46
Nodes (6): isCloudEnvVar(), getFieldPreviewDisplayValue(), isSecretField(), isServerInjectedField(), MASKED_VALUE_DISPLAY, ServerInjectedFieldContext

### Community 128 - "RollbackMenuAction.tsx"
Cohesion: 0.43
Nodes (6): canExecuteRollback(), RollbackConfirmation(), RollbackMenuAction(), renderAction(), ActionDropdown(), unavailableReason()

### Community 129 - "TargetForm.tsx"
Cohesion: 0.53
Nodes (4): encodeBase64(), TargetForm(), SecretType, isValidKubernetesLabelValue()

## Knowledge Gaps
- **17 isolated node(s):** `@patternfly/patternfly`, `@patternfly/react-styles`, `@types/dagre`, `victory`, `@types/react` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 955 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `CreateRun.tsx`, `operatorApi.ts`, `TerminalContent.tsx`, `krknAiState.ts`, `useNotifications`, `groupsApi.ts`, `apiClient.test.ts`, `VisualizeInstallCard.tsx`, `services/index.ts`, `handlers.ts`, `CloudCredentialsCard.tsx`, `provider.ts`, `ResiliencyHistoryChart.tsx`, `GraphRunDetail.tsx`, `UsersCard.tsx`, `RunCategoryActions.tsx`, `JobsList.tsx`, `DynamicFormBuilder.tsx`, `IdentityManagement.tsx`, `operatorApi`, `ElasticsearchAlertsTab.tsx`, `StudioCanvas.tsx`, `ResiliencyHistoryConfigurationTooltip.tsx`, `authService.ts`, `package.json`, `websocketHandlers.ts`, `ScenarioDetail.test.tsx`, `operatorApi`, `registriesApi.ts`, `StudioContext.tsx`, `useAuth`, `ScenariosList.tsx`, `components/JobsList.test.tsx`, `graphRunsApi.ts`, `componentsApi.ts`, `StudioNodeEditorModal.tsx`, `visualizeApi.ts`, `workflowsApi.ts`, `ScenarioConfigStep.tsx`, `AuthContext.tsx`, `BaseApiClient`, `KrknAIPage.test.tsx`, `useScenarioRunsPoller.ts`, `@patternfly/react-icons`, `useKrknAIOrigins.ts`, `krknAiArchive.ts`, `index.tsx`, `Studio.tsx`, `useReportActions.ts`, `VisualizeInstallCard.tsx`, `MockWebSocket`, `BackupRestoreCard.test.tsx`, `CategoryResponse`, `Login.tsx`, `useWebSocket.test.tsx`, `identityApi`, `terminalValidation.ts`, `KrknAIRunSummary`, `studioRecovery.ts`, `UserManagement.test.tsx`, `@patternfly/react-core`, `useClusterDiscovery.ts`, `ScenarioConfigStep.test.tsx`, `AppContext.tsx`, `Studio/WorkflowDetailsPanel.test.tsx`, `hooks/useJobs.ts`, `FileSelector.tsx`, `FileForm.test.tsx`, `JobStatsSummary.tsx`, `LoadWorkflowSelect.test.tsx`, `RollbackAvailability`, `fieldUtils.ts`, `setup.ts`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **What connects `@patternfly/patternfly`, `@patternfly/react-styles`, `@types/dagre` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CreateRun.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06467661691542288 - nodes in this community are weakly interconnected._
- **Why does `identityApi` connect `identityApi` to `BaseApiClient`, `API Documentation`, `Login.tsx`, `Provider Configuration API Specification`, `IdentityManagement.tsx`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `operatorApi.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055051421657592255 - nodes in this community are weakly interconnected._
- **Why does `react` connect `StudioNodeEditorModal.tsx` to `CreateRun.tsx`, `operatorApi.ts`, `TerminalContent.tsx`, `RollbackMenuAction.tsx`, `useNotifications`, `groupsApi.ts`, `TargetForm.tsx`, `vitest`, `services/index.ts`, `handlers.ts`, `ResiliencyHistoryChart.tsx`, `GraphRunDetail.tsx`, `UsersCard.tsx`, `RunCategoryActions.tsx`, `JobsList.tsx`, `DynamicFormBuilder.tsx`, `ElasticsearchDataView.tsx`, `IdentityManagement.tsx`, `operatorApi`, `ElasticsearchAlertsTab.tsx`, `App.tsx`, `CloudCredentialsCard.tsx`, `StudioCanvas.tsx`, `ResiliencyHistoryConfigurationTooltip.tsx`, `package.json`, `RunDetail.tsx`, `websocketService`, `ScenarioDetail.test.tsx`, `operatorApi`, `registriesApi.ts`, `StudioContext.tsx`, `useAuth`, `ScenarioExplorer.tsx`, `ScenariosList.tsx`, `RunList.tsx`, `componentsApi.ts`, `ResiliencyHistoryChart.tsx`, `ScenarioConfigStep.tsx`, `AuthContext.tsx`, `FileInfo`, `useScenarioRunsPoller.ts`, `ScenarioDetail.tsx`, `@patternfly/react-icons`, `useKrknAIOrigins.ts`, `index.tsx`, `Studio.tsx`, `ScenarioHealthCharts.tsx`, `useReportActions.ts`, `VisualizeInstallCard.tsx`, `CategoryResponse`, `Login.tsx`, `KrknAIRunSummary`, `@patternfly/react-core`, `useClusterDiscovery.ts`, `ScenarioConfigStep.test.tsx`, `AppContext.tsx`, `hooks/useJobs.ts`, `FileSelector.tsx`, `JobStatsSummary.tsx`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `krknAiState.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12312312312312312 - nodes in this community are weakly interconnected._