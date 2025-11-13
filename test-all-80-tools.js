#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test configuration with extended list of tools
const TOOL_TESTS = [
  // Transaction Tools (9 tools)
  { name: 'get_transaction', args: { signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk' }, category: 'Transaction' },
  { name: 'batch_transactions', args: { signatures: ['5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'] }, category: 'Transaction' },
  { name: 'analyze_transaction', args: { signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk' }, category: 'Transaction' },
  { name: 'explain_transaction', args: { signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk' }, category: 'Transaction' },
  { name: 'get_transaction_metrics', args: { signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk' }, category: 'Transaction' },
  { name: 'find_related_transactions', args: { signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk' }, category: 'Transaction' },
  { name: 'filter_transactions', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', type: 'token' }, category: 'Transaction' },
  { name: 'get_transaction_error_report', args: { signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk' }, category: 'Transaction' },
  { name: 'get_transaction_effects', args: { signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk' }, category: 'Transaction' },

  // Account Tools (6 tools)
  { name: 'get_account_stats', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Account' },
  { name: 'get_account_portfolio', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Account' },
  { name: 'get_solana_balance', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Account' },
  { name: 'get_account_transactions', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', limit: 5 }, category: 'Account' },
  { name: 'get_account_token_stats', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Account' },
  { name: 'check_account_type', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Account' },

  // Block Tools (3 tools)
  { name: 'get_block', args: { slot: 250000000 }, category: 'Block' },
  { name: 'get_recent_blocks', args: { limit: 5 }, category: 'Block' },
  { name: 'get_block_stats', args: {}, category: 'Block' },

  // Search Tools (5 tools)
  { name: 'universal_search', args: { query: 'bonk', limit: 5 }, category: 'Search' },
  { name: 'search_accounts', args: { query: 'bonk', limit: 5 }, category: 'Search' },
  { name: 'search_tokens', args: { query: 'bonk', limit: 5 }, category: 'Search' },
  { name: 'search_transactions', args: { query: 'transfer', limit: 5 }, category: 'Search' },
  { name: 'search_pools', args: { query: 'usdc', limit: 5 }, category: 'Search' },

  // DeFi & Analytics Tools (14 tools)
  { name: 'get_defi_overview', args: {}, category: 'DeFi' },
  { name: 'get_dex_analytics', args: { dex: 'raydium' }, category: 'DeFi' },
  { name: 'get_defi_health', args: {}, category: 'DeFi' },
  { name: 'get_validator_analytics', args: {}, category: 'Analytics' },
  { name: 'get_trending_validators', args: { limit: 5 }, category: 'Analytics' },
  { name: 'get_cross_chain_analytics', args: {}, category: 'Analytics' },
  { name: 'get_bot_analytics', args: {}, category: 'Analytics' },
  { name: 'get_liquidity_pool_stats', args: { poolAddress: 'HBB111SCo9jkCejsZfz8Ec8nH7T6THF8KEKSnvwT6XK6' }, category: 'DeFi' },
  { name: 'get_lending_protocol_stats', args: { protocol: 'solend' }, category: 'DeFi' },
  { name: 'get_yield_farming_opportunities', args: { minApy: 10 }, category: 'DeFi' },
  { name: 'get_protocol_tvl_history', args: { protocol: 'marinade' }, category: 'DeFi' },
  { name: 'get_mev_analytics', args: {}, category: 'Analytics' },
  { name: 'get_network_performance', args: {}, category: 'Analytics' },
  { name: 'get_ecosystem_metrics', args: {}, category: 'Analytics' },

  // Market Data Tools (8 tools)
  { name: 'get_market_data', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Market' },
  { name: 'get_chart_data', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', type: '1h' }, category: 'Market' },
  { name: 'get_dex_profile', args: { name: 'raydium' }, category: 'Market' },
  { name: 'get_volume_analytics', args: { period: '24h' }, category: 'Market' },
  { name: 'get_price_alerts', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Market' },
  { name: 'get_market_makers', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Market' },
  { name: 'get_trading_pairs', args: { baseMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Market' },
  { name: 'get_liquidity_metrics', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Market' },

  // Token Tools (8 tools)
  { name: 'get_token_info', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Token' },
  { name: 'get_token_metadata', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Token' },
  { name: 'get_trending_tokens', args: { limit: 5 }, category: 'Token' },
  { name: 'get_new_tokens', args: { limit: 5 }, category: 'Token' },
  { name: 'get_token_holders', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', limit: 10 }, category: 'Token' },
  { name: 'get_token_distribution', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Token' },
  { name: 'get_token_security', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'Token' },
  { name: 'get_token_price_history', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', period: '7d' }, category: 'Token' },

  // NFT Tools (7 tools)
  { name: 'get_nft_collections', args: { limit: 5 }, category: 'NFT' },
  { name: 'get_trending_nfts', args: { limit: 5 }, category: 'NFT' },
  { name: 'get_nft_collection_stats', args: { collection: 'degods' }, category: 'NFT' },
  { name: 'get_nft_holder_stats', args: { collection: 'degods' }, category: 'NFT' },
  { name: 'get_nft_sales_history', args: { collection: 'degods', limit: 10 }, category: 'NFT' },
  { name: 'get_nft_rarity', args: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'NFT' },
  { name: 'get_nft_marketplace_stats', args: { marketplace: 'magiceden' }, category: 'NFT' },

  // User/Social Tools (10 tools)
  { name: 'get_user_history', args: { walletAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', limit: 5 }, category: 'User' },
  { name: 'get_user_profile', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'User' },
  { name: 'get_user_feed', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', limit: 5 }, category: 'User' },
  { name: 'get_user_follows', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'User' },
  { name: 'get_user_followers', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'User' },
  { name: 'get_social_stats', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'User' },
  { name: 'get_user_notifications', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'User' },
  { name: 'get_user_achievements', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'User' },
  { name: 'get_user_reputation', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }, category: 'User' },
  { name: 'get_user_activity_summary', args: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', period: '30d' }, category: 'User' },

  // Miscellaneous Tools (10 tools)
  { name: 'get_gas_estimates', args: {}, category: 'Misc' },
  { name: 'get_network_status', args: {}, category: 'Misc' },
  { name: 'get_slot_info', args: { slot: 250000000 }, category: 'Misc' },
  { name: 'get_epoch_info', args: {}, category: 'Misc' },
  { name: 'get_cluster_nodes', args: {}, category: 'Misc' },
  { name: 'get_supply_info', args: {}, category: 'Misc' },
  { name: 'get_inflation_info', args: {}, category: 'Misc' },
  { name: 'get_performance_samples', args: { limit: 10 }, category: 'Misc' },
  { name: 'get_recent_performance', args: {}, category: 'Misc' },
  { name: 'get_version_info', args: {}, category: 'Misc' }
];

async function testAllTools() {
  console.log(`${colors.cyan}${colors.bright}🚀 OpenSVM MCP - Testing All 80 Tools${colors.reset}`);
  console.log(`${'='.repeat(80)}\n`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'test-all-80-tools', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    console.log(`${colors.cyan}Connecting to MCP server...${colors.reset}`);
    await client.connect(transport);
    console.log(`${colors.green}✅ Connected successfully${colors.reset}\n`);

    // Get list of available tools from server
    const serverTools = await client.listTools();
    console.log(`${colors.cyan}Server reports ${serverTools.tools.length} available tools${colors.reset}\n`);

    const results = {
      passed: [],
      failed: [],
      notFound: []
    };

    // Create a map of server tools for quick lookup
    const serverToolMap = new Map(serverTools.tools.map(t => [t.name, t]));

    // Group tools by category
    const byCategory = {};
    for (const test of TOOL_TESTS) {
      if (!byCategory[test.category]) {
        byCategory[test.category] = [];
      }
      byCategory[test.category].push(test);
    }

    let totalTested = 0;

    // Test each category
    for (const [category, tools] of Object.entries(byCategory)) {
      console.log(`${colors.blue}${colors.bright}📦 ${category} Tools (${tools.length})${colors.reset}`);
      console.log(`${'-'.repeat(60)}`);

      for (const tool of tools) {
        totalTested++;
        process.stdout.write(`  [${totalTested}/${TOOL_TESTS.length}] ${colors.yellow}${tool.name}${colors.reset}... `);

        // Check if tool exists on server
        if (!serverToolMap.has(tool.name)) {
          console.log(`${colors.red}❌ NOT FOUND${colors.reset}`);
          results.notFound.push(tool.name);
          continue;
        }

        try {
          const startTime = Date.now();
          const result = await client.callTool({
            name: tool.name,
            arguments: tool.args
          });
          const duration = Date.now() - startTime;

          if (result && result.content && result.content.length > 0) {
            console.log(`${colors.green}✅ OK${colors.reset} (${duration}ms)`);
            results.passed.push(tool.name);
          } else {
            console.log(`${colors.yellow}⚠️ EMPTY${colors.reset}`);
            results.failed.push({ name: tool.name, error: 'Empty response' });
          }
        } catch (error) {
          const shortError = error.message.substring(0, 40);
          console.log(`${colors.red}❌ ERROR${colors.reset} - ${shortError}`);
          results.failed.push({ name: tool.name, error: error.message });
        }

        // Small delay to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      console.log();
    }

    // Summary
    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}📊 FINAL TEST RESULTS${colors.reset}`);
    console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);

    const total = TOOL_TESTS.length;
    const passRate = ((results.passed.length / total) * 100).toFixed(1);

    console.log(`${colors.bright}Tools Tested: ${total}${colors.reset}`);
    console.log(`${colors.green}✅ Passed: ${results.passed.length} (${passRate}%)${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${results.failed.length}${colors.reset}`);
    console.log(`${colors.yellow}⚠️ Not Found: ${results.notFound.length}${colors.reset}`);

    // List failures
    if (results.failed.length > 0) {
      console.log(`\n${colors.red}Failed tools:${colors.reset}`);
      const uniqueErrors = {};
      results.failed.forEach(item => {
        const key = item.error.substring(0, 50);
        if (!uniqueErrors[key]) {
          uniqueErrors[key] = [];
        }
        uniqueErrors[key].push(item.name);
      });

      for (const [error, tools] of Object.entries(uniqueErrors)) {
        console.log(`  ${error}:`);
        tools.forEach(tool => console.log(`    - ${tool}`));
      }
    }

    // List not found
    if (results.notFound.length > 0) {
      console.log(`\n${colors.yellow}Tools not found on server:${colors.reset}`);
      results.notFound.forEach(name => console.log(`  - ${name}`));
    }

    // Overall status
    console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
    if (results.passed.length === total) {
      console.log(`${colors.green}${colors.bright}🎉 PERFECT! All 80 tools passed!${colors.reset}`);
    } else if (passRate >= 75) {
      console.log(`${colors.green}${colors.bright}✅ SUCCESS! ${passRate}% of tools working${colors.reset}`);
    } else if (passRate >= 50) {
      console.log(`${colors.yellow}${colors.bright}⚠️ PARTIAL SUCCESS - ${passRate}% working${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bright}❌ NEEDS ATTENTION - Only ${passRate}% working${colors.reset}`);
    }

  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    console.log(`\n${colors.cyan}Closing connection...${colors.reset}`);
    await client.close();
    console.log(`${colors.green}✅ Test complete${colors.reset}`);
  }
}

// Run tests
testAllTools().catch(console.error);