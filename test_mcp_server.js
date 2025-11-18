#!/usr/bin/env node

/**
 * Test MCP Server Functionality
 */

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

console.log('🧪 MCP Server Test Suite\n');

// Test 1: Server starts and responds
async function testServerStart() {
  console.log('TEST 1: Server Startup');
  console.log('=' .repeat(50));

  return new Promise((resolve) => {
    const server = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let hasStarted = false;

    server.stdout.on('data', (data) => {
      output += data.toString();
      if (data.toString().includes('running on stdio')) {
        hasStarted = true;
        console.log('✓ Server started successfully\n');
        server.kill();
      }
    });

    server.stderr.on('data', (data) => {
      console.error('stderr:', data.toString());
    });

    server.on('close', (code) => {
      if (hasStarted) {
        resolve(true);
      } else {
        console.log(`✗ Server exited with code ${code}`);
        console.log('Output:', output);
        resolve(false);
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!hasStarted) {
        console.log('⚠ Server startup timeout');
        server.kill();
        resolve(false);
      }
    }, 5000);
  });
}

// Test 2: List tools request
async function testListTools() {
  console.log('TEST 2: List Tools');
  console.log('=' .repeat(50));

  return new Promise((resolve) => {
    const server = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let response = '';
    let requestSent = false;

    server.stdout.on('data', (data) => {
      response += data.toString();

      // Wait for server to start, then send request
      if (!requestSent && response.includes('running on stdio')) {
        requestSent = true;

        const listToolsRequest = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        }) + '\n';

        server.stdin.write(listToolsRequest);
      }

      // Check for response
      if (requestSent && response.includes('"result"')) {
        try {
          // Extract JSON from response
          const lines = response.split('\n');
          const jsonLine = lines.find(line => line.includes('"result"'));
          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            const toolCount = result.result?.tools?.length || 0;
            console.log(`✓ Received tools list: ${toolCount} tools`);

            // Show first few tools
            if (result.result?.tools) {
              console.log('\nFirst 5 tools:');
              result.result.tools.slice(0, 5).forEach(tool => {
                console.log(`  - ${tool.name}`);
              });
            }

            console.log('');
            server.kill();
            resolve(true);
          }
        } catch (e) {
          console.error('Parse error:', e.message);
        }
      }
    });

    server.on('close', () => {
      if (!requestSent) {
        console.log('✗ Failed to send request\n');
        resolve(false);
      }
    });

    setTimeout(() => {
      console.log('⚠ Timeout waiting for response\n');
      server.kill();
      resolve(false);
    }, 10000);
  });
}

// Test 3: Tool call request (get_account_transfers)
async function testToolCall() {
  console.log('TEST 3: Tool Call (get_account_transfers)');
  console.log('=' .repeat(50));

  return new Promise((resolve) => {
    const server = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let response = '';
    let requestSent = false;

    server.stdout.on('data', (data) => {
      response += data.toString();

      if (!requestSent && response.includes('running on stdio')) {
        requestSent = true;

        const toolCallRequest = JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'get_account_transfers',
            arguments: {
              address: 'So11111111111111111111111111111111111111112',
              limit: 5
            }
          }
        }) + '\n';

        console.log('Sending tool call request...');
        server.stdin.write(toolCallRequest);
      }

      if (requestSent && response.includes('"result"')) {
        try {
          const lines = response.split('\n');
          const jsonLine = lines.find(line => line.includes('"result"') && line.includes('content'));
          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            console.log('✓ Received tool call response');

            if (result.result?.content?.[0]?.text) {
              const content = JSON.parse(result.result.content[0].text);
              const transferCount = content.data?.length || 0;
              console.log(`  Transfers returned: ${transferCount}`);
              console.log(`  Response size: ${result.result.content[0].text.length} bytes`);
            }

            console.log('');
            server.kill();
            resolve(true);
          }
        } catch (e) {
          console.error('Parse error:', e.message);
        }
      }
    });

    server.stderr.on('data', (data) => {
      const msg = data.toString();
      if (!msg.includes('OpenSVM API Error')) {
        console.error('stderr:', msg);
      }
    });

    server.on('close', () => {
      if (!requestSent) {
        console.log('✗ Failed to send request\n');
        resolve(false);
      }
    });

    setTimeout(() => {
      console.log('⚠ Timeout (tool calls can take 10-15s)\n');
      server.kill();
      resolve(false);
    }, 30000);
  });
}

// Run all tests
async function runTests() {
  const results = [];

  results.push(await testServerStart());
  await sleep(1000);

  results.push(await testListTools());
  await sleep(1000);

  results.push(await testToolCall());

  console.log('=' .repeat(50));
  console.log('TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log(`✓ Passed: ${results.filter(r => r).length}/${results.length}`);
  console.log(`✗ Failed: ${results.filter(r => !r).length}/${results.length}\n`);

  if (results.every(r => r)) {
    console.log('✅ All tests passed!\n');
  } else {
    console.log('⚠ Some tests failed\n');
  }
}

runTests().catch(console.error);
