# Krkn Operator Console

![test](https://github.com/krkn-chaos/krkn-operator-console/actions/workflows/test.yml/badge.svg)
![pr-checks](https://github.com/krkn-chaos/krkn-operator-console/actions/workflows/pr-checks.yml/badge.svg)
![coverage](https://krkn-chaos.github.io/krkn-lib-docs/coverage_badge_krkn-operator-console.svg)

Web console for the krkn-operator chaos orchestration platform.

## Status

✅ **MVP Complete** - Ready for testing

## Overview

React-based web console using PatternFly design system to interact with the krkn-operator REST API for chaos scenario orchestration.

## Features

- Automatic initialization workflow (POST /targets)
- Target status polling (GET /targets/{uuid})
- Cluster selection UI (GET /clusters)
- Error handling with retry capability
- PatternFly design system
- Responsive layout
- Loading states and progress indicators

### User Management (Admin)
- Create, edit, and delete user accounts
- Assign roles (Admin, User)
- View user details and activity
- Role-based access control (RBAC)
- Password policies and validation
- Self-deletion and last-admin protection
- See [User Management Documentation](./docs/USER_MANAGEMENT.md)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Access to krkn-operator API endpoint
- Podman or Docker (for containerization)

### Development

```bash
# Install dependencies
npm install

# Port-forward the operator API (in another terminal)
kubectl port-forward svc/krkn-operator-controller-manager-api-service 8080:8080

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Configuration

Environment variables are configured via `.env` file:

```env
VITE_API_URL=/api                # API base URL
VITE_POLL_INTERVAL=3000         # Poll every 3 seconds
VITE_POLL_TIMEOUT=60000         # Timeout after 60 seconds
VITE_DEBUG_MODE=true            # Enable debug logging
```

## Architecture

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: PatternFly 5
- **State Management**: React Context + useReducer
- **Deployment**: Separate from operator (Kubernetes Deployment)
- **Communication**: REST API to operator service via nginx proxy

## Workflow

The console follows this initialization workflow:

```
1. App Load
   ↓
2. POST /targets → Get UUID
   ↓
3. Poll GET /targets/{UUID} (every 3s until 200 OK)
   ↓
4. GET /clusters?id={UUID} → Display clusters
   ↓
5. User selects cluster
   ↓
6. (Future: Chaos orchestration UI)
```

See [REQUIREMENTS.md](REQUIREMENTS.md) for detailed specifications.

## Project Structure

```
krkn-operator-console/
├── src/
│   ├── components/        # React components (PatternFly)
│   │   ├── LoadingScreen.tsx
│   │   ├── ClusterSelector.tsx
│   │   └── ErrorDisplay.tsx
│   ├── context/          # State management
│   │   └── AppContext.tsx
│   ├── hooks/            # Custom React hooks
│   │   └── useTargetPoller.ts
│   ├── services/         # API client
│   │   └── operatorApi.ts
│   ├── types/            # TypeScript types
│   │   └── api.ts
│   ├── config.ts         # App configuration
│   ├── App.tsx           # Main App component
│   └── main.tsx          # Entry point
├── k8s/                  # Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── route.yaml        # OpenShift Route
│   └── ingress.yaml      # Kubernetes Ingress
├── Dockerfile            # Multi-stage build
├── nginx.conf            # Nginx config with API proxy
└── vite.config.ts        # Vite configuration
```

## Deployment

### Container Build

```bash
# Build image (Podman - default)
podman build -t quay.io/krkn-chaos/krkn-operator:console .

# Push to registry
podman push quay.io/krkn-chaos/krkn-operator:console

# Run locally for testing
podman run -p 8080:8080 quay.io/krkn-chaos/krkn-operator:console

# Or use Docker
docker build -t quay.io/krkn-chaos/krkn-operator:console .
docker push quay.io/krkn-chaos/krkn-operator:console
```

### Kubernetes / OpenShift

**OpenShift (with Route):**
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/route.yaml

# Get the route URL
oc get route krkn-operator-console
```

**Kubernetes (with Ingress):**
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# Update ingress.yaml with your domain before applying
```

### Production Considerations

1. **Update nginx.conf** if your operator service has a different name
2. **Configure ingress/route** with your actual domain
3. **Set resource limits** based on your cluster capacity
4. **Enable TLS** for secure communication (handled by Route/Ingress)

### Quick Deploy with Scripts

We provide helper scripts for common operations:

```bash
# Build and push Docker image
./scripts/build-and-push.sh

# Deploy to cluster (default namespace: krkn-operator-system)
./scripts/deploy-k8s.sh

# View logs
./scripts/logs.sh

# Undeploy
./scripts/undeploy-k8s.sh
```

See [scripts/README.md](scripts/README.md) for detailed documentation.

## Documentation

- `REQUIREMENTS.md` - Complete requirements and specifications
- `../krkn-operator/PROGRESS.md` - Operator API documentation

## API Compatibility

- **Supported API Version**: v1alpha1
- **Minimum Operator Version**: v0.1.0

## License

Apache License 2.0

## Related Projects

- [krkn-operator](../krkn-operator/) - The operator this console interacts with
- [krkn-lib](https://github.com/krkn-chaos/krkn-lib) - Core chaos testing library