#!/bin/bash
# Build and push Docker image to registry

set -e

# Configuration
IMAGE_REGISTRY="${IMAGE_REGISTRY:-quay.io}"
IMAGE_REPO="${IMAGE_REPO:-krkn-chaos/krkn-operator-console}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_FULL="${IMAGE_REGISTRY}/${IMAGE_REPO}:${IMAGE_TAG}"

echo "🐳 Building and Pushing Krkn Operator Console"
echo "=============================================="
echo "Image: ${IMAGE_FULL}"
echo ""

# Build the image
echo "📦 Building Docker image..."
docker build -t "${IMAGE_FULL}" .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker build successful!"
echo ""

# Ask for confirmation before pushing
read -p "🚀 Push image to ${IMAGE_REGISTRY}? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Pushing image to registry..."
    docker push "${IMAGE_FULL}"

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
