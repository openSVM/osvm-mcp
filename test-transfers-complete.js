#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testCompleteTransfers() {
  console.log('🧪 Testing get_account_transfers with ALL parameters\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'transfer-complete-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    const testAddress = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

    // Test 1: Basic query with new default
    console.log('Test 1: Basic query (default parameters)');
    const result1 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 3
      }
    });
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`✅ Found ${data1.data?.length || 0} transfers`);
    console.log(`   Total: ${data1.total}, HasMore: ${data1.hasMore}\n`);

    // Test 2: transferType with uppercase values
    console.log('Test 2: Filter by transferType="IN"');
    const result2 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 3,
        transferType: 'IN'
      }
    });
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`✅ Query successful: ${data2.data?.length || 0} results`);
    if (data2.data && data2.data.length > 0) {
      const types = data2.data.map(t => t.transferType).join(', ');
      console.log(`   Transfer types: ${types}\n`);
    }

    // Test 3: transferType="OUT"
    console.log('Test 3: Filter by transferType="OUT"');
    const result3 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 3,
        transferType: 'OUT'
      }
    });
    const data3 = JSON.parse(result3.content[0].text);
    console.log(`✅ Query successful: ${data3.data?.length || 0} results`);
    if (data3.data && data3.data.length > 0) {
      const types = data3.data.map(t => t.transferType).join(', ');
      console.log(`   Transfer types: ${types}\n`);
    }

    // Test 4: transferType="ALL"
    console.log('Test 4: Filter by transferType="ALL"');
    const result4 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 3,
        transferType: 'ALL'
      }
    });
    const data4 = JSON.parse(result4.content[0].text);
    console.log(`✅ Query successful: ${data4.data?.length || 0} results\n`);

    // Test 5: solanaOnly filter
    console.log('Test 5: SOL transfers only (solanaOnly=true)');
    const result5 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 5,
        solanaOnly: true
      }
    });
    const data5 = JSON.parse(result5.content[0].text);
    console.log(`✅ Found ${data5.data?.length || 0} SOL transfers`);
    if (data5.data && data5.data.length > 0) {
      const tokens = data5.data.map(t => t.tokenSymbol).join(', ');
      console.log(`   Tokens: ${tokens}\n`);
    }

    // Test 6: txType filter
    console.log('Test 6: Filter by txType="sol"');
    const result6 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 3,
        txType: 'sol'
      }
    });
    const data6 = JSON.parse(result6.content[0].text);
    console.log(`✅ Query successful: ${data6.data?.length || 0} results\n`);

    // Test 7: Pagination with beforeSignature
    console.log('Test 7: Pagination with beforeSignature');
    if (data1.nextPageSignature) {
      const result7 = await client.callTool({
        name: 'get_account_transfers',
        arguments: {
          address: testAddress,
          limit: 3,
          beforeSignature: data1.nextPageSignature
        }
      });
      const data7 = JSON.parse(result7.content[0].text);
      console.log(`✅ Next page: ${data7.data?.length || 0} transfers`);
      if (data7.data && data7.data.length > 0) {
        console.log(`   First txId: ${data7.data[0].txId.substring(0, 20)}...\n`);
      }
    }

    // Test 8: Offset pagination
    console.log('Test 8: Offset pagination (offset=5)');
    const result8 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 3,
        offset: 5
      }
    });
    const data8 = JSON.parse(result8.content[0].text);
    console.log(`✅ Found ${data8.data?.length || 0} transfers at offset 5\n`);

    // Test 9: bypassCache parameter
    console.log('Test 9: Fresh data (bypassCache=true)');
    const result9 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 2,
        bypassCache: true
      }
    });
    const data9 = JSON.parse(result9.content[0].text);
    console.log(`✅ Query successful: ${data9.data?.length || 0} results`);
    console.log(`   FromCache: ${data9.fromCache}\n`);

    // Test 10: Response structure validation
    console.log('Test 10: Response structure validation');
    console.log('   Response fields:');
    console.log(`   - data: ${Array.isArray(data1.data) ? '✅ array' : '❌ not array'}`);
    console.log(`   - hasMore: ${typeof data1.hasMore === 'boolean' ? '✅ boolean' : '❌ not boolean'}`);
    console.log(`   - total: ${typeof data1.total === 'number' ? '✅ number' : '❌ not number'}`);
    console.log(`   - originalTotal: ${typeof data1.originalTotal === 'number' ? '✅ number' : '❌ not number'}`);
    console.log(`   - nextPageSignature: ${data1.nextPageSignature ? '✅ string' : '⚠️  null'}`);
    console.log(`   - fromCache: ${typeof data1.fromCache === 'boolean' ? '✅ boolean' : '❌ not boolean'}`);

    if (data1.data && data1.data.length > 0) {
      const tx = data1.data[0];
      console.log('\n   Transfer object fields:');
      console.log(`   - txId: ${tx.txId ? '✅' : '❌'}`);
      console.log(`   - date: ${tx.date ? '✅' : '❌'}`);
      console.log(`   - from: ${tx.from ? '✅' : '❌'}`);
      console.log(`   - to: ${tx.to ? '✅' : '❌'}`);
      console.log(`   - tokenSymbol: ${tx.tokenSymbol ? '✅' : '❌'}`);
      console.log(`   - tokenAmount: ${tx.tokenAmount ? '✅' : '❌'}`);
      console.log(`   - transferType: ${tx.transferType ? '✅' : '❌'}`);
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testCompleteTransfers().catch(console.error);
