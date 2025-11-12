#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m'
};

async function test() {
  console.log(`${colors.cyan}${colors.bright}🧪 OpenSVM MCP Server - Final Test${colors.reset}`);
  console.log('='.repeat(60));

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'final-test', version: '1.0.0' },
    { capabilities: {} }
  );

  let passed = 0;
  let failed = 0;

  try {
    console.log(`\n${colors.cyan}1. Connecting to server...${colors.reset}`);
    await client.connect(transport);
    console.log(`${colors.green}✅ Connected${colors.reset}`);
    passed++;

    // Test 1: get_transaction
    console.log(`\n${colors.cyan}2. Testing get_transaction...${colors.reset}`);
    try {
      const result = await client.callTool({
        name: 'get_transaction',
        arguments: {
          signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'
        }
      });

      if (result && result.content && result.content[0]) {
        const data = JSON.parse(result.content[0].text);
        console.log(`${colors.green}✅ Got transaction data${colors.reset}`);
        console.log(`   Has signature: ${!!data.signature}`);
        console.log(`   Has timestamp: ${!!data.timestamp}`);
        console.log(`   Has details: ${!!data.details}`);
        passed++;
      } else {
        console.log(`${colors.red}❌ No data returned${colors.reset}`);
        failed++;
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
      failed++;
    }

    // Test 2: get_account_transactions
    console.log(`\n${colors.cyan}3. Testing get_account_transactions...${colors.reset}`);
    try {
      const result = await client.callTool({
        name: 'get_account_transactions',
        arguments: {
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
          limit: 2
        }
      });

      if (result && result.content && result.content[0]) {
        const data = JSON.parse(result.content[0].text);
        if (data.transactions && Array.isArray(data.transactions)) {
          console.log(`${colors.green}✅ Got ${data.transactions.length} transactions${colors.reset}`);
          console.log(`   Has transfers: ${!!(data.transactions[0]?.transfers)}`);
          passed++;
        } else {
          console.log(`${colors.red}❌ Missing transactions array${colors.reset}`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
      failed++;
    }

    // Test 3: get_account_portfolio
    console.log(`\n${colors.cyan}4. Testing get_account_portfolio...${colors.reset}`);
    try {
      const result = await client.callTool({
        name: 'get_account_portfolio',
        arguments: {
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
        }
      });

      if (result && result.content && result.content[0]) {
        const data = JSON.parse(result.content[0].text);
        console.log(`${colors.green}✅ Got portfolio data${colors.reset}`);
        console.log(`   Has native balance: ${!!(data.data?.native)}`);
        console.log(`   Has tokens: ${!!(data.data?.tokens)}`);
        console.log(`   Total value: ${data.data?.totalValue || 'N/A'}`);
        passed++;
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
      failed++;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.bright}📊 Results:${colors.reset}`);
    console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);

    if (failed === 0) {
      console.log(`\n${colors.green}${colors.bright}🎉 All tests passed!${colors.reset}`);
      console.log(`${colors.green}The MCP server is working correctly.${colors.reset}\n`);
    } else {
      console.log(`\n${colors.yellow}⚠️  Some tests failed${colors.reset}\n`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
  } finally {
    await client.close();
  }
}

test().catch(console.error);
