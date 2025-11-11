#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testTools() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js'],
    env: process.env
  });

  const client = new Client({
    name: 'test-client',
    version: '0.1.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('Connected to MCP server');

    // Get list of tools
    const toolsResult = await client.callTool('tools/list', {});
    console.log('\n=== Available Tools ===');
    console.log(JSON.stringify(toolsResult.content, null, 2));

    // Test get_transaction with a known transaction
    console.log('\n=== Testing get_transaction ===');
    const txResult = await client.callTool('get_transaction', {
      signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'
    });
    console.log('Response:', JSON.stringify(txResult.content, null, 2));
    validateSchema(txResult.content[0], {
      signature: 'string',
      timestamp: 'number',
      slot: 'number',
      success: 'boolean',
      fee: 'number',
      accountsCount: 'number',
      instructionsCount: 'number',
      logMessagesCount: 'number',
      signer: 'string',
      type: 'string',
      description: 'string',
      accounts: 'array',
      instructions: 'array',
      logs: 'array',
      tokenTransfers: 'array',
      computeUnitsUsed: 'number'
    });

    // Test batch_transactions
    console.log('\n=== Testing batch_transactions ===');
    const batchResult = await client.callTool('batch_transactions', {
      signatures: [
        '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk',
        '4PZLZ7L8JKkZN6vJcPaZKBcA8C5FvKyJF7kdSxCvYYFRbKxdPeKnUvHPKtLJz8qd1xKBdyJJjuTQRa5uVxWYZF2u'
      ]
    });
    console.log('Response:', JSON.stringify(batchResult.content, null, 2));

    // Test get_account_stats
    console.log('\n=== Testing get_account_stats ===');
    const accountResult = await client.callTool('get_account_stats', {
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'  // Bonk deployer
    });
    console.log('Response:', JSON.stringify(accountResult.content, null, 2));
    validateSchema(accountResult.content[0], {
      address: 'string',
      balance: 'number',
      transactionCount: 'number',
      firstSeen: 'string',
      lastSeen: 'string',
      isSystemProgram: 'boolean',
      accountType: 'string',
      totalReceived: 'number',
      totalSent: 'number',
      avgTransactionValue: 'number'
    });

    // Test get_market_data
    console.log('\n=== Testing get_market_data ===');
    const marketResult = await client.callTool('get_market_data', {
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'  // Bonk
    });
    console.log('Response:', JSON.stringify(marketResult.content, null, 2));
    validateSchema(marketResult.content[0], {
      data: 'object'
    });

    if (marketResult.content[0].data) {
      validateSchema(marketResult.content[0].data, {
        mint: 'string',
        symbol: 'string',
        name: 'string',
        supply: 'string',
        decimals: 'number',
        price: 'number',
        priceChange24h: 'number',
        marketCap: 'number',
        volume24h: 'number',
        liquidity: 'number',
        holders: 'number',
        topHolders: 'array',
        liquidityPools: 'array',
        priceHistory: 'array'
      });
    }

    // Test get_defi_overview
    console.log('\n=== Testing get_defi_overview ===');
    const defiResult = await client.callTool('get_defi_overview', {});
    console.log('Response:', JSON.stringify(defiResult.content, null, 2));
    validateSchema(defiResult.content[0], {
      totalValueLocked: 'number',
      tvlChange24h: 'number',
      totalVolume24h: 'number',
      volumeChange24h: 'number',
      totalProtocols: 'number',
      activeUsers24h: 'number',
      topProtocols: 'array',
      categories: 'object'
    });

    // Test universal_search
    console.log('\n=== Testing universal_search ===');
    const searchResult = await client.callTool('universal_search', {
      query: 'bonk'
    });
    console.log('Response:', JSON.stringify(searchResult.content, null, 2));
    validateSchema(searchResult.content[0], {
      accounts: 'array',
      transactions: 'array',
      tokens: 'array',
      pools: 'array',
      summary: 'object'
    });

    // Test get_block
    console.log('\n=== Testing get_block ===');
    const blockResult = await client.callTool('get_block', {
      slot: 250000000
    });
    console.log('Response:', JSON.stringify(blockResult.content, null, 2));
    validateSchema(blockResult.content[0], {
      slot: 'number',
      blockhash: 'string',
      previousBlockhash: 'string',
      timestamp: 'number',
      height: 'number',
      transactionCount: 'number',
      totalFees: 'number',
      totalValue: 'number',
      leader: 'string',
      transactions: 'array'
    });

    console.log('\n✅ All tests passed! All responses match their schemas.');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

function validateSchema(data, schema) {
  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in data)) {
      throw new Error(`Missing required field: ${key}`);
    }

    const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
    if (actualType !== expectedType) {
      throw new Error(`Field ${key} has type ${actualType}, expected ${expectedType}`);
    }
  }
  console.log('✓ Schema validation passed');
}

testTools().catch(console.error);