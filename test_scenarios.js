#!/usr/bin/env bun

/**
 * Comprehensive Scenario Testing for OpenSVM MCP Server
 * Tests real-world use cases and edge cases
 */

import { spawn } from 'child_process';

// Test wallets and addresses
const ADDRESSES = {
  whale: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck', // Large holder
  normal: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Regular wallet
  jupiter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter program
  raydium: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium V4
};

const TOKENS = {
  sol: 'So11111111111111111111111111111111111111112',
  usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  bonk: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  jup: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

const TRANSACTIONS = {
  recent: '24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu',
  swap: '5KtPn4fH7yv4w8qJfJmJ5h3p1mF7x9H8K2L3cT4wR5zQ9vY6sB3nX2', // Example
};

// Scenario test cases
const scenarios = [
  // === Wallet Analysis Scenarios ===
  {
    category: 'Wallet Analysis',
    name: 'Whale wallet overview',
    tool: 'get_account_stats',
    args: { address: ADDRESSES.whale },
    expectation: 'Should show large holdings and activity'
  },
  {
    category: 'Wallet Analysis',
    name: 'Whale portfolio breakdown',
    tool: 'get_account_portfolio',
    args: { address: ADDRESSES.whale },
    expectation: 'Should list multiple token holdings'
  },
  {
    category: 'Wallet Analysis',
    name: 'SOL balance check',
    tool: 'get_solana_balance',
    args: { address: ADDRESSES.whale },
    expectation: 'Should return SOL balance'
  },
  {
    category: 'Wallet Analysis',
    name: 'Recent wallet activity',
    tool: 'get_account_transactions',
    args: { address: ADDRESSES.whale, limit: 10 },
    expectation: 'Should return last 10 transactions'
  },
  {
    category: 'Wallet Analysis',
    name: 'Token transfer history',
    tool: 'get_account_transfers',
    args: { address: ADDRESSES.whale, limit: 20 },
    expectation: 'Should return transfer history'
  },

  // === Token-Specific Scenarios ===
  {
    category: 'Token Analysis',
    name: 'USDC holdings for wallet',
    tool: 'get_account_token_stats',
    args: { address: ADDRESSES.whale, mint: TOKENS.usdc },
    expectation: 'Should show USDC balance and stats'
  },
  {
    category: 'Token Analysis',
    name: 'BONK token stats',
    tool: 'get_account_token_stats',
    args: { address: ADDRESSES.whale, mint: TOKENS.bonk },
    expectation: 'Should show BONK holdings'
  },
  {
    category: 'Token Analysis',
    name: 'SOL market data',
    tool: 'get_market_data',
    args: { mint: TOKENS.sol, endpoint: 'markets' },
    expectation: 'Should return SOL price and volume'
  },
  {
    category: 'Token Analysis',
    name: 'USDC market data',
    tool: 'get_market_data',
    args: { mint: TOKENS.usdc, endpoint: 'markets' },
    expectation: 'Should return USDC market info'
  },

  // === Transaction Analysis ===
  {
    category: 'Transaction Analysis',
    name: 'Recent transaction details',
    tool: 'get_transaction',
    args: { signature: TRANSACTIONS.recent },
    expectation: 'Should return full transaction data'
  },
  {
    category: 'Transaction Analysis',
    name: 'Batch transaction lookup',
    tool: 'batch_transactions',
    args: { 
      signatures: [TRANSACTIONS.recent],
      includeDetails: true 
    },
    expectation: 'Should return transaction array'
  },

  // === Blockchain Data ===
  {
    category: 'Blockchain Data',
    name: 'Recent block data',
    tool: 'get_block',
    args: { slot: 250000000 },
    expectation: 'Should return block information'
  },
  {
    category: 'Blockchain Data',
    name: 'Network statistics',
    tool: 'get_block_stats',
    args: {},
    expectation: 'Should return network metrics'
  },

  // === Search Scenarios ===
  {
    category: 'Search',
    name: 'Universal search - SOL',
    tool: 'universal_search',
    args: { query: 'SOL' },
    expectation: 'Should find SOL token'
  },
  {
    category: 'Search',
    name: 'Universal search - Jupiter',
    tool: 'universal_search',
    args: { query: 'Jupiter' },
    expectation: 'Should find Jupiter protocol'
  },
  {
    category: 'Search',
    name: 'Search accounts by address',
    tool: 'search_accounts',
    args: { query: ADDRESSES.whale },
    expectation: 'Should find whale wallet'
  },
  {
    category: 'Search',
    name: 'Search by token mint',
    tool: 'search_accounts',
    args: { query: TOKENS.usdc, tokenMint: TOKENS.usdc },
    expectation: 'Should find USDC holders'
  },

  // === DeFi Ecosystem ===
  {
    category: 'DeFi Analytics',
    name: 'Overall DeFi overview',
    tool: 'get_defi_overview',
    args: {},
    expectation: 'Should return DeFi ecosystem stats'
  },
  {
    category: 'DeFi Analytics',
    name: 'Raydium DEX analytics',
    tool: 'get_dex_analytics',
    args: { dex: 'raydium' },
    expectation: 'Should return Raydium metrics'
  },
  {
    category: 'DeFi Analytics',
    name: 'Orca DEX analytics',
    tool: 'get_dex_analytics',
    args: { dex: 'orca' },
    expectation: 'Should return Orca metrics'
  },
  {
    category: 'DeFi Analytics',
    name: 'DeFi health metrics',
    tool: 'get_defi_health',
    args: {},
    expectation: 'Should return protocol health'
  },

  // === AI Inference Scenarios ===
  {
    category: 'AI Analysis',
    name: 'Explain blockchain concept',
    tool: 'ai_inference_call',
    args: { 
      question: 'What is a liquidity pool?',
      maxTokens: 150
    },
    expectation: 'Should explain liquidity pools'
  },
  {
    category: 'AI Analysis',
    name: 'Technical analysis',
    tool: 'ai_inference_call',
    args: { 
      question: 'How does Solana achieve high TPS?',
      maxTokens: 200
    },
    expectation: 'Should explain Solana performance'
  },
  {
    category: 'AI Analysis',
    name: 'DeFi comparison',
    tool: 'ai_inference_call',
    args: { 
      question: 'Compare Raydium and Orca DEXes',
      maxTokens: 200
    },
    expectation: 'Should compare two DEXes'
  },

  // === Edge Cases ===
  {
    category: 'Edge Cases',
    name: 'Very old block',
    tool: 'get_block',
    args: { slot: 100000000 },
    expectation: 'Should return historical block data'
  },
  {
    category: 'Edge Cases',
    name: 'Small transaction limit',
    tool: 'get_account_transactions',
    args: { address: ADDRESSES.whale, limit: 1 },
    expectation: 'Should return exactly 1 transaction'
  },
  {
    category: 'Edge Cases',
    name: 'Large transaction limit',
    tool: 'get_account_transactions',
    args: { address: ADDRESSES.whale, limit: 100 },
    expectation: 'Should return up to 100 transactions'
  },
  {
    category: 'Edge Cases',
    name: 'Minimal AI tokens',
    tool: 'ai_inference_call',
    args: { 
      question: 'What is Solana?',
      maxTokens: 50
    },
    expectation: 'Should give short answer'
  },
  {
    category: 'Edge Cases',
    name: 'Maximum AI tokens',
    tool: 'ai_inference_call',
    args: { 
      question: 'Explain Solana architecture in detail',
      maxTokens: 500
    },
    expectation: 'Should give detailed answer'
  },
];

// Test execution
async function testScenario(server, scenario, testNum, total) {
  return new Promise((resolve) => {
    const request = {
      jsonrpc: '2.0',
      id: testNum + 1,
      method: 'tools/call',
      params: { name: scenario.tool, arguments: scenario.args }
    };

    let responded = false;
    const timeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        resolve({ 
          success: false, 
          error: 'timeout (>120s)', 
          time: 120000,
          scenario 
        });
      }
    }, 120000);

    const startTime = Date.now();

    server.stdout.once('data', (data) => {
      if (responded) return;
      responded = true;
      clearTimeout(timeout);

      const time = Date.now() - startTime;
      try {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (!line.trim() || !line.includes('"id"')) continue;
          const response = JSON.parse(line);
          if (response.id === testNum + 1) {
            if (response.error) {
              resolve({ 
                success: false, 
                error: response.error.message, 
                time,
                scenario 
              });
            } else if (response.result?.isError) {
              const errorText = response.result.content?.[0]?.text || 'Unknown error';
              resolve({ 
                success: false, 
                error: errorText.slice(0, 100), 
                time,
                scenario 
              });
            } else {
              const resultText = response.result?.content?.[0]?.text || '';
              resolve({ 
                success: true, 
                time,
                size: resultText.length,
                scenario 
              });
            }
            return;
          }
        }
        resolve({ 
          success: false, 
          error: 'no matching response', 
          time,
          scenario 
        });
      } catch (e) {
        resolve({ 
          success: false, 
          error: e.message, 
          time,
          scenario 
        });
      }
    });

    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

