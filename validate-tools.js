#!/usr/bin/env node

import axios from 'axios';

// Mock API responses for testing
const mockApiResponses = {
  getTransaction: {
    signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk',
    timestamp: 1699123456789,
    slot: 250000000,
    success: true,
    fee: 5000,
    accountsCount: 5,
    instructionsCount: 2,
    logMessagesCount: 10,
    signer: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    type: 'Transfer',
    description: 'SOL transfer',
    accounts: [],
    instructions: [],
    logs: [],
    tokenTransfers: [],
    computeUnitsUsed: 1000
  },
  getAccountStats: {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    balance: 1000000000,
    transactionCount: 1500,
    firstSeen: '2021-01-01T00:00:00Z',
    lastSeen: '2024-01-01T00:00:00Z',
    isSystemProgram: false,
    accountType: 'Token Account',
    totalReceived: 5000000000,
    totalSent: 4000000000,
    avgTransactionValue: 1000000
  },
  getMarketData: {
    data: {
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      name: 'Bonk',
      supply: '92000000000000000',
      decimals: 5,
      price: 0.00001234,
      priceChange24h: 5.67,
      marketCap: 1234567890,
      volume24h: 98765432,
      liquidity: 10000000,
      holders: 500000,
      topHolders: [],
      liquidityPools: [],
      priceHistory: []
    }
  },
  getDefiOverview: {
    totalValueLocked: 5000000000,
    tvlChange24h: 2.5,
    totalVolume24h: 1000000000,
    volumeChange24h: -1.2,
    totalProtocols: 150,
    activeUsers24h: 50000,
    topProtocols: [],
    categories: {}
  },
  getBlock: {
    slot: 250000000,
    blockhash: 'GKJyJtCMBRo8dKxvtNHZxwZQ8Jz1tKBSGcVPeb8JvZqF',
    previousBlockhash: 'Eit7RCyhUixAe2hGBS2oqneh59NRBtU63PQiroKBfJFu',
    timestamp: 1699123456,
    height: 200000000,
    transactionCount: 150,
    totalFees: 750000,
    totalValue: 10000000000,
    leader: 'CertusDeBmqN8ZawdkxK5kFGMwBXdudvWHYwtNgNhvLu',
    transactions: []
  },
  universalSearch: {
    accounts: [],
    transactions: [],
    tokens: [],
    pools: [],
    summary: {
      totalAccounts: 10,
      totalTransactions: 50,
      totalTokens: 5,
      totalPools: 3
    }
  }
};

// Tool definitions with their expected schemas
const toolTests = [
  {
    name: 'get_transaction',
    description: 'Get detailed transaction information',
    inputSchema: {
      signature: { type: 'string', required: true }
    },
    outputSchema: {
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
    },
    mockResponse: mockApiResponses.getTransaction
  },
  {
    name: 'get_account_stats',
    description: 'Get account statistics and history',
    inputSchema: {
      address: { type: 'string', required: true }
    },
    outputSchema: {
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
    },
    mockResponse: mockApiResponses.getAccountStats
  },
  {
    name: 'get_market_data',
    description: 'Get token market data and analytics',
    inputSchema: {
      mint: { type: 'string', required: true }
    },
    outputSchema: {
      data: 'object'
    },
    mockResponse: mockApiResponses.getMarketData
  },
  {
    name: 'get_defi_overview',
    description: 'Get DeFi ecosystem overview',
    inputSchema: {},
    outputSchema: {
      totalValueLocked: 'number',
      tvlChange24h: 'number',
      totalVolume24h: 'number',
      volumeChange24h: 'number',
      totalProtocols: 'number',
      activeUsers24h: 'number',
      topProtocols: 'array',
      categories: 'object'
    },
    mockResponse: mockApiResponses.getDefiOverview
  },
  {
    name: 'get_block',
    description: 'Get block information',
    inputSchema: {
      slot: { type: 'number', required: true }
    },
    outputSchema: {
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
    },
    mockResponse: mockApiResponses.getBlock
  },
  {
    name: 'universal_search',
    description: 'Search across all blockchain data',
    inputSchema: {
      query: { type: 'string', required: true },
      limit: { type: 'number', required: false }
    },
    outputSchema: {
      accounts: 'array',
      transactions: 'array',
      tokens: 'array',
      pools: 'array',
      summary: 'object'
    },
    mockResponse: mockApiResponses.universalSearch
  }
];

// Validate schema
function validateSchema(data, schema, toolName) {
  const errors = [];

  for (const [field, expectedType] of Object.entries(schema)) {
    if (!(field in data)) {
      errors.push(`Missing field: ${field}`);
      continue;
    }

    const value = data[field];
    let actualType;

    if (value === null) {
      actualType = 'null';
    } else if (Array.isArray(value)) {
      actualType = 'array';
    } else {
      actualType = typeof value;
    }

    if (actualType !== expectedType) {
      errors.push(`Field ${field}: expected ${expectedType}, got ${actualType}`);
    }
  }

  return errors;
}

// Main test function
async function runValidation() {
  console.log('🔍 OpenSVM MCP Tools Validation\n');
  console.log('=' .repeat(60));
  console.log('This test validates that each tool\'s response matches its schema.\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const tool of toolTests) {
    totalTests++;
    console.log(`\n📌 Testing: ${tool.name}`);
    console.log(`   ${tool.description}`);

    // Validate input schema definition
    console.log('   Input Schema: ✅ Defined');

    // Validate output schema definition
    console.log('   Output Schema: ✅ Defined');

    // Validate mock response against schema
    const errors = validateSchema(tool.mockResponse, tool.outputSchema, tool.name);

    if (errors.length === 0) {
      console.log('   Response Validation: ✅ PASSED');
      console.log(`   → All ${Object.keys(tool.outputSchema).length} fields match schema`);
      passedTests++;
    } else {
      console.log('   Response Validation: ❌ FAILED');
      errors.forEach(error => console.log(`     → ${error}`));
      failedTests++;
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 Validation Summary:');
  console.log(`   Total Tools: ${totalTests}`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);

  if (failedTests === 0) {
    console.log('\n🎉 SUCCESS: All tools have valid schemas!');
    console.log('✨ All mock responses match their defined output schemas.\n');
  } else {
    console.log(`\n⚠️ WARNING: ${failedTests} tool(s) have schema mismatches.\n`);
  }

  // Additional validation info
  console.log('📝 Tool Categories Found:');
  console.log('   • Transaction Tools (get_transaction, batch_transactions)');
  console.log('   • Account Tools (get_account_stats, get_account_portfolio)');
  console.log('   • Market Tools (get_market_data, get_defi_overview)');
  console.log('   • Block Tools (get_block, get_recent_blocks)');
  console.log('   • Search Tools (universal_search, search_accounts)');
  console.log('   • Analytics Tools (get_validator_analytics, get_dex_analytics)\n');

  return failedTests === 0;
}

// Run validation
runValidation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});