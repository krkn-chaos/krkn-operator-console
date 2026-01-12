#!/bin/bash
# Remove krkn-operator-console from Kubernetes/OpenShift

set -e

NAMESPACE="${NAMESPACE:-krkn-operator-system}"
PLATFORM="${PLATFORM:-openshift}"

echo "🗑️  Undeploying Krkn Operator Console"
echo "======================================"
echo "Namespace: ${NAMESPACE}"
echo ""

read -p "⚠️  Are you sure you want to undeploy? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🗑️  Deleting resources..."

if [ "${PLATFORM}" == "openshift" ]; then
    kubectl delete -f k8s/route.yaml -n "${NAMESPACE}" --ignore-not-found=true
else
    kubectl delete -f k8s/ingress.yaml -n "${NAMESPACE}" --ignore-not-found=true
fi

kubectl delete -f k8s/service.yaml -n "${NAMESPACE}" --ignore-not-found=true
kubectl delete -f k8s/deployment.yaml -n "${NAMESPACE}" --ignore-not-found=true

echo ""
echo "✅ Console undeployed from namespace: ${NAMESPACE}"
