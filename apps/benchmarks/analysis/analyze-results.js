/**
 * Results Analyzer
 *
 * Analyzes k6 and metrics data to generate comprehensive reports
 * Használat: node analyze-results.js --k6 results/k6-summary.json --metrics results/metrics.json --output report.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .option("k6", {
    type: "string",
    description: "k6 results JSON file",
    demandOption: false,
  })
  .option("metrics", {
    type: "string",
    description: "Metrics JSON file",
    demandOption: false,
  })
  .option("output", {
    alias: "o",
    type: "string",
    description: "Output report file",
    default: "results/report.md",
  })
  .help().argv;

console.log(`=== Analyzing Results ===`);

// Load data
let k6Data = null;
let metricsData = null;

if (argv.k6) {
  try {
    k6Data = JSON.parse(readFileSync(argv.k6, "utf-8"));
    console.log(`Loaded k6 data from ${argv.k6}`);
  } catch (error) {
    console.error(`Error loading k6 data: ${error.message}`);
  }
}

if (argv.metrics) {
  try {
    metricsData = JSON.parse(readFileSync(argv.metrics, "utf-8"));
    console.log(`Loaded metrics data from ${argv.metrics}`);
  } catch (error) {
    console.error(`Error loading metrics data: ${error.message}`);
  }
}

// Analysis functions

function analyzeLatency(data) {
  if (!data || !data.metrics) return null;

  const httpReqDuration = data.metrics.http_req_duration;
  if (!httpReqDuration || !httpReqDuration.values) return null;

  return {
    avg: httpReqDuration.values.avg?.toFixed(2),
    min: httpReqDuration.values.min?.toFixed(2),
    max: httpReqDuration.values.max?.toFixed(2),
    p50: httpReqDuration.values["p(50)"]?.toFixed(2),
    p90: httpReqDuration.values["p(90)"]?.toFixed(2),
    p95: httpReqDuration.values["p(95)"]?.toFixed(2),
    p99: httpReqDuration.values["p(99)"]?.toFixed(2),
  };
}

function analyzeErrorRate(data) {
  if (!data || !data.metrics) return null;

  const httpReqFailed = data.metrics.http_req_failed;
  if (!httpReqFailed) return null;

  return {
    rate: (httpReqFailed.values.rate * 100).toFixed(2),
    passes: httpReqFailed.values.passes,
    fails: httpReqFailed.values.fails,
  };
}

function analyzeThroughput(data) {
  if (!data || !data.metrics) return null;

  const iterations = data.metrics.iterations;
  const httpReqs = data.metrics.http_reqs;

  return {
    iterations: iterations?.values?.count,
    iterationsPerSec: iterations?.values?.rate?.toFixed(2),
    requests: httpReqs?.values?.count,
    requestsPerSec: httpReqs?.values?.rate?.toFixed(2),
  };
}

function parseResourceValue(value) {
  if (!value) return 0;

  // Parse CPU: "123m" or "1.5"
  if (value.endsWith("m")) {
    return parseInt(value) / 1000;
  }

  // Parse memory: "1234Mi", "1.5Gi", etc
  if (value.endsWith("Ki")) {
    return parseInt(value) / 1024 / 1024; // Convert to GB
  }
  if (value.endsWith("Mi")) {
    return parseInt(value) / 1024;
  }
  if (value.endsWith("Gi")) {
    return parseInt(value);
  }

  return parseFloat(value);
}

function analyzeResourceUsage(metricsData) {
  if (
    !metricsData ||
    !metricsData.samples ||
    metricsData.samples.length === 0
  ) {
    return null;
  }

  const tenantStats = {};

  // Process each tenant
  for (const sample of metricsData.samples) {
    for (const [tenantId, tenantData] of Object.entries(sample.tenants)) {
      if (!tenantStats[tenantId]) {
        tenantStats[tenantId] = {
          cpu: [],
          memory: [],
          restarts: [],
        };
      }

      // Aggregate pod metrics
      for (const pod of tenantData.pods) {
        const cpuValue = parseResourceValue(pod.cpu);
        const memoryValue = parseResourceValue(pod.memory);

        tenantStats[tenantId].cpu.push(cpuValue);
        tenantStats[tenantId].memory.push(memoryValue);
      }

      // Track restarts
      for (const pod of tenantData.podStatus) {
        tenantStats[tenantId].restarts.push(pod.restarts);
      }
    }
  }

  // Calculate statistics
  const result = {};
  for (const [tenantId, stats] of Object.entries(tenantStats)) {
    const cpuSorted = stats.cpu.sort((a, b) => a - b);
    const memorySorted = stats.memory.sort((a, b) => a - b);
    const maxRestarts = Math.max(...stats.restarts, 0);

    result[tenantId] = {
      cpu: {
        avg: (stats.cpu.reduce((a, b) => a + b, 0) / stats.cpu.length).toFixed(
          3,
        ),
        min: cpuSorted[0]?.toFixed(3) || "0",
        max: cpuSorted[cpuSorted.length - 1]?.toFixed(3) || "0",
        p95: cpuSorted[Math.floor(cpuSorted.length * 0.95)]?.toFixed(3) || "0",
      },
      memory: {
        avg: (
          stats.memory.reduce((a, b) => a + b, 0) / stats.memory.length
        ).toFixed(3),
        min: memorySorted[0]?.toFixed(3) || "0",
        max: memorySorted[memorySorted.length - 1]?.toFixed(3) || "0",
        p95:
          memorySorted[Math.floor(memorySorted.length * 0.95)]?.toFixed(3) ||
          "0",
      },
      restarts: maxRestarts,
      samples: stats.cpu.length,
    };
  }

  return result;
}

function detectThrottling(metricsData) {
  if (!metricsData || !metricsData.samples) return null;

  const throttlingEvents = [];

  for (const sample of metricsData.samples) {
    for (const [tenantId, tenantData] of Object.entries(sample.tenants)) {
      if (!tenantData.resourceQuota) continue;

      const quota = tenantData.resourceQuota;

      // Check CPU throttling
      if (quota.used && quota.hard) {
        const cpuUsed = parseResourceValue(
          quota.used["requests.cpu"] || quota.used["limits.cpu"],
        );
        const cpuHard = parseResourceValue(
          quota.hard["requests.cpu"] || quota.hard["limits.cpu"],
        );

        if (cpuUsed / cpuHard > 0.9) {
          throttlingEvents.push({
            timestamp: sample.timestamp,
            tenant: tenantId,
            type: "cpu",
            usage: cpuUsed,
            limit: cpuHard,
            percentage: ((cpuUsed / cpuHard) * 100).toFixed(1),
          });
        }

        // Check memory throttling
        const memUsed = parseResourceValue(
          quota.used["requests.memory"] || quota.used["limits.memory"],
        );
        const memHard = parseResourceValue(
          quota.hard["requests.memory"] || quota.hard["limits.memory"],
        );

        if (memUsed / memHard > 0.9) {
          throttlingEvents.push({
            timestamp: sample.timestamp,
            tenant: tenantId,
            type: "memory",
            usage: memUsed,
            limit: memHard,
            percentage: ((memUsed / memHard) * 100).toFixed(1),
          });
        }
      }
    }
  }

  return throttlingEvents;
}

// Generate report
function generateReport() {
  const report = [];

  report.push("# Benchmark Results Analysis Report\n");
  report.push(`Generated: ${new Date().toISOString()}\n`);
  report.push("---\n\n");

  // k6 Results
  if (k6Data) {
    report.push("## Load Test Results (k6)\n\n");

    const latency = analyzeLatency(k6Data);
    if (latency) {
      report.push("### Response Time (Latency)\n\n");
      report.push("| Metric | Value (ms) |\n");
      report.push("|--------|------------|\n");
      report.push(`| Average | ${latency.avg} |\n`);
      report.push(`| Minimum | ${latency.min} |\n`);
      report.push(`| Maximum | ${latency.max} |\n`);
      report.push(`| P50 (Median) | ${latency.p50} |\n`);
      report.push(`| P90 | ${latency.p90} |\n`);
      report.push(`| **P95** | **${latency.p95}** |\n`);
      report.push(`| **P99 (Tail Latency)** | **${latency.p99}** |\n`);
      report.push("\n");
    }

    const errorRate = analyzeErrorRate(k6Data);
    if (errorRate) {
      report.push("### Error Rate\n\n");
      report.push(`- **Error Rate**: ${errorRate.rate}%\n`);
      report.push(`- Successful Requests: ${errorRate.passes}\n`);
      report.push(`- Failed Requests: ${errorRate.fails}\n`);
      report.push("\n");
    }

    const throughput = analyzeThroughput(k6Data);
    if (throughput) {
      report.push("### Throughput\n\n");
      report.push(`- Total Requests: ${throughput.requests}\n`);
      report.push(`- **Requests/sec**: **${throughput.requestsPerSec}**\n`);
      report.push(`- Total Iterations: ${throughput.iterations}\n`);
      report.push(`- Iterations/sec: ${throughput.iterationsPerSec}\n`);
      report.push("\n");
    }
  }

  // Metrics Results
  if (metricsData) {
    report.push("## Resource Usage Analysis\n\n");

    const resourceUsage = analyzeResourceUsage(metricsData);
    if (resourceUsage) {
      report.push("### CPU and Memory Usage by Tenant\n\n");

      for (const [tenantId, stats] of Object.entries(resourceUsage)) {
        report.push(`#### Tenant: ${tenantId}\n\n`);

        report.push("**CPU Usage (cores)**\n\n");
        report.push("| Metric | Value |\n");
        report.push("|--------|-------|\n");
        report.push(`| Average | ${stats.cpu.avg} |\n`);
        report.push(`| Minimum | ${stats.cpu.min} |\n`);
        report.push(`| Maximum | ${stats.cpu.max} |\n`);
        report.push(`| P95 | ${stats.cpu.p95} |\n`);
        report.push("\n");

        report.push("**Memory Usage (GB)**\n\n");
        report.push("| Metric | Value |\n");
        report.push("|--------|-------|\n");
        report.push(`| Average | ${stats.memory.avg} |\n`);
        report.push(`| Minimum | ${stats.memory.min} |\n`);
        report.push(`| Maximum | ${stats.memory.max} |\n`);
        report.push(`| P95 | ${stats.memory.p95} |\n`);
        report.push("\n");

        report.push(`**Pod Restarts**: ${stats.restarts}\n\n`);
        report.push(`_Based on ${stats.samples} samples_\n\n`);
      }
    }

    const throttling = detectThrottling(metricsData);
    if (throttling && throttling.length > 0) {
      report.push("### Resource Throttling Events\n\n");
      report.push(`Detected ${throttling.length} throttling events:\n\n`);

      report.push(
        "| Timestamp | Tenant | Type | Usage | Limit | Percentage |\n",
      );
      report.push(
        "|-----------|--------|------|-------|-------|------------|\n",
      );

      for (const event of throttling.slice(0, 20)) {
        // Show first 20
        report.push(
          `| ${event.timestamp} | ${event.tenant} | ${event.type} | ${event.usage.toFixed(2)} | ${event.limit.toFixed(2)} | ${event.percentage}% |\n`,
        );
      }

      if (throttling.length > 20) {
        report.push(`\n_Showing first 20 of ${throttling.length} events_\n`);
      }

      report.push("\n");
    } else {
      report.push("### Resource Throttling Events\n\n");
      report.push("No throttling events detected.\n\n");
    }
  }

  // Summary and Conclusions
  report.push("## Key Findings\n\n");

  if (k6Data && metricsData) {
    const latency = analyzeLatency(k6Data);
    const resourceUsage = analyzeResourceUsage(metricsData);
    const throttling = detectThrottling(metricsData);

    report.push("### Performance Summary\n\n");

    if (latency && latency.p99) {
      const p99 = parseFloat(latency.p99);
      if (p99 < 500) {
        report.push("✅ **Excellent** tail latency (P99 < 500ms)\n\n");
      } else if (p99 < 1000) {
        report.push("⚠️ **Acceptable** tail latency (P99 < 1000ms)\n\n");
      } else if (p99 < 2000) {
        report.push("⚠️ **Degraded** tail latency (P99 < 2000ms)\n\n");
      } else {
        report.push("❌ **Poor** tail latency (P99 > 2000ms)\n\n");
      }
    }

    if (throttling && throttling.length > 0) {
      report.push(
        `⚠️ Resource throttling detected (${throttling.length} events)\n\n`,
      );
    } else {
      report.push("✅ No resource throttling detected\n\n");
    }

    report.push("### Recommendations\n\n");

    if (throttling && throttling.length > 0) {
      report.push(
        "- Consider increasing resource quotas for affected tenants\n",
      );
      report.push("- Implement horizontal pod autoscaling (HPA)\n");
      report.push("- Review application resource requests and limits\n");
    }

    if (latency && parseFloat(latency.p99) > 1000) {
      report.push(
        "- Investigate tail latency causes (slow queries, external calls)\n",
      );
      report.push("- Implement caching strategies\n");
      report.push("- Optimize database queries\n");
    }

    if (resourceUsage) {
      const tenants = Object.keys(resourceUsage);
      if (tenants.length > 1) {
        report.push('- Monitor for "noisy neighbor" effects between tenants\n');
        report.push("- Consider implementing rate limiting\n");
      }
    }
  }

  report.push("\n---\n\n");
  report.push("_Generated by kite benchmarks analysis tool_\n");

  return report.join("");
}

// Save report
const reportContent = generateReport();

try {
  const dir = dirname(argv.output);
  mkdirSync(dir, { recursive: true });
  writeFileSync(argv.output, reportContent);
  console.log(`Report saved to: ${argv.output}`);
} catch (error) {
  console.error("Error saving report:", error.message);
  process.exit(1);
}

console.log("\n=== Analysis Complete ===");
