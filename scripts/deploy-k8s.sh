#!/bin/bash
# Deploy krkn-operator-console to Kubernetes/OpenShift

set -e

NAMESPACE="${NAMESPACE:-krkn-operator-system}"
PLATFORM="${PLATFORM:-openshift}"  # openshift or kubernetes
IMG="${IMG:-quay.io/krkn-chaos/krkn-operator-console:latest}"

echo "🚀 Deploying Krkn Operator Console"
echo "===================================="
echo "Namespace: ${NAMESPACE}"
echo "Platform: ${PLATFORM}"
echo "Image: ${IMG}"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl."
    exit 1
fi

# Create namespace if it doesn't exist
echo "📁 Checking namespace..."
if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    echo "Creating namespace: ${NAMESPACE}"
    kubectl create namespace "${NAMESPACE}"
else
    echo "✅ Namespace ${NAMESPACE} exists"
fi

# Deploy resources
echo ""
echo "📦 Deploying Deployment..."
kubectl apply -f k8s/deployment.yaml -n "${NAMESPACE}"

# Update image if specified
echo "🔄 Setting image to: ${IMG}..."
kubectl set image deployment/krkn-operator-console console="${IMG}" -n "${NAMESPACE}"

# Wait for deployment to be created
sleep 2

# Verify image was set
CURRENT_IMAGE=$(kubectl get deployment krkn-operator-console -n "${NAMESPACE}" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "unknown")
echo "✅ Image verified: ${CURRENT_IMAGE}"


echo ""
echo "🌐 Deploying Service..."
# Delete existing service if it exists to avoid conflicts with old spec
kubectl delete service krkn-operator-console -n "${NAMESPACE}" --ignore-not-found=true
kubectl apply -f k8s/service.yaml -n "${NAMESPACE}"

echo ""
if [ "${PLATFORM}" == "openshift" ]; then
    echo "🔗 Deploying OpenShift Route..."
    kubectl apply -f k8s/route.yaml -n "${NAMESPACE}"

    echo ""
    echo "⏳ Waiting for route to be ready..."
    sleep 3

    ROUTE_URL=$(kubectl get route krkn-operator-console -n "${NAMESPACE}" -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
    if [ -n "${ROUTE_URL}" ]; then
        echo "✅ Console available at: https://${ROUTE_URL}"
    fi
else
    echo "🔗 Deploying Kubernetes Ingress..."
    echo "⚠️  Make sure to edit k8s/ingress.yaml with your domain before applying!"
    read -p "Deploy ingress? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl apply -f k8s/ingress.yaml -n "${NAMESPACE}"
    fi
fi

echo ""
echo "📊 Deployment Status:"
echo "===================="
kubectl get deployment krkn-operator-console -n "${NAMESPACE}"

echo ""
echo "🔍 Pods:"
kubectl get pods -l app=krkn-operator-console -n "${NAMESPACE}"

echo ""
echo "✨ Deployment complete!"
echo ""
echo "Useful commands:"
echo "  - View logs: kubectl logs -f -l app=krkn-operator-console -n ${NAMESPACE}"
echo "  - Check status: kubectl get pods -l app=krkn-operator-console -n ${NAMESPACE}"
echo "  - Port-forward: kubectl port-forward svc/krkn-operator-console 8080:8080 -n ${NAMESPACE}"
