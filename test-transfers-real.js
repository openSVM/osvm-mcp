#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testRealTransfers() {
  console.log('🧪 Testing get_account_transfers with real API address\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'transfer-real-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Use the address from the API documentation example
    const testAddress = '7aDTuuAN98tBanLcJQgq2oVaXztBzMgLNRu84iVqnVVH';

    console.log(`Testing address: ${testAddress}`);
    console.log('Query parameters: limit=10\n');

    const result = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 10
      }
    });

    console.log('✅ Query successful!\n');
    const data = JSON.parse(result.content[0].text);

    console.log('Response structure:');
    console.log(`  - Keys: ${Object.keys(data).join(', ')}`);

    if (data.transfers && Array.isArray(data.transfers)) {
      console.log(`  - Transfers count: ${data.transfers.length}`);

      if (data.transfers.length > 0) {
        console.log('\nFirst transfer:');
        const first = data.transfers[0];
        console.log(JSON.stringify(first, null, 2));

        console.log('\nTransfer fields:');
        Object.keys(first).forEach(key => {
          console.log(`  - ${key}: ${typeof first[key]}`);
        });
      } else {
        console.log('  - No transfers found (this address may have no transfer history)');
      }
    } else {
      console.log('  - transfers field:', data.transfers);
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testRealTransfers().catch(console.error);
