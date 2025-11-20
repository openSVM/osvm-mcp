#!/usr/bin/env node

import { spawn } from 'child_process';
import zlib from 'zlib';

const TEST_WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

console.log('🧪 Large Limit & Pagination Test\n');
console.log(`Wallet: ${TEST_WALLET}\n`);

// Test runner
async function testMCP(args, description) {
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

        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === 2) {
              if (response.error) {
                resolve({
                  success: false,
                  elapsed,
                  error: response.error.message || JSON.stringify(response.error),
                  description
                });
                return;
              }

              const text = response.result?.content?.[0]?.text;
              if (text) {
                const data = JSON.parse(text);

                // Handle compressed responses
                if (data._compressed === 'brotli') {
                  const compressed = Buffer.from(data.data, 'base64');
                  const decompressed = zlib.brotliDecompressSync(compressed);
                  const original = JSON.parse(decompressed.toString());

                  resolve({
                    success: true,
                    elapsed,
                    data: original,
                    compressed: true,
                    originalSize: data._originalSize,
                    compressedSize: data._compressedSize,
                    description
                  });
                } else {
                  resolve({
                    success: true,
                    elapsed,
                    data,
                    compressed: false,
                    responseSize: text.length,
                    description
                  });
                }
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
          arguments: args
        }
      };
      server.stdin.write(JSON.stringify(toolCall) + '\n');
      server.stdin.end();
    }, 100);
  });
}

// Run tests
(async () => {
  console.log('='.repeat(80));
  console.log('📊 LARGE LIMIT TESTS (5000 transfers)');
  console.log('='.repeat(80));

  const tests = [
    {
      name: 'Limit 5000 - Uncompressed',
      args: { address: TEST_WALLET, limit: 5000 }
    },
    {
      name: 'Limit 5000 - Compressed',
      args: { address: TEST_WALLET, limit: 5000, compress: true }
    },
    {
      name: 'Limit 1000, Offset 0 - Compressed',
      args: { address: TEST_WALLET, limit: 1000, offset: 0, compress: true }
    },
    {
      name: 'Limit 1000, Offset 1000 - Compressed',
      args: { address: TEST_WALLET, limit: 1000, offset: 1000, compress: true }
    },
    {
      name: 'Limit 1000, Offset 2000 - Compressed',
      args: { address: TEST_WALLET, limit: 1000, offset: 2000, compress: true }
    },
    {
      name: 'Limit 500, Offset 100 - Uncompressed',
      args: { address: TEST_WALLET, limit: 500, offset: 100 }
    },
    {
      name: 'Limit 500, Offset 100 - Compressed',
      args: { address: TEST_WALLET, limit: 500, offset: 100, compress: true }
    }
  ];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n[${i + 1}/${tests.length}] 📝 ${test.name}`);
    console.log(`   Args: ${JSON.stringify(test.args)}`);

    try {
      const result = await testMCP(test.args, test.name);

      if (!result.success) {
        console.log(`   ❌ FAILED (${result.elapsed}s): ${result.error}`);
      } else {
        const transferCount = result.data?.data?.length || 0;
        const hasMore = result.data?.hasMore;
        const total = result.data?.total;

        console.log(`   ✅ SUCCESS (${result.elapsed}s)`);
        console.log(`      Transfers: ${transferCount.toLocaleString()}`);
        console.log(`      Has More: ${hasMore}`);
        console.log(`      Total Available: ${total?.toLocaleString() || 'N/A'}`);

        if (result.compressed) {
          const ratio = ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1);
          const compressionRatio = (result.originalSize / result.compressedSize).toFixed(2);
          console.log(`      Original Size: ${result.originalSize.toLocaleString()}B`);
          console.log(`      Compressed Size: ${result.compressedSize.toLocaleString()}B`);
          console.log(`      Reduction: ${ratio}%`);
          console.log(`      Ratio: ${compressionRatio}:1`);

          // Check buffer compatibility
          const fitIn64KB = result.compressedSize < 65536;
          const fitIn1MB = result.compressedSize < 1048576;
          console.log(`      Fits in 64KB buffer: ${fitIn64KB ? '✅ YES' : '❌ NO'}`);
          console.log(`      Fits in 1MB buffer: ${fitIn1MB ? '✅ YES' : '❌ NO'}`);
        } else {
          console.log(`      Response Size: ${result.responseSize.toLocaleString()}B`);
          const fitIn64KB = result.responseSize < 65536;
          const fitIn1MB = result.responseSize < 1048576;
          console.log(`      Fits in 64KB buffer: ${fitIn64KB ? '✅ YES' : '❌ NO'}`);
          console.log(`      Fits in 1MB buffer: ${fitIn1MB ? '✅ YES' : '❌ NO'}`);
        }

        // Validate first and last transfer
        if (transferCount > 0) {
          const first = result.data.data[0];
          const last = result.data.data[transferCount - 1];
          console.log(`      First TX: ${first.txId?.substring(0, 20)}...`);
          console.log(`      Last TX: ${last.txId?.substring(0, 20)}...`);
        }
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Wait 2 seconds between tests to avoid rate limiting
    if (i < tests.length - 1) {
      console.log(`   ⏳ Waiting 2s before next test...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Large Limit & Pagination Test Complete');
  console.log('='.repeat(80));
})();
