# Graph Report - console  (2026-11-26)

## Corpus Check
- 413 files · ~330,070 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: .css 16, (none) 6, .jsonl 2)

## Summary
- 2596 nodes · 7034 edges · 140 communities (123 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a5987a28`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CreateRun.tsx
- operatorApi.ts
- @patternfly/react-core
- krknAiState.ts
- react
- groupsApi.ts
- resiliencyHistoryReport.ts
- vitest
- VisualizeInstallCard.tsx
- websocketService.ts
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
- ScenarioDetail.tsx
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
- WorkspacesCard.tsx
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
- GraphRunDetail.test.tsx
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
- ResiliencyHistoryPage.tsx
- studioImport.ts
- useKrknAIOrigins.ts
- krknAiArchive.ts
- UI Style Guide
- index.tsx
- krknAiWebsocketHandlers.ts
- Studio.tsx
- ScenarioHealthCharts.tsx
- useReportActions.ts
- useStudioContext
- TargetForm.tsx
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
- StudioWorkflow
- UserManagement.test.tsx
- useScenarioRunDetail.test.tsx
- mockServiceWorker.js
- Development
- Functional Requirements
- config.ts
- 4. Update Target
- ScenariosRequest
- useGraphRunsPoller.test.tsx
- REQUIREMENTS.md
- 1. Create Target
- 5. Delete Target
- Studio/WorkflowDetailsPanel.test.tsx
- __tests__/RunCategoryActions.test.tsx
- services/index.ts
- compilerOptions
- 2. List Targets
- 3. Get Target by UUID
- Error Responses
- FAQ
- FileSelector.tsx
- Agent Instructions
- FileForm.test.tsx
- FitnessChart.tsx
- 2. API Endpoints Integration
- 6. Non-Functional Requirements
- description
- LoadWorkflowSelect.test.tsx
- graphRunReplay.test.ts
- allowScripts
- 3. UI Components
- 7. Deployment
- 9. Testing Requirements
- useReportActions.test.ts
- setup.ts
- TARGET_PROVIDER_CONFIG_SPEC.md
- LogViewer.test.tsx
- ScenarioRunDetailModal.test.tsx
- signatureVerificationApi.test.ts
- vite-env.d.ts
- msw
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
- `Phase 4: Custom Hooks ✅` --references--> `useTargetPoller()`  [INFERRED]
  spec.orig/agent-specs/PROGRESS-MVP.md → src/hooks/useTargetPoller.ts
- `Request Body` --references--> `CreateTargetRequest`  [INFERRED]
  spec.orig/REQUIREMENTS.md → src/types/api.ts
- `Description` --references--> `ScenariosRequest`  [INFERRED]
  spec.orig/agent-specs/REQUIREMENTS-MVP.md → src/types/api.ts
- `Error state` --references--> `useNotifications()`  [INFERRED]
  src/UI_STYLE_GUIDE.md → src/hooks/useNotifications.ts

## Import Cycles
- None detected.

## Communities (140 total, 17 thin omitted)

### Community 0 - "CreateRun.tsx"
Cohesion: 0.06
Nodes (57): yaml, ClusterComponentsEditor(), ClusterComponentsEditorProps, ComponentLocation, NamespaceComponent, withDisabledFlag(), withNamespaceDisabled(), componentData() (+49 more)

### Community 1 - "operatorApi.ts"
Cohesion: 0.05
Nodes (26): OperatorApiClient, mockFetch, mockFetch, mockFetch, AvailableFilesResponse, CategoriesListResponse, CategoryEntityAssociationResponse, ClustersResponse (+18 more)

### Community 2 - "@patternfly/react-core"
Cohesion: 0.09
Nodes (34): @patternfly/react-core, @patternfly/react-icons, ActiveRunsModal(), ActiveRunsModalProps, ActiveRunsSummary(), ActiveRunsSummaryProps, ClusterConflictWarningProps, ClusterHealthIndicator() (+26 more)

### Community 3 - "krknAiState.ts"
Cohesion: 0.09
Nodes (43): clustersField(), JsonRecord, krknAiHandlers, record(), registryContextField(), requestBody(), stringField(), buildState() (+35 more)

### Community 4 - "react"
Cohesion: 0.12
Nodes (25): react, BackupRestoreCard(), formatBytes(), configEntryCellStyle, ElasticsearchConfigForm(), ElasticsearchConfigsCard(), groupIdentifier(), ProviderConfigTab() (+17 more)

### Community 5 - "groupsApi.ts"
Cohesion: 0.10
Nodes (27): AddMembersModal(), AddMembersModalProps, Action, ClusterPermissionsTable(), ClusterPermissionsTableProps, CreateGroupModal(), CreateGroupModalProps, EditGroupModal() (+19 more)

### Community 6 - "resiliencyHistoryReport.ts"
Cohesion: 0.13
Nodes (44): jspdf, addPageFooters(), buildResiliencyHistoryPdf(), buildSnapshotRows(), clusterDisplayName(), collectConfigurations(), COLORS, ConfigurationRunType (+36 more)

### Community 7 - "vitest"
Cohesion: 0.09
Nodes (9): @testing-library/react, @testing-library/user-event, vitest, defaultProps, mocks, job, { mockGetSettings, mockUpdateSettings }, signatureState (+1 more)

### Community 8 - "VisualizeInstallCard.tsx"
Cohesion: 0.10
Nodes (23): ElasticsearchConfigFormProps, mockAlertsResult, mockConfigs, mockQueryResult, mockShowError, mockShowSuccess, StatusBadge(), VisualizeInstallCard() (+15 more)

### Community 9 - "websocketService.ts"
Cohesion: 0.09
Nodes (33): graphJob, mockConnectionState, scenarioJob, mockBuildResourceUrl, mockConnect, mockDisconnect, mockGetState, mockOffMessage (+25 more)

### Community 10 - "API Documentation"
Cohesion: 0.05
Nodes (36): 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 500 Internal Server Error, API Documentation, Authentication (+28 more)

### Community 11 - "handlers.ts"
Cohesion: 0.07
Nodes (29): msw, enablePreviewMode(), worker, handlers, mockCategories, mockClusters, mockDummyWorkflowDetail, mockFiles (+21 more)

### Community 12 - "Completed Tasks"
Cohesion: 0.05
Nodes (37): API Integration, Architecture Summary, Completed Tasks, Components Created, Components Updated, Features Added, Features Added, Immediate Next Actions (+29 more)

### Community 13 - "API Endpoints"
Cohesion: 0.05
Nodes (37): Access Control, Access Control, Account Features, Admin Role, Advanced User Management, API Endpoints, Audit and Compliance, Base URL (+29 more)

### Community 14 - "CloudCredentialsCard.tsx"
Cohesion: 0.09
Nodes (26): CloudCredentialForm(), CloudCredentialFormProps, CloudCredentialsCard(), credentialAccessLabel(), credentialsCellStyle, credentialsHeaderCellStyle, credentialsTableStyle, mutedTextStyle (+18 more)

### Community 15 - "provider.ts"
Cohesion: 0.09
Nodes (27): ProviderConfigTabProps, pollConfigStatus(), providersApi, AppState, FieldType, CreateProviderConfigResponse, CustomSchemaField, GetProviderConfigResponse (+19 more)

### Community 16 - "ResiliencyHistoryChart.tsx"
Cohesion: 0.11
Nodes (31): ActiveTooltip, ChartDomain, CLUSTER_COLORS, formatDate(), formatDateTick(), formatDelta(), getFullDomain(), getScoreTicks() (+23 more)

### Community 17 - "GraphRunDetail.tsx"
Cohesion: 0.13
Nodes (28): dagre, ClusterScoresSection(), getLayoutedElements(), GraphRunDetail(), GraphRunDetailProps, nodeTypes, ScenarioNode(), ResiliencyScoreBox() (+20 more)

### Community 18 - "UsersCard.tsx"
Cohesion: 0.13
Nodes (19): ChangePasswordFormProps, mockGroups, mockUsers, UserDetails(), UserDetailsProps, UserForm(), UserFormProps, UsersCard() (+11 more)

### Community 19 - "api.ts"
Cohesion: 0.07
Nodes (35): ErrorDisplayProps, AppError, AuthType, BaseField, BooleanField, DEFAULT_WORKLOAD_IMAGE_TAGS, EnumField, ErrorResponse (+27 more)

### Community 20 - "RunCategoryActions.tsx"
Cohesion: 0.12
Nodes (22): RollbackActionsProps, canExecuteRollback(), RollbackAttempt, RollbackConfirmation(), RollbackMenuAction(), RollbackMenuActionProps, job, notifications (+14 more)

### Community 21 - "JobsList.tsx"
Cohesion: 0.12
Nodes (25): anser, JobDiagnosticAlert(), JobDiagnosticAlertProps, GRAPH_RUN_TERMINAL_PHASES, JobsList(), JobsListProps, rollbackProgress(), toUnifiedRunItem() (+17 more)

### Community 22 - "Provider Configuration API Specification"
Cohesion: 0.06
Nodes (30): 1. List Available Providers (Optional), 1. List Providers, 2. Create Config Request, 2. Get Provider Config Status, 2. Update Provider Status, 3. Create Provider Config Request, 3. Poll for Completion, 3. Update Provider Configuration (+22 more)

### Community 23 - "DynamicFormBuilder.tsx"
Cohesion: 0.15
Nodes (18): DynamicFormBuilder(), DynamicFormBuilderProps, ScrollableFieldGroup(), DynamicFormBuilderWithTracking(), DynamicFormBuilderWithTrackingProps, ScrollableFieldGroupWithTracking(), ScenarioParameterSectionsProps, ScenarioConfigStepProps (+10 more)

### Community 24 - "ElasticsearchDataView.tsx"
Cohesion: 0.10
Nodes (28): buildClusterConfigRows(), buildPodRecoveryData(), ClusterConfigTable(), displayValue(), ElasticsearchDataView(), FILTER_CATEGORIES, findExpectedRecoveryTime(), flattenEntries() (+20 more)

### Community 25 - "IdentityManagement.tsx"
Cohesion: 0.11
Nodes (23): AccountLoadState(), emptyProvider, failure(), hasMapping(), IdentityManagement(), confirmAction(), confirmMapping(), loadMoreRemoteGroups() (+15 more)

### Community 26 - "operatorApi"
Cohesion: 0.21
Nodes (17): react-icons, CategoryForm(), groupsResponse, useCategoryManagementPage(), useFileManagementPage(), SaveWorkflowModal(), SaveWorkflowModalProps, buildGraph() (+9 more)

### Community 27 - "ElasticsearchAlertsTab.tsx"
Cohesion: 0.13
Nodes (24): ALERT_FILTER_OPTIONS, alertSeverity(), alertSeverityColor(), AlertSortColumn, alertSummaryField(), ElasticsearchAlertsTab(), ElasticsearchAlertsTabProps, formatAlertCreatedAt() (+16 more)

### Community 28 - "krknAiApi.ts"
Cohesion: 0.11
Nodes (27): ScenarioExplorerProps, KrknAiArchiveSnapshot, PreviewKrknAIRun, RunState, SeedFixture, KrknAIApiRequestOptions, KrknAIArtifactStatus, KrknAIConfigRequest (+19 more)

### Community 29 - "App.tsx"
Cohesion: 0.13
Nodes (19): App(), appMocks, renderApp(), ChangePasswordForm(), ComponentVersionsAccess(), ErrorDisplay(), LoadingScreen(), RegistrySelector() (+11 more)

### Community 30 - "ScenarioDetail.tsx"
Cohesion: 0.15
Nodes (22): ClusterConflictWarning(), readFileAsBase64(), ScenarioDetail(), ScenarioParameterSections(), ScenarioReference, CLOUD_DISABLED_FIELDS, CLOUD_ENV_VAR_PREFIXES, CLOUD_TYPE_DESCRIPTION_TAGS (+14 more)

### Community 31 - "authService"
Cohesion: 0.16
Nodes (6): AuthState, authService, AuthSession, clearAuthStorage(), parseCookieSession(), User

### Community 32 - "StudioCanvas.tsx"
Cohesion: 0.15
Nodes (15): reactflow, DeletableEdge(), edgeTypes, nodeTypes, StudioCanvas(), StudioCanvasProps, StudioNode(), formatValue() (+7 more)

### Community 33 - "ResiliencyHistoryConfigurationTooltip.tsx"
Cohesion: 0.14
Nodes (17): ConfigRows(), ConfigurationRunType, displayValue(), GraphConfiguration(), GraphNode(), ResiliencyHistoryConfigurationTooltip(), RunConfiguration, ScenarioConfiguration() (+9 more)

### Community 34 - "authService.ts"
Cohesion: 0.14
Nodes (18): AuthContextValue, { createRootMock, workerStartMock }, AUTH_STORAGE_KEY_LIST, AuthSessionRecord, emptySession(), hasLegacyAuth(), readLegacySession(), readUserFromStorage() (+10 more)

### Community 35 - "Frontend Authentication Tasks - Import Guide"
Cohesion: 0.08
Nodes (24): 1. Initialize Beads (if not already done), 2. Import the Frontend Tasks, 3. Verify Import, API Reference, Documentation, Frontend Authentication Tasks - Import Guide, Need Help?, Notes (+16 more)

### Community 36 - "package.json"
Cohesion: 0.08
Nodes (23): name, private, type, version, eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, jsdom (+15 more)

### Community 37 - "RunDetail.tsx"
Cohesion: 0.18
Nodes (20): errorText(), isActive(), KrknAIPage(), mergeSummaryIntoRun(), phaseOf(), MetadataPanel(), MetadataPanelProps, ConfigState (+12 more)

### Community 38 - "websocketHandlers.ts"
Cohesion: 0.10
Nodes (19): krknAiWebsocketHandlers, server, server, createRunsMessage(), dashboardHandler, dashboardWs, getMockLogLines(), graphrunsHandler (+11 more)

### Community 39 - "websocketService"
Cohesion: 0.14
Nodes (4): websocketService, ConnectionStateHandler, ManagedConnection, RawMessageHandler

### Community 40 - "ScenarioDetail.test.tsx"
Cohesion: 0.14
Nodes (11): NodeMetadataStepProps, WorkspaceSelector(), WorkspaceSelectorProps, fetchMock, workspacesApi, CreateScenarioRunResponse, ScenarioRunRequest, WorkspaceInfo (+3 more)

### Community 41 - "WorkspacesCard.tsx"
Cohesion: 0.16
Nodes (14): @patternfly/react-table, CategoriesTable(), CategoriesTableProps, CategoryFormModal(), CategoryFormModalProps, CategoryManagementPage(), FILE_PURPOSE_CONFIG, MultiFilterProps (+6 more)

### Community 42 - "registriesApi.ts"
Cohesion: 0.15
Nodes (13): RegistrySelectorStepProps, registriesApi, RFC-1123, fetchJson(), mockFetchJson, AvailableRegistriesResponse, AvailableRegistry, CreateRegistryRequest (+5 more)

### Community 43 - "StudioContext.tsx"
Cohesion: 0.16
Nodes (13): saveAutosave(), workflow, detectCircularDependencies(), mergeVisibleCategorySelection(), normalizeCategoryNames(), SavedWorkflowMetadata, StudioContext, StudioProvider() (+5 more)

### Community 44 - "useAuth"
Cohesion: 0.21
Nodes (11): react-router-dom, AppRouter(), AdminOnly(), AdminOnlyProps, ProtectedRoute(), ProtectedRouteProps, useAuth(), Register() (+3 more)

### Community 45 - "ScenarioExplorer.tsx"
Cohesion: 0.22
Nodes (20): CalculationStatus(), CancelledFitnessValue(), columns, displayValue(), formatFitness(), isBaselineScenario(), isCalculationPending(), isGenerationFinalized() (+12 more)

### Community 46 - "ScenariosList.tsx"
Cohesion: 0.17
Nodes (13): ScenariosList(), SortOption, SignatureStatusIcon(), SignatureStatusIconProps, statusDetails, ScenariosListStep(), AppContext, { mockGetSettings, mockUpdateSettings } (+5 more)

### Community 47 - "components/JobsList.test.tsx"
Cohesion: 0.14
Nodes (10): defaultProps, noopSet, resetJobsMock(), setMockIsLoading(), setMockJobs(), setMockPagination(), setMockSnapshotVersion(), setMockStats() (+2 more)

### Community 48 - "graphRunsApi.ts"
Cohesion: 0.17
Nodes (10): GraphRunsApiClient, fetch(), fetchJson(), mockFetch, mockFetchJson, CreateGraphRunRequest, GraphRunDetail, GraphRunListItem (+2 more)

### Community 49 - "CLAUDE.md - Project Instructions"
Cohesion: 0.10
Nodes (19): Architecture Principles, Before Committing, Before Writing Code, CLAUDE.md - Project Instructions, Code Organization & Reusability, Code Quality Standards, Communication, Critical Rules (+11 more)

### Community 50 - "RunList.tsx"
Cohesion: 0.18
Nodes (16): CreateRunProps, FitnessValue(), RunDetailProps, getClusterName(), KrknAIRunListEntry, phaseColor(), RunActionsMenu(), RunList() (+8 more)

### Community 51 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, jsdom, msw, @testing-library/jest-dom, @testing-library/react (+11 more)

### Community 52 - "Deployment Scripts"
Cohesion: 0.11
Nodes (17): `build-and-push.sh`, Common Workflows, `deploy-k8s.sh`, Deployment Scripts, `dev-setup.sh`, 🔧 Development, 🐳 Docker, First Time Deployment (+9 more)

### Community 53 - "componentsApi.ts"
Cohesion: 0.19
Nodes (9): consoleComponentManifest, consoleComponentName, ComponentVersionsCard(), ComponentVersionsModal(), ComponentVersionsModalProps, ComponentDescription, ComponentManifest, componentsApi (+1 more)

### Community 54 - "GraphRunDetail.test.tsx"
Cohesion: 0.11
Nodes (8): NodeDetailModalProps, mockCreateGraphRun, mockDownloadJson, mockGetGraphRun, mockGetGraphRunConfig, mockGetScenarios, mockGetScenarioRunStatus, NodeStatus

### Community 55 - "StudioNodeEditorModal.tsx"
Cohesion: 0.17
Nodes (11): NodeMetadataStep(), RegistrySelectorStep(), StudioNodeEditorModalComponent(), StudioNodeEditorModalProps, renderEditor(), scenarioConfigMockState, WizardStepConfig, WizardStepper() (+3 more)

### Community 56 - "visualizeApi.ts"
Cohesion: 0.16
Nodes (9): mockDashboards, mockInstances, visualizeApi, GrafanaDashboard, ListVisualizeResponse, VisualizeConfig, VisualizeDashboardsResponse, VisualizeLogsResponse (+1 more)

### Community 57 - "KrknAIApiClient"
Cohesion: 0.14
Nodes (3): createKrknAIHttpError(), KrknAIApiClient, KrknAIConfigValidationError

### Community 58 - "workflowsApi.ts"
Cohesion: 0.19
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
Nodes (13): canReuseCacheEntry(), extractDefaultValues(), ScenarioConfigStep(), fetchScenarioDetail(), scenarioDetailCache, ScenarioDetailCacheEntry, scenarioDetailCacheKey(), renderStep() (+5 more)

### Community 64 - "AuthContext.tsx"
Cohesion: 0.16
Nodes (13): AuthAction, AuthContext, AuthProvider(), AuthProviderProps, authReducer(), initialState, AccountStateReader(), LogoutConsumer() (+5 more)

### Community 65 - "BaseApiClient"
Cohesion: 0.16
Nodes (7): mockFetch, UnifiedJobsResponse, ApiError, authenticatedFetch(), BaseApiClient, createApiError(), TestApiClient

### Community 66 - "FileInfo"
Cohesion: 0.20
Nodes (12): FileForm(), loadFile(), FileFormProps, FileFormModal(), FileFormModalProps, FileManagementPage(), canModifyFile(), FilesTable() (+4 more)

### Community 67 - "KrknAIPage.test.tsx"
Cohesion: 0.14
Nodes (10): advance(), flushReact(), mockRunResources, mocks, openWizardToConfiguration(), openWizardToPreview(), openWizardToPreviousRuns(), originalHiddenDescriptor (+2 more)

### Community 68 - "useScenarioRunsPoller.ts"
Cohesion: 0.17
Nodes (8): mocks, mockConnectionState, mockDispatch, mockScenarioRuns, hasChanges(), TERMINAL_PHASES, ScenarioRunState, ScenarioRunStatusResponse

### Community 69 - "ResiliencyHistoryPage.tsx"
Cohesion: 0.17
Nodes (12): AppliedFilters, clusterIdentity(), ClusterOption, hasHistoryData(), ResiliencyHistoryPage(), emptyHistory, mocks, multiHistory (+4 more)

### Community 70 - "studioImport.ts"
Cohesion: 0.25
Nodes (14): assertValidNodeIds(), buildStudioExport(), computeDepths(), graphNodeToStudioConfig(), isGraphMapShape(), isStudioWorkflowShape(), parseImportedWorkflow(), reconstructWorkflowFromGraph() (+6 more)

### Community 71 - "useKrknAIOrigins.ts"
Cohesion: 0.20
Nodes (11): mocks, run(), RunFixture, ChildOrigins, errorMessage(), httpStatus(), isOptionalOriginLookupFailure(), labelValue() (+3 more)

### Community 72 - "krknAiArchive.ts"
Cohesion: 0.22
Nodes (13): buildKrknAiArchiveFiles(), crc32(), CRC_TABLE, createKrknAiZipArchive(), jsonFile(), KrknAiArchiveFile, safeFileSegment(), textFile() (+5 more)

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
Cohesion: 0.35
Nodes (11): LoadWorkflowSelect(), RunWorkflowModal(), Studio(), StudioContent(), clearAutosave(), loadAutosave(), StudioNodeEditorModal, StudioRecoveryModal() (+3 more)

### Community 77 - "ScenarioHealthCharts.tsx"
Cohesion: 0.29
Nodes (12): colors, formatNumber(), MeasuredSample, measurementDetails(), MeasurementField, measurementFields(), MeasurementTooltip(), OutcomeMeasurement() (+4 more)

### Community 78 - "useReportActions.ts"
Cohesion: 0.21
Nodes (9): ReportDownloadButton(), ReportDownloadButtonProps, mockDownloadReportHTML, mockDownloadReportPDF, mockGetReportStatus, useReportActions(), UseReportActionsOptions, UseReportActionsResult (+1 more)

### Community 79 - "useStudioContext"
Cohesion: 0.24
Nodes (9): renderModal(), signatureState, signedNode, unsignedNode, SaveWorkflowConfirmModal(), useStudioContext(), assembleExportFile(), StudioToolbar() (+1 more)

### Community 80 - "TargetForm.tsx"
Cohesion: 0.22
Nodes (8): encodeBase64(), TargetForm(), TargetFormProps, CreateTargetRequest, SecretType, TargetOperationResponse, UpdateTargetRequest, isValidKubernetesLabelValue()

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
Cohesion: 0.32
Nodes (9): CategoryFormProps, CategoryMultiSelect(), CategoryMultiSelectProps, categories, Harness(), RunCategoryStripeProps, StudioContextType, CategoryLoadStatus (+1 more)

### Community 86 - "Login.tsx"
Cohesion: 0.29
Nodes (5): useCooldown(), Login(), toRouterRelativeReturnUrl(), renderLogin(), renderLogin()

### Community 87 - "useWebSocket.test.tsx"
Cohesion: 0.17
Nodes (11): mockConnect, mockDisconnect, mockGetState, mockOffMessage, mockOffRawMessage, mockOffStateChange, mockOnMessage, mockOnRawMessage (+3 more)

### Community 89 - "terminalValidation.ts"
Cohesion: 0.29
Nodes (10): ALLOWED_COMMANDS, BLOCKED_COMMANDS, BLOCKED_FLAGS, findBlockedFlag(), getAllowedCommands(), hasStreamingFlags(), isWriteCommand(), parseCommand() (+2 more)

### Community 90 - "KrknAIRunSummary"
Cohesion: 0.38
Nodes (8): ResultsDownloadButton(), ResultsDownloadButtonProps, completeSummary, useKrknAIResultsDownload(), UseKrknAIResultsDownloadOptions, krknAiApi, KrknAIRunPhase, KrknAIRunSummary

### Community 91 - "StudioWorkflow"
Cohesion: 0.24
Nodes (8): StudioProviderProps, ParsedImport, StudioExportFile, getStudioRecoveryState(), StudioRecoveryState, workflow, StudioWorkflow, GraphRunReplayPayload

### Community 92 - "UserManagement.test.tsx"
Cohesion: 0.18
Nodes (10): mockAuthState, mockCreateUser, mockDeleteUser, mockGetUser, mockIsAdmin, mockListGroups, mockListUsers, mockShowError (+2 more)

### Community 93 - "useScenarioRunDetail.test.tsx"
Cohesion: 0.18
Nodes (10): mockBuildResourceUrl, mockConnect, mockDisconnect, mockGetState, mockOffMessage, mockOffStateChange, mockOnMessage, mockOnStateChange (+2 more)

### Community 94 - "mockServiceWorker.js"
Cohesion: 0.36
Nodes (8): activeClientIds, getResponse(), handleRequest(), IS_MOCKED_RESPONSE, resolveMainClient(), respondWithMock(), sendToClient(), serializeRequest()

### Community 95 - "Development"
Cohesion: 0.20
Nodes (9): Development, Environment Variables, Krkn-AI run integration, krkn-operator-console, License, Mock development and PR previews, Other Commands, Prerequisites (+1 more)

### Community 96 - "Functional Requirements"
Cohesion: 0.20
Nodes (10): 10. Future Enhancements (Out of Scope for MVP), 1. Application Initialization Workflow, 4. State Management, 5. Configuration, 8.1 Project Structure, 8.2 Development Commands, 8. Development Workflow, API Service Client (+2 more)

### Community 97 - "config.ts"
Cohesion: 0.33
Nodes (3): config, transformDiscoveredClusters(), FetchState

### Community 98 - "4. Update Target"
Cohesion: 0.22
Nodes (9): 400 Bad Request, 404 Not Found, 4. Update Target, 500 Internal Server Error, Error Responses, Example Request, Path Parameters, Request Body (+1 more)

### Community 99 - "ScenariosRequest"
Cohesion: 0.28
Nodes (6): ScenarioDetailProps, ScenariosListStepProps, UseScenariosFetchResult, ScenarioGlobals, ScenariosRequest, ScenarioTag

### Community 100 - "useGraphRunsPoller.test.tsx"
Cohesion: 0.22
Nodes (5): mockConnectionState, mockDispatch, mockGraphRuns, sendWsMessage(), GraphRunState

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

### Community 105 - "__tests__/RunCategoryActions.test.tsx"
Cohesion: 0.25
Nodes (7): categories, defaultProps, mockClosePreview, mockHandleDownload, mockHandlePreview, mockReportReturn, mockRetry

### Community 106 - "services/index.ts"
Cohesion: 0.36
Nodes (3): signatureVerificationApi, SignatureVerificationSettingsRequest, SignatureVerificationSettingsResponse

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
Cohesion: 0.43
Nodes (4): FileSelector(), FileSelectorProps, mockAvailableFiles, FileReference

### Community 113 - "Agent Instructions"
Cohesion: 0.33
Nodes (5): Agent Instructions, graphify, Landing the Plane (Session Completion), Quick Reference, UI Conventions

### Community 115 - "FitnessChart.tsx"
Cohesion: 0.53
Nodes (5): FitnessChart(), FitnessChartProps, formatFitness(), getExpandedDomain(), KrknAIFitnessProgression

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

### Community 120 - "graphRunReplay.test.ts"
Cohesion: 0.40
Nodes (4): mockGetGraphRun, mockGetGraphRunConfig, mockGetScenarios, mockListAvailableCredentials

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

### Community 125 - "useReportActions.test.ts"
Cohesion: 0.50
Nodes (3): mockDownloadReportHTML, mockDownloadReportPDF, mockGetReportStatus

## Knowledge Gaps
- **17 isolated node(s):** `@patternfly/patternfly`, `@patternfly/react-styles`, `@types/dagre`, `victory`, `@types/react` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 960 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `CreateRun.tsx`, `LogViewer.test.tsx`, `@patternfly/react-core`, `operatorApi.ts`, `ScenarioRunDetailModal.test.tsx`, `groupsApi.ts`, `react`, `krknAiState.ts`, `VisualizeInstallCard.tsx`, `websocketService.ts`, `signatureVerificationApi.test.ts`, `handlers.ts`, `CloudCredentialsCard.tsx`, `provider.ts`, `ResiliencyHistoryChart.tsx`, `GraphRunDetail.tsx`, `UsersCard.tsx`, `RunCategoryActions.tsx`, `DynamicFormBuilder.tsx`, `operatorApi`, `ElasticsearchAlertsTab.tsx`, `App.tsx`, `ScenarioDetail.tsx`, `StudioCanvas.tsx`, `ResiliencyHistoryConfigurationTooltip.tsx`, `authService.ts`, `package.json`, `websocketHandlers.ts`, `ScenarioDetail.test.tsx`, `WorkspacesCard.tsx`, `registriesApi.ts`, `StudioContext.tsx`, `useAuth`, `ScenariosList.tsx`, `components/JobsList.test.tsx`, `graphRunsApi.ts`, `componentsApi.ts`, `GraphRunDetail.test.tsx`, `StudioNodeEditorModal.tsx`, `visualizeApi.ts`, `workflowsApi.ts`, `ScenarioConfigStep.tsx`, `AuthContext.tsx`, `BaseApiClient`, `FileInfo`, `KrknAIPage.test.tsx`, `useScenarioRunsPoller.ts`, `ResiliencyHistoryPage.tsx`, `studioImport.ts`, `useKrknAIOrigins.ts`, `krknAiArchive.ts`, `index.tsx`, `useReportActions.ts`, `useStudioContext`, `MockWebSocket`, `BackupRestoreCard.test.tsx`, `CategoryResponse`, `Login.tsx`, `useWebSocket.test.tsx`, `identityApi`, `terminalValidation.ts`, `KrknAIRunSummary`, `StudioWorkflow`, `UserManagement.test.tsx`, `useScenarioRunDetail.test.tsx`, `config.ts`, `useGraphRunsPoller.test.tsx`, `Studio/WorkflowDetailsPanel.test.tsx`, `__tests__/RunCategoryActions.test.tsx`, `FileSelector.tsx`, `FileForm.test.tsx`, `LoadWorkflowSelect.test.tsx`, `graphRunReplay.test.ts`, `useReportActions.test.ts`, `setup.ts`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **What connects `@patternfly/patternfly`, `@patternfly/react-styles`, `@types/dagre` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CreateRun.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06467661691542288 - nodes in this community are weakly interconnected._
- **Why does `identityApi` connect `identityApi` to `BaseApiClient`, `API Documentation`, `Login.tsx`, `Provider Configuration API Specification`, `IdentityManagement.tsx`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `operatorApi.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046153846153846156 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `CreateRun.tsx`, `@patternfly/react-core`, `groupsApi.ts`, `VisualizeInstallCard.tsx`, `websocketService.ts`, `CloudCredentialsCard.tsx`, `ResiliencyHistoryChart.tsx`, `GraphRunDetail.tsx`, `UsersCard.tsx`, `RunCategoryActions.tsx`, `JobsList.tsx`, `DynamicFormBuilder.tsx`, `ElasticsearchDataView.tsx`, `IdentityManagement.tsx`, `operatorApi`, `ElasticsearchAlertsTab.tsx`, `App.tsx`, `ScenarioDetail.tsx`, `StudioCanvas.tsx`, `ResiliencyHistoryConfigurationTooltip.tsx`, `package.json`, `RunDetail.tsx`, `ScenarioDetail.test.tsx`, `WorkspacesCard.tsx`, `StudioContext.tsx`, `useAuth`, `ScenarioExplorer.tsx`, `ScenariosList.tsx`, `RunList.tsx`, `componentsApi.ts`, `StudioNodeEditorModal.tsx`, `ScenarioConfigStep.tsx`, `AuthContext.tsx`, `useScenarioRunsPoller.ts`, `ResiliencyHistoryPage.tsx`, `useKrknAIOrigins.ts`, `index.tsx`, `Studio.tsx`, `ScenarioHealthCharts.tsx`, `useReportActions.ts`, `useStudioContext`, `TargetForm.tsx`, `CategoryResponse`, `Login.tsx`, `KrknAIRunSummary`, `config.ts`, `ScenariosRequest`, `FileSelector.tsx`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `@patternfly/react-core` be split into smaller, more focused modules?**
  _Cohesion score 0.08552188552188553 - nodes in this community are weakly interconnected._