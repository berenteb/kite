/**
 * I/O Stress Tool
 *
 * Generates I/O load on a specific tenant by uploading/downloading data
 * Használat: node io-stress.js --tenant tenant1 --duration 300 --size 1024
 */

import axios from "axios";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import crypto from "crypto";

const argv = yargs(hideBin(process.argv))
  .option("tenant", {
    alias: "t",
    type: "string",
    description: "Tenant ID",
    default: "tenant1",
  })
  .option("duration", {
    alias: "d",
    type: "number",
    description: "Duration in seconds",
    default: 300,
  })
  .option("size", {
    alias: "s",
    type: "number",
    description: "Payload size in KB",
    default: 1024,
  })
  .option("base-url", {
    alias: "b",
    type: "string",
    description: "Base URL",
    default: "kuberi.tech",
  })
  .option("parallel", {
    alias: "p",
    type: "number",
    description: "Number of parallel workers",
    default: 5,
  })
  .option("operation", {
    alias: "o",
    type: "string",
    description: "Operation type: read, write, or mixed",
    default: "mixed",
    choices: ["read", "write", "mixed"],
  })
  .help().argv;

const tenantUrl = `http://${argv.tenant}.${argv["base-url"]}`;
const startTime = Date.now();
const endTime = startTime + argv.duration * 1000;

console.log(`=== I/O Stress Test ===`);
console.log(`Tenant: ${argv.tenant}`);
console.log(`URL: ${tenantUrl}`);
console.log(`Duration: ${argv.duration}s`);
console.log(`Payload size: ${argv.size}KB`);
console.log(`Parallel workers: ${argv.parallel}`);
console.log(`Operation: ${argv.operation}`);
console.log(`Starting at: ${new Date(startTime).toISOString()}`);
console.log(`Will end at: ${new Date(endTime).toISOString()}`);
console.log("");

let requestCount = 0;
let errorCount = 0;
let totalLatency = 0;
let bytesTransferred = 0;

// Generate random data payload
function generatePayload(sizeKB) {
  return crypto.randomBytes(sizeKB * 1024).toString("base64");
}

// Simulate write operation
async function writeOperation() {
  const payload = generatePayload(argv.size);

  try {
    const start = Date.now();

    // POST request with payload
    // In production, replace with actual upload endpoint
    const response = await axios.post(
      `${tenantUrl}/api/health`,
      { data: payload },
      {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          "X-Stress-Test": "io-write",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    const latency = Date.now() - start;
    totalLatency += latency;
    requestCount++;
    bytesTransferred += payload.length;

    if (response.status >= 400) {
      errorCount++;
    }

    return { success: true, latency, bytes: payload.length };
  } catch (error) {
    errorCount++;
    return { success: false, error: error.message };
  }
}

// Simulate read operation
async function readOperation() {
  try {
    const start = Date.now();

    // GET request
    const response = await axios.get(`${tenantUrl}/api/health`, {
      timeout: 30000,
      headers: {
        "X-Stress-Test": "io-read",
      },
    });

    const latency = Date.now() - start;
    totalLatency += latency;
    requestCount++;

    // Estimate bytes read
    const bytes = JSON.stringify(response.data).length;
    bytesTransferred += bytes;

    if (response.status >= 400) {
      errorCount++;
    }

    return { success: true, latency, bytes };
  } catch (error) {
    errorCount++;
    return { success: false, error: error.message };
  }
}

// I/O load generator
async function generateLoad() {
  while (Date.now() < endTime) {
    let result;

    // Determine operation based on strategy
    if (argv.operation === "write") {
      result = await writeOperation();
    } else if (argv.operation === "read") {
      result = await readOperation();
    } else {
      // Mixed: 50/50 read/write
      result =
        Math.random() > 0.5 ? await writeOperation() : await readOperation();
    }

    // Report progress every 50 requests
    if (requestCount % 50 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.floor((endTime - Date.now()) / 1000);
      const avgLatency = Math.floor(totalLatency / requestCount);
      const rps = Math.floor(requestCount / elapsed);
      const mbTransferred = (bytesTransferred / 1024 / 1024).toFixed(2);
      const throughput = (bytesTransferred / 1024 / elapsed).toFixed(2);

      console.log(
        `[${elapsed}s/${argv.duration}s] Requests: ${requestCount}, Errors: ${errorCount}, Avg Latency: ${avgLatency}ms, RPS: ${rps}, Data: ${mbTransferred}MB, Throughput: ${throughput}KB/s, Remaining: ${remaining}s`,
      );
    }

    if (!result.success) {
      console.error(`Error: ${result.error}`);

      if (result.error.includes("ECONNREFUSED")) {
        console.error("Connection refused - is the tenant running?");
        process.exit(1);
      }
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Start parallel workers
const workers = [];
for (let i = 0; i < argv.parallel; i++) {
  workers.push(generateLoad());
}

// Wait for all workers to complete
Promise.all(workers)
  .then(() => {
    const totalDuration = (Date.now() - startTime) / 1000;
    const avgLatency = totalLatency / requestCount;
    const rps = requestCount / totalDuration;
    const errorRate = (errorCount / requestCount) * 100;
    const mbTransferred = (bytesTransferred / 1024 / 1024).toFixed(2);
    const throughput = (bytesTransferred / 1024 / totalDuration).toFixed(2);

    console.log("\n=== Test Complete ===");
    console.log(`Total Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`Total Requests: ${requestCount}`);
    console.log(`Total Errors: ${errorCount} (${errorRate.toFixed(2)}%)`);
    console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Requests/sec: ${rps.toFixed(2)}`);
    console.log(`Data Transferred: ${mbTransferred}MB`);
    console.log(`Average Throughput: ${throughput}KB/s`);
    console.log(`Ended at: ${new Date().toISOString()}`);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nInterrupted by user");
  const totalDuration = (Date.now() - startTime) / 1000;
  const avgLatency = totalLatency / requestCount;
  const rps = requestCount / totalDuration;
  const errorRate = (errorCount / requestCount) * 100;
  const mbTransferred = (bytesTransferred / 1024 / 1024).toFixed(2);
  const throughput = (bytesTransferred / 1024 / totalDuration).toFixed(2);

  console.log("\n=== Test Interrupted ===");
  console.log(`Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`Total Requests: ${requestCount}`);
  console.log(`Total Errors: ${errorCount} (${errorRate.toFixed(2)}%)`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`Requests/sec: ${rps.toFixed(2)}`);
  console.log(`Data Transferred: ${mbTransferred}MB`);
  console.log(`Average Throughput: ${throughput}KB/s`);

  process.exit(0);
});
