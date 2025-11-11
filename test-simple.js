#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testAllTools() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  try {
    console.log('🔌 Connecting to OpenSVM MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully\n');

    // List all available tools
    console.log('📋 Listing available tools:');
    const toolsList = await client.listTools();
    console.log(`Found ${toolsList.tools.length} tools\n`);

    // Define test cases
    const tests = [
      {
        name: 'get_transaction',
        args: {
          signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'
        },
        expectedFields: ['signature', 'timestamp', 'slot', 'success', 'fee']
      },
      {
        name: 'get_account_stats',
        args: {
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
        },
        expectedFields: ['address', 'balance', 'transactionCount']
      },
      {
        name: 'get_market_data',
        args: {
          mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
        },
        expectedFields: ['data']
      },
      {
        name: 'get_defi_overview',
        args: {},
        expectedFields: ['totalValueLocked', 'totalVolume24h']
      },
      {
        name: 'get_block',
        args: {
          slot: 250000000
        },
        expectedFields: ['slot', 'blockhash', 'timestamp']
      },
      {
        name: 'universal_search',
        args: {
          query: 'bonk',
          limit: 5
        },
        expectedFields: ['accounts', 'transactions', 'tokens']
      }
    ];

    console.log('🧪 Running tool tests:\n');
    console.log('=' .repeat(60));

    let passedCount = 0;
    let failedCount = 0;

    for (const test of tests) {
      process.stdout.write(`\nTesting ${test.name}... `);

      try {
        const result = await client.callTool(test.name, test.args);

        if (result && result.content && result.content.length > 0) {
          let data;

          // Parse the content
          if (result.content[0].type === 'text') {
            try {
              data = JSON.parse(result.content[0].text);
            } catch (e) {
              data = result.content[0];
            }
          } else {
            data = result.content[0];
          }

          // Validate expected fields
          let valid = true;
          const missingFields = [];

          for (const field of test.expectedFields) {
            if (!(field in data)) {
              missingFields.push(field);
              valid = false;
            }
          }

          if (valid) {
            console.log('✅ PASSED');
            const fieldCount = Object.keys(data).length;
            console.log(`  → Response has ${fieldCount} fields`);

            // Show sample of the response structure
            const sampleFields = Object.keys(data).slice(0, 5).join(', ');
            console.log(`  → Fields: ${sampleFields}${fieldCount > 5 ? '...' : ''}`);

            passedCount++;
          } else {
            console.log('❌ FAILED');
            console.log(`  → Missing fields: ${missingFields.join(', ')}`);
            console.log(`  → Received fields: ${Object.keys(data).join(', ')}`);
            failedCount++;
          }
        } else {
          console.log('❌ FAILED - No content in response');
          failedCount++;
        }
      } catch (error) {
        console.log(`❌ FAILED`);
        console.log(`  → Error: ${error.message}`);
        failedCount++;
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`\n📊 Test Results:`);
    console.log(`  ✅ Passed: ${passedCount}/${tests.length}`);
    console.log(`  ❌ Failed: ${failedCount}/${tests.length}`);

    if (failedCount === 0) {
      console.log('\n🎉 All tools tested successfully!');
      console.log('✨ All responses match their expected schemas.');
    } else {
      console.log(`\n⚠️ ${failedCount} test(s) failed.`);
      console.log('Please check the tool implementations.');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    console.log('\n🔌 Closing connection...');
    await client.close();
    console.log('✅ Connection closed');
  }
}

// Run the tests
testAllTools().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});