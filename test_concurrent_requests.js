#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🔀 Testing Concurrent Request Handling\n');

const WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

// Spawn MCP server
const server = spawn('node', ['./build/index.js'], {
  cwd: '/home/larp/.osvm/mcp/osvm-mcp',
  stdio: ['pipe', 'pipe', 'pipe']
});

let responses = new Map();
let chunks = [];

server.stdout.on('data', (data) => {
  chunks.push(data);
  const output = Buffer.concat(chunks).toString();
  const lines = output.split('\n');

  // Process complete JSON lines
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const response = JSON.parse(line);
      if (response.id && response.id > 1) {
        responses.set(response.id, {
          received: Date.now(),
          error: response.error,
          hasData: !!response.result?.content?.[0]?.text
        });
      }
    } catch (e) {}
  }

  // Keep last incomplete line
  chunks = [Buffer.from(lines[lines.length - 1])];
});

// Send initialize
const init = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' }
  }
};
server.stdin.write(JSON.stringify(init) + '\n');

// Wait for init, then send multiple requests SIMULTANEOUSLY
setTimeout(() => {
  console.log('📤 Sending 5 concurrent requests...\n');
  const startTime = Date.now();

  // Send 5 requests at once (no await, fire all immediately)
  for (let i = 2; i <= 6; i++) {
    const request = {
      jsonrpc: '2.0',
      id: i,
      method: 'tools/call',
      params: {
        name: 'get_account_transfers',
        arguments: {
          address: WALLET,
          limit: 10 + (i * 10) // Different limits to distinguish
        }
      }
    };
    server.stdin.write(JSON.stringify(request) + '\n');
    console.log(`   Request ${i}: limit=${10 + (i * 10)}`);
  }

  // Check results after 15 seconds
  setTimeout(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  All requests sent, waiting ${elapsed}s for responses...\n`);

    // Wait a bit more for responses
    setTimeout(() => {
      console.log('📥 Results:\n');

      const times = [];
      for (let id = 2; id <= 6; id++) {
        const resp = responses.get(id);
        if (resp) {
          const time = ((resp.received - startTime) / 1000).toFixed(2);
          times.push(parseFloat(time));
          console.log(`   Request ${id}: ${resp.error ? '❌ ERROR' : '✅ SUCCESS'} in ${time}s`);
        } else {
          console.log(`   Request ${id}: ⏳ No response yet`);
        }
      }

      console.log('\n📊 Analysis:');
      if (times.length >= 2) {
        const min = Math.min(...times);
        const max = Math.max(...times);
        const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);

        console.log(`   Fastest: ${min}s`);
        console.log(`   Slowest: ${max}s`);
        console.log(`   Average: ${avg}s`);
        console.log(`   Time spread: ${(max - min).toFixed(2)}s`);

        if (max - min < 2) {
          console.log('\n✅ Requests processed CONCURRENTLY (similar completion times)');
        } else {
          console.log('\n⚠️  Requests processed SEQUENTIALLY (large time differences)');
        }
      }

      server.kill();
      process.exit(0);
    }, 15000);
  }, 100);
}, 500);

setTimeout(() => {
  console.log('\n⏱️  Test timeout!');
  server.kill();
  process.exit(1);
}, 40000);
