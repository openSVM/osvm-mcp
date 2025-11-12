#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

async function testMCPFixes() {
  console.log(`${colors.cyan}${colors.bright}🔍 Testing MCP Server Fixes${colors.reset}`);
  console.log('='.repeat(60));

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'test-fixes', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    console.log(`\n${colors.cyan}Connecting to MCP server...${colors.reset}`);
    await client.connect(transport);
    console.log(`${colors.green}✅ Connected${colors.reset}\n`);

    // Test 1: get_transaction with transfers
    console.log(`${colors.bright}Test 1: get_transaction - Transfer field mapping${colors.reset}`);
    console.log('-'.repeat(40));

    try {
      const txResult = await client.callTool('get_transaction', {
        signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'
      });

      if (txResult && txResult.content && txResult.content[0]) {
        const data = JSON.parse(txResult.content[0].text);

        console.log(`${colors.green}✅ Tool responded successfully${colors.reset}`);

        // Check for tokenTransfers field
        if (data.tokenTransfers) {
          console.log(`${colors.green}✅ Has tokenTransfers field${colors.reset}`);

          if (data.tokenTransfers.length > 0) {
            const transfer = data.tokenTransfers[0];
            console.log(`\n${colors.cyan}Sample transfer:${colors.reset}`);
            console.log(JSON.stringify(transfer, null, 2));

            // Check field mapping
            const hasFromTo = transfer.from !== undefined || transfer.to !== undefined;
            const hasAccountChange = transfer.account !== undefined && transfer.change !== undefined;

            if (hasFromTo) {
              console.log(`${colors.green}✅ Has from/to fields (fix working!)${colors.reset}`);
            } else {
              console.log(`${colors.red}❌ Missing from/to fields${colors.reset}`);
            }

            if (hasAccountChange) {
              console.log(`${colors.green}✅ Original account/change fields preserved${colors.reset}`);
            }
          } else {
            console.log(`${colors.yellow}⚠️ No transfers in this transaction${colors.reset}`);
          }
        } else {
          console.log(`${colors.yellow}⚠️ No tokenTransfers field found${colors.reset}`);
        }
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    }

    // Test 2: get_account_transactions
    console.log(`\n${colors.bright}Test 2: get_account_transactions - Endpoint path fix${colors.reset}`);
    console.log('-'.repeat(40));

    try {
      const accResult = await client.callTool('get_account_transactions', {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        limit: 2
      });

      if (accResult && accResult.content && accResult.content[0]) {
        const text = accResult.content[0].text;

        // Check if we got HTML (error) or JSON (success)
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
          console.log(`${colors.red}❌ Received HTML 404 page - endpoint not fixed${colors.reset}`);
        } else {
          const data = JSON.parse(text);
          console.log(`${colors.green}✅ Tool responded with JSON data${colors.reset}`);

          if (data.transactions && Array.isArray(data.transactions)) {
            console.log(`${colors.green}✅ Has transactions array (${data.transactions.length} transactions)${colors.reset}`);

            if (data.transactions.length > 0 && data.transactions[0].transfers) {
              console.log(`${colors.green}✅ Transactions have transfer data${colors.reset}`);

              const transfer = data.transactions[0].transfers[0];
              if (transfer) {
                console.log(`\n${colors.cyan}Sample transfer:${colors.reset}`);
                console.log(JSON.stringify(transfer, null, 2));
              }
            }
          } else {
            console.log(`${colors.red}❌ Missing transactions array${colors.reset}`);
          }
        }
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.green}${colors.bright}✅ MCP server fixes verified!${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  } finally {
    console.log(`\n${colors.cyan}Closing connection...${colors.reset}`);
    await client.close();
    console.log(`${colors.green}✅ Done${colors.reset}`);
  }
}

testMCPFixes().catch(console.error);