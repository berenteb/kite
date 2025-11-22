#!/bin/bash

# Prerequisites Checker
# Ellenőrzi, hogy minden szükséges eszköz telepítve van

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Checking Prerequisites ==="
echo ""

ALL_OK=true

# Check k6
echo -n "Checking k6... "
if command -v k6 >/dev/null 2>&1; then
  VERSION=$(k6 version | head -n1)
  echo -e "${GREEN}✓${NC} $VERSION"
else
  echo -e "${RED}✗${NC} Not found"
  echo "  Install: https://k6.io/docs/getting-started/installation/"
  ALL_OK=false
fi

# Check kubectl
echo -n "Checking kubectl... "
if command -v kubectl >/dev/null 2>&1; then
  VERSION=$(kubectl version --client --short 2>/dev/null | head -n1)
  echo -e "${GREEN}✓${NC} $VERSION"
else
  echo -e "${RED}✗${NC} Not found"
  echo "  Install: https://kubernetes.io/docs/tasks/tools/"
  ALL_OK=false
fi

# Check Node.js
echo -n "Checking Node.js... "
if command -v node >/dev/null 2>&1; then
  VERSION=$(node --version)
  echo -e "${GREEN}✓${NC} $VERSION"
else
  echo -e "${RED}✗${NC} Not found"
  echo "  Install: https://nodejs.org/"
  ALL_OK=false
fi

# Check npm
echo -n "Checking npm... "
if command -v npm >/dev/null 2>&1; then
  VERSION=$(npm --version)
  echo -e "${GREEN}✓${NC} v$VERSION"
else
  echo -e "${RED}✗${NC} Not found"
  ALL_OK=false
fi

echo ""

# Check kubectl cluster access
echo -n "Checking Kubernetes cluster access... "
if kubectl cluster-info >/dev/null 2>&1; then
  CLUSTER=$(kubectl config current-context)
  echo -e "${GREEN}✓${NC} Connected to $CLUSTER"
else
  echo -e "${RED}✗${NC} Cannot connect to cluster"
  echo "  Check your kubeconfig: kubectl config view"
  ALL_OK=false
fi

# Check metrics-server
echo -n "Checking metrics-server... "
if kubectl get deployment metrics-server -n kube-system >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Installed"
else
  echo -e "${YELLOW}⚠${NC} Not found (required for 'kubectl top')"
  echo "  Install: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"
fi

echo ""

# Check Node.js dependencies
echo -n "Checking Node.js dependencies... "
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✓${NC} Installed"
else
  echo -e "${YELLOW}⚠${NC} Not installed"
  echo "  Run: npm install"
fi

echo ""

# Check if tenants exist
echo "Checking for test tenants..."
TENANT_COUNT=0
for i in 1 2 3; do
  NAMESPACE="tenant-tenant$i"
  if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} tenant$i exists"
    TENANT_COUNT=$((TENANT_COUNT + 1))
  else
    echo -e "  ${YELLOW}⚠${NC} tenant$i not found"
  fi
done

if [ $TENANT_COUNT -eq 0 ]; then
  echo ""
  echo -e "${YELLOW}Warning:${NC} No test tenants found"
  echo "  Create tenants: ./scripts/setup-tenants.sh 3"
fi

echo ""

# Final status
if [ "$ALL_OK" = true ]; then
  echo -e "${GREEN}✓ All prerequisites met!${NC}"
  echo ""
  echo "You can now run benchmarks:"
  echo "  ./scripts/run-full-suite.sh"
  exit 0
else
  echo -e "${RED}✗ Some prerequisites are missing${NC}"
  echo "Please install the missing tools and try again."
  exit 1
fi

