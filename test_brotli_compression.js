#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import zlib from 'zlib';

const TEST_WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

console.log('🗜️  Brotli Compression Test for get_account_transfers\n');
console.log(`Wallet: ${TEST_WALLET}`);
console.log(`Testing: compress=true vs compress=false\n`);

// Test function
async function testMCP(compress, limit) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['./build/index.js'], {
      cwd: '/home/larp/.osvm/mcp/osvm-mcp',
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let output = '';
    const startTime = Date.now();

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.on('close', () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      try {
        const lines = output.trim().split('\n').filter(l => l.trim());

        // Find the tool response (id=2)
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === 2) {
              const text = response.result?.content?.[0]?.text;
              if (text) {
                const data = JSON.parse(text);
                resolve({
                  elapsed,
                  data,
                  size: text.length,
                  compressed: data._compressed === 'brotli'
                });
                return;
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
        reject(new Error('No valid response found'));
      } catch (error) {
        reject(error);
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
            address: TEST_WALLET,
            limit: limit,
            compress: compress
          }
        }
      };
      server.stdin.write(JSON.stringify(toolCall) + '\n');
      server.stdin.end();
    }, 100);
  });
}

// Run tests
(async () => {
  const tests = [
    { limit: 50, label: '50 transfers' },
    { limit: 100, label: '100 transfers' },
    { limit: 200, label: '200 transfers' },
    { limit: 500, label: '500 transfers' }
  ];

  console.log('=' .repeat(70));

  for (const test of tests) {
    console.log(`\n📊 Testing: ${test.label}\n`);

    // Test without compression
    console.log('   Without compression...');
    const uncompressed = await testMCP(false, test.limit);
    console.log(`   ✓ ${uncompressed.elapsed}s | ${uncompressed.size.toLocaleString()} bytes | ${uncompressed.data.data?.length || 0} transfers`);

    // Test with compression
    console.log('   With Brotli compression...');
    const compressed = await testMCP(true, test.limit);
    console.log(`   ✓ ${compressed.elapsed}s | ${compressed.size.toLocaleString()} bytes | Compressed: YES`);

    // Verify decompression
    if (compressed.compressed) {
      const compressedData = Buffer.from(compressed.data.data, 'base64');
      const decompressed = zlib.brotliDecompressSync(compressedData);
      const original = JSON.parse(decompressed.toString());

      console.log(`\n   📦 Compression Results:`);
      console.log(`      Original:   ${compressed.data._originalSize.toLocaleString()} bytes`);
      console.log(`      Compressed: ${compressed.data._compressedSize.toLocaleString()} bytes`);
      console.log(`      Reduction:  ${((1 - compressed.data._compressedSize / compressed.data._originalSize) * 100).toFixed(1)}%`);
      console.log(`      Ratio:      ${(compressed.data._originalSize / compressed.data._compressedSize).toFixed(2)}:1`);
      console.log(`\n   ✓ Decompression successful: ${original.data.length} transfers verified`);

      // Verify with 1MB buffer
      const fitIn64KB = compressed.data._compressedSize < 65536;
      const fitIn1MB = compressed.data._compressedSize < 1048576;
      console.log(`\n   📏 Buffer Requirements:`);
      console.log(`      Fits in 64KB pipe buffer: ${fitIn64KB ? '✅ YES' : '❌ NO (will chunk)'}`);
      console.log(`      Fits in 1MB pipe buffer:  ${fitIn1MB ? '✅ YES' : '❌ NO'}`);
    }

    console.log('\n' + '-'.repeat(70));
  }

  console.log('\n' + '=' .repeat(70));
  console.log('✅ Brotli Compression Test Complete');
  console.log('=' .repeat(70));
})();
