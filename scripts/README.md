# Deployment Scripts

Collection of helper scripts for building, deploying, and managing the Krkn Operator Console.

## Scripts Overview

### 🔧 Development

#### `dev-setup.sh`
Initial development setup - installs dependencies and creates `.env` file.

```bash
./scripts/dev-setup.sh
```

---

### 🐳 Docker

#### `build-and-push.sh`
Build container image and push to container registry.

**Usage:**
```bash
# Use defaults (podman + quay.io/krkn-chaos/krkn-operator:console)
./scripts/build-and-push.sh

# Use Docker instead of Podman
CONTAINER_TOOL=docker ./scripts/build-and-push.sh

# Custom registry/repo/tag
IMAGE_REGISTRY=docker.io IMAGE_REPO=myorg/console IMAGE_TAG=v1.0.0 ./scripts/build-and-push.sh
```

**Environment Variables:**
- `CONTAINER_TOOL` - Container tool to use: `podman` or `docker` (default: `podman`)
- `IMAGE_REGISTRY` - Container registry (default: `quay.io`)
- `IMAGE_REPO` - Repository path (default: `krkn-chaos/krkn-operator:console`)
- `IMAGE_TAG` - Image tag (default: `latest`)

#### `test-local-docker.sh`
Build and run container image locally for testing.

```bash
# Use defaults (podman, port 8080)
./scripts/test-local-docker.sh

# Use Docker instead of Podman
CONTAINER_TOOL=docker ./scripts/test-local-docker.sh

# Custom port
PORT=3000 ./scripts/test-local-docker.sh
```

**Environment Variables:**
- `CONTAINER_TOOL` - Container tool to use: `podman` or `docker` (default: `podman`)
- `PORT` - Local port to expose (default: `8080`)

**Notes:**
- API calls will fail without operator backend
- Use `kubectl port-forward` to connect to operator API

---

### ☸️ Kubernetes Deployment

#### `deploy-k8s.sh`
Deploy console to Kubernetes/OpenShift cluster.

**Usage:**
```bash
# Deploy to OpenShift (default namespace: krkn-operator-system)
./scripts/deploy-k8s.sh

# Deploy with custom image
IMG=quay.io/myorg/console:v1.0.0 ./scripts/deploy-k8s.sh

# Deploy to specific namespace
NAMESPACE=my-namespace ./scripts/deploy-k8s.sh

# Deploy to Kubernetes with Ingress
PLATFORM=kubernetes ./scripts/deploy-k8s.sh
```

**Environment Variables:**
- `IMG` - Container image to deploy (default: `quay.io/krkn-chaos/krkn-operator:console`)
- `NAMESPACE` - Target namespace (default: `krkn-operator-system`)
- `PLATFORM` - Platform type: `openshift` or `kubernetes` (default: `openshift`)

**What it does:**
1. Creates namespace if it doesn't exist
2. Applies Deployment manifest
3. Updates deployment image to specified `IMG`
4. Applies Service manifest
5. Applies Route (OpenShift) or Ingress (Kubernetes)
6. Shows deployment status

#### `undeploy-k8s.sh`
Remove console from cluster.

```bash
# Remove from default namespace
./scripts/undeploy-k8s.sh

# Remove from specific namespace
NAMESPACE=my-namespace ./scripts/undeploy-k8s.sh
```

#### `logs.sh`
View logs from deployed console pods.

```bash
# Follow logs (default)
./scripts/logs.sh

# View last 100 lines without following
FOLLOW=false ./scripts/logs.sh

# Logs from specific namespace
NAMESPACE=my-namespace ./scripts/logs.sh
```

---

## Common Workflows

### First Time Deployment

```bash
# 1. Development setup
./scripts/dev-setup.sh

# 2. Build and test locally
./scripts/test-local-docker.sh

# 3. Build and push to registry
./scripts/build-and-push.sh

# 4. Deploy to cluster
./scripts/deploy-k8s.sh

# 5. Check logs
./scripts/logs.sh
```

### Update Deployment

```bash
# 1. Make code changes
# 2. Rebuild and push
./scripts/build-and-push.sh

# 3. Restart deployment (force pull new image)
kubectl rollout restart deployment/krkn-operator-console -n krkn-operator-system

# 4. Watch rollout
kubectl rollout status deployment/krkn-operator-console -n krkn-operator-system
```

### Troubleshooting

```bash
# View logs
./scripts/logs.sh

# Check pod status
kubectl get pods -l app=krkn-operator-console -n krkn-operator-system

# Describe pod
kubectl describe pod -l app=krkn-operator-console -n krkn-operator-system

# Check events
kubectl get events -n krkn-operator-system --sort-by='.lastTimestamp'

# Port-forward for local testing
kubectl port-forward svc/krkn-operator-console 8080:8080 -n krkn-operator-system
```

---

## Prerequisites

- `kubectl` or `oc` CLI installed and configured
- Docker or Podman installed (for Docker scripts)
- Access to container registry (for push operations)
- Cluster access with appropriate permissions

---

## Notes

- All scripts use `krkn-operator-system` as default namespace
- Scripts are idempotent - safe to run multiple times
- OpenShift platform is assumed by default (uses Routes)
- For Kubernetes, edit `k8s/ingress.yaml` with your domain before deploying
