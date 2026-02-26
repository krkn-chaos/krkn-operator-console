# CLAUDE.md - krkn-operator Project Instructions

## Project Overview

This is the **krkn-operator-console**, the React-based frontend/UI for the krkn-operator-ecosystem. It provides a web interface for managing chaos engineering scenarios, cluster targets, and provider configurations.

### Ecosystem Architecture

The krkn-operator-ecosystem consists of multiple projects (located one folder above this project):

- **krkn-operator** (`../krkn-operator`) - Core operator with shared reusable code in `pkg/`
- **krkn-operator-acm** (`../krkn-operator-acm`) - Integration operator with Red Hat Advanced Cluster Management (ACM)
- **krkn-operator-console** (this project) - React frontend/UI for the ecosystem

**Important**: Decisions and changes made in krkn-operator-console often require reading or modifying the backend projects. Always consider the impact on API contracts with krkn-operator and krkn-operator-acm

## Quick Reference - Most Critical Rules

**Before You Write ANY Code:**
1. 🔍 **Search for existing patterns** - Don't reinvent the wheel
2. ✅ **Create beads issue** - `bd create` before coding
3. 🚫 **NEVER duplicate code** - Extract to hooks/utils/components immediately
4. 📝 **Define TypeScript interfaces first** - Type safety is mandatory
5. ✅ **Write tests alongside code** - Not after, during

**Before You Commit:**
1. 🔍 **Review diff for duplication** - If ANY code is duplicated, refactor it
2. ✅ **Run tests** - `npm test` must pass
3. ✅ **Run linter** - `npm run lint` must pass
4. ✅ **Test in browser** - All user flows must work
5. ✅ **Close beads** - `bd close <id>` and `bd sync`

**Golden Rules:**
- 🚨 **Code duplication = Production bug waiting to happen** - Zero tolerance
- 🚨 **TypeScript errors = Build failure** - Fix them, never ignore
- 🚨 **Every component needs tests** - Minimum 80% coverage
- 🚨 **Use beads for ALL tasks** - No TODO.md or markdown tracking files

---

## Critical Rules

### Task Management

**MANDATORY: Use beads exclusively for all task tracking**
- ✅ ALWAYS use `bd create` to create tasks before starting work
- ✅ ALWAYS use `bd ready` to find available work
- ✅ ALWAYS use `bd update <id> --status=in_progress` when starting a task
- ✅ ALWAYS use `bd close <id>` when completing work
- ❌ NEVER start coding without creating a beads issue first

**PROHIBITED - Do NOT create these files for task tracking:**
- ❌ NEVER use TodoWrite or TaskCreate tools
- ❌ NEVER create TODO.md, tasks.md, TASKS.md, PROGRESS.md, or any markdown files for tasks
- ❌ NEVER create checklists in markdown files
- ❌ NEVER create issue lists or tracking files
- ✅ Use ONLY beads (`bd` commands) for all task and issue tracking



### Code Duplication - ZERO TOLERANCE POLICY

**CRITICAL: Code duplication is the enemy of maintainability. You must actively work to eliminate it.**

**Detection and Prevention:**
- 🚨 MANDATORY: Before writing ANY code, search the codebase for similar patterns
- ❌ NEVER copy-paste code between components/hooks/utils
- ❌ NEVER duplicate logic "just this once" - refactor immediately
- ✅ If code appears in 2+ places, it MUST be extracted into a shared function
- ✅ If you see duplicated code while working, refactor it as part of your task
- ✅ Use your IDE's "find similar code" features to detect duplication

**Where to Extract Duplicated Code:**

1. **Custom Hooks** (`src/hooks/`) - For reusable business logic:
   ```typescript
   // ❌ BAD: Duplicated loading state in multiple components
   function ComponentA() {
     const [loading, setLoading] = useState(false);
     const [data, setData] = useState(null);
     const [error, setError] = useState(null);

     useEffect(() => {
       async function fetch() {
         setLoading(true);
         try {
           const result = await api.getData();
           setData(result);
         } catch (e) {
           setError(e.message);
         } finally {
           setLoading(false);
         }
       }
       fetch();
     }, []);
   }

   // ✅ GOOD: Extract into reusable hook
   function useFetchData<T>(fetcher: () => Promise<T>) {
     const [loading, setLoading] = useState(false);
     const [data, setData] = useState<T | null>(null);
     const [error, setError] = useState<string | null>(null);

     useEffect(() => {
       async function fetch() {
         setLoading(true);
         try {
           const result = await fetcher();
           setData(result);
         } catch (e) {
           setError(e instanceof Error ? e.message : 'Error');
         } finally {
           setLoading(false);
         }
       }
       fetch();
     }, [fetcher]);

     return { data, loading, error };
   }
   ```

