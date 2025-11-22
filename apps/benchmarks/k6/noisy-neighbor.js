import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const noisyTenantLatency = new Trend("noisy_tenant_latency", true);
const quietTenantLatency = new Trend("quiet_tenant_latency", true);
const quietTenantP99 = new Trend("quiet_tenant_p99", true);
const requestCount = new Counter("total_requests");

export const options = {
  scenarios: {
    noisy_neighbor: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "1m", target: 500 },
        { duration: "1m", target: 1000 },
        { duration: "1m", target: 1000 },
        { duration: "1m", target: 0 },
      ],
      exec: "noisyTenant",
      tags: { scenario: "noisy" },
    },
    quiet_tenants: {
      executor: "constant-vus",
      vus: 30,
      duration: "5m",
      exec: "quietTenants",
      tags: { scenario: "quiet" },
    },
  },
  thresholds: {
    quiet_tenant_latency: ["p(95)<800", "p(99)<2000"],
    "quiet_tenant_p99{tenant:tenant2}": ["p(99)<2000"],
    "quiet_tenant_p99{tenant:tenant3}": ["p(99)<2000"],
    "http_req_failed{scenario:quiet}": ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "kuberi.tech";
const TENANT_IDS = __ENV.TENANTS
  ? __ENV.TENANTS.split(",").map((id) => id.trim())
  : [];

if (TENANT_IDS.length === 0) {
  throw new Error("No tenants found");
}

const NOISY_TENANT = __ENV.NOISY_TENANT || TENANT_IDS[0];
const QUIET_TENANTS = TENANT_IDS.filter((id) => id !== NOISY_TENANT);

if (QUIET_TENANTS.length === 0) {
  throw new Error("No quiet tenants found");
}

const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
}

const MINIKUBE_IP = __ENV.MINIKUBE_IP || "192.168.49.2";
const NODE_PORT = __ENV.NODE_PORT || "31899";

function getTenantUrl(tenantId) {
  return `http://${MINIKUBE_IP}:${NODE_PORT}/api`;
}

export function noisyTenant() {
  const url = `${getTenantUrl(NOISY_TENANT)}/auth/login`;

  const response = http.post(
    url,
    JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Host: `${NOISY_TENANT}.${BASE_URL}`,
      },
      tags: { tenant: NOISY_TENANT, type: "noisy" },
      timeout: "30s",
    },
  );

  const duration = response.timings.duration;
  noisyTenantLatency.add(duration, { tenant: NOISY_TENANT });
  requestCount.add(1, { tenant: NOISY_TENANT });

  const success = check(response, {
    "noisy: status is 200 or 401": (r) => r.status >= 200 && r.status < 300,
  });

  errorRate.add(!success, { tenant: NOISY_TENANT });

  sleep(0.1);
}

export function quietTenants() {
  const tenantId =
    QUIET_TENANTS[Math.floor(Math.random() * QUIET_TENANTS.length)];
  const url = `${getTenantUrl(tenantId)}/auth/login`;

  const response = http.post(
    url,
    JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Host: `${tenantId}.${BASE_URL}`,
      },
      tags: { tenant: tenantId, type: "quiet" },
      timeout: "30s",
    },
  );

  const duration = response.timings.duration;
  quietTenantLatency.add(duration, { tenant: tenantId });
  quietTenantP99.add(duration, { tenant: tenantId });
  requestCount.add(1, { tenant: tenantId });

  const success = check(response, {
    "quiet: status is 200 or 401": (r) => r.status >= 200 && r.status < 300,
    "quiet: latency acceptable": (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success, { tenant: tenantId });

  sleep(Math.random() * 3 + 1);
}

export function setup() {
  console.log(`=== Noisy Neighbor Test ===`);
  console.log(`Noisy tenant: ${NOISY_TENANT}`);
  console.log(`Quiet tenants: ${QUIET_TENANTS.join(", ")}`);
  console.log(`Registering test user on all tenants...`);

  const allTenants = [NOISY_TENANT, ...QUIET_TENANTS];
  allTenants.forEach((tenantId) => {
    const registerUrl = `${getTenantUrl(tenantId)}/auth/register`;
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
          Host: `${tenantId}.${BASE_URL}`,
        },
        timeout: "30s",
      },
    );

    if (registerResponse.status === 201 || registerResponse.status === 200) {
      console.log(`  ✓ Tenant ${tenantId}: User registered`);
    } else if (registerResponse.status === 400) {
      console.log(`  ✓ Tenant ${tenantId}: User already exists`);
    } else {
      console.log(
        `  ⚠ Tenant ${tenantId}: Registration returned ${registerResponse.status}`,
      );
    }
  });

  console.log(`Starting test...`);

  return {
    startTime: new Date().toISOString(),
    noisyTenant: NOISY_TENANT,
    quietTenants: QUIET_TENANTS,
  };
}

export function teardown(data) {
  console.log(`\n=== Test Summary ===`);
  console.log(`Started at: ${data.startTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
  console.log(
    `\nAnalyze the results to see impact on quiet tenants' tail latency (P95, P99)`,
  );
}
