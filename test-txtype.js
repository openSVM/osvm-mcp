#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testTxType() {
  console.log('🧪 Testing txType parameter filtering\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'txtype-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    const testAddress = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

    // Test 1: Filter by txType="sol"
    console.log('Test 1: txType="sol" (native SOL transfers)');
    const result1 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 5,
        txType: 'sol'
      }
    });
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`✅ Found ${data1.data?.length || 0} transfers`);
    if (data1.data && data1.data.length > 0) {
      console.log('   First 3 transfers:');
      data1.data.slice(0, 3).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.tokenSymbol}: ${tx.tokenAmount} (${tx.transferType})`);
      });
    }
    console.log();

    // Test 2: Filter by txType="spl"
    console.log('Test 2: txType="spl" (SPL token transfers)');
    const result2 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 5,
        txType: 'spl'
      }
    });
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`✅ Found ${data2.data?.length || 0} transfers`);
    if (data2.data && data2.data.length > 0) {
      const tokens = [...new Set(data2.data.map(t => t.tokenSymbol))];
      console.log(`   Token types: ${tokens.join(', ')}`);
    }
    console.log();

    // Test 3: Multiple types (comma-separated)
    console.log('Test 3: txType="sol,spl" (both SOL and SPL)');
    const result3 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 10,
        txType: 'sol,spl'
      }
    });
    const data3 = JSON.parse(result3.content[0].text);
    console.log(`✅ Found ${data3.data?.length || 0} transfers`);
    if (data3.data && data3.data.length > 0) {
      const solCount = data3.data.filter(t => t.tokenSymbol === 'SOL').length;
      const tokenCount = data3.data.filter(t => t.tokenSymbol !== 'SOL').length;
      console.log(`   SOL transfers: ${solCount}`);
      console.log(`   Token transfers: ${tokenCount}`);
    }
    console.log();

    // Test 4: Filter by txType="defi"
    console.log('Test 4: txType="defi" (DeFi transactions)');
    const result4 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 5,
        txType: 'defi'
      }
    });
    const data4 = JSON.parse(result4.content[0].text);
    console.log(`✅ Found ${data4.data?.length || 0} DeFi transfers\n`);

    // Test 5: Filter by txType="nft"
    console.log('Test 5: txType="nft" (NFT transactions)');
    const result5 = await client.callTool({
      name: 'get_account_transfers',
      arguments: {
        address: testAddress,
        limit: 5,
        txType: 'nft'
      }
    });
    const data5 = JSON.parse(result5.content[0].text);
    console.log(`✅ Found ${data5.data?.length || 0} NFT transfers\n`);

    console.log('🎉 All txType filter tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testTxType().catch(console.error);
