#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

// Sample of different tool categories to test
const TOOLS_TO_TEST = [
  // Transaction Tools
  { name: 'get_transaction', args: { signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk' }, category: 'Transaction' },
  { name: 'batch_transactions', args: { signatures: ['5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'] }, category: 'Transaction' },

  // Account Tools
  { name: 'get_account_stats', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Account' },
  { name: 'get_account_portfolio', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Account' },
  { name: 'get_solana_balance', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Account' },
  { name: 'get_account_transactions', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', limit: 5 }, category: 'Account' },

  // Block Tools
  { name: 'get_block', args: { slot: 250000000 }, category: 'Block' },
  { name: 'get_recent_blocks', args: { limit: 5 }, category: 'Block' },

  // Search Tools
  { name: 'universal_search', args: { query: 'bonk' }, category: 'Search' },

  // DeFi Tools
  { name: 'get_defi_overview', args: {}, category: 'DeFi' },
  { name: 'get_dex_analytics', args: { dex: 'raydium' }, category: 'DeFi' },

  // Market Data
  { name: 'get_market_data', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', endpoint: 'markets' }, category: 'Market' },
  { name: 'chart', args: { mint: 'So11111111111111111111111111111111111111112', interval: '1H' }, category: 'Market' },

  // Token Tools
  { name: 'get_token_info', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Token' },
  { name: 'get_trending_tokens', args: { limit: 5 }, category: 'Token' },

  // RPC Tools (sample)
  { name: 'rpc_getHealth', args: {}, category: 'RPC' },
  { name: 'rpc_getVersion', args: {}, category: 'RPC' },
  { name: 'rpc_getSlot', args: {}, category: 'RPC' },
];

async function testAllTools() {
  console.log(`${colors.cyan}${colors.bright}🧪 Testing MCP Tool Execution${colors.reset}`);
  console.log('='.repeat(70));

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'tool-execution-test', version: '1.0.0' },
    { capabilities: {} }
  );

  const results = {
    passed: [],
    failed: [],
    errors: []
  };

  try {
    console.log(`\n${colors.cyan}Connecting to MCP server...${colors.reset}`);
    await client.connect(transport);
    console.log(`${colors.green}✅ Connected successfully${colors.reset}\n`);

    // Group tools by category
    const byCategory = {};
    for (const tool of TOOLS_TO_TEST) {
      if (!byCategory[tool.category]) {
        byCategory[tool.category] = [];
      }
      byCategory[tool.category].push(tool);
    }

    // Test each category
    for (const [category, tools] of Object.entries(byCategory)) {
      console.log(`${colors.blue}${colors.bright}📦 ${category} Tools (${tools.length})${colors.reset}`);
      console.log('-'.repeat(70));

      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        process.stdout.write(`  [${i + 1}/${tools.length}] ${colors.yellow}${tool.name}${colors.reset}... `);

        try {
          const startTime = Date.now();
          const result = await client.callTool({
            name: tool.name,
            arguments: tool.args
          });
          const duration = Date.now() - startTime;

          if (result && result.content && result.content.length > 0) {
            // Try to parse response
            try {
              const data = JSON.parse(result.content[0].text);
              console.log(`${colors.green}✅ OK${colors.reset} (${duration}ms)`);
              results.passed.push(tool.name);
            } catch (e) {
              // Not JSON, but still got response
              console.log(`${colors.green}✅ OK${colors.reset} (${duration}ms, non-JSON)`);
              results.passed.push(tool.name);
            }
          } else {
            console.log(`${colors.yellow}⚠️  EMPTY${colors.reset}`);
            results.failed.push(tool.name);
          }
        } catch (error) {
          console.log(`${colors.red}❌ ERROR${colors.reset}`);
          results.errors.push({ name: tool.name, error: error.message.substring(0, 100) });
        }
      }
      console.log();
    }

    // Summary
    console.log('='.repeat(70));
    console.log(`${colors.bright}📊 Test Results${colors.reset}\n`);
    console.log(`${colors.green}✅ Passed:  ${results.passed.length}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Empty:   ${results.failed.length}${colors.reset}`);
    console.log(`${colors.red}❌ Errors:  ${results.errors.length}${colors.reset}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`   Total:   ${TOOLS_TO_TEST.length} tools tested\n`);

    if (results.errors.length > 0) {
      console.log(`${colors.red}${colors.bright}Errors:${colors.reset}`);
      results.errors.forEach(e => {
        console.log(`  ${colors.red}•${colors.reset} ${e.name}: ${e.error}`);
      });
      console.log();
    }

    const successRate = ((results.passed.length / TOOLS_TO_TEST.length) * 100).toFixed(1);
    if (results.errors.length === 0) {
      console.log(`${colors.green}${colors.bright}🎉 All tools executed successfully! (${successRate}% success rate)${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}⚠️  Some tools had issues (${successRate}% success rate)${colors.reset}\n`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testAllTools().catch(console.error);
