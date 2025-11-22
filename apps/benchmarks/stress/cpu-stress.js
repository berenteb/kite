/**
 * CPU Stress Tool
 *
 * Generates CPU load on a specific tenant to simulate "noisy neighbor"
 * Használat: node cpu-stress.js --tenant tenant1 --duration 300 --intensity 100
 */

import axios from "axios";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

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
  .option("intensity", {
    alias: "i",
    type: "number",
    description: "CPU intensity (0-100)",
    default: 100,
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
    default: 10,
  })
  .help().argv;

const tenantUrl = `http://${argv.tenant}.${argv["base-url"]}`;
const startTime = Date.now();
const endTime = startTime + argv.duration * 1000;

console.log(`=== CPU Stress Test ===`);
console.log(`Tenant: ${argv.tenant}`);
console.log(`URL: ${tenantUrl}`);
console.log(`Duration: ${argv.duration}s`);
console.log(`Intensity: ${argv.intensity}%`);
console.log(`Parallel workers: ${argv.parallel}`);
console.log(`Starting at: ${new Date(startTime).toISOString()}`);
console.log(`Will end at: ${new Date(endTime).toISOString()}`);
console.log("");

let requestCount = 0;
let errorCount = 0;
let totalLatency = 0;

// CPU-intensive request generator
async function generateLoad() {
  while (Date.now() < endTime) {
    try {
      const start = Date.now();

      // Send request to health endpoint
      // In production, you might want to hit CPU-intensive endpoints
      const response = await axios.get(`${tenantUrl}/api/health`, {
        timeout: 10000,
        headers: {
          "X-Stress-Test": "cpu-load",
        },
      });

      const latency = Date.now() - start;
      totalLatency += latency;
      requestCount++;

      if (response.status >= 400) {
        errorCount++;
      }

      // Report progress every 100 requests
      if (requestCount % 100 === 0) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.floor((endTime - Date.now()) / 1000);
        const avgLatency = Math.floor(totalLatency / requestCount);
        const rps = Math.floor(requestCount / elapsed);

        console.log(
          `[${elapsed}s/${argv.duration}s] Requests: ${requestCount}, Errors: ${errorCount}, Avg Latency: ${avgLatency}ms, RPS: ${rps}, Remaining: ${remaining}s`,
        );
      }

      // Adjust sleep based on intensity
      const sleepMs = Math.max(0, (100 - argv.intensity) * 10);
      if (sleepMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
      }
    } catch (error) {
      errorCount++;

      if (error.code === "ECONNABORTED") {
        console.error("Request timeout");
      } else if (error.code === "ECONNREFUSED") {
        console.error("Connection refused - is the tenant running?");
        process.exit(1);
      } else {
        console.error(`Error: ${error.message}`);
      }
    }
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

    console.log("\n=== Test Complete ===");
    console.log(`Total Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`Total Requests: ${requestCount}`);
    console.log(`Total Errors: ${errorCount} (${errorRate.toFixed(2)}%)`);
    console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Requests/sec: ${rps.toFixed(2)}`);
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

  console.log("\n=== Test Interrupted ===");
  console.log(`Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`Total Requests: ${requestCount}`);
  console.log(`Total Errors: ${errorCount} (${errorRate.toFixed(2)}%)`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`Requests/sec: ${rps.toFixed(2)}`);

  process.exit(0);
});
