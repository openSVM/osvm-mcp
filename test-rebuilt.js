#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function test() {
  console.log('🔌 Connecting to rebuilt MCP server...');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'test-rebuilt', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected successfully\n');

    // Test get_transaction
    console.log('Testing get_transaction...');
    const result = await client.callTool({
      name: 'get_transaction',
      arguments: {
        signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'
      }
    });

    if (result && result.content && result.content[0]) {
      const data = JSON.parse(result.content[0].text);
      console.log('✅ Got response');
      console.log('Has tokenTransfers:', !!data.tokenTransfers);

      if (data.tokenTransfers && data.tokenTransfers.length > 0) {
        const transfer = data.tokenTransfers[0];
        console.log('\nSample transfer:');
        console.log(JSON.stringify(transfer, null, 2));
        console.log('\nFields present:');
        console.log('- account:', !!transfer.account);
        console.log('- change:', !!transfer.change);
        console.log('- from:', !!transfer.from);
        console.log('- to:', !!transfer.to);
      }
    }

    await client.close();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.close();
    process.exit(1);
  }
}

test().catch(console.error);
