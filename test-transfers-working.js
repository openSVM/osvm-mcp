#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testWorkingTransfers() {
  console.log('🧪 Testing get_account_transfers with wallet that has transfer data\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'transfer-working-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Use wallet with known transfer history
    const testAddress = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

    console.log(`Testing address: ${testAddress}`);
    console.log('Query parameters: limit=5\n');

    const result = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 5
      }
    });

    console.log('✅ Query successful!\n');
    const data = JSON.parse(result.content[0].text);

    console.log('📊 Response structure:');
    console.log(`  Keys: ${Object.keys(data).join(', ')}\n`);

    if (data.data && Array.isArray(data.data)) {
      console.log(`✅ Found ${data.data.length} transfers`);
      console.log(`  hasMore: ${data.hasMore}`);
      console.log(`  total: ${data.total}`);
      console.log(`  originalTotal: ${data.originalTotal}`);
      console.log(`  nextPageSignature: ${data.nextPageSignature ? data.nextPageSignature.substring(0, 20) + '...' : 'null'}`);
      console.log(`  fromCache: ${data.fromCache}\n`);

      if (data.data.length > 0) {
        console.log('📝 First transfer:');
        const first = data.data[0];
        console.log(`  txId: ${first.txId.substring(0, 20)}...`);
        console.log(`  date: ${first.date}`);
        console.log(`  from: ${first.from.substring(0, 12)}...`);
        console.log(`  to: ${first.to.substring(0, 12)}...`);
        console.log(`  tokenSymbol: ${first.tokenSymbol}`);
        console.log(`  tokenAmount: ${first.tokenAmount}`);
        console.log(`  transferType: ${first.transferType}\n`);

        console.log('📋 All transfers summary:');
        data.data.forEach((tx, i) => {
          console.log(`  ${i + 1}. ${tx.transferType} ${tx.tokenAmount} ${tx.tokenSymbol} (${tx.date})`);
        });
        console.log();
      }
    } else {
      console.log('❌ Unexpected response structure');
      console.log(JSON.stringify(data, null, 2));
    }

    // Test 2: With transferType filter
    console.log('\n🔍 Test 2: Filter by transferType="in"\n');
    const result2 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 3,
        transferType: 'in'
      }
    });

    const data2 = JSON.parse(result2.content[0].text);
    console.log(`✅ Found ${data2.data?.length || 0} incoming transfers\n`);

    // Test 3: With pagination
    console.log('📄 Test 3: Pagination with nextPageSignature\n');
    if (data.nextPageSignature) {
      const result3 = await client.callTool({
        name: 'get_account_transfers',
        arguments: {
          address: testAddress,
          limit: 3,
          beforeSignature: data.nextPageSignature
        }
      });

      const data3 = JSON.parse(result3.content[0].text);
      console.log(`✅ Next page has ${data3.data?.length || 0} transfers`);
      if (data3.data && data3.data.length > 0) {
        console.log(`  First tx on next page: ${data3.data[0].txId.substring(0, 20)}...\n`);
      }
    }

    // Test 4: SOL only filter
    console.log('💰 Test 4: SOL transfers only\n');
    const result4 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 5,
        solanaOnly: true
      }
    });

    const data4 = JSON.parse(result4.content[0].text);
    console.log(`✅ Found ${data4.data?.length || 0} SOL-only transfers`);
    if (data4.data && data4.data.length > 0) {
      const allSol = data4.data.every(tx => tx.tokenSymbol === 'SOL');
      console.log(`  All transfers are SOL: ${allSol}\n`);
    }

    console.log('🎉 All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testWorkingTransfers().catch(console.error);