2. **Utility Functions** (`src/utils/`) - For pure transformations:
   ```typescript
   // ❌ BAD: Same formatting logic duplicated
   function ComponentA() {
     const formatted = new Date(timestamp).toLocaleDateString('en-US');
   }
   function ComponentB() {
     const formatted = new Date(timestamp).toLocaleDateString('en-US');
   }

   // ✅ GOOD: Extract to utility
   // utils/dateFormatters.ts
   export function formatDate(timestamp: string): string {
     return new Date(timestamp).toLocaleDateString('en-US');
   }
   ```

3. **Shared Components** (`src/components/shared/`) - For reusable UI patterns:
   ```typescript
   // ❌ BAD: Same error alert in multiple places
   <Alert variant="danger" title="Error">
     {error instanceof Error ? error.message : 'Unknown error'}
   </Alert>

   // ✅ GOOD: Extract to shared component
   export function ErrorAlert({ error }: { error: unknown }) {
     return (
       <Alert variant="danger" title="Error">
         {error instanceof Error ? error.message : 'Unknown error'}
       </Alert>
     );
   }
   ```

4. **Service Layer Methods** (`src/services/`) - For repeated API patterns:
   ```typescript
   // ❌ BAD: Same error handling duplicated
   async function fetchA() {
     const res = await fetch('/a');
     if (!res.ok) throw new Error(`HTTP ${res.status}`);
     return res.json();
   }
   async function fetchB() {
     const res = await fetch('/b');
     if (!res.ok) throw new Error(`HTTP ${res.status}`);
     return res.json();
   }

   // ✅ GOOD: Base class with shared logic
   class BaseApi {
     protected async fetchJson<T>(url: string): Promise<T> {
       const res = await fetch(url);
       if (!res.ok) throw new Error(`HTTP ${res.status}`);
       return res.json();
     }
   }
   ```

**Refactoring Workflow:**

1. **When You Notice Duplication:**
   - Stop immediately - do not continue writing duplicated code
   - Identify the pattern being repeated
   - Extract to appropriate location (hook/util/component/service)
   - Update all instances to use the extracted version
   - Test all affected code paths

2. **Before Committing:**
   - Review your diff for any copy-pasted code
   - Search codebase for similar patterns you might have missed
   - If you find 3+ lines repeated, extract them

3. **Code Review Checklist:**
   - "Could this logic be reused elsewhere?"
   - "Does similar code exist in another file?"
   - "Would this pattern benefit other components?"

**Red Flags - Signs of Duplication:**
- 🚩 Copy-pasting code between files
- 🚩 Similar variable names in different components (`isLoadingA`, `isLoadingB`)
- 🚩 Repeated if/else or switch statements with same structure
- 🚩 Similar useEffect dependencies in multiple components
- 🚩 Identical error handling patterns
- 🚩 Same validation logic in multiple forms

**Examples from This Project:**

✅ **Good Reuse:**
- `useNotifications()` - Centralized notification logic (used in Settings, ProviderConfigTab, etc.)
- `DynamicFormBuilder` - Schema-driven form generation (reused for scenarios and providers)
- `parseSchema()` - Supports both JSON Schema and custom format (one parser, multiple use cases)
- `providersApi` service - Centralized API logic with consistent error handling

❌ **Watch Out For:**
- Don't duplicate polling logic - use `useTargetPoller` and `useProviderConfigPoller` patterns
- Don't duplicate API error handling - use the established pattern in services
- Don't duplicate loading states - consider extracting to custom hook
- Don't duplicate form validation - use shared validation functions

**Remember:**
- Every line of duplicated code is 2x the bugs, 2x the maintenance, 2x the technical debt
- Spending 10 minutes refactoring now saves hours of debugging later
- The best code is code you don't have to write because it's already been extracted

### Code Quality Standards

**This is PRODUCTION code. Every change must meet these standards:**

