#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🧪 Testing Specific MCP Call\n');
console.log('Tool: get_account_transfers');
console.log('Address: 69yhtoJR4JYPPABZcSNkzuqbaFbwHsCkja1sP1Q2aVT5');
console.log('Limit: 20');
console.log('TxType: sol,spl\n');

const server = spawn('node', ['./build/index.js'], {
  cwd: '/home/larp/.osvm/mcp/osvm-mcp',
  stdio: ['pipe', 'pipe', 'inherit']
});

let output = '';
const startTime = Date.now();

server.stdout.on('data', (data) => {
  output += data.toString();
  console.log('📥 Received data chunk:', data.length, 'bytes');
});

server.on('close', (code) => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n⏱️  Total time: ${elapsed}s`);
  console.log(`🚪 Process exited with code: ${code}\n`);

  try {
    const lines = output.trim().split('\n').filter(l => l.trim());
    console.log(`📝 Received ${lines.length} JSON-RPC messages\n`);

    for (let i = 0; i < lines.length; i++) {
      try {
        const response = JSON.parse(lines[i]);
        console.log(`[${i + 1}] ID: ${response.id}, Method: ${response.method || 'response'}`);

        if (response.id === 2) {
          console.log('\n✅ Found tool response (id=2):\n');

          if (response.error) {
            console.log('❌ ERROR:', JSON.stringify(response.error, null, 2));
          } else if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            const data = JSON.parse(text);

            console.log('📊 Response Summary:');
            console.log(`   Size: ${text.length.toLocaleString()} bytes`);
            console.log(`   Compressed: ${data._compressed === 'brotli' ? 'YES' : 'NO'}`);

            if (data._compressed === 'brotli') {
              console.log(`   Original Size: ${data._originalSize?.toLocaleString()} bytes`);
              console.log(`   Compressed Size: ${data._compressedSize?.toLocaleString()} bytes`);
            } else {
              console.log(`   Transfers: ${data.data?.length || 0}`);
              console.log(`   Has More: ${data.hasMore}`);
              console.log(`   Total: ${data.total}`);

              console.log('\n📋 Transfers:');
              if (data.data?.length > 0) {
                data.data.slice(0, 5).forEach((tx, idx) => {
                  console.log(`   [${idx + 1}] ${tx.txId?.substring(0, 20)}... | ${tx.transferType} | ${tx.tokenAmount} ${tx.tokenSymbol}`);
                });
                if (data.data.length > 5) {
                  console.log(`   ... and ${data.data.length - 5} more`);
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  } catch (error) {
    console.error('❌ Error parsing output:', error.message);
  }
});

// Send initialize
const init = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
};
console.log('📤 Sending initialize...');
server.stdin.write(JSON.stringify(init) + '\n');

// Send tool call
setTimeout(() => {
  const toolCall = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'get_account_transfers',
      arguments: {
        address: '69yhtoJR4JYPPABZcSNkzuqbaFbwHsCkja1sP1Q2aVT5',
        limit: 20,
        txType: 'sol,spl'
      }
    }
  };
  console.log('📤 Sending tool call...\n');
  server.stdin.write(JSON.stringify(toolCall) + '\n');
  server.stdin.end();
}, 100);
