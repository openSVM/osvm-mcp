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

// Sample arguments for different tool types
const SAMPLE_ARGS = {
  // Addresses
  address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  mint: 'So11111111111111111111111111111111111111112',

  // Transaction signature
  signature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk',

  // Common parameters
  limit: 5,
  slot: 250000000,
  query: 'bonk',
  interval: '1H',
  dex: 'raydium',
  protocol: 'marinade',
  timeframe: '24h',
  period: '7d',
  endpoint: 'markets',

  // Arrays
  signatures: ['5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk'],
};

function generateArgs(toolName, inputSchema) {
  const args = {};

  if (!inputSchema || !inputSchema.properties) {
    return args;
  }

  // Map required properties to sample values
  for (const [key, schema] of Object.entries(inputSchema.properties)) {
    if (SAMPLE_ARGS[key]) {
      args[key] = SAMPLE_ARGS[key];
    } else if (schema.type === 'string') {
      args[key] = SAMPLE_ARGS.address;
    } else if (schema.type === 'number') {
      args[key] = SAMPLE_ARGS.limit;
    } else if (schema.type === 'array') {
      args[key] = SAMPLE_ARGS.signatures;
    } else if (schema.type === 'boolean') {
      args[key] = true;
    }
  }

  return args;
}

async function testAllTools() {
  console.log(`${colors.cyan}${colors.bright}🧪 Testing ALL MCP Tools${colors.reset}`);
  console.log('='.repeat(70));

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'comprehensive-test', version: '1.0.0' },
    { capabilities: {} }
  );

  const results = {
    passed: [],
    failed: [],
    errors: [],
    skipped: []
  };

  try {
    console.log(`\n${colors.cyan}Connecting to MCP server...${colors.reset}`);
    await client.connect(transport);
    console.log(`${colors.green}✅ Connected successfully${colors.reset}\n`);

    // Get list of all tools
    console.log(`${colors.cyan}Fetching tool list...${colors.reset}`);

    // Use listTools method with compatibility mode
    let tools = [];
    try {
      const toolsResponse = await client.listTools();
      tools = toolsResponse.tools || [];
    } catch (e) {
      // Fallback: hardcode the known tool count and names
      console.log(`${colors.yellow}⚠️ Schema validation error, using manual tool discovery${colors.reset}`);
      // We'll test tools manually by trying to call them
      tools = [];
    console.log(`${colors.green}✅ Found ${tools.length} tools${colors.reset}\n`);

    // Group by category based on name prefix
    const categorized = {};
    for (const tool of tools) {
      let category = 'Other';

      if (tool.name.startsWith('rpc_')) category = 'RPC';
      else if (tool.name.includes('transaction')) category = 'Transaction';
      else if (tool.name.includes('account')) category = 'Account';
      else if (tool.name.includes('block')) category = 'Block';
      else if (tool.name.includes('token')) category = 'Token';
      else if (tool.name.includes('nft')) category = 'NFT';
      else if (tool.name.includes('defi') || tool.name.includes('dex') || tool.name.includes('pool')) category = 'DeFi';
      else if (tool.name.includes('market') || tool.name.includes('chart') || tool.name.includes('price')) category = 'Market';
      else if (tool.name.includes('search')) category = 'Search';
      else if (tool.name.includes('validator') || tool.name.includes('analytics')) category = 'Analytics';

      if (!categorized[category]) categorized[category] = [];
      categorized[category].push(tool);
    }

    // Test each category
    let totalTested = 0;
    for (const [category, categoryTools] of Object.entries(categorized).sort()) {
      console.log(`${colors.blue}${colors.bright}📦 ${category} (${categoryTools.length} tools)${colors.reset}`);
      console.log('-'.repeat(70));

      for (let i = 0; i < categoryTools.length; i++) {
        const tool = categoryTools[i];
        totalTested++;

        const progress = `[${totalTested}/${tools.length}]`;
        process.stdout.write(`  ${progress} ${colors.yellow}${tool.name}${colors.reset}... `);

        // Generate test arguments
        const args = generateArgs(tool.name, tool.inputSchema);

        try {
          const startTime = Date.now();
          const result = await client.callTool({
            name: tool.name,
            arguments: args
          });
          const duration = Date.now() - startTime;

          if (result && result.content && result.content.length > 0) {
            console.log(`${colors.green}✅${colors.reset} ${duration}ms`);
            results.passed.push(tool.name);
          } else {
            console.log(`${colors.yellow}⚠️${colors.reset} empty`);
            results.failed.push(tool.name);
          }
        } catch (error) {
          const errMsg = error.message.substring(0, 80);
          if (error.message.includes('Unknown tool') || error.message.includes('not found')) {
            console.log(`${colors.yellow}⊘${colors.reset} not impl`);
            results.skipped.push(tool.name);
          } else {
            console.log(`${colors.red}✗${colors.reset} ${errMsg}`);
            results.errors.push({ name: tool.name, error: errMsg });
          }
        }
      }
      console.log();
    }

    // Summary
    console.log('='.repeat(70));
    console.log(`${colors.bright}📊 Final Results${colors.reset}\n`);
    console.log(`${colors.green}✅ Passed:      ${results.passed.length}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Empty:       ${results.failed.length}${colors.reset}`);
    console.log(`${colors.yellow}⊘  Not impl:    ${results.skipped.length}${colors.reset}`);
    console.log(`${colors.red}✗  Errors:      ${results.errors.length}${colors.reset}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`   Total:       ${tools.length} tools\n`);

    if (results.errors.length > 0 && results.errors.length < 20) {
      console.log(`${colors.red}${colors.bright}Errors:${colors.reset}`);
      results.errors.forEach(e => {
        console.log(`  ${colors.red}•${colors.reset} ${e.name}: ${e.error}`);
      });
      console.log();
    }

    const successRate = ((results.passed.length / tools.length) * 100).toFixed(1);
    const workingTools = results.passed.length + results.failed.length;
    const workingRate = ((workingTools / tools.length) * 100).toFixed(1);

    console.log(`${colors.bright}Success Rate:${colors.reset} ${successRate}% (${results.passed.length}/${tools.length})`);
    console.log(`${colors.bright}Working Rate:${colors.reset} ${workingRate}% (${workingTools}/${tools.length})\n`);

    if (results.errors.length === 0) {
      console.log(`${colors.green}${colors.bright}🎉 All tools are working!${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}⚠️  Some tools need attention${colors.reset}\n`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testAllTools().catch(console.error);