**Testing:**
- ✅ MANDATORY: Write tests for ALL new code
- ✅ Unit tests for custom hooks and utility functions
- ✅ Integration tests for components with business logic
- ✅ Mock API calls and external dependencies
- ✅ Test error states and edge cases
- ✅ Run `npm test` before committing
- ✅ Minimum 80% code coverage for new code

**Documentation:**
- ✅ MANDATORY: Add JSDoc comments for exported functions and complex logic
- ✅ TypeScript interfaces serve as inline documentation
- ✅ Explain WHY, not just WHAT (include context and rationale)
- ✅ Document error conditions and edge cases
- ✅ Include usage examples for complex components/hooks
- ✅ Update README.md when adding new features

**Code Reviews & Quality:**
- ✅ Follow React and TypeScript best practices
- ✅ Handle ALL errors explicitly - never ignore catch blocks
- ✅ Use meaningful variable and function names
- ✅ Keep components and functions small and focused (Single Responsibility)
- ✅ Add validation for all user inputs
- ✅ Use console.error for errors, console.log only in development
- ✅ Run `npm run lint` and fix all issues before committing

## Development Workflow

### Before Writing Code
1. Create a beads issue: `bd create --title="..." --description="..." --type=task --priority=2`
2. Review the issue: `bd show <id>`
3. Mark as in progress: `bd update <id> --status=in_progress`
4. Read existing code to understand patterns and avoid duplication
5. Identify where code should go:
   - `src/components/` for UI components
   - `src/hooks/` for reusable business logic
   - `src/services/` for API clients
   - `src/utils/` for pure utility functions
   - `src/types/` for TypeScript interfaces

### While Writing Code
1. **FIRST**: Search codebase for similar existing patterns - can you reuse existing code?
2. Write the minimum code needed to solve the problem
3. **STOP if you copy-paste**: Extract duplicated logic into hooks/utils immediately
4. Define TypeScript interfaces before implementation
5. Write tests alongside the implementation
6. Add JSDoc comments for complex logic
7. **Continuous refactoring**: If you see duplication while working, fix it
8. Run tests frequently: `npm test`
9. Check the app in browser: `npm run dev`

### Before Committing
1. **CRITICAL**: Review your diff - is ANY code duplicated? Refactor if yes
2. Search codebase for similar patterns you might have missed
3. Run full test suite: `npm test`
4. Run linters: `npm run lint`
5. Run type checking: `npm run type-check` (if available)
6. Verify code coverage is adequate
7. Test in browser - verify all user flows work
8. Close beads issue: `bd close <id>`
9. Sync beads: `bd sync`
10. Commit with meaningful message

### Session End Protocol
**CRITICAL - Always complete these steps:**
```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```


## React Enterprise Best Practices

### Technology Stack

**Core Technologies:**
- ✅ React 18 with TypeScript (strict mode enabled)
- ✅ Vite for build tooling and development server
- ✅ PatternFly 5 for enterprise UI components
- ✅ Context API + Reducer pattern for state management
- ✅ Custom hooks for reusable logic

**Project Structure:**
```
src/
├── components/       # React components (presentational + container)
├── context/         # Context providers and reducers
├── hooks/           # Custom hooks (business logic)
├── services/        # API clients and external integrations
├── types/           # TypeScript type definitions
├── utils/           # Pure utility functions
└── config.ts        # Application configuration
```

### Type Safety & TypeScript

**Strict Type Definitions:**
- ✅ MANDATORY: Define interfaces for ALL API responses and requests
- ✅ Use `type` for unions/aliases, `interface` for object shapes
- ✅ Avoid `any` - use `unknown` if type is truly unknown
- ✅ Enable strict mode in tsconfig.json
- ✅ Export types from `src/types/` for reusability

**Example Pattern:**
```typescript
// types/api.ts
export interface ScenarioRunState {
  scenarioRunName: string;
  scenarioName: string;
  phase: string;
  totalTargets: number;
  // ... all fields explicitly typed
}

// services/operatorApi.ts
async listScenarioRuns(): Promise<ScenarioRunState[]> {
  const response = await fetch(`${API_BASE}/scenarios/run`);
  return await response.json();
}
```

### State Management Patterns

**Context + Reducer (Enterprise Scale):**
- ✅ Use Context API for global state (avoid prop drilling)
- ✅ Reducer pattern for complex state transitions
- ✅ Single source of truth for application state
- ✅ Immutable state updates only
- ✅ Type-safe actions with discriminated unions

**Example Pattern:**
```typescript
// types/api.ts
type AppAction =
  | { type: 'POLL_SUCCESS' }
  | { type: 'POLL_ERROR'; payload: { message: string; type: string } }
  | { type: 'PROVIDER_STATUS_UPDATED'; payload: { name: string; active: boolean } };

// context/AppContext.tsx
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'POLL_SUCCESS':
      return { ...state, phase: 'selecting_clusters' };
    case 'POLL_ERROR':
      return { ...state, phase: 'error', error: action.payload };
    default:
      return state;
  }
}
```

**When NOT to use global state:**
- ❌ Component-local UI state (modals, accordions, form inputs)
- ❌ Derived data (compute on-the-fly instead)
- ❌ Temporary state that doesn't affect other components

### Custom Hooks Best Practices

**Separation of Concerns:**
- ✅ Extract business logic into custom hooks
- ✅ One hook = one responsibility
- ✅ Hooks should be pure and reusable
- ✅ Return values, not JSX

**Common Hook Patterns:**

**1. Polling Hook Pattern:**
```typescript
// hooks/useTargetPoller.ts
export function useTargetPoller() {
  const { state, dispatch } = useAppContext();
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.phase !== 'polling') return;

    async function poll() {
      const status = await api.getStatus(state.uuid);
      if (status === 200) {
        dispatch({ type: 'POLL_SUCCESS' });
        clearInterval(pollIntervalRef.current!);
      }
    }

    poll();
    pollIntervalRef.current = window.setInterval(poll, 3000);

    return () => clearInterval(pollIntervalRef.current!);
  }, [state.phase, state.uuid]);
}
```

**2. Notification Hook Pattern:**
```typescript
// hooks/useNotifications.ts
export function useNotifications() {
  const { dispatch } = useAppContext();

  const showSuccess = (title: string, message: string) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: { variant: 'success', title, message } });
  };

  return { showSuccess, showError, showWarning };
}
```

**3. Data Fetching Hook Pattern:**
```typescript
// hooks/useProviders.ts
export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const data = await providersApi.listProviders();
        setProviders(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProviders();
  }, []);

  return { providers, loading, error };
}
```

### Component Design Principles

**Component Organization:**
- ✅ Keep components focused and single-purpose
- ✅ Extract reusable logic into hooks
- ✅ Props interface defined at top of file
- ✅ Prefer function components over class components
- ✅ Use TypeScript for prop validation (not PropTypes)

**File Naming:**
- ✅ PascalCase for components: `ProviderConfigTab.tsx`
- ✅ camelCase for hooks: `useProviderConfigPoller.ts`
- ✅ camelCase for utilities: `schemaParser.ts`
- ✅ UPPERCASE for constants: `config.ts`

**Component Structure Template:**
```typescript
import { useState } from 'react';
import { Button, Alert } from '@patternfly/react-core';
import { useAppContext } from '../context/AppContext';
import type { ProviderInfo } from '../types/provider';

interface MyComponentProps {
  provider: ProviderInfo;
  onSubmit: (values: FormValues) => void;
}

export function MyComponent({ provider, onSubmit }: MyComponentProps) {
  const { state, dispatch } = useAppContext();
  const [localState, setLocalState] = useState('');

  const handleAction = async () => {
    // Business logic
  };

  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### API Service Layer

**Centralized API Clients:**
- ✅ Create service classes for each backend API
- ✅ Single instance exported from service file
- ✅ All API calls go through service layer
- ✅ Type-safe request/response interfaces
- ✅ Consistent error handling

**Example Pattern:**
```typescript
// services/providersApi.ts
class ProvidersApi {
  private baseUrl = '/api/v1';

