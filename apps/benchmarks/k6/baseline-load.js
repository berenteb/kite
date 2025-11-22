/**
 * Baseline Load Test
 *
 * Célja: Normál terhelés mellett mérni a rendszer teljesítményét
 * minden tenant esetén egyenlő terheléssel.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const tenantLatency = new Trend("tenant_latency", true);

// Test configuration
export const options = {
  stages: [
    { duration: "1m", target: 100 },
    { duration: "1m", target: 500 },
    { duration: "1m", target: 1000 },
    { duration: "1m", target: 1000 },
    { duration: "1m", target: 0 },
  ],
  noConnectionReuse: false,
};

// Configuration - update these based on your environment
const BASE_URL = __ENV.BASE_URL || "kuberi.tech";
const TENANT_IDS = __ENV.TENANTS
  ? __ENV.TENANTS.split(",").map((id) => id.trim())
  : [];
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
}

if (TENANT_IDS.length === 0) {
  throw new Error("No tenants found");
}

// Generate tenant configs with URLs
// For NodePort access, use minikube IP:NodePort with Host header
const MINIKUBE_IP = __ENV.MINIKUBE_IP || "127.0.0.1";
const NODE_PORT = __ENV.NODE_PORT || "61485";
const TENANTS = TENANT_IDS.map((id) => ({
  id: id,
  url: `http://${MINIKUBE_IP}:${NODE_PORT}/api`,
  hostname: `${id}.${BASE_URL}`,
}));

const API_ENDPOINTS = [
  { path: "/health", weight: 10 },
  { path: "/auth/login", weight: 30, requiresAuth: true },
  // Add more endpoints based on your API
];

export function setup() {
  console.log(`Starting baseline load test with ${TENANTS.length} tenants`);
  console.log(`Registering test user on all tenants...`);
  // Register test user on all tenants
  TENANTS.forEach((tenant) => {
    const registerUrl = `${tenant.url}/auth/register`;
    const registerResponse = http.post(
      registerUrl,
      JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        firstName: "Test",
        lastName: "User",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Host: tenant.hostname,
        },
        timeout: "30s",
      },
    );

    if (registerResponse.status === 201 || registerResponse.status === 200) {
      console.log(`  ✓ Tenant ${tenant.id}: User registered`);
    } else if (registerResponse.status === 400) {
      console.log(`  ✓ Tenant ${tenant.id}: User already exists`);
    } else {
      console.log(
        `  ⚠ Tenant ${tenant.id}: Registration returned ${registerResponse.status}`,
      );
    }
  });

  return { startTime: new Date().toISOString() };
}

export default function () {
  // Randomly select a tenant
  const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];

  // Randomly select an endpoint based on weights
  const totalWeight = API_ENDPOINTS.reduce((sum, ep) => sum + ep.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedEndpoint = API_ENDPOINTS[0];

  for (const endpoint of API_ENDPOINTS) {
    random -= endpoint.weight;
    if (random <= 0) {
      selectedEndpoint = endpoint;
      break;
    }
  }

  const url = `${tenant.url}${selectedEndpoint.path}`;
  const params = {
    headers: {
      "Content-Type": "application/json",
      Host: tenant.hostname,
    },
    tags: {
      tenant: tenant.id,
      endpoint: selectedEndpoint.path,
    },
    timeout: "30s",
  };

  const startTime = new Date();
  let response;
  if (selectedEndpoint.path === "/health") {
    response = http.get(url, params);
  } else {
    response = http.post(
      url,
      JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Host: tenant.hostname,
        },
        tags: {
          tenant: tenant.id,
          endpoint: selectedEndpoint.path,
        },
        timeout: "30s",
      },
    );
  }
  const duration = new Date() - startTime;

  // Record metrics
  tenantLatency.add(duration, { tenant: tenant.id });

  // Checks
  const success = check(response, {
    "status is 200 or 401": (r) => r.status >= 200 && r.status < 300,
    "response time < 1s": (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);

  // Random sleep between 1-5 seconds to simulate user think time
  sleep(Math.random() * 4 + 1);
}

export function teardown(data) {
  console.log(`Baseline test completed. Started at: ${data.startTime}`);
}
