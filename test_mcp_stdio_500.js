#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🔍 Testing MCP stdio call with limit=500\n');

const server = spawn('./build/index.js', [], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Track chunks
let chunks = [];
let responded = false;

// Initialize
console.log('📤 Sending initialize...');
server.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' }
  }
}) + '\n');

server.stdout.once('data', (data) => {
  console.log('✅ Server initialized\n');

  // Now call get_account_transfers with limit=500
  console.log('📤 Calling get_account_transfers with limit=500...');
  const startTime = Date.now();

  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'get_account_transfers',
      arguments: {
        address: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck',
        limit: 500
      }
    }
  }) + '\n');

  // Listen for response with chunked reading
  server.stdout.on('data', (chunk) => {
    chunks.push(chunk);
    const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
    console.log(`📥 Received chunk ${chunks.length}: ${chunk.length} bytes (total: ${totalSize} bytes)`);

    // Try to parse complete response
    const fullData = Buffer.concat(chunks).toString();
    const lines = fullData.split('\n');

    for (const line of lines) {
      if (!line.trim() || !line.includes('"id"')) continue;
      try {
        const response = JSON.parse(line);
        if (response.id === 2 && !responded) {
          responded = true;
          const duration = Date.now() - startTime;

          console.log(`\n✅ Response received in ${(duration/1000).toFixed(2)}s`);
          console.log(`📊 Total chunks: ${chunks.length}`);
          console.log(`📊 Total size: ${totalSize} bytes`);

          if (response.error) {
            console.log(`❌ MCP Error: ${response.error.message}`);
          } else if (response.result?.isError) {
            console.log(`❌ Tool Error: ${response.result.content?.[0]?.text?.slice(0, 200)}`);
          } else {
            const resultText = response.result?.content?.[0]?.text || '{}';
            const data = JSON.parse(resultText);
            console.log(`✅ SUCCESS`);
            console.log(`   Transfers: ${data.data?.length || 0}`);
            console.log(`   Total: ${data.total}`);
            console.log(`   Has More: ${data.hasMore}`);
            console.log(`   Response size: ${resultText.length} bytes`);
          }

          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Not complete JSON yet, keep waiting
      }
    }
  });

  // Timeout after 30s
  setTimeout(() => {
    if (!responded) {
      console.log(`\n❌ TIMEOUT after 30s`);
      console.log(`   Chunks received: ${chunks.length}`);
      console.log(`   Total data: ${chunks.reduce((sum, c) => sum + c.length, 0)} bytes`);
      server.kill();
      process.exit(1);
    }
  }, 30000);
});
