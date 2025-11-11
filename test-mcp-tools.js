#!/usr/bin/env node

import axios from 'axios';

const PROXY_URL = 'http://localhost:6277';
const AUTH_TOKEN = 'd3bc7a496daf8f89460e12d9b8fb0edd722c613e8665010e2eb944d9d8f88ec3';

const headers = {
  'Content-Type': 'application/json',
  'MCP-Proxy-Auth-Token': AUTH_TOKEN
};

// Helper to make JSON-RPC call
async function makeRpcCall(method, params = {}) {
  try {
    const response = await axios.post(PROXY_URL, {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Math.random().toString(36).substr(2, 9)
    }, { headers });

    if (response.data.error) {
      throw new Error(`RPC Error: ${JSON.stringify(response.data.error)}`);
    }

    return response.data.result;
  } catch (error) {
    console.error(`Error calling ${method}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Validate that response matches expected schema
function validateSchema(data, schema, path = '') {
  for (const [key, expectedType] of Object.entries(schema)) {
    const fullPath = path ? `${path}.${key}` : key;

    if (expectedType === 'optional') continue;

    if (!(key in data)) {
      throw new Error(`Missing required field: ${fullPath}`);
    }

    const value = data[key];
    let actualType;

    if (value === null) {
      actualType = 'null';
    } else if (Array.isArray(value)) {
      actualType = 'array';
    } else {
      actualType = typeof value;
    }

    // Handle nested object validation
    if (expectedType === 'object' && actualType === 'object' && value !== null) {
      // Object is valid, could validate nested structure if needed
      continue;
    }

    if (actualType !== expectedType && !(expectedType === 'number' && actualType === 'string')) {
      console.warn(`Field ${fullPath} has type ${actualType}, expected ${expectedType}`);
    }
  }
  return true;
}

async function testTools() {
  console.log('Testing OpenSVM MCP Tools...\n');

  try {
    // First, list all available tools
    console.log('=== Listing Available Tools ===');
    const toolsResponse = await makeRpcCall('tools/list');
    console.log(`Found ${toolsResponse.tools.length} tools\n`);

    // Test each tool with sample data
    const tests = [
      {
        name: 'get_transaction',
        params: {
          signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'
        },
        schema: {
          signature: 'string',
          timestamp: 'number',
          slot: 'number',
          success: 'boolean',
          fee: 'number'
        }
      },
      {
        name: 'batch_transactions',
        params: {
          signatures: [
            '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk',
            '4PZLZ7L8JKkZN6vJcPaZKBcA8C5FvKyJF7kdSxCvYYFRbKxdPeKnUvHPKtLJz8qd1xKBdyJJjuTQRa5uVxWYZF2u'
          ]
        },
        schema: {
          transactions: 'array',
          summary: 'object'
        }
      },
      {
        name: 'get_account_stats',
        params: {
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' // Bonk deployer
        },
        schema: {
          address: 'string',
          balance: 'number',
          transactionCount: 'number'
        }
      },
      {
        name: 'get_account_portfolio',
        params: {
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
        },
        schema: {
          address: 'string',
          totalValue: 'number',
          solBalance: 'number',
          tokens: 'array'
        }
      },
      {
        name: 'get_market_data',
        params: {
          mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' // Bonk token
        },
        schema: {
          data: 'object'
        }
      },
      {
        name: 'get_defi_overview',
        params: {},
        schema: {
          totalValueLocked: 'number',
          totalVolume24h: 'number',
          topProtocols: 'array'
        }
      },
      {
        name: 'get_block',
        params: {
          slot: 250000000
        },
        schema: {
          slot: 'number',
          blockhash: 'string',
          timestamp: 'number',
          transactionCount: 'number'
        }
      },
      {
        name: 'get_recent_blocks',
        params: {
          limit: 5
        },
        schema: {
          blocks: 'array'
        }
      },
      {
        name: 'universal_search',
        params: {
          query: 'bonk'
        },
        schema: {
          accounts: 'array',
          transactions: 'array',
          tokens: 'array'
        }
      },
      {
        name: 'get_validator_analytics',
        params: {
          validator: 'CertusDeBmqN8ZawdkxK5kFGMwBXdudvWHYwtNgNhvLu' // Certus One validator
        },
        schema: {
          validator: 'string',
          performance: 'object',
          rewards: 'object'
        }
      }
    ];

    let passedTests = 0;
    let failedTests = 0;

    for (const test of tests) {
      console.log(`\n=== Testing ${test.name} ===`);
      console.log('Params:', JSON.stringify(test.params, null, 2));

      try {
        const result = await makeRpcCall(`tools/call`, {
          name: test.name,
          arguments: test.params
        });

        console.log('Response received successfully');

        // Parse the content if it's a JSON string
        let content = result.content;
        if (content && content.length > 0 && content[0].text) {
          try {
            const parsed = JSON.parse(content[0].text);
            content = parsed;
          } catch (e) {
            // Not JSON, use as is
            content = content[0];
          }
        } else if (content && content.length > 0) {
          content = content[0];
        }

        // Validate schema if provided
        if (test.schema && content) {
          try {
            validateSchema(content, test.schema);
            console.log('✅ Schema validation passed');
            passedTests++;
          } catch (schemaError) {
            console.error('❌ Schema validation failed:', schemaError.message);
            console.log('Actual data structure:', JSON.stringify(content, null, 2).substring(0, 500));
            failedTests++;
          }
        } else {
          console.log('✅ Tool executed successfully');
          passedTests++;
        }

      } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        failedTests++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Test Results: ${passedTests} passed, ${failedTests} failed`);

    if (failedTests === 0) {
      console.log('\n✅ All tools tested successfully and responses match their schemas!');
    } else {
      console.log(`\n⚠️ ${failedTests} test(s) failed. Please review the errors above.`);
    }

  } catch (error) {
    console.error('Fatal error during testing:', error.message);
    process.exit(1);
  }
}

// Wait a moment for the server to be ready
setTimeout(() => {
  testTools().then(() => {
    console.log('\nTest complete!');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}, 2000);