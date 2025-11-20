#!/usr/bin/env node

import { spawn } from 'child_process';
import zlib from 'zlib';

const TEST_WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

console.log('🧪 Comprehensive MCP Tool Testing\n');

// Test runner
async function testMCP(toolName, args, description) {
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
                  error: response.error.message,
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
          name: toolName,
          arguments: args
        }
      };
      server.stdin.write(JSON.stringify(toolCall) + '\n');
      server.stdin.end();
    }, 100);
  });
}

// Format result
function formatResult(result) {
  if (!result.success) {
    return `❌ FAILED (${result.elapsed}s): ${result.error}`;
  }

  let info = `✅ ${result.elapsed}s`;

  if (result.compressed) {
    const ratio = ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1);
    info += ` | Compressed: ${result.compressedSize.toLocaleString()}B (${ratio}% reduction)`;
  }

  if (result.data?.data?.length !== undefined) {
    info += ` | ${result.data.data.length} transfers`;
  }

  return info;
}

// Run all tests
(async () => {
  console.log('='.repeat(80));
  console.log('📊 GET_ACCOUNT_TRANSFERS TESTS');
  console.log('='.repeat(80));

  const transferTests = [
    // Basic scenarios
    {
      name: 'Default (50 transfers)',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET }
    },
    {
      name: 'Small limit (10 transfers)',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, limit: 10 }
    },
    {
      name: 'Medium limit (100 transfers)',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, limit: 100 }
    },
    {
      name: 'Large limit (500 transfers)',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, limit: 500 }
    },

    // Compression tests
    {
      name: 'With compression (50 transfers)',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, limit: 50, compress: true }
    },
    {
      name: 'With compression (500 transfers)',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, limit: 500, compress: true }
    },

    // Filter tests
    {
      name: 'Inbound transfers only',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, transferType: 'IN', limit: 50 }
    },
    {
      name: 'Outbound transfers only',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, transferType: 'OUT', limit: 50 }
    },
    {
      name: 'SOL only transfers',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, solanaOnly: true, limit: 50 }
    },
    {
      name: 'SPL token transfers only',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, txType: 'spl', limit: 50 }
    },

    // Pagination tests
    {
      name: 'Pagination: offset 10, limit 20',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, offset: 10, limit: 20 }
    },

    // Cache bypass test
    {
      name: 'Bypass cache (fresh data)',
      tool: 'get_account_transfers',
      args: { address: TEST_WALLET, limit: 10, bypassCache: true }
    },

    // Combined filters
    {
      name: 'Combined: OUT + SOL only + compressed',
      tool: 'get_account_transfers',
      args: {
        address: TEST_WALLET,
        transferType: 'OUT',
        solanaOnly: true,
        limit: 50,
        compress: true
      }
    }
  ];

  for (const test of transferTests) {
    console.log(`\n📝 ${test.name}`);
    console.log(`   Args: ${JSON.stringify(test.args)}`);
    try {
      const result = await testMCP(test.tool, test.args, test.name);
      console.log(`   ${formatResult(result)}`);

      // Validate response structure
      if (result.success && result.data) {
        const hasData = Array.isArray(result.data.data);
        const hasMore = typeof result.data.hasMore === 'boolean';
        const hasTotal = typeof result.data.total === 'number';

        if (!hasData || !hasMore || !hasTotal) {
          console.log(`   ⚠️  Invalid response structure`);
        }
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🤖 AI INFERENCE TESTS');
  console.log('='.repeat(80));

  const aiTests = [
    // Basic queries
    {
      name: 'Simple question about wallet',
      tool: 'get_ai_inference',
      args: {
        query: 'What is this wallet address?',
        address: TEST_WALLET
      }
    },
    {
      name: 'Trading activity analysis',
      tool: 'get_ai_inference',
      args: {
        query: 'Is this wallet actively trading?',
        address: TEST_WALLET
      }
    },
    {
      name: 'Portfolio composition',
      tool: 'get_ai_inference',
      args: {
        query: 'What tokens does this wallet hold?',
        address: TEST_WALLET
      }
    },

    // Trading signals
    {
      name: 'Trading signals for wallet',
      tool: 'get_ai_trading_signals',
      args: {
        address: TEST_WALLET,
        signal_type: 'buy'
      }
    },

    // Complex queries
    {
      name: 'Risk assessment query',
      tool: 'get_ai_inference',
      args: {
        query: 'What are the risks associated with this wallet?',
        address: TEST_WALLET
      }
    }
  ];

  for (const test of aiTests) {
    console.log(`\n📝 ${test.name}`);
    console.log(`   Tool: ${test.tool}`);
    console.log(`   Args: ${JSON.stringify(test.args)}`);
    try {
      const result = await testMCP(test.tool, test.args, test.name);
      console.log(`   ${formatResult(result)}`);

      // Show AI response preview
      if (result.success && result.data?.answer) {
        const preview = result.data.answer.substring(0, 100);
        console.log(`   💬 Response: "${preview}${result.data.answer.length > 100 ? '...' : ''}"`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Comprehensive Testing Complete');
  console.log('='.repeat(80));
})();
