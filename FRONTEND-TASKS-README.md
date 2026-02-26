# Frontend Authentication Tasks - Import Guide

## Overview

This file (`frontend-tasks.jsonl`) contains 9 beads tasks for implementing the authentication system in krkn-operator-console.

**Total Tasks**: 9 (7 x P1, 2 x P2)
**Estimated Effort**: 18-20 developer days

---

## Quick Start - Import Tasks into Beads

### 1. Initialize Beads (if not already done)

```bash
cd /Users/tsebasti/Projects/krkn-operator-ecosystem/krkn-operator-console
bd init
```

You'll be prompted to configure beads. Use these settings:
- Issue prefix: `console` (or `krkn-console`)
- Other settings: accept defaults

### 2. Import the Frontend Tasks

```bash
# Import all tasks from the JSONL file
bd import frontend-tasks.jsonl
```

This will create 9 tasks with all their dependencies intact.

### 3. Verify Import

```bash
# List all imported tasks
bd list --status=open

# See tasks ready to work on (no blockers)
bd ready
```

You should see:
- **krkn-operator-b3n** as the first available task (no dependencies)
- Other tasks blocked by their dependencies

---

## Task Overview

### Phase 1 - Foundation (Start Here!)
1. **krkn-operator-b3n** (P1) - Setup authentication infrastructure
   - **No dependencies** - Start here!
   - Creates: Auth context, token storage, API client
   - Estimated: 2-3 days

### Phase 2 - Core UI
2. **krkn-operator-j01** (P1) - Admin registration check page
3. **krkn-operator-4ju** (P1) - First admin registration page
4. **krkn-operator-up8** (P1) - Login page

### Phase 3 - Advanced Features
5. **krkn-operator-jkx** (P1) - Protected routes & navigation guards
6. **krkn-operator-urc** (P1) - Session expiration & logout
7. **krkn-operator-2q3** (P2) - Error handling & user feedback

### Phase 4 - Role-Based UI
8. **krkn-operator-6q1** (P1) - Role-based UI components

### Phase 5 - Testing
9. **krkn-operator-82z** (P2) - E2E tests

---

## Working with Tasks

### Start Working on a Task

```bash
# 1. Find available work
bd ready

# 2. View task details
bd show krkn-operator-b3n

# 3. Mark as in progress
bd update krkn-operator-b3n --status=in_progress

# 4. When done
bd close krkn-operator-b3n --reason="Completed auth infrastructure"
```

### Sync Changes

```bash
# After completing tasks, sync to commit beads changes
bd sync

# This commits beads database changes to git
```

---

## Documentation

### API Reference
See the backend repository for complete API documentation:
- **API Spec**: `../krkn-operator/docs/api-authentication-spec.md`
  - Complete endpoint documentation
  - Request/response examples
  - Error codes and handling
  - Frontend implementation examples

- **Implementation Guide**: `../krkn-operator/docs/frontend-authentication-tasks.md`
  - Detailed task breakdown
  - Dependency graph
  - Phase planning
  - Common issues and solutions

### Quick API Summary

**Public Endpoints (no auth)**:
- `GET /api/v1/auth/is-registered`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

**Protected Endpoints**:
- All other endpoints require `Authorization: Bearer <token>`

**Login Response Example**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-02-27T10:30:00Z",
  "userId": "[email protected]",
  "role": "admin",
  "name": "John",
  "surname": "Doe"
}
```

---

## Testing Backend API

### Start Backend (from krkn-operator directory)

```bash
cd ../krkn-operator
make run
```

Backend will start on `http://localhost:8080`

### Test Endpoints

```bash
# 1. Register first admin
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "[email protected]",
    "password": "TestPassword123",
    "name": "Test",
    "surname": "Admin",
    "role": "admin"
  }'

# 2. Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "[email protected]",
    "password": "TestPassword123"
  }'

# 3. Use token (replace with actual token from login)
export TOKEN="your-jwt-token-here"
curl -X GET http://localhost:8080/api/v1/clusters \
  -H "Authorization: Bearer $TOKEN"
```

---

## Task Dependencies

```
b3n (Auth Infrastructure)
 ├─→ j01 (Admin Check)
 ├─→ 4ju (Registration Page)
 └─→ up8 (Login Page)
      ├─→ jkx (Protected Routes)
      │    └─→ 6q1 (Role UI)
      │         └─→ 82z (E2E Tests)
      ├─→ urc (Session Expiration)
      │    └─→ 82z (E2E Tests)
      └─→ 2q3 (Error Handling)
```

---

## Notes

- These tasks were exported from `krkn-operator` project
- Task IDs kept original prefix `krkn-operator-*` for traceability
- All dependencies are preserved
- Priority levels: P1 = High, P2 = Medium
- Beads will manage the dependency graph automatically

---

## Need Help?

- **Beads Workflow**: Run `bd prime` for complete workflow guide
- **API Questions**: See `../krkn-operator/docs/api-authentication-spec.md`
- **Task Details**: Use `bd show <task-id>` for full description
- **Available Work**: Use `bd ready` to see unblocked tasks

---

**Ready to start? Import the tasks and run `bd ready` to begin!**
