#!/usr/bin/env node

/**
 * Debug MCP stdio communication
 * This will help identify where the hang occurs
 */

import { spawn } from 'child_process';

console.log('🔍 Debugging MCP stdio communication\n');

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let stderrOutput = '';
let stdoutOutput = '';
let initializeSent = false;
let toolCallSent = false;

// Track stderr (logs)
server.stderr.on('data', (data) => {
  const msg = data.toString();
  stderrOutput += msg;
  console.log('[STDERR]:', msg.trim());

  // After server starts, send initialize
  if (!initializeSent && msg.includes('running on stdio')) {
    console.log('\n📤 Sending initialize request...\n');
    initializeSent = true;

    const init = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'debug', version: '1.0.0' }
      }
    };

    server.stdin.write(JSON.stringify(init) + '\n');
  }
});

// Track stdout (JSON-RPC responses)
server.stdout.on('data', (data) => {
  const msg = data.toString();
  stdoutOutput += msg;
  console.log('[STDOUT]:', msg.trim());

  try {
    const response = JSON.parse(msg);

    // After initialize response, send tool call
    if (response.id === 1 && !toolCallSent) {
      console.log('\n✓ Initialize successful!\n');
      console.log('📤 Sending tool call (get_account_transfers)...\n');
      toolCallSent = true;

      const toolCall = {
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
      };

      server.stdin.write(JSON.stringify(toolCall) + '\n');
      console.log('⏳ Waiting for tool call response...\n');
    }

    // Check for tool call response
    if (response.id === 2) {
      console.log('\n✓ Tool call response received!\n');

      if (response.result?.content?.[0]?.text) {
        const content = JSON.parse(response.result.content[0].text);
        console.log('📊 Response data:', {
          hasData: !!content.data,
          transferCount: content.data?.length || 0,
          responseSize: response.result.content[0].text.length
        });
      }

      console.log('\n✅ SUCCESS - MCP stdio working!\n');
      server.kill();
      process.exit(0);
    }

  } catch (e) {
    // Not valid JSON, might be partial
  }
});

server.on('error', (err) => {
  console.error('\n❌ Process error:', err);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`\n📝 Server closed with code: ${code}`);
  console.log('\nStderr output:');
  console.log(stderrOutput);
  console.log('\nStdout output:');
  console.log(stdoutOutput);
});

// Timeout
setTimeout(() => {
  console.log('\n⏰ TIMEOUT after 30 seconds');
  console.log('\nDiagnostics:');
  console.log('- Initialize sent:', initializeSent);
  console.log('- Tool call sent:', toolCallSent);
  console.log('- Stderr length:', stderrOutput.length);
  console.log('- Stdout length:', stdoutOutput.length);

  if (stdoutOutput.length === 0) {
    console.log('\n⚠️  No stdout output - server not responding to stdin!');
  }

  if (initializeSent && !toolCallSent) {
    console.log('\n⚠️  Hung after initialize - check server initialization');
  }

  if (toolCallSent) {
    console.log('\n⚠️  Hung during tool call - likely API request timeout');
  }

  server.kill();
  process.exit(1);
}, 30000);
