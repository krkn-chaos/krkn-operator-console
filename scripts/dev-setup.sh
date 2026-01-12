#!/bin/bash
# Development setup script for krkn-operator-console

set -e

echo "🚀 Krkn Operator Console - Development Setup"
echo "=============================================="

# Check Node.js version
echo ""
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node.js version: $NODE_VERSION"

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install

# Check if operator service is accessible
echo ""
echo "🔍 Checking operator API accessibility..."
echo "   Expected endpoint: http://localhost:8080"
echo ""
echo "   To make the operator API available, run in another terminal:"
echo "   kubectl port-forward svc/krkn-operator-controller-manager-api-service 8080:8080"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "   ✅ .env created from .env.example"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start port-forward in another terminal:"
echo "     kubectl port-forward svc/krkn-operator-controller-manager-api-service 8080:8080"
echo ""
echo "  2. Start development server:"
echo "     npm run dev"
echo ""
echo "  3. Open browser at: http://localhost:3000"
echo ""
