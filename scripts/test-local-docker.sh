#!/bin/bash
# Test the container image locally

set -e

IMAGE_TAG="${IMAGE_TAG:-krkn-operator-console:local}"
CONTAINER_NAME="${CONTAINER_NAME:-krkn-console-test}"
PORT="${PORT:-8080}"
CONTAINER_TOOL="${CONTAINER_TOOL:-podman}"  # podman or docker

echo "🧪 Testing Krkn Operator Console Container Image Locally"
echo "========================================================="
echo "Container tool: ${CONTAINER_TOOL}"
echo "Image: ${IMAGE_TAG}"
echo "Port: ${PORT}"
echo ""

# Check if container tool is available
if ! command -v "${CONTAINER_TOOL}" &> /dev/null; then
    echo "❌ ${CONTAINER_TOOL} not found!"
    if [ "${CONTAINER_TOOL}" == "podman" ]; then
        echo "   Try: CONTAINER_TOOL=docker ./scripts/test-local-docker.sh"
    fi
    exit 1
fi

# Build the image
echo "📦 Building container image..."
${CONTAINER_TOOL} build -t "${IMAGE_TAG}" .

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Stop and remove existing container if running
if ${CONTAINER_TOOL} ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🛑 Stopping existing container..."
    ${CONTAINER_TOOL} stop "${CONTAINER_NAME}" 2>/dev/null || true
    ${CONTAINER_TOOL} rm "${CONTAINER_NAME}" 2>/dev/null || true
fi

# Run the container
echo "🚀 Starting container..."
${CONTAINER_TOOL} run -d \
    --name "${CONTAINER_NAME}" \
    -p "${PORT}:8080" \
    "${IMAGE_TAG}"

if [ $? -eq 0 ]; then
    echo "✅ Container started successfully!"
    echo ""
    echo "📊 Container Info:"
    ${CONTAINER_TOOL} ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "🌐 Console available at: http://localhost:${PORT}"
    echo ""
    echo "⚠️  Note: API calls will fail without operator backend"
    echo "   To test API integration, use port-forward:"
    echo "   kubectl port-forward svc/krkn-operator-controller-manager-api-service 8080:8080"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: ${CONTAINER_TOOL} logs -f ${CONTAINER_NAME}"
    echo "  - Stop: ${CONTAINER_TOOL} stop ${CONTAINER_NAME}"
    echo "  - Remove: ${CONTAINER_TOOL} rm ${CONTAINER_NAME}"
else
    echo "❌ Failed to start container!"
    exit 1
fi
