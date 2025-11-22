#!/bin/bash

# Full Benchmark Suite Runner
# Runs all benchmark tests in sequence with monitoring

set -e

# Configuration
RESULTS_DIR="results/$(date +%Y%m%d_%H%M%S)"
TENANTS="${TENANTS:-cmiacj8yb0003ckhxoa4nw5bg,cmiacg6080001ckhxe1wd0ya3,cmiacg7dq0002ckhxz3skctdz}"
BASE_URL="${BASE_URL:-kuberi.tech}"
MINIKUBE_IP="${MINIKUBE_IP:-127.0.0.1}"
NODE_PORT="${NODE_PORT:-8080}"
NOISY_TENANT="${NOISY_TENANT:-cmiacj8yb0003ckhxoa4nw5bg}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Kite Benchmark Suite ===${NC}"
echo ""
echo "Results directory: $RESULTS_DIR"
echo "Tenants: $TENANTS"
echo "Base URL: $BASE_URL"
echo "Noisy tenant: $NOISY_TENANT"
echo "Minikube IP: $MINIKUBE_IP"
echo "Node Port: $NODE_PORT"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Save configuration
cat > "$RESULTS_DIR/config.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tenants": "$TENANTS",
  "baseUrl": "$BASE_URL",
  "noisyTenant": "$NOISY_TENANT",
  "minikubeIp": "$MINIKUBE_IP",
  "nodePort": "$NODE_PORT"
}
EOF

# Function to run test with monitoring
run_test_with_monitoring() {
  local test_name=$1
  local k6_script=$2
  local duration=$3
  local extra_args=${4:-}
  
  echo -e "${YELLOW}Running test: $test_name${NC}"
  echo "Duration: ${duration}s"
  echo ""
  
  # Start metrics collection in background
  node monitoring/collect-metrics.js \
    --duration "$duration" \
    --interval 5 \
    --tenants $(echo $TENANTS | tr ',' ' ') \
    --output "$RESULTS_DIR/${test_name}-metrics.json" &
  
  local metrics_pid=$!
  
  # Wait a bit for metrics collection to start
  sleep 3
  
  # Run k6 test
  k6 run "$k6_script" \
    --out json="$RESULTS_DIR/${test_name}-k6.json" \
    --summary-export="$RESULTS_DIR/${test_name}-summary.json" \
    $extra_args
  
  # Wait for metrics collection to finish
  wait $metrics_pid
  
  echo -e "${GREEN}✓ $test_name completed${NC}"
  echo ""
}

generate_test_user_email() {
  echo "test$(date +%s)@test.com"
}

generate_test_user_password() {
  echo "test1234"
}

# # Test 1: Baseline Load Test
echo -e "${GREEN}=== Test 1: Baseline Load ===${NC}"
echo "Establishing baseline performance with normal load"
echo ""
TEST_USER_EMAIL=$(generate_test_user_email)
TEST_USER_PASSWORD=$(generate_test_user_password)
run_test_with_monitoring \
  "baseline" \
  "k6/baseline-load.js" \
  300 \
  "-e TENANTS=$TENANTS -e BASE_URL=$BASE_URL -e TEST_USER_EMAIL=$TEST_USER_EMAIL -e TEST_USER_PASSWORD=$TEST_USER_PASSWORD -e MINIKUBE_IP=$MINIKUBE_IP -e NODE_PORT=$NODE_PORT"
sleep 30
 # Test 2: Resource Limits Test
 echo -e "${GREEN}=== Test 2: Resource Limits ===${NC}"
  echo "Testing impact of resource limits and quotas"
  echo ""
 
 TEST_USER_EMAIL=$(generate_test_user_email)
 TEST_USER_PASSWORD=$(generate_test_user_password)
 run_test_with_monitoring \
   "resource-limits" \
   "k6/resource-limits.js" \
   360 \
   "-e TENANT_ID=$NOISY_TENANT -e BASE_URL=$BASE_URL -e TENANTS=$TENANTS -e TEST_USER_EMAIL=$TEST_USER_EMAIL -e TEST_USER_PASSWORD=$TEST_USER_PASSWORD -e MINIKUBE_IP=$MINIKUBE_IP -e NODE_PORT=$NODE_PORT"
 
 sleep 30

