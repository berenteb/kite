/**
 * Pool Exhaustion Test
 *
 * Célja: Tesztelni a connection pool, thread pool, és egyéb pool erőforrások
 * kimerülését és a rendszer viselkedését pool exhaustion esetén.
 *
 * Módszertan:
 * - Sok párhuzamos, hosszú életű kapcsolatot hozunk létre
 * - Mérjük a pool exhaustion hatását új kérésekre
 * - Vizsgáljuk a recovery időt
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const connectionErrors = new Counter("connection_errors");
const poolExhausted = new Gauge("pool_exhausted");
const timeoutErrors = new Counter("timeout_errors");
const queueWaitTime = new Trend("queue_wait_time", true);
const newConnectionLatency = new Trend("new_connection_latency", true);

export const options = {
  scenarios: {
    // Scenario 1: Saturate connection pool
    pool_saturation: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "1m", target: 500 }, // Saturate pool
        { duration: "1m", target: 2000 }, // Exceed pool capacity
        { duration: "1m", target: 0 }, // Recovery
      ],
      exec: "longLivedConnections",
      tags: { scenario: "saturation" },
    },
    // Scenario 2: Test new connections during saturation
    new_connections: {
      executor: "constant-arrival-rate",
      rate: 10,
      timeUnit: "1s",
      duration: "5m",
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: "testNewConnection",
      tags: { scenario: "new_connection" },
      startTime: "2m", // Start after saturation begins
    },
  },
  thresholds: {
    new_connection_latency: ["p(95)<3000", "p(99)<5000"],
    connection_errors: ["count<100"],
    "http_req_failed{scenario:new_connection}": ["rate<0.1"], // 10% error threshold
  },
};

const TENANT_IDS = __ENV.TENANTS
  ? __ENV.TENANTS.split(",").map((id) => id.trim())
  : [];

if (TENANT_IDS.length === 0) {
  throw new Error("No tenants found");
}

const TENANT_ID = __ENV.TENANT_ID || TENANT_IDS[0];
if (!TENANT_IDS.includes(TENANT_ID)) {
  throw new Error(`Tenant ${TENANT_ID} not found`);
}

const BASE_URL = __ENV.BASE_URL || "kuberi.tech";
const MINIKUBE_IP = __ENV.MINIKUBE_IP || "192.168.49.2";
const NODE_PORT = __ENV.NODE_PORT || "31899";
const TENANT_URL = `http://${MINIKUBE_IP}:${NODE_PORT}/api`;
const TENANT_HOSTNAME = `${TENANT_ID}.${BASE_URL}`;

// Long-lived connections to saturate pool
export function longLivedConnections() {
  const url = `${TENANT_URL}/health`;

  const response = http.get(url, {
    headers: {
      Host: TENANT_HOSTNAME,
    },
    tags: {
      tenant: TENANT_ID,
      type: "long_lived",
    },
    timeout: "60s", // Long timeout to hold connection
  });

  const isConnectionError = response.error_code !== 0;
  const isTimeout = response.error && response.error.includes("timeout");

  if (isConnectionError) {
    connectionErrors.add(1);
  }

  if (isTimeout) {
    timeoutErrors.add(1);
  }

  check(response, {
    "long-lived: no connection error": (r) => r.error_code === 0,
  });

  // Hold connection longer
  sleep(Math.random() * 5 + 10); // 10-15 seconds
}

const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
}

// Test new connections during pool saturation
export function testNewConnection() {
  const url = `${TENANT_URL}/auth/login`;

  const startTime = new Date().getTime();
  const response = http.post(
    url,
    JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Host: TENANT_HOSTNAME,
      },
      tags: {
        tenant: TENANT_ID,
        type: "new_connection",
      },
      timeout: "10s",
    },
  );
  const duration = new Date().getTime() - startTime;

  // Record metrics
  newConnectionLatency.add(duration, { tenant: TENANT_ID });

  // Detect pool exhaustion indicators
  const isPoolExhausted =
    response.status === 503 ||
    response.status === 429 ||
    (response.error &&
      (response.error.includes("pool") ||
        response.error.includes("connection") ||
        response.error.includes("timeout")));

  if (isPoolExhausted) {
    poolExhausted.add(1);
    connectionErrors.add(1, { type: "pool_exhausted" });
    queueWaitTime.add(duration, { exhausted: true });
  } else {
    queueWaitTime.add(duration, { exhausted: false });
  }

  // Checks
  const success = check(response, {
    "new connection: status is 200 or 401": (r) =>
      r.status >= 200 && r.status < 300,
    "new connection: no errors": (r) => r.error_code === 0,
    "new connection: reasonable latency": (r) => r.timings.duration < 5000,
  });

  if (!success) {
    errorRate.add(1, { type: "new_connection" });
  }

  sleep(1);
}

export function setup() {
  console.log(`=== Pool Exhaustion Test ===`);
  console.log(`Target tenant: ${TENANT_ID}`);
  console.log(`Registering test user...`);

  // Register test user
  const registerUrl = `${TENANT_URL}/auth/register`;
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
        Host: TENANT_HOSTNAME,
      },
      timeout: "30s",
    },
  );

  if (registerResponse.status === 201 || registerResponse.status === 200) {
    console.log(`✓ Test user registered successfully`);
  } else if (registerResponse.status === 400) {
    console.log(`✓ Test user already exists (ok)`);
  } else {
    console.log(
      `⚠ Warning: User registration returned ${registerResponse.status}`,
    );
  }

  console.log(
    `Test will saturate connection pools and test new connections during exhaustion`,
  );
  console.log(`Starting test...`);

  return {
    startTime: new Date().toISOString(),
    tenant: TENANT_ID,
  };
}

export function teardown(data) {
  console.log(`\n=== Test Summary ===`);
  console.log(`Tenant: ${data.tenant}`);
  console.log(`Started at: ${data.startTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
  console.log(
    `\nCheck connection_errors and pool_exhausted metrics to identify bottlenecks`,
  );
}