async function runScenarios() {
  console.log('🧪 OpenSVM MCP - Comprehensive Scenario Testing\n');
  console.log(`Total Scenarios: ${scenarios.length}\n`);

  const server = spawn('./build/index.js', [], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  // Initialize
  const initRequest = {
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'scenario-test', version: '1.0.0' }
    }
  };

  server.stdin.write(JSON.stringify(initRequest) + '\n');

  await new Promise(resolve => {
    server.stdout.once('data', () => resolve());
  });

  console.log('✓ Server initialized\n');

  const results = {
    total: scenarios.length,
    passed: 0,
    failed: 0,
    timeout: 0,
    totalTime: 0,
    byCategory: {}
  };

  const failures = [];
  let currentCategory = '';

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    
    // Print category header
    if (scenario.category !== currentCategory) {
      currentCategory = scenario.category;
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📁 ${currentCategory}`);
      console.log('='.repeat(70));
    }

    // Initialize category stats
    if (!results.byCategory[scenario.category]) {
      results.byCategory[scenario.category] = {
        total: 0,
        passed: 0,
        failed: 0,
        totalTime: 0
      };
    }

    process.stdout.write(`[${i + 1}/${scenarios.length}] ${scenario.name.padEnd(35)} `);

    const result = await testScenario(server, scenario, i, scenarios.length);
    
    results.totalTime += result.time;
    results.byCategory[scenario.category].total++;
    results.byCategory[scenario.category].totalTime += result.time;

    if (result.success) {
      results.passed++;
      results.byCategory[scenario.category].passed++;
      const timeStr = result.time < 1000 ? `${result.time}ms` : `${(result.time / 1000).toFixed(1)}s`;
      const sizeStr = result.size ? ` (${(result.size / 1024).toFixed(1)}KB)` : '';
      console.log(`✓ ${timeStr}${sizeStr}`);
    } else {
      if (result.error === 'timeout (>120s)') {
        results.timeout++;
        console.log(`⏱  TIMEOUT`);
      } else {
        results.failed++;
        console.log(`✗ ${result.error.slice(0, 40)}`);
      }
      results.byCategory[scenario.category].failed++;
      failures.push(result);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  server.kill();

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Scenarios: ${results.total}`);
  console.log(`✓ Passed:        ${results.passed} (${(results.passed/results.total*100).toFixed(1)}%)`);
  console.log(`✗ Failed:        ${results.failed}`);
  console.log(`⏱  Timeout:       ${results.timeout}`);
  console.log(`Avg Response:    ${Math.round(results.totalTime/results.total)}ms`);
  console.log(`Total Time:      ${(results.totalTime/1000).toFixed(1)}s`);

  // Category breakdown
  console.log('\n' + '='.repeat(70));
  console.log('📁 BY CATEGORY');
  console.log('='.repeat(70));
  
  Object.entries(results.byCategory).forEach(([category, stats]) => {
    const passRate = (stats.passed / stats.total * 100).toFixed(0);
    const avgTime = Math.round(stats.totalTime / stats.total);
    console.log(`${category.padEnd(25)} ${stats.passed}/${stats.total} (${passRate}%) - avg ${avgTime}ms`);
  });

  if (failures.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('❌ FAILURES');
    console.log('='.repeat(70));
    failures.forEach((f, idx) => {
      console.log(`\n[${idx + 1}] ${f.scenario.category} - ${f.scenario.name}`);
      console.log(`    Tool: ${f.scenario.tool}`);
      console.log(`    Error: ${f.error.slice(0, 100)}`);
      console.log(`    Time: ${f.time}ms`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log(results.failed === 0 && results.timeout === 0 ? '✅ ALL SCENARIOS PASSED!' : `⚠️  ${results.failed + results.timeout} SCENARIO(S) FAILED`);
  console.log('='.repeat(70));

  process.exit(results.failed > 0 || results.timeout > 0 ? 1 : 0);
}

runScenarios().catch(console.error);
