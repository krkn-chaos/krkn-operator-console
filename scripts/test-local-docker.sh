#!/bin/bash
# Test the Docker image locally

set -e

IMAGE_TAG="${IMAGE_TAG:-krkn-operator-console:local}"
CONTAINER_NAME="${CONTAINER_NAME:-krkn-console-test}"
PORT="${PORT:-8080}"

echo "🧪 Testing Krkn Operator Console Docker Image Locally"
echo "======================================================"
echo "Image: ${IMAGE_TAG}"
echo "Port: ${PORT}"
echo ""

# Build the image
echo "📦 Building Docker image..."
docker build -t "${IMAGE_TAG}" .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Stop and remove existing container if running
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🛑 Stopping existing container..."
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    docker rm "${CONTAINER_NAME}" 2>/dev/null || true
fi

# Run the container
echo "🚀 Starting container..."
docker run -d \
    --name "${CONTAINER_NAME}" \
    -p "${PORT}:8080" \
    "${IMAGE_TAG}"

if [ $? -eq 0 ]; then
    echo "✅ Container started successfully!"
    echo ""
    echo "📊 Container Info:"
    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "🌐 Console available at: http://localhost:${PORT}"
    echo ""
    echo "⚠️  Note: API calls will fail without operator backend"
    echo "   To test API integration, use port-forward:"
    echo "   kubectl port-forward svc/krkn-operator-controller-manager-api-service 8080:8080"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: docker logs -f ${CONTAINER_NAME}"
    echo "  - Stop: docker stop ${CONTAINER_NAME}"
    echo "  - Remove: docker rm ${CONTAINER_NAME}"
else
    echo "❌ Failed to start container!"
    exit 1
fi
