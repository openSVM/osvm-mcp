#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

const server = spawn('node', ['./build/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let messageId = 1;
const pendingRequests = new Map();

// Read line-by-line from stdout
const rl = createInterface({
  input: server.stdout,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  console.log('← Server:', line);
  try {
    const message = JSON.parse(line);
    if (message.id && pendingRequests.has(message.id)) {
      const { resolve } = pendingRequests.get(message.id);
      pendingRequests.delete(message.id);
      resolve(message);
    }
  } catch (e) {
    // Might be a notification or malformed
  }
});

function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    pendingRequests.set(id, { resolve, reject });

    const message = JSON.stringify(request) + '\n';
    console.log('→ Client:', message.trim());
    server.stdin.write(message);

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 10000);
  });
}

async function test() {
  try {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n=== Testing MCP Server ===\n');

    // Initialize
    console.log('1. Initializing...');
    const initResult = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });
    console.log('✅ Initialized:', JSON.stringify(initResult, null, 2));

    // List tools
    console.log('\n2. Listing tools...');
    const toolsResult = await sendRequest('tools/list', {});
    console.log('✅ Got', toolsResult.result?.tools?.length, 'tools');

    // Call get_transaction
    console.log('\n3. Calling get_transaction...');
    const txResult = await sendRequest('tools/call', {
      name: 'get_transaction',
      arguments: {
        signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'
      }
    });

    if (txResult.result?.content?.[0]?.text) {
      const data = JSON.parse(txResult.result.content[0].text);
      console.log('✅ Got transaction data');
      console.log('Has tokenTransfers:', !!data.tokenTransfers);

      if (data.tokenTransfers?.length > 0) {
        const transfer = data.tokenTransfers[0];
        console.log('\nSample transfer:');
        console.log(JSON.stringify(transfer, null, 2));
        console.log('\nField check:');
        console.log('- account:', !!transfer.account);
        console.log('- change:', !!transfer.change);
        console.log('- from:', !!transfer.from);
        console.log('- to:', !!transfer.to);
      }
    }

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    server.kill();
    process.exit(0);
  }
}

test();
