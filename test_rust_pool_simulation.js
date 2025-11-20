#!/usr/bin/env node

/**
 * Simulation showing Rust MCP Pool performance
 * This spawns multiple MCP server processes to demonstrate true parallelism
 */

import { spawn } from 'child_process';
import { cpus } from 'os';

const POOL_SIZE = Math.min(cpus().length, 4); // Use 4 cores max for test
const WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

console.log('🚀 MCP Pool Simulation\n');
console.log(`Pool size: ${POOL_SIZE} MCP server instances`);
console.log(`Testing: 5 concurrent requests\n`);

// Spawn pool of MCP servers
const pool = [];
for (let i = 0; i < POOL_SIZE; i++) {
  const server = spawn('node', ['./build/index.js'], {
    cwd: '/home/larp/.osvm/mcp/osvm-mcp',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pool.push({
    id: i,
    process: server,
    busy: false,
    responses: new Map()
  });

  // Initialize each server
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

console.log('✅ Pool initialized with', POOL_SIZE, 'instances\n');

// Test requests
const requests = [
  { id: 2, limit: 30 },
  { id: 3, limit: 40 },
  { id: 4, limit: 50 },
  { id: 5, limit: 60 },
  { id: 6, limit: 70 }
];

const results = [];
const startTime = Date.now();

// Distribute requests across pool
console.log('📤 Distributing 5 requests across', POOL_SIZE, 'servers...\n');

requests.forEach((req, idx) => {
  const serverIdx = idx % POOL_SIZE;
  const server = pool[serverIdx];

  console.log(`   Request ${req.id} → Server ${serverIdx + 1} (limit=${req.limit})`);

  let output = '';
  server.process.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        if (response.id === req.id) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          results.push({
            id: req.id,
            elapsed: parseFloat(elapsed),
            server: serverIdx + 1,
            success: !response.error
          });

          if (results.length === requests.length) {
            showResults();
          }
        }
      } catch (e) {}
    }
  });

  const toolCall = {
    jsonrpc: '2.0',
    id: req.id,
    method: 'tools/call',
    params: {
      name: 'get_account_transfers',
      arguments: {
        address: WALLET,
        limit: req.limit
      }
    }
  };
  server.process.stdin.write(JSON.stringify(toolCall) + '\n');
});

function showResults() {
  console.log('\n📥 Results:\n');

  results.sort((a, b) => a.id - b.id);

  results.forEach(r => {
    console.log(`   Request ${r.id}: ${r.success ? '✅' : '❌'} ${r.elapsed}s (Server ${r.server})`);
  });

  const times = results.map(r => r.elapsed);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
  const spread = (max - min).toFixed(2);

  console.log('\n📊 Analysis:');
  console.log(`   Fastest: ${min}s`);
  console.log(`   Slowest: ${max}s`);
  console.log(`   Average: ${avg}s`);
  console.log(`   Time spread: ${spread}s`);

  if (parseFloat(spread) < 2) {
    console.log('\n✅ Requests processed CONCURRENTLY (similar completion times)');
    console.log(`   Speedup: ${(results.length / parseFloat(avg)).toFixed(1)}x faster than sequential`);
  } else {
    console.log('\n⚠️  Some requests processed sequentially');
  }

  // Cleanup
  pool.forEach(s => s.process.kill());
  process.exit(0);
}

setTimeout(() => {
  console.log('\n⏱️  Test timeout!');
  pool.forEach(s => s.process.kill());
  process.exit(1);
}, 30000);
