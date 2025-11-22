/**
 * Resource Limits and Quotas Test
 *
 * Célja: Vizsgálni a Kubernetes resource limits és requests hatását
 * a tenant teljesítményére különböző konfigurációk mellett.
 *
 * Módszertan:
 * - Fokozatosan növeljük a terhelést
 * - Figyeljük, amikor a tenant eléri a resource limiteket
 * - Mérjük a throttling hatását a latency-re
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import exec from "k6/execution";

// Custom metrics
const errorRate = new Rate("errors");
const latencyByPhase = new Trend("latency_by_phase", true);
const throttlingEvents = new Counter("throttling_events");
const cpuThrottling = new Trend("cpu_throttling_detected", true);

export const options = {
  stages: [
    // Phase 1: Light load - under limits
    { duration: "1m", target: 100 },
    // Phase 2: Normal load - approaching limits
    { duration: "1m", target: 500 },
    // Phase 3: Heavy load - at limits
    { duration: "1m", target: 1000 },
    // Phase 4: Overload - exceeding limits
    { duration: "1m", target: 1500 },
    // Phase 5: Stress - far exceeding limits
    { duration: "1m", target: 2000 },
    // Recovery
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    "http_req_duration{phase:light}": ["p(99)<500"],
    "http_req_duration{phase:normal}": ["p(99)<800"],
    "http_req_duration{phase:heavy}": ["p(99)<1500"],
    "http_req_duration{phase:overload}": ["p(99)<3000"],
  },
  noConnectionReuse: false,
  userAgent: "k6-load-test",
};

const TENANT_IDS = __ENV.TENANTS
  ? __ENV.TENANTS.split(",").map((id) => id.trim())
  : [];

if (TENANT_IDS.length === 0) {
  throw new Error("No tenants found");
}

const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
}

const TENANT_ID = __ENV.TENANT_ID || TENANT_IDS[0];
const BASE_URL = __ENV.BASE_URL || "kuberi.tech";
if (!TENANT_IDS.includes(TENANT_ID)) {
  throw new Error(`Tenant ${TENANT_ID} not found`);
}

const MINIKUBE_IP = __ENV.MINIKUBE_IP || "127.0.0.1";
const NODE_PORT = __ENV.NODE_PORT || "61485";
const TENANT_URL = `http://${MINIKUBE_IP}:${NODE_PORT}/api`;
const TENANT_HOSTNAME = `${TENANT_ID}.${BASE_URL}`;

// Determine current phase based on time elapsed
function getCurrentPhase() {
  // Get elapsed time in seconds since test start
  const elapsed = exec.scenario.progress * 360; // Total test duration is 360 seconds (6 minutes)

  // Each phase is 60 seconds
  if (elapsed < 60) return "light";
  if (elapsed < 120) return "normal";
  if (elapsed < 180) return "heavy";
  if (elapsed < 240) return "overload";
  if (elapsed < 300) return "stress";
  return "recovery";
}

export default function () {
  const phase = getCurrentPhase();

  // Different endpoint patterns for different phases
  let endpoint = "/health";
  if (phase === "heavy" || phase === "overload" || phase === "stress") {
    // More CPU-intensive endpoints
    endpoint = "/auth/login"; // Replace with a more intensive endpoint if available
  }

  const url = `${TENANT_URL}${endpoint}`;

  const startTime = new Date().getTime();

  let response;
  if (endpoint === "/health") {
    response = http.get(url, {
      headers: {
        Host: TENANT_HOSTNAME,
      },
      tags: {
        tenant: TENANT_ID,
        phase: phase,
      },
      timeout: "30s",
    });
  } else {
    // Correct k6 http.post syntax: http.post(url, body, params)
    response = http.post(
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
          phase: phase,
        },
        timeout: "30s",
      },
    );
  }
  const duration = new Date().getTime() - startTime;

  // Record metrics
  latencyByPhase.add(duration, { phase: phase, tenant: TENANT_ID });

  // Detect throttling (significantly increased latency or 429/503 errors)
  const isThrottled =
    response.status === 429 || response.status === 503 || duration > 2000;

  if (isThrottled) {
    throttlingEvents.add(1, { phase: phase });
    cpuThrottling.add(1, { phase: phase });
  }

  // Checks
  const success = check(response, {
    "status is 200-299, 401, or throttled": (r) =>
      (r.status >= 200 && r.status < 300) ||
      r.status === 401 || // Unauthorized (expected - user doesn't exist)
      r.status === 429 ||
      r.status === 503,
    [`${phase}: acceptable latency`]: (r) => {
      const limits = {
        light: 500,
        normal: 800,
        heavy: 1500,
        overload: 3000,
        stress: 5000,
        recovery: 1000,
      };
      return r.timings.duration < limits[phase];
    },
  });

  errorRate.add(!success, { phase: phase });

  // Adaptive sleep based on phase
  const sleepTimes = {
    light: 2,
    normal: 1,
    heavy: 0.5,
    overload: 0.2,
    stress: 0.1,
    recovery: 2,
  };

  sleep(sleepTimes[phase] || 1);
}

export function setup() {
  console.log(`=== Resource Limits Test ===`);
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
    `Test will progress through phases: light → normal → heavy → overload → stress → recovery`,
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
    `\nAnalyze throttling events and latency by phase to understand resource limit impact`,
  );
}
