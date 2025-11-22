/**
 * Metrics Collector
 * 
 * Collects metrics from Kubernetes pods and nodes during benchmark tests
 * Használat: node collect-metrics.js --duration 600 --interval 5 --output results/metrics.json
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const execAsync = promisify(exec);

const argv = yargs(hideBin(process.argv))
  .option('duration', {
    alias: 'd',
    type: 'number',
    description: 'Collection duration in seconds',
    default: 600
  })
  .option('interval', {
    alias: 'i',
    type: 'number',
    description: 'Collection interval in seconds',
    default: 5
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output file path',
    default: 'results/metrics.json'
  })
  .option('tenants', {
    alias: 't',
    type: 'array',
    description: 'Tenant IDs to monitor',
    default: []
  })
  .help()
  .argv;

const startTime = Date.now();
const endTime = startTime + (argv.duration * 1000);
const metrics = {
  metadata: {
    startTime: new Date(startTime).toISOString(),
    duration: argv.duration,
    interval: argv.interval,
    tenants: argv.tenants,
  },
  samples: [],
};

console.log(`=== Metrics Collection ===`);
console.log(`Duration: ${argv.duration}s`);
console.log(`Interval: ${argv.interval}s`);
console.log(`Tenants: ${argv.tenants.length > 0 ? argv.tenants.join(', ') : 'all'}`);
console.log(`Output: ${argv.output}`);
console.log(`Starting at: ${new Date(startTime).toISOString()}`);
console.log('');

// Get pod metrics
async function getPodMetrics(namespace) {
  try {
    const { stdout } = await execAsync(`kubectl top pods -n ${namespace} --no-headers`);
    const lines = stdout.trim().split('\n');
    
    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        name: parts[0],
        cpu: parts[1],
        memory: parts[2],
      };
    });
  } catch (error) {
    console.error(`Error getting pod metrics for namespace ${namespace}:`, error.message);
    return [];
  }
}

// Get node metrics
async function getNodeMetrics() {
  try {
    const { stdout } = await execAsync(`kubectl top nodes --no-headers`);
    const lines = stdout.trim().split('\n');
    
    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        name: parts[0],
        cpu: parts[1],
        cpuPercent: parts[2],
        memory: parts[3],
        memoryPercent: parts[4],
      };
    });
  } catch (error) {
    console.error(`Error getting node metrics:`, error.message);
    return [];
  }
}

// Get resource quota usage
async function getResourceQuota(namespace) {
  try {
    const { stdout } = await execAsync(`kubectl get resourcequota -n ${namespace} -o json`);
    const data = JSON.parse(stdout);
    
    if (!data.items || data.items.length === 0) {
      return null;
    }
    
    const quota = data.items[0];
    return {
      name: quota.metadata.name,
      used: quota.status.used,
      hard: quota.status.hard,
    };
  } catch (error) {
    return null;
  }
}

// Get pod status
async function getPodStatus(namespace) {
  try {
    const { stdout } = await execAsync(`kubectl get pods -n ${namespace} -o json`);
    const data = JSON.parse(stdout);
    
    return data.items.map(pod => ({
      name: pod.metadata.name,
      phase: pod.status.phase,
      ready: pod.status.conditions?.find(c => c.type === 'Ready')?.status === 'True',
      restarts: pod.status.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) || 0,
    }));
  } catch (error) {
    console.error(`Error getting pod status for namespace ${namespace}:`, error.message);
    return [];
  }
}

// Get all tenant namespaces
async function getTenantNamespaces() {
  if (argv.tenants.length > 0) {
    return argv.tenants.map(t => `tenant-${t}`);
  }
  
  try {
    const { stdout } = await execAsync(`kubectl get namespaces -l tenant-id -o jsonpath='{.items[*].metadata.name}'`);
    return stdout.trim().split(/\s+/).filter(n => n);
  } catch (error) {
    console.error(`Error getting tenant namespaces:`, error.message);
    return [];
  }
}

// Collect metrics sample
async function collectSample() {
  const timestamp = new Date().toISOString();
  const sample = {
    timestamp,
    nodes: await getNodeMetrics(),
    tenants: {},
  };
  
  const namespaces = await getTenantNamespaces();
  
  for (const namespace of namespaces) {
    const tenantId = namespace.replace('tenant-', '');
    sample.tenants[tenantId] = {
      namespace,
      pods: await getPodMetrics(namespace),
      podStatus: await getPodStatus(namespace),
      resourceQuota: await getResourceQuota(namespace),
    };
  }
  
  return sample;
}

// Main collection loop
async function collect() {
  let sampleCount = 0;
  
  while (Date.now() < endTime) {
    const loopStart = Date.now();
    
    try {
      const sample = await collectSample();
      metrics.samples.push(sample);
      sampleCount++;
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.floor((endTime - Date.now()) / 1000);
      
      console.log(`[${elapsed}s/${argv.duration}s] Sample ${sampleCount} collected, ${remaining}s remaining`);
      
      // Save intermediate results every 10 samples
      if (sampleCount % 10 === 0) {
        saveMetrics();
      }
    } catch (error) {
      console.error('Error collecting sample:', error.message);
    }
    
    // Wait for next interval
    const loopDuration = Date.now() - loopStart;
    const sleepTime = Math.max(0, (argv.interval * 1000) - loopDuration);
    
    if (sleepTime > 0) {
      await new Promise(resolve => setTimeout(resolve, sleepTime));
    }
  }
  
  // Save final results
  metrics.metadata.endTime = new Date().toISOString();
  metrics.metadata.samplesCollected = sampleCount;
  saveMetrics();
  
  console.log('\n=== Collection Complete ===');
  console.log(`Samples collected: ${sampleCount}`);
  console.log(`Output saved to: ${argv.output}`);
}

// Save metrics to file
function saveMetrics() {
  try {
    const dir = dirname(argv.output);
    mkdirSync(dir, { recursive: true });
    writeFileSync(argv.output, JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.error('Error saving metrics:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nInterrupted by user');
  metrics.metadata.endTime = new Date().toISOString();
  metrics.metadata.interrupted = true;
  saveMetrics();
  console.log(`Partial results saved to: ${argv.output}`);
  process.exit(0);
});

// Start collection
collect().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

