# Krkn Operator Console - Architecture

## Overview

```
┌─────────────────────────────────────┐
│ User Browser                        │
└─────────────────────────────────────┘
           ↓ HTTPS
┌─────────────────────────────────────┐
│ OpenShift Route / K8s Ingress       │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ Console Service (ClusterIP)         │
│ Port: 8080                          │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ Console Deployment (N replicas)     │
│  └─ nginx + React SPA               │
└─────────────────────────────────────┘
           ↓ HTTP (in-cluster)
┌─────────────────────────────────────┐
│ Operator API Service                │
│ krkn-operator-controller-manager... │
│ Port: 8080                          │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ Operator Pod                        │
│  ├─ operator container (Go)         │
│  └─ data-provider container (Py)    │
└─────────────────────────────────────┘
```

## Component Responsibilities

### React Application
- **UI Layer**: PatternFly components
- **State Management**: React Context + useReducer
- **API Client**: Typed service layer
- **Routing**: React Router (future)

### Nginx
- **Static Serving**: React build artifacts
- **API Proxy**: `/api/*` → operator service (avoid CORS)
- **SPA Routing**: Fallback to index.html

### Kubernetes Resources
- **Deployment**: 2 replicas for HA
- **Service**: ClusterIP for internal access
- **Route/Ingress**: External access with TLS

## Data Flow

### Initialization Flow
```
App Load
  ↓
[POST /targets] → UUID
  ↓
[Poll GET /targets/{UUID}] → 200 OK
  ↓
[GET /clusters?id={UUID}] → Cluster List
  ↓
User Selects Cluster
  ↓
(Future: Chaos Orchestration)
```

### State Machine
```
initializing → polling → selecting_cluster → (future states)
     ↓            ↓             ↓
   error ← ─── ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

## Technology Stack

### Frontend
- **React** 18+
- **TypeScript** 5+
- **PatternFly** 4.x
- **Vite** (build tool)

### Build & Deploy
- **Docker** multi-stage build
- **Nginx** alpine
- **Kubernetes** native manifests

## Security Considerations

- **No secrets in frontend** (all API calls server-side authenticated)
- **HTTPS** via Route/Ingress TLS
- **CORS** handled by nginx proxy
- **CSP** headers in nginx config (future)

## Scalability

- **Horizontal**: Scale deployment replicas
- **Caching**: nginx static asset caching
- **CDN**: Future consideration for static assets

## Monitoring & Observability

- **Health Checks**: nginx `/` endpoint
- **Logs**: stdout/stderr → cluster logging
- **Metrics**: Future - Prometheus metrics from nginx

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| API URL | http://localhost:8080 | http://krkn-operator-... |
| Build | npm start (dev server) | npm build → nginx |
| CORS | Proxy via Vite | Proxy via nginx |
| TLS | No | Yes (Route/Ingress) |

## Why Separate Deployment?

1. **Independent Scaling**: UI ≠ Operator
2. **Independent Releases**: Frontend updates without operator downtime
3. **Clean Separation**: UI is just an API client
4. **Standard Pattern**: Matches Prometheus/Grafana, ArgoCD/UI, etc.