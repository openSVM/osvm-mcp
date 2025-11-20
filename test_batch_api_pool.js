#!/usr/bin/env node

/**
 * Test Batch API + Pool = 100 wallets/sec
 * Demonstrates achieving 100 req/sec using batch API with pool
 */

import { spawn } from 'child_process';
import { cpus } from 'os';

const POOL_SIZE = 10; // 10 servers for batch processing
const BATCH_SIZE = 50; // 50 wallets per batch
const NUM_BATCHES = 10; // 10 batches = 500 total wallets

// Test wallets (mix of real and test addresses)
const TEST_WALLETS = [
  'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  '11111111111111111111111111111111'
];

// Generate 500 test wallets (repeat the test wallets)
const allWallets = [];
for (let i = 0; i < 500; i++) {
  allWallets.push(TEST_WALLETS[i % TEST_WALLETS.length]);
}

// Split into batches of 50
const batches = [];
for (let i = 0; i < allWallets.length; i += BATCH_SIZE) {
  batches.push(allWallets.slice(i, i + BATCH_SIZE));
}

console.log('🚀 Batch API + Pool Test: 500 Wallets\n');
console.log(`Pool size: ${POOL_SIZE} MCP servers`);
console.log(`Batch size: ${BATCH_SIZE} wallets per request`);
console.log(`Total batches: ${batches.length}`);
console.log(`Total wallets: ${allWallets.length}\n`);

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
      clientInfo: { name: 'batch-pool-test', version: '1.0.0' }
    }
  };
  server.stdin.write(JSON.stringify(init) + '\n');
}

console.log('✅ Pool initialized\n');
console.log('📤 Distributing batch requests...\n');

const results = [];
const startTime = Date.now();

// Setup stdout handlers
pool.forEach((server, serverIdx) => {
  let output = '';

  server.process.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    output = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        if (response.id > 1) { // Skip init
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

          if (response.error) {
            results.push({
              id: response.id,
              elapsed: parseFloat(elapsed),
              server: serverIdx + 1,
              error: response.error.message,
              walletsProcessed: 0
            });
          } else {
            const data = JSON.parse(response.result.content[0].text);
            const walletsProcessed = data._meta ? data._meta.successCount : 0;

            results.push({
              id: response.id,
              elapsed: parseFloat(elapsed),
              server: serverIdx + 1,
              walletsProcessed,
              success: true
            });
          }

          const completed = results.length;
          const totalWalletsProcessed = results.reduce((sum, r) => sum + (r.walletsProcessed || 0), 0);
          process.stdout.write(`\r   Progress: ${completed}/${batches.length} batches (${totalWalletsProcessed} wallets processed)`);

          if (completed === batches.length) {
            setTimeout(() => showResults(), 500);
          }
        }
      } catch (e) {}
    }
  });
});

// Distribute batches across pool
batches.forEach((walletBatch, idx) => {
  const serverIdx = idx % POOL_SIZE;
  const server = pool[serverIdx];
  server.requestCount++;

  const toolCall = {
    jsonrpc: '2.0',
    id: idx + 2,
    method: 'tools/call',
    params: {
      name: 'get_batch_account_transfers',
      arguments: {
        addresses: walletBatch,
        limit: 20,
        compress: false
      }
    }
  };
  server.process.stdin.write(JSON.stringify(toolCall) + '\n');
});

function showResults() {
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const successfulBatches = results.filter(r => r.success);
  const totalWalletsProcessed = results.reduce((sum, r) => sum + (r.walletsProcessed || 0), 0);

  console.log('\n\n📊 Results:\n');

  console.log('Sample batch results:');
  successfulBatches.slice(0, 5).forEach(r => {
    console.log(`   Batch ${r.id}: ✅ ${r.elapsed}s (Server ${r.server}, ${r.walletsProcessed} wallets)`);
  });
  if (successfulBatches.length > 5) {
    console.log(`   ... (${successfulBatches.length - 5} more batches) ...\n`);
  }

  const times = successfulBatches.map(r => r.elapsed);
  if (times.length > 0) {
    const min = Math.min(...times);
    const max = Math.max(...times);
    const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);

    console.log('📈 Performance Analysis:');
    console.log(`   Total time: ${totalElapsed}s`);
    console.log(`   Batches completed: ${successfulBatches.length}/${batches.length}`);
    console.log(`   Wallets processed: ${totalWalletsProcessed}/${allWallets.length}`);
    console.log(`   Fastest batch: ${min}s`);
    console.log(`   Slowest batch: ${max}s`);
    console.log(`   Average batch: ${avg}s`);

    // Calculate throughput
    const walletsPerSec = (totalWalletsProcessed / parseFloat(totalElapsed)).toFixed(2);
    const batchesPerSec = (successfulBatches.length / parseFloat(totalElapsed)).toFixed(2);

    console.log('\n⚡ Throughput:');
    console.log(`   ${walletsPerSec} wallets/second`);
    console.log(`   ${batchesPerSec} batches/second`);

    // Comparison with single requests
    const singleRequestTime = 19; // Average from previous tests
    const sequentialTime = totalWalletsProcessed * singleRequestTime;
    const speedup = (sequentialTime / parseFloat(totalElapsed)).toFixed(1);

    console.log('\n🚀 Speedup vs Individual Requests:');
    console.log(`   Sequential (1 wallet at a time): ~${sequentialTime.toFixed(0)}s (${totalWalletsProcessed} × ${singleRequestTime}s)`);
    console.log(`   Batch + Pool: ${totalElapsed}s`);
    console.log(`   Speedup: ${speedup}x faster!`);

    // Show if we hit target
    if (parseFloat(walletsPerSec) >= 100) {
      console.log('\n✅ TARGET ACHIEVED: 100+ wallets/sec!');
    } else {
      console.log(`\n📊 Current: ${walletsPerSec} wallets/sec`);
      console.log(`   Need ${(100 / parseFloat(walletsPerSec)).toFixed(1)}x more servers to hit 100 wallets/sec`);
      const serversNeeded = Math.ceil(POOL_SIZE * 100 / parseFloat(walletsPerSec));
      console.log(`   Recommended: ${serversNeeded} servers`);
    }
  }

  // Server utilization
  console.log('\n🖥️  Server Utilization:');
  pool.forEach((server, idx) => {
    const serverBatches = results.filter(r => r.server === idx + 1);
    const serverWallets = serverBatches.reduce((sum, r) => sum + (r.walletsProcessed || 0), 0);
    console.log(`   Server ${idx + 1}: ${serverBatches.length} batches (${serverWallets} wallets)`);
  });

  // Cleanup
  pool.forEach(s => s.process.kill());
  process.exit(0);
}

setTimeout(() => {
  console.log('\n\n⏱️  Test timeout!');
  console.log(`Completed: ${results.length}/${batches.length} batches`);
  pool.forEach(s => s.process.kill());
  process.exit(1);
}, 120000);
