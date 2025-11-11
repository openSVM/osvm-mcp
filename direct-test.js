#!/usr/bin/env node

import { spawn } from 'child_process';

const tests = [
  {
    name: 'get_transaction',
    params: {
      signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'
    }
  },
  {
    name: 'get_account_stats',
    params: {
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    }
  },
  {
    name: 'get_market_data',
    params: {
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    }
  },
  {
    name: 'get_defi_overview',
    params: {}
  },
  {
    name: 'get_block',
    params: {
      slot: 250000000
    }
  },
  {
    name: 'universal_search',
    params: {
      query: 'bonk'
    }
  },
  {
    name: 'batch_transactions',
    params: {
      signatures: [
        '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk',
        '4PZLZ7L8JKkZN6vJcPaZKBcA8C5FvKyJF7kdSxCvYYFRbKxdPeKnUvHPKtLJz8qd1xKBdyJJjuTQRa5uVxWYZF2u'
      ]
    }
  }
];

async function testTool(toolName, params) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';
    let responseReceived = false;

    server.stdout.on('data', (data) => {
      output += data.toString();

      // Look for the JSON-RPC response
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('"jsonrpc":"2.0"') && line.includes('"result"')) {
          try {
            const response = JSON.parse(line);
            responseReceived = true;
            server.kill();
            resolve(response);
          } catch (e) {
            // Not a complete JSON yet
          }
        }
      }
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    server.on('close', (code) => {
      if (!responseReceived) {
        reject(new Error(`Server closed without response. Output: ${output}, Errors: ${errorOutput}`));
      }
    });

    // Send initialization
    const initMessage = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      },
      id: 1
    };

    server.stdin.write(JSON.stringify(initMessage) + '\n');

    // Wait a moment then send the tool call
    setTimeout(() => {
      const toolMessage = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        },
        id: 2
      };

      server.stdin.write(JSON.stringify(toolMessage) + '\n');
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        server.kill();
        reject(new Error('Timeout waiting for response'));
      }
    }, 5000);
  });
}

async function runTests() {
  console.log('🔍 Testing OpenSVM MCP Tools\n');
  console.log('=' .repeat(60));

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    process.stdout.write(`\nTesting ${test.name}... `);

    try {
      const response = await testTool(test.name, test.params);

      if (response.result && response.result.content) {
        // Try to parse the content
        let content;
        if (response.result.content[0] && response.result.content[0].text) {
          try {
            content = JSON.parse(response.result.content[0].text);
          } catch (e) {
            content = response.result.content[0];
          }
        }

        // Basic validation - check if we got a non-empty response
        if (content) {
          console.log('✅ PASSED');
          console.log(`  Response structure: ${Object.keys(content).join(', ')}`);
          passedTests++;
        } else {
          console.log('❌ FAILED - Empty response');
          failedTests++;
        }
      } else if (response.error) {
        console.log(`❌ FAILED - Error: ${response.error.message}`);
        failedTests++;
      } else {
        console.log('❌ FAILED - Invalid response structure');
        failedTests++;
      }
    } catch (error) {
      console.log(`❌ FAILED - ${error.message}`);
      failedTests++;
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`\n📊 Results: ${passedTests}/${tests.length} tests passed`);

  if (passedTests === tests.length) {
    console.log('\n✅ All tools are working correctly and returning valid responses!');
  } else {
    console.log(`\n⚠️ ${failedTests} test(s) failed. Please check the implementation.`);
  }
}

runTests().catch(console.error);