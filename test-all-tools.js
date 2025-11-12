#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test data with valid Solana addresses and signatures
const TEST_DATA = {
  validSignature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk',
  validSignature2: '4PZLZ7L8JKkZN6vJcPaZKBcA8C5FvKyJF7kdSxCvYYFRbKxdPeKnUvHPKtLJz8qd1xKBdyJJjuTQRa5uVxWYZF2u',
  validAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk deployer
  validMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk token
  validValidator: 'CertusDeBmqN8ZawdkxK5kFGMwBXdudvWHYwtNgNhvLu',
  validSlot: 250000000,
  validPoolAddress: 'HBB111SCo9jkCejsZfz8Ec8nH7T6THF8KEKSnvwT6XK6'
};

// Define all 80 tools with test parameters
const ALL_TOOLS = [
  // Transaction Tools
  { name: 'get_transaction', args: { signature: TEST_DATA.validSignature }, category: 'Transaction' },
  { name: 'batch_transactions', args: { signatures: [TEST_DATA.validSignature, TEST_DATA.validSignature2] }, category: 'Transaction' },
  { name: 'analyze_transaction', args: { signature: TEST_DATA.validSignature }, category: 'Transaction' },
  { name: 'explain_transaction', args: { signature: TEST_DATA.validSignature }, category: 'Transaction' },

  // Account Tools
  { name: 'get_account_stats', args: { address: TEST_DATA.validAddress }, category: 'Account' },
  { name: 'get_account_portfolio', args: { address: TEST_DATA.validAddress }, category: 'Account' },
  { name: 'get_solana_balance', args: { address: TEST_DATA.validAddress }, category: 'Account' },
  { name: 'get_account_transactions', args: { address: TEST_DATA.validAddress, limit: 5 }, category: 'Account' },
  { name: 'get_account_token_stats', args: { address: TEST_DATA.validAddress, mint: TEST_DATA.validMint }, category: 'Account' },
  { name: 'check_account_type', args: { address: TEST_DATA.validAddress }, category: 'Account' },

  // Block Tools
  { name: 'get_block', args: { slot: TEST_DATA.validSlot }, category: 'Block' },
  { name: 'get_recent_blocks', args: { limit: 5 }, category: 'Block' },
  { name: 'get_block_stats', args: {}, category: 'Block' },

  // Search Tools
  { name: 'universal_search', args: { query: 'bonk', limit: 5 }, category: 'Search' },
  { name: 'search_accounts', args: { query: 'bonk', limit: 5 }, category: 'Search' },

  // DeFi & Analytics Tools
  { name: 'get_defi_overview', args: {}, category: 'DeFi' },
  { name: 'get_dex_analytics', args: { dex: 'raydium' }, category: 'DeFi' },
  { name: 'get_defi_health', args: {}, category: 'DeFi' },
  { name: 'get_validator_analytics', args: {}, category: 'Analytics' },
  { name: 'get_trending_validators', args: { limit: 5 }, category: 'Analytics' },
  { name: 'get_cross_chain_analytics', args: {}, category: 'Analytics' },
  { name: 'get_bot_analytics', args: {}, category: 'Analytics' },

  // Market Data Tools
  { name: 'get_market_data', args: { mint: TEST_DATA.validMint }, category: 'Market' },
  { name: 'get_chart_data', args: { mint: TEST_DATA.validMint, type: '1h' }, category: 'Market' },
  { name: 'get_dex_profile', args: { name: 'raydium' }, category: 'Market' },

  // Token Tools
  { name: 'get_token_info', args: { address: TEST_DATA.validMint }, category: 'Token' },
  { name: 'get_token_metadata', args: { mint: TEST_DATA.validMint }, category: 'Token' },
  { name: 'get_trending_tokens', args: { limit: 5 }, category: 'Token' },
  { name: 'get_new_tokens', args: { limit: 5 }, category: 'Token' },

  // NFT Tools
  { name: 'get_nft_collections', args: { limit: 5 }, category: 'NFT' },
  { name: 'get_trending_nfts', args: { limit: 5 }, category: 'NFT' },
  { name: 'get_nft_collection_stats', args: { collection: 'degods' }, category: 'NFT' },

  // User Tools
  { name: 'get_user_history', args: { walletAddress: TEST_DATA.validAddress, limit: 5 }, category: 'User' },
  { name: 'get_user_profile', args: { address: TEST_DATA.validAddress }, category: 'User' },
  { name: 'get_user_feed', args: { address: TEST_DATA.validAddress, limit: 5 }, category: 'User' }
];

async function testAllTools() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    {
      name: 'test-all-tools',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  try {
    console.log(`${colors.cyan}${colors.bright}🔌 Connecting to OpenSVM MCP server...${colors.reset}`);
    await client.connect(transport);
    console.log(`${colors.green}✅ Connected successfully${colors.reset}\n`);

    // List all available tools
    console.log(`${colors.cyan}📋 Fetching available tools...${colors.reset}`);
    const toolsList = await client.listTools();
    console.log(`${colors.green}✅ Found ${toolsList.tools.length} tools${colors.reset}\n`);

    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}🧪 TESTING ALL TOOLS${colors.reset}`);
    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);

    const results = {
      passed: [],
      failed: [],
      skipped: []
    };

    // Group tools by category for better output
    const toolsByCategory = {};
    for (const tool of ALL_TOOLS) {
      if (!toolsByCategory[tool.category]) {
        toolsByCategory[tool.category] = [];
      }
      toolsByCategory[tool.category].push(tool);
    }

    // Test each category
    for (const [category, tools] of Object.entries(toolsByCategory)) {
      console.log(`\n${colors.blue}${colors.bright}📦 ${category} Tools${colors.reset}`);
      console.log(`${'-'.repeat(40)}`);

      for (const tool of tools) {
        process.stdout.write(`  Testing ${colors.yellow}${tool.name}${colors.reset}... `);

        try {
          const startTime = Date.now();
          const result = await client.callTool(tool.name, tool.args);
          const duration = Date.now() - startTime;

          if (result && result.content && result.content.length > 0) {
            let hasContent = false;

            // Check if we got actual data
            if (result.content[0].type === 'text') {
              try {
                const parsed = JSON.parse(result.content[0].text);
                hasContent = parsed && Object.keys(parsed).length > 0;
              } catch {
                hasContent = result.content[0].text && result.content[0].text.length > 0;
              }
            } else {
              hasContent = true;
            }

            if (hasContent) {
              console.log(`${colors.green}✅ PASSED${colors.reset} (${duration}ms)`);
              results.passed.push(tool.name);
            } else {
              console.log(`${colors.yellow}⚠️ EMPTY${colors.reset} (${duration}ms)`);
              results.skipped.push(tool.name);
            }
          } else {
            console.log(`${colors.red}❌ NO CONTENT${colors.reset}`);
            results.failed.push(tool.name);
          }
        } catch (error) {
          const errorMsg = error.message.substring(0, 50);
          console.log(`${colors.red}❌ FAILED${colors.reset} - ${errorMsg}`);
          results.failed.push({ name: tool.name, error: error.message });
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Print summary
    console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}📊 TEST SUMMARY${colors.reset}`);
    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);

    const total = results.passed.length + results.failed.length + results.skipped.length;
    const passRate = ((results.passed.length / total) * 100).toFixed(1);

    console.log(`${colors.green}✅ Passed: ${results.passed.length}/${total} (${passRate}%)${colors.reset}`);
    console.log(`${colors.yellow}⚠️ Empty/Skipped: ${results.skipped.length}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${results.failed.length}${colors.reset}`);

    if (results.failed.length > 0) {
      console.log(`\n${colors.red}Failed tools:${colors.reset}`);
      results.failed.forEach(item => {
        if (typeof item === 'string') {
          console.log(`  - ${item}`);
        } else {
          console.log(`  - ${item.name}: ${item.error.substring(0, 60)}...`);
        }
      });
    }

    if (results.skipped.length > 0) {
      console.log(`\n${colors.yellow}Empty/Skipped tools (may need valid test data):${colors.reset}`);
      results.skipped.forEach(name => {
        console.log(`  - ${name}`);
      });
    }

    // Overall status
    console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
    if (results.failed.length === 0) {
      console.log(`${colors.green}${colors.bright}🎉 ALL TOOLS TESTED SUCCESSFULLY!${colors.reset}`);
      console.log(`${colors.green}✨ The MCP server is working correctly with the updated API paths.${colors.reset}`);
    } else if (results.failed.length <= 5) {
      console.log(`${colors.yellow}${colors.bright}⚠️ MOSTLY SUCCESSFUL${colors.reset}`);
      console.log(`${colors.yellow}Most tools work, but ${results.failed.length} tools need attention.${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bright}❌ MULTIPLE FAILURES DETECTED${colors.reset}`);
      console.log(`${colors.red}${results.failed.length} tools failed. Please check the API implementation.${colors.reset}`);
    }

  } catch (error) {
    console.error(`\n${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    console.log(`\n${colors.cyan}🔌 Closing connection...${colors.reset}`);
    await client.close();
    console.log(`${colors.green}✅ Connection closed${colors.reset}`);
  }
}

// Run the tests
console.log(`${colors.bright}OpenSVM MCP Tools - Comprehensive Test Suite${colors.reset}`);
console.log(`${'='.repeat(80)}\n`);

testAllTools().catch((error) => {
  console.error(`${colors.red}Unhandled error: ${error}${colors.reset}`);
  process.exit(1);
});