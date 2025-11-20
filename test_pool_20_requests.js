#!/usr/bin/env node

/**
 * Test pool performance with 20 concurrent requests
 * Compares sequential vs pooled execution
 */

import { spawn } from 'child_process';
import { cpus } from 'os';

const POOL_SIZE = Math.min(cpus().length, 8); // Use up to 8 cores
const WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const NUM_REQUESTS = 20;

console.log('🚀 MCP Pool Performance Test: 20 Concurrent Requests\n');
console.log(`Pool size: ${POOL_SIZE} MCP server instances`);
console.log(`Total requests: ${NUM_REQUESTS}\n`);

// Generate requests
const requests = Array.from({ length: NUM_REQUESTS }, (_, i) => ({
  id: i + 2, // Start from 2 (1 is init)
  limit: 20 + (i * 5) // Vary limits
}));

// Spawn pool
const pool = [];
for (let i = 0; i < POOL_SIZE; i++) {
  const server = spawn('node', ['./build/index.js'], {
    cwd: '/home/larp/.osvm/mcp/osvm-mcp',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pool.push({
    id: i,
    process: server,
    responses: new Map(),
    requestCount: 0
  });

  // Initialize
  const init = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'pool-test', version: '1.0.0' }
    }
  };
  server.stdin.write(JSON.stringify(init) + '\n');
}

console.log('✅ Pool initialized\n');
console.log('📤 Distributing requests...\n');

const results = [];
const startTime = Date.now();
let nextRequestIndex = 0;

// Setup stdout handlers for all servers
pool.forEach((server, serverIdx) => {
  let output = '';

  server.process.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    output = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        if (response.id > 1) { // Skip init response
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          const req = requests.find(r => r.id === response.id);

          results.push({
            id: response.id,
            elapsed: parseFloat(elapsed),
            server: serverIdx + 1,
            limit: req?.limit,
            success: !response.error
          });

          process.stdout.write(`\r   Progress: ${results.length}/${NUM_REQUESTS} (${((results.length/NUM_REQUESTS)*100).toFixed(0)}%)`);

          if (results.length === NUM_REQUESTS) {
            setTimeout(() => showResults(), 500);
          }
        }
      } catch (e) {}
    }
  });
});

// Distribute all requests immediately
requests.forEach((req, idx) => {
  const serverIdx = idx % POOL_SIZE;
  const server = pool[serverIdx];
  server.requestCount++;

  const toolCall = {
    jsonrpc: '2.0',
    id: req.id,
    method: 'tools/call',
    params: {
      name: 'get_account_transfers',
      arguments: {
        address: WALLET,
        limit: req.limit,
        compress: true // Use compression!
      }
    }
  };
  server.process.stdin.write(JSON.stringify(toolCall) + '\n');
});

function showResults() {
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n\n📊 Results:\n');

  results.sort((a, b) => a.id - b.id);

  // Show sample results
  console.log('First 10 results:');
  results.slice(0, 10).forEach(r => {
    console.log(`   Request ${r.id}: ${r.success ? '✅' : '❌'} ${r.elapsed}s (Server ${r.server}, limit=${r.limit})`);
  });

  console.log(`   ... (${NUM_REQUESTS - 10} more) ...\n`);

  const times = results.map(r => r.elapsed);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
  const spread = (max - min).toFixed(2);

  console.log('📈 Performance Analysis:');
  console.log(`   Total time: ${totalElapsed}s`);
  console.log(`   Fastest response: ${min}s`);
  console.log(`   Slowest response: ${max}s`);
  console.log(`   Average response: ${avg}s`);
  console.log(`   Time spread: ${spread}s`);
  console.log(`   Success rate: ${results.filter(r => r.success).length}/${NUM_REQUESTS} (${((results.filter(r => r.success).length/NUM_REQUESTS)*100).toFixed(0)}%)`);

  // Calculate theoretical sequential time
  const sequentialTime = parseFloat(avg) * NUM_REQUESTS;
  const actualTime = parseFloat(totalElapsed);
  const speedup = (sequentialTime / actualTime).toFixed(1);

  console.log('\n⚡ Speedup Comparison:');
  console.log(`   Sequential (1 server): ~${sequentialTime.toFixed(1)}s (${NUM_REQUESTS} × ${avg}s)`);
  console.log(`   Parallel (${POOL_SIZE} servers): ${actualTime}s`);
  console.log(`   Speedup: ${speedup}x faster! 🚀`);

  // Show server utilization
  console.log('\n🖥️  Server Utilization:');
  pool.forEach((server, idx) => {
    const serverResults = results.filter(r => r.server === idx + 1);
    console.log(`   Server ${idx + 1}: ${serverResults.length} requests`);
  });

  // Cleanup
  pool.forEach(s => s.process.kill());
  process.exit(0);
}

setTimeout(() => {
  console.log('\n\n⏱️  Test timeout!');
  console.log(`Completed: ${results.length}/${NUM_REQUESTS} requests`);
  pool.forEach(s => s.process.kill());
  process.exit(1);
}, 60000);
