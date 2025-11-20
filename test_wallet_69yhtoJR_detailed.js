#!/usr/bin/env node

import { spawn } from 'child_process';
import axios from 'axios';

const WALLET = '69yhtoJR4JYPPABZcSNkzuqbaFbwHsCkja1sP1Q2aVT5';

console.log('🔍 Detailed Analysis of Wallet:', WALLET);
console.log('='.repeat(80));

// First, test direct API call
async function testDirectAPI() {
  console.log('\n📡 Testing Direct API Call (no MCP)...\n');

  const tests = [
    { limit: 5, desc: 'Limit 5' },
    { limit: 10, desc: 'Limit 10' },
    { limit: 1, desc: 'Limit 1 (minimal)' },
  ];

  for (const test of tests) {
    const url = `https://opensvm.com/api/account-transfers/${WALLET}`;
    console.log(`   Testing: ${test.desc}`);
    console.log(`   URL: ${url}?limit=${test.limit}`);

    const startTime = Date.now();
    try {
      const response = await axios.get(url, {
        params: { limit: test.limit },
        timeout: 35000
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`   ✅ SUCCESS (${elapsed}s)`);
      console.log(`      Status: ${response.status}`);
      console.log(`      Transfers: ${response.data?.data?.length || 0}`);
      console.log(`      Has More: ${response.data?.hasMore}`);
      console.log(`      Total: ${response.data?.total}`);
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      if (error.code === 'ECONNABORTED') {
        console.log(`   ❌ TIMEOUT (${elapsed}s)`);
      } else if (error.response) {
        console.log(`   ❌ ERROR (${elapsed}s)`);
        console.log(`      Status: ${error.response.status} ${error.response.statusText}`);
      } else {
        console.log(`   ❌ ERROR (${elapsed}s): ${error.message}`);
      }
    }
    console.log();
    await new Promise(r => setTimeout(r, 2000));
  }
}

// Test via MCP
async function testViaMCP(limit) {
  return new Promise((resolve) => {
    const server = spawn('node', ['./build/index.js'], {
      cwd: '/home/larp/.osvm/mcp/osvm-mcp',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let stderr = '';
    const startTime = Date.now();

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    server.on('close', () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      try {
        const lines = output.trim().split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === 2) {
              if (response.error) {
                resolve({
                  success: false,
                  elapsed,
                  error: response.error.message || 'Tool error',
                  stderr: stderr.includes('504') ? '504 Gateway Timeout' : null
                });
              } else if (response.result?.content?.[0]?.text) {
                const data = JSON.parse(response.result.content[0].text);
                resolve({
                  success: true,
                  elapsed,
                  count: data.data?.length || 0,
                  hasMore: data.hasMore,
                  total: data.total,
                  size: response.result.content[0].text.length
                });
              }
              return;
            }
          } catch (e) {}
        }
        resolve({ success: false, elapsed, error: 'No response', stderr: stderr.substring(0, 200) });
      } catch (error) {
        resolve({ success: false, elapsed, error: error.message });
      }
    });

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

    setTimeout(() => {
      const toolCall = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_account_transfers',
          arguments: {
            address: WALLET,
            limit: limit
          }
        }
      };
      server.stdin.write(JSON.stringify(toolCall) + '\n');
      server.stdin.end();
    }, 100);

    setTimeout(() => {
      server.kill();
      resolve({ success: false, elapsed: 35, error: 'Timeout (killed)' });
    }, 36000);
  });
}

async function testMCPCalls() {
  console.log('\n🔧 Testing Via MCP Server...\n');

  const tests = [
    { limit: 1, desc: 'Limit 1 (minimal)' },
    { limit: 5, desc: 'Limit 5' },
    { limit: 10, desc: 'Limit 10' },
  ];

  for (const test of tests) {
    console.log(`   Testing: ${test.desc}`);
    const result = await testViaMCP(test.limit);

    if (result.success) {
      console.log(`   ✅ SUCCESS (${result.elapsed}s)`);
      console.log(`      Transfers: ${result.count}`);
      console.log(`      Has More: ${result.hasMore}`);
      console.log(`      Response Size: ${result.size} bytes`);
    } else {
      console.log(`   ❌ FAILED (${result.elapsed}s)`);
      console.log(`      Error: ${result.error}`);
      if (result.stderr) {
        console.log(`      Stderr: ${result.stderr}`);
      }
    }
    console.log();
    await new Promise(r => setTimeout(r, 2000));
  }
}

// Run all tests
(async () => {
  await testDirectAPI();
  await testMCPCalls();

  console.log('='.repeat(80));
  console.log('✅ Analysis Complete');
  console.log('='.repeat(80));
})();