# Test 3: Noisy Neighbor Test
echo -e "${GREEN}=== Test 3: Noisy Neighbor ===${NC}"
echo "Simulating noisy neighbor scenario"
echo ""

TEST_USER_EMAIL=$(generate_test_user_email)
TEST_USER_PASSWORD=$(generate_test_user_password)
run_test_with_monitoring \
  "noisy-neighbor" \
  "k6/noisy-neighbor.js" \
  300 \
  "-e TENANTS=$TENANTS -e NOISY_TENANT=$NOISY_TENANT -e BASE_URL=$BASE_URL -e TEST_USER_EMAIL=$TEST_USER_EMAIL -e TEST_USER_PASSWORD=$TEST_USER_PASSWORD -e MINIKUBE_IP=$MINIKUBE_IP -e NODE_PORT=$NODE_PORT"

sleep 30

# Test 4: Pool Exhaustion Test
echo -e "${GREEN}=== Test 4: Pool Exhaustion ===${NC}"
echo "Testing connection pool exhaustion"
echo ""

TEST_USER_EMAIL=$(generate_test_user_email)
TEST_USER_PASSWORD=$(generate_test_user_password)
run_test_with_monitoring \
  "pool-exhaustion" \
  "k6/pool-exhaustion.js" \
  300 \
  "-e TENANT_ID=$NOISY_TENANT -e BASE_URL=$BASE_URL -e TENANTS=$TENANTS -e TEST_USER_EMAIL=$TEST_USER_EMAIL -e TEST_USER_PASSWORD=$TEST_USER_PASSWORD -e MINIKUBE_IP=$MINIKUBE_IP -e NODE_PORT=$NODE_PORT"

sleep 30

# Generate analysis reports
echo -e "${GREEN}=== Generating Reports ===${NC}"
echo ""

for test in baseline resource-limits noisy-neighbor pool-exhaustion; do
  if [ -f "$RESULTS_DIR/${test}-summary.json" ] && [ -f "$RESULTS_DIR/${test}-metrics.json" ]; then
    echo "Analyzing $test results..."
    node analysis/analyze-results.js \
      --k6 "$RESULTS_DIR/${test}-summary.json" \
      --metrics "$RESULTS_DIR/${test}-metrics.json" \
      --output "$RESULTS_DIR/${test}-report.md"
  fi
done

# Create combined summary
cat > "$RESULTS_DIR/README.md" <<EOF
# Benchmark Suite Results

**Date**: $(date)
**Tenants**: $TENANTS
**Base URL**: $BASE_URL

## Tests Performed

1. **Baseline Load Test** - Normal load across all tenants
   - [Report](.baseline-report.md)
   - [k6 Data](./baseline-summary.json)
   - [Metrics](./baseline-metrics.json)

2. **Resource Limits Test** - Impact of resource quotas
   - [Report](./resource-limits-report.md)
   - [k6 Data](./resource-limits-summary.json)
   - [Metrics](./resource-limits-metrics.json)

3. **Noisy Neighbor Test** - Multi-tenant isolation
   - [Report](./noisy-neighbor-report.md)
   - [k6 Data](./noisy-neighbor-summary.json)
   - [Metrics](./noisy-neighbor-metrics.json)

4. **Pool Exhaustion Test** - Connection pool behavior
   - [Report](./pool-exhaustion-report.md)
   - [k6 Data](./pool-exhaustion-summary.json)
   - [Metrics](./pool-exhaustion-metrics.json)

## Quick Summary

See individual reports for detailed analysis.
EOF

echo -e "${GREEN}✓ All tests completed!${NC}"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review individual test reports in $RESULTS_DIR"
echo "2. Compare metrics across tests"
echo "3. Identify performance bottlenecks and resource limits"
echo ""

