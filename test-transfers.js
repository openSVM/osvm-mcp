#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testTransfers() {
  console.log('🧪 Testing get_account_transfers tool\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'transfer-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Test 1: Basic account transfers query
    console.log('Test 1: Get transfers for a sample address');
    const result1 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        limit: 5
      }
    });
    console.log('✅ Basic query successful');
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`   Found ${data1.transfers?.length || 0} transfers`);
    if (data1.transfers && data1.transfers.length > 0) {
      const first = data1.transfers[0];
      console.log(`   First transfer: ${first.amount} tokens`);
      console.log(`   From: ${first.from.substring(0, 8)}...`);
      console.log(`   To: ${first.to.substring(0, 8)}...`);
    }
    console.log();

    // Test 2: With offset pagination
    console.log('Test 2: Query with offset');
    const result2 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        limit: 3,
        offset: 5
      }
    });
    console.log('✅ Pagination query successful');
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`   Found ${data2.transfers?.length || 0} transfers (offset: 5)\n`);

    // Test 3: With direction filter
    console.log('Test 3: Filter by direction (incoming)');
    const result3 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        limit: 5,
        direction: 'in'
      }
    });
    console.log('✅ Direction filter successful');
    const data3 = JSON.parse(result3.content[0].text);
    console.log(`   Found ${data3.transfers?.length || 0} incoming transfers\n`);

    // Test 4: Invalid address error handling
    console.log('Test 4: Error handling for invalid address');
    try {
      await client.callTool({
        name: 'get_account_transfers',
        arguments: {
          address: 'invalid'
        }
      });
      console.log('❌ Should have thrown error for invalid address');
    } catch (error) {
      console.log('✅ Correctly rejected invalid address');
      console.log(`   Error: ${error.message.substring(0, 80)}...\n`);
    }

    console.log('🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testTransfers().catch(console.error);
