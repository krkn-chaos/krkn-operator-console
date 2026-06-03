#!/bin/bash
# Build and push container image to registry

set -e

# Configuration
IMAGE_REGISTRY="${IMAGE_REGISTRY:-quay.io}"
IMAGE_REPO="${IMAGE_REPO:-krkn-chaos/krkn-operator-console}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_FULL="${IMAGE_REGISTRY}/${IMAGE_REPO}:${IMAGE_TAG}"
CONTAINER_TOOL="${CONTAINER_TOOL:-podman}"  # podman or docker

echo "📦 Building and Pushing Krkn Operator Console"
echo "=============================================="
echo "Container tool: ${CONTAINER_TOOL}"
echo "Image: ${IMAGE_FULL}"
echo ""

# Check if container tool is available
if ! command -v "${CONTAINER_TOOL}" &> /dev/null; then
    echo "❌ ${CONTAINER_TOOL} not found!"
    if [ "${CONTAINER_TOOL}" == "podman" ]; then
        echo "   Try: CONTAINER_TOOL=docker ./scripts/build-and-push.sh"
    fi
    exit 1
fi

# Build the image
echo "📦 Building container image..."
${CONTAINER_TOOL} build -t "${IMAGE_FULL}" .

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Ask for confirmation before pushing
read -p "🚀 Push image to ${IMAGE_REGISTRY}? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Pushing image to registry..."
    ${CONTAINER_TOOL} push "${IMAGE_FULL}"

    if [ $? -eq 0 ]; then
        echo "✅ Image pushed successfully!"
        echo ""
        echo "Image available at: ${IMAGE_FULL}"
    else
        echo "❌ Failed to push image!"
        exit 1
    fi
else
    echo "⏭️  Skipping push to registry"
    echo "Image available locally: ${IMAGE_FULL}"
fi

echo ""
echo "Next steps:"
echo "  1. Update k8s/deployment.yaml with image: ${IMAGE_FULL}"
echo "  2. Deploy to Kubernetes: ./scripts/deploy-k8s.sh"