  async listProviders(): Promise<ProviderInfo[]> {
    const response = await fetch(`${this.baseUrl}/providers`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: ListProvidersResponse = await response.json();
    return data.providers;
  }

  async updateProviderStatus(name: string, active: boolean): Promise<void> {
    const response = await fetch(`${this.baseUrl}/providers/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
  }
}

export const providersApi = new ProvidersApi();
```

**Why Service Layer:**
- ✅ Centralized API logic (DRY)
- ✅ Easy to mock for testing
- ✅ Consistent error handling
- ✅ Single place to add auth headers, retry logic, etc.

### Error Handling

**Component-Level Error Handling:**
```typescript
const handleSubmit = async () => {
  try {
    await providersApi.submitConfig(uuid, values);
    showSuccess('Configuration Saved', 'Success!');
  } catch (error) {
    showError(
      'Failed to Save Configuration',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
};
```

**API-Level Error Handling:**
```typescript
// services/providersApi.ts
async listProviders(): Promise<ProviderInfo[]> {
  try {
    const response = await fetch(`${API_BASE}/providers`);

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('API endpoint not available');
    }

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to connect to API');
  }
}
```

### Performance Optimization

**Avoid Unnecessary Re-renders:**
- ✅ Use `React.memo()` for expensive pure components
- ✅ Use `useMemo()` for expensive computations
- ✅ Use `useCallback()` for callback props passed to children
- ✅ Keep context scope narrow (don't put everything in one context)

**Lazy Loading:**
```typescript
// Lazy load heavy components
const ProviderConfigTab = lazy(() => import('./ProviderConfigTab'));

<Suspense fallback={<Spinner />}>
  <ProviderConfigTab />
</Suspense>
```

**List Rendering:**
```typescript
// Always use keys for lists
{providers.map((provider) => (
  <AccordionItem key={provider.name}>
    {/* content */}
  </AccordionItem>
))}
```

### PatternFly Component Usage

**Consistent UI Patterns:**
- ✅ Use PatternFly 5 components for all UI elements
- ✅ Follow PatternFly design patterns (Empty States, Loading States, etc.)
- ✅ Use Alert component for user feedback
- ✅ Use Modal for confirmations and forms
- ✅ Use Accordion/Tabs for content organization

**PatternFly Best Practices:**
```typescript
// Empty State Pattern
<EmptyState>
  <EmptyStateIcon icon={CubesIcon} />
  <Title headingLevel="h2" size="lg">No Providers Available</Title>
  <EmptyStateBody>
    No target providers are currently registered with the system.
  </EmptyStateBody>
</EmptyState>

// Loading State Pattern
{isLoading && (
  <EmptyState>
    <EmptyStateIcon icon={() => <Spinner size="xl" />} />
    <Title headingLevel="h2" size="lg">Loading Providers</Title>
  </EmptyState>
)}

// Alert Pattern
<Alert variant="danger" title="Failed to Load">
  An error occurred. Please try again.
</Alert>
```

### Form Handling

**Controlled Components:**
- ✅ Always use controlled form inputs
- ✅ Single source of truth for form state
- ✅ Validate on submit, not on every keystroke (unless needed)

**Dynamic Forms (Schema-Driven):**
```typescript
// Reusable form builder based on schema
export function DynamicFormBuilder({ fields, values, onChange }) {
  return (
    <Form>
      {fields.map((field) => {
        switch (field.type) {
          case 'string':
            return <TextInput key={field.variable} />;
          case 'number':
            return <NumberInput key={field.variable} />;
          case 'boolean':
            return <Switch key={field.variable} />;
          default:
            return null;
        }
      })}
    </Form>
  );
}
```

### Testing Guidelines

**Unit Tests:**
- ✅ Test custom hooks in isolation
- ✅ Test utility functions with edge cases
- ✅ Mock API calls in tests
- ✅ Use React Testing Library (not Enzyme)

**Integration Tests:**
- ✅ Test component + hook interactions
- ✅ Test user workflows (form submission, navigation)
- ✅ Test error states and loading states

**What NOT to Test:**
- ❌ PatternFly component internals
- ❌ Third-party library implementation details
- ❌ React lifecycle methods

### Code Quality Standards (React Specific)

**Linting & Formatting:**
- ✅ Run ESLint before committing
- ✅ Use Prettier for consistent formatting
- ✅ Fix all warnings (not just errors)

**Imports Organization:**
```typescript
// 1. React imports
import { useState, useEffect } from 'react';

// 2. External libraries
import { Button, Alert } from '@patternfly/react-core';
import { UserIcon } from '@patternfly/react-icons';

// 3. Internal modules (absolute paths)
import { useAppContext } from '../context/AppContext';
import { providersApi } from '../services/providersApi';
import type { ProviderInfo } from '../types/provider';
```

**Avoid Common Pitfalls:**
- ❌ NEVER mutate state directly
- ❌ NEVER use index as key in lists (unless static)
- ❌ NEVER forget cleanup in useEffect
- ❌ NEVER ignore TypeScript errors (fix them!)
- ❌ NEVER use `// @ts-ignore` (fix the type instead)

### Accessibility (a11y)

**PatternFly Compliance:**
- ✅ Use semantic HTML elements
- ✅ Provide aria-labels for icon-only buttons
- ✅ Ensure keyboard navigation works
- ✅ Use proper heading hierarchy (h1 → h2 → h3)
- ✅ PatternFly components are a11y-compliant by default

### Documentation

**Component Documentation:**
```typescript
/**
 * ProviderConfigTab displays configuration form for a single provider
 *
 * Shows:
 * - Provider configuration form (if fields exist)
 * - Empty state for providers without configuration
 * - Submit button with loading state
 *
 * @param provider - Provider information (name, active status)
 * @param schema - Parsed provider schema with form fields (null if not ready)
 * @param uuid - Provider config request UUID for submission
 */
export function ProviderConfigTab({ provider, schema, uuid }: ProviderConfigTabProps) {
  // ...
}
```

**README Updates:**
- ✅ Document new features in README.md
- ✅ Update API documentation when endpoints change
- ✅ Include screenshots for UI changes
- ✅ Document environment variables

## Architecture Principles

- **Separation of Concerns**: UI components, business logic (hooks), API layer should be separate
- **Dependency Injection**: Pass dependencies explicitly via props/context, avoid global state
- **Type Safety**: TypeScript strict mode, explicit interfaces for all data shapes
- **Testability**: Design code to be easily testable with mocks
- **Fail Fast**: Validate early, display errors immediately to user
- **DRY (Don't Repeat Yourself)**: ZERO tolerance for code duplication - extract and reuse aggressively
- **Reusability First**: Always ask "Will this be needed elsewhere?" before writing code
- **Composition Over Inheritance**: Build complex behavior from simple, reusable pieces

## Project-Specific Patterns

### Polling Pattern (Target & Provider Config)

**Used for long-running backend operations:**

1. **Create Request**: POST endpoint returns UUID
2. **Poll Status**: GET endpoint with UUID returns status code
   - `202 Accepted` = Still processing (keep polling)
   - `200 OK` = Completed (data ready)
   - `404 Not Found` = Invalid UUID
3. **Timeout**: Stop polling after configured timeout (60 seconds)
4. **Cleanup**: Clear interval on unmount or completion

**Implementation:**
```typescript
// hooks/useProviderConfigPoller.ts
useEffect(() => {
  if (status !== 'polling' || !uuid) return;

  let attempt = 0;
  const startTime = Date.now();

  async function poll() {
    if (Date.now() - startTime > TIMEOUT) {
      dispatch({ type: 'TIMEOUT_ERROR' });
      return;
    }

    const response = await api.getStatus(uuid);
    if (response.status === 200) {
      dispatch({ type: 'SUCCESS', payload: response.data });
      clearInterval(intervalRef.current);
    } else if (response.status === 202) {
      // Continue polling
    }
  }

  poll();
  intervalRef.current = setInterval(poll, POLL_INTERVAL);

  return () => clearInterval(intervalRef.current);
}, [status, uuid]);
```

**Key Points:**
- ✅ Use refs for interval IDs (not state)
- ✅ Always cleanup intervals on unmount
- ✅ Implement timeout to prevent infinite polling
- ✅ Handle all HTTP status codes explicitly
- ✅ Dispatch state updates via reducer

### Schema-Driven Forms

**Dynamic form generation based on backend schemas:**

**Schema Formats Supported:**
1. **JSON Schema** (krkn-operator): Standard JSON Schema with nested properties
2. **Custom Format** (krkn-operator-acm): Array of field objects with type numbers

**Parser Pattern:**
```typescript
// utils/schemaParser.ts
export function parseSchema(schemaString: string): ScenarioField[] {
  const parsed = JSON.parse(schemaString);

  // Auto-detect format
  if (Array.isArray(parsed)) {
    return parseCustomSchema(schemaString);
  } else if (parsed.type === 'object' && parsed.properties) {
    return parseJsonSchema(schemaString);
  }

  return [];
}
```

**Form Builder Pattern:**
```typescript
// components/DynamicFormBuilder.tsx
export function DynamicFormBuilder({ fields, values, onChange }) {
  return (
    <Form>
      {fields.map((field) => {
        switch (field.type) {
          case 'string':
            return (
              <FormGroup key={field.variable} label={field.name}>
                <TextInput
                  value={values[field.variable] || field.default || ''}
                  onChange={(value) => onChange({ ...values, [field.variable]: value })}
                />
              </FormGroup>
            );
          // ... other types
        }
      })}
    </Form>
  );
}
```

**Nested Fields Support:**
- ✅ Use dot notation for nested fields: `"api.port"`, `"scenarios.timeout"`
- ✅ Flatten nested JSON Schema properties during parsing
- ✅ Preserve dot notation in form field variables

### Provider Configuration Pattern

**Multi-provider configuration with tabs/accordion:**

1. **List Providers**: GET `/providers` → Provider info with active status
2. **Create Config Request**: POST `/provider-config` → UUID
3. **Poll Config Status**: GET `/provider-config/{uuid}` → 202 or 200 with schemas
4. **Parse Schemas**: Convert backend schemas to normalized format
5. **Render Forms**: Dynamic forms per provider
6. **Toggle Status**: PATCH `/providers/{name}` → Update active status
7. **Submit Config**: POST `/provider-config/{uuid}` → Save configuration

**UI Pattern (Accordion):**
- ✅ Each provider = AccordionItem
- ✅ Header shows provider name + Active/Inactive badge + toggle switch
- ✅ Only active providers can be expanded
- ✅ Deactivating a provider auto-collapses it
- ✅ Toggle in header prevents accordion expansion on click

### Notification Pattern

**Centralized user feedback:**

```typescript
// hooks/useNotifications.ts
export function useNotifications() {
  const { dispatch } = useAppContext();

  const showSuccess = (title: string, message: string) => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: { variant: 'success', title, message, id: generateId() }
    });
  };

  const showError = (title: string, message: string) => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: { variant: 'danger', title, message, id: generateId() }
    });
  };

  return { showSuccess, showError };
}
```

**Usage:**
```typescript
const { showSuccess, showError } = useNotifications();

try {
  await api.submitConfig(values);
  showSuccess('Configuration Saved', 'Successfully updated provider settings');
} catch (error) {
  showError('Failed to Save', error.message);
}
```

### API Error Handling Pattern

**Consistent error handling across all API calls:**

```typescript
// services/providersApi.ts
async listProviders(): Promise<ProviderInfo[]> {
  try {
    const response = await fetch(`${API_BASE}/providers`);

    // Validate content type
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('API endpoint not available');
    }

    // Handle HTTP errors
    if (!response.ok) {
      try {
        const error: ErrorResponse = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      } catch (parseError) {
        throw new Error(`HTTP ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    // Re-throw Error objects, wrap others
    if (error instanceof Error) throw error;
    throw new Error('Failed to connect to API');
  }
}
```

### State Phase Transitions

**Finite state machine pattern for application flow:**

```typescript
// types/api.ts
export type AppPhase =
  | 'jobs_list'           // Initial state - viewing jobs
  | 'polling'             // Polling target creation
  | 'selecting_clusters'  // Choosing clusters
  | 'creating_jobs'       // Creating scenario runs
  | 'error';              // Error state

// Allowed transitions
jobs_list → polling (user creates job)
polling → selecting_clusters (target ready)
polling → error (timeout/failure)
selecting_clusters → creating_jobs (user submits)
creating_jobs → jobs_list (jobs created)
error → jobs_list (user goes back)
```

**Benefits:**
- ✅ Prevents invalid state combinations
- ✅ Clear transition logic in reducer
- ✅ Easy to reason about application flow
- ✅ Type-safe with TypeScript discriminated unions

## When in Doubt

- Check existing code patterns in the project (especially hooks and services)
- Favor simplicity over cleverness
- Ask for clarification before making architectural decisions
- Document assumptions and trade-offs in code comments
- Create a beads issue to track follow-up work
- For UI patterns, consult PatternFly documentation
- For polling/async patterns, reference existing hooks

## Communication

- All git commits should reference beads issues when relevant
- Use conventional commit format: `type(scope): description`
- PR descriptions should explain WHY, not just WHAT
- Include test results in PR descriptions

---

**Remember**: This is production code used by the ecosystem. Quality, documentation, and reusability are not optional.