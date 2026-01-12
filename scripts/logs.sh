#!/bin/bash
# View logs from deployed console pods

set -e

NAMESPACE="${NAMESPACE:-krkn-operator-system}"
FOLLOW="${FOLLOW:-true}"

echo "📋 Krkn Operator Console Logs"
echo "=============================="
echo "Namespace: ${NAMESPACE}"
echo ""

# Check if deployment exists
if ! kubectl get deployment krkn-operator-console -n "${NAMESPACE}" &> /dev/null; then
    echo "❌ Console deployment not found in namespace: ${NAMESPACE}"
    exit 1
fi

# Get pod count
POD_COUNT=$(kubectl get pods -l app=krkn-operator-console -n "${NAMESPACE}" --no-headers | wc -l | tr -d ' ')

if [ "${POD_COUNT}" -eq 0 ]; then
    echo "❌ No console pods running"
    exit 1
fi

echo "Found ${POD_COUNT} pod(s)"
echo ""

if [ "${FOLLOW}" == "true" ]; then
    echo "📡 Following logs (Ctrl+C to stop)..."
    kubectl logs -f -l app=krkn-operator-console -n "${NAMESPACE}" --all-containers=true
else
    kubectl logs -l app=krkn-operator-console -n "${NAMESPACE}" --all-containers=true --tail=100
fi
