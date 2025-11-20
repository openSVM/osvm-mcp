#!/usr/bin/env node
import { spawn } from 'child_process';

const server = spawn('./build/index.js', [], { stdio: ['pipe', 'pipe', 'inherit'] });

// Initialize
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

server.stdout.once('data', () => {
  console.log('✓ Server initialized\n');
  console.log('Testing get_account_transfers with limit=1000...\n');
  
  const start = Date.now();
  
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'get_account_transfers',
      arguments: {
        address: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck',
        limit: 1000
      }
    }
  }) + '\n');
  
  let dataReceived = false;
  let chunks = [];
  
  // Listen for all stdout data
  server.stdout.on('data', (data) => {
    if (dataReceived) return;
    
    chunks.push(data);
    const fullData = Buffer.concat(chunks).toString();
    
    // Check if we have a complete JSON-RPC response
    const lines = fullData.split('\n');
    for (const line of lines) {
      if (!line.trim() || !line.includes('"id"')) continue;
      try {
        const response = JSON.parse(line);
        if (response.id === 2) {
          dataReceived = true;
          const duration = Date.now() - start;
          
          if (response.error) {
            console.log(`❌ MCP Error (${duration}ms)`);
            console.log(`Error: ${response.error.message}`);
          } else if (response.result?.isError) {
            console.log(`❌ Tool Error (${duration}ms)`);
            console.log(`Error: ${response.result.content?.[0]?.text?.slice(0, 200)}`);
          } else {
            const result = JSON.parse(response.result.content?.[0]?.text || '{}');
            console.log(`✅ SUCCESS (${duration}ms)`);
            console.log(`Transfers returned: ${result.data?.length || 0}`);
            console.log(`Total: ${result.total}`);
            console.log(`Has more: ${result.hasMore}`);
            console.log(`Response size: ${(fullData.length / 1024).toFixed(1)} KB`);
          }
          
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Not complete JSON yet, keep waiting
      }
    }
  });
  
  // Timeout after 150s
  setTimeout(() => {
    if (!dataReceived) {
      console.log(`❌ TIMEOUT after 150s`);
      console.log(`Chunks received: ${chunks.length}`);
      console.log(`Total data: ${Buffer.concat(chunks).length} bytes`);
      server.kill();
      process.exit(1);
    }
  }, 150000);
});
