#!/usr/bin/env bun

/**
 * Comprehensive Latency Test - All 84 OpenSVM MCP Tools
 * Measures response times and performance across all tools
 */

import { spawn } from 'child_process';

const TEST_WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const WRAPPED_SOL = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const RAYDIUM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const RECENT_TX = '24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu';
const RECENT_SLOT = 250000000;

// All 84 tool tests organized by category
const toolTests = [
  // === TRANSACTION TOOLS (9 tools) ===
  { category: 'Transaction', name: 'get_transaction', args: { signature: RECENT_TX }},
  { category: 'Transaction', name: 'batch_transactions', args: { signatures: [RECENT_TX], includeDetails: true }},
  { category: 'Transaction', name: 'get_transaction_metadata', args: { signature: RECENT_TX }},
  { category: 'Transaction', name: 'analyze_transaction', args: { signature: RECENT_TX }},
  { category: 'Transaction', name: 'explain_transaction', args: { signature: RECENT_TX, detailLevel: 'medium' }},
  { category: 'Transaction', name: 'compare_transactions', args: { signatures: [RECENT_TX] }},
  { category: 'Transaction', name: 'get_transaction_events', args: { signature: RECENT_TX }},
  { category: 'Transaction', name: 'get_transaction_logs', args: { signature: RECENT_TX }},
  { category: 'Transaction', name: 'get_transaction_accounts', args: { signature: RECENT_TX }},

  // === ACCOUNT TOOLS (12 tools) ===
  { category: 'Account', name: 'get_account_stats', args: { address: TEST_WALLET }},
  { category: 'Account', name: 'get_account_portfolio', args: { address: TEST_WALLET }},
  { category: 'Account', name: 'get_solana_balance', args: { address: TEST_WALLET }},
  { category: 'Account', name: 'get_account_transactions', args: { address: TEST_WALLET, limit: 5 }},
  { category: 'Account', name: 'get_account_transfers', args: { address: TEST_WALLET, limit: 10 }},
  { category: 'Account', name: 'get_account_token_stats', args: { address: TEST_WALLET, mint: USDC_MINT }},
  { category: 'Account', name: 'check_account_type', args: { address: TEST_WALLET }},
  { category: 'Account', name: 'get_account_pnl', args: { address: TEST_WALLET }},
  { category: 'Account', name: 'get_account_activity', args: { address: TEST_WALLET, limit: 10 }},
  { category: 'Account', name: 'get_account_nfts', args: { address: TEST_WALLET }},
  { category: 'Account', name: 'get_account_stakes', args: { address: TEST_WALLET }},
  { category: 'Account', name: 'get_account_defi_positions', args: { address: TEST_WALLET }},

  // === BLOCK TOOLS (6 tools) ===
  { category: 'Block', name: 'get_block', args: { slot: RECENT_SLOT }},
  { category: 'Block', name: 'get_recent_blocks', args: { limit: 3 }},
  { category: 'Block', name: 'get_block_stats', args: {}},
  { category: 'Block', name: 'get_block_transactions', args: { slot: RECENT_SLOT, limit: 5 }},
  { category: 'Block', name: 'get_block_rewards', args: { slot: RECENT_SLOT }},
  { category: 'Block', name: 'get_block_production', args: {}},

  // === SEARCH TOOLS (8 tools) ===
  { category: 'Search', name: 'universal_search', args: { query: 'SOL' }},
  { category: 'Search', name: 'search_accounts', args: { query: WRAPPED_SOL }},
  { category: 'Search', name: 'search_transactions', args: { query: 'swap', limit: 5 }},
  { category: 'Search', name: 'search_tokens', args: { query: 'USDC' }},
  { category: 'Search', name: 'search_programs', args: { query: 'raydium' }},
  { category: 'Search', name: 'search_nfts', args: { query: 'degods' }},
  { category: 'Search', name: 'search_defi', args: { query: 'liquidity' }},
  { category: 'Search', name: 'advanced_search', args: { query: 'SOL', filters: {} }},

  // === TOKEN TOOLS (10 tools) ===
  { category: 'Token', name: 'get_token_info', args: { mint: WRAPPED_SOL }},
  { category: 'Token', name: 'get_token_holders', args: { mint: USDC_MINT, limit: 10 }},
  { category: 'Token', name: 'get_token_supply', args: { mint: WRAPPED_SOL }},
  { category: 'Token', name: 'get_token_metadata', args: { mint: WRAPPED_SOL }},
  { category: 'Token', name: 'get_token_price', args: { mint: WRAPPED_SOL }},
  { category: 'Token', name: 'get_token_volume', args: { mint: WRAPPED_SOL }},
  { category: 'Token', name: 'get_token_stats', args: { mint: WRAPPED_SOL }},
  { category: 'Token', name: 'get_token_transfers', args: { mint: USDC_MINT, limit: 10 }},
  { category: 'Token', name: 'get_token_top_traders', args: { mint: WRAPPED_SOL, limit: 5 }},
  { category: 'Token', name: 'analyze_token', args: { mint: WRAPPED_SOL }},

  // === DEFI TOOLS (15 tools) ===
  { category: 'DeFi', name: 'get_defi_overview', args: {}},
  { category: 'DeFi', name: 'get_dex_analytics', args: { dex: 'raydium' }},
  { category: 'DeFi', name: 'get_defi_health', args: {}},
  { category: 'DeFi', name: 'get_liquidity_pools', args: { limit: 10 }},
  { category: 'DeFi', name: 'get_pool_info', args: { poolAddress: RAYDIUM_V4 }},
  { category: 'DeFi', name: 'get_swap_routes', args: { from: WRAPPED_SOL, to: USDC_MINT }},
  { category: 'DeFi', name: 'get_lending_stats', args: {}},
  { category: 'DeFi', name: 'get_staking_stats', args: {}},
  { category: 'DeFi', name: 'get_farm_info', args: { limit: 5 }},
  { category: 'DeFi', name: 'get_vault_stats', args: {}},
  { category: 'DeFi', name: 'get_protocol_tvl', args: { protocol: 'raydium' }},
  { category: 'DeFi', name: 'get_yield_opportunities', args: { minApy: 5 }},
  { category: 'DeFi', name: 'analyze_defi_position', args: { address: TEST_WALLET }},
  { category: 'DeFi', name: 'get_defi_risks', args: { protocol: 'raydium' }},
  { category: 'DeFi', name: 'get_impermanent_loss', args: { poolAddress: RAYDIUM_V4 }},

  // === MARKET TOOLS (8 tools) ===
  { category: 'Market', name: 'get_market_data', args: { mint: WRAPPED_SOL, endpoint: 'markets' }},
  { category: 'Market', name: 'get_price_history', args: { mint: WRAPPED_SOL, interval: '1h' }},
  { category: 'Market', name: 'get_trading_volume', args: { mint: WRAPPED_SOL }},
  { category: 'Market', name: 'get_market_depth', args: { mint: WRAPPED_SOL }},
  { category: 'Market', name: 'get_order_book', args: { mint: WRAPPED_SOL }},
  { category: 'Market', name: 'get_recent_trades', args: { mint: WRAPPED_SOL, limit: 10 }},
  { category: 'Market', name: 'get_market_stats', args: {}},
  { category: 'Market', name: 'get_trending_tokens', args: { limit: 10 }},

  // === NFT TOOLS (7 tools) ===
  { category: 'NFT', name: 'get_nft_info', args: { mint: WRAPPED_SOL }},
  { category: 'NFT', name: 'get_nft_metadata', args: { mint: WRAPPED_SOL }},
  { category: 'NFT', name: 'get_nft_sales', args: { collection: 'degods', limit: 5 }},
  { category: 'NFT', name: 'get_nft_floor_price', args: { collection: 'degods' }},
  { category: 'NFT', name: 'get_collection_stats', args: { collection: 'degods' }},
  { category: 'NFT', name: 'get_nft_holders', args: { collection: 'degods', limit: 10 }},
  { category: 'NFT', name: 'analyze_nft', args: { mint: WRAPPED_SOL }},

  // === VALIDATOR TOOLS (5 tools) ===
  { category: 'Validator', name: 'get_validator_analytics', args: { limit: 5 }},
  { category: 'Validator', name: 'get_validator_info', args: { voteAccount: TEST_WALLET }},
  { category: 'Validator', name: 'get_validator_performance', args: { voteAccount: TEST_WALLET }},
  { category: 'Validator', name: 'get_validator_rewards', args: { voteAccount: TEST_WALLET }},
  { category: 'Validator', name: 'get_epoch_info', args: {}},

  // === AI TOOLS (2 tools) ===
  { category: 'AI', name: 'ai_inference_call', args: { question: 'What is Solana?', maxTokens: 100 }},
  { category: 'AI', name: 'ai_analyze_wallet', args: { address: TEST_WALLET, analysisType: 'summary' }},

  // === WALLET MAPPING TOOLS (2 tools) ===
  { category: 'Wallet Mapping', name: 'find_related_transactions', args: { signatures: [RECENT_TX] }},
  { category: 'Wallet Mapping', name: 'holders_by_interaction', args: { program: RAYDIUM_V4, limit: 10 }},
];

async function testTool(server, test, id) {
  return new Promise((resolve) => {
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: test.name, arguments: test.args }
    };

    let responded = false;
    const timeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        resolve({ success: false, error: 'timeout', time: 120000, category: test.category });
      }
    }, 120000);

    const startTime = Date.now();
    let chunks = [];

    const dataHandler = (data) => {
      if (responded) return;
      
      chunks.push(data);
      const fullData = Buffer.concat(chunks).toString();
      const lines = fullData.split('\n');
      
      for (const line of lines) {
        if (!line.trim() || !line.includes('"id"')) continue;
        try {
          const response = JSON.parse(line);
          if (response.id === id) {
            responded = true;
            clearTimeout(timeout);
            server.stdout.removeListener('data', dataHandler);
            
            const time = Date.now() - startTime;
            
            if (response.error) {
              resolve({ success: false, error: response.error.message, time, category: test.category });
            } else if (response.result?.isError) {
              const errorText = response.result.content?.[0]?.text || 'Unknown error';
              resolve({ success: false, error: errorText.slice(0, 100), time, category: test.category });
            } else {
              const resultText = response.result?.content?.[0]?.text || '{}';
              resolve({ 
                success: true, 
                time, 
                size: resultText.length,
                category: test.category
              });
            }
            return;
          }
        } catch (e) {
          // Not complete JSON yet, keep waiting
        }
      }
    };

    server.stdout.on('data', dataHandler);
    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

async function runTests() {
  console.log('⚡ Latency Test - All 84 OpenSVM MCP Tools\n');

  const server = spawn('./build/index.js', [], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  // Initialize
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'latency-test', version: '1.0.0' }
    }
  }) + '\n');

  await new Promise(resolve => {
    server.stdout.once('data', () => resolve());
  });

  console.log('✓ Server initialized\n');

  const results = {
    total: toolTests.length,
    passed: 0,
    failed: 0,
    timeout: 0,
    totalTime: 0,
    latencies: [],
    byCategory: {}
  };

  const failures = [];
  let currentCategory = '';

  for (let i = 0; i < toolTests.length; i++) {
    const test = toolTests[i];
    
    if (test.category !== currentCategory) {
      currentCategory = test.category;
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📁 ${currentCategory}`);
      console.log('='.repeat(70));
    }

    if (!results.byCategory[test.category]) {
      results.byCategory[test.category] = {
        total: 0,
        passed: 0,
        failed: 0,
        totalTime: 0,
        latencies: []
      };
    }

    process.stdout.write(`[${i + 1}/${toolTests.length}] ${test.name.padEnd(40)} `);

    const result = await testTool(server, test, i + 1);
    
    results.totalTime += result.time;
    results.byCategory[test.category].total++;
    results.byCategory[test.category].totalTime += result.time;

    if (result.success) {
      results.passed++;
      results.byCategory[test.category].passed++;
      results.latencies.push(result.time);
      results.byCategory[test.category].latencies.push(result.time);
      
      const timeStr = result.time < 1000 ? `${result.time}ms` : `${(result.time / 1000).toFixed(1)}s`;
      const sizeStr = result.size ? ` (${(result.size / 1024).toFixed(1)}KB)` : '';
      console.log(`✓ ${timeStr}${sizeStr}`);
    } else {
      if (result.error === 'timeout') {
        results.timeout++;
        console.log(`⏱  TIMEOUT`);
      } else {
        results.failed++;
        console.log(`✗ ${result.error.slice(0, 40)}`);
      }
      results.byCategory[test.category].failed++;
      failures.push({ test, result });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  server.kill();

  // Calculate statistics
  results.latencies.sort((a, b) => a - b);
  const p50 = results.latencies[Math.floor(results.latencies.length * 0.5)] || 0;
  const p95 = results.latencies[Math.floor(results.latencies.length * 0.95)] || 0;
  const p99 = results.latencies[Math.floor(results.latencies.length * 0.99)] || 0;
  const avg = results.passed > 0 ? results.totalTime / results.passed : 0;

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tools:      ${results.total}`);
  console.log(`✓ Passed:         ${results.passed} (${(results.passed/results.total*100).toFixed(1)}%)`);
  console.log(`✗ Failed:         ${results.failed}`);
  console.log(`⏱  Timeout:        ${results.timeout}`);
  console.log('');
  console.log('Latency Statistics:');
  console.log(`  Min:            ${results.latencies[0] || 0}ms`);
  console.log(`  Average:        ${Math.round(avg)}ms`);
  console.log(`  p50 (median):   ${Math.round(p50)}ms`);
  console.log(`  p95:            ${Math.round(p95)}ms`);
  console.log(`  p99:            ${Math.round(p99)}ms`);
  console.log(`  Max:            ${results.latencies[results.latencies.length - 1] || 0}ms`);
  console.log(`  Total Time:     ${(results.totalTime / 1000).toFixed(1)}s`);

  // Category breakdown
  console.log('\n' + '='.repeat(70));
  console.log('📁 BY CATEGORY (sorted by avg latency)');
  console.log('='.repeat(70));
  
  const categoryStats = Object.entries(results.byCategory)
    .map(([category, stats]) => {
      const avgLatency = stats.passed > 0 ? stats.totalTime / stats.passed : 0;
      const passRate = (stats.passed / stats.total * 100).toFixed(0);
      return { category, stats, avgLatency, passRate };
    })
    .sort((a, b) => a.avgLatency - b.avgLatency);

  categoryStats.forEach(({ category, stats, avgLatency, passRate }) => {
    const latencyStr = avgLatency < 1000 ? `${Math.round(avgLatency)}ms` : `${(avgLatency / 1000).toFixed(1)}s`;
    console.log(`${category.padEnd(20)} ${stats.passed}/${stats.total} (${passRate}%) - avg ${latencyStr}`);
  });

  // Speed tiers
  console.log('\n' + '='.repeat(70));
  console.log('⚡ SPEED TIERS');
  console.log('='.repeat(70));
  
  const ultraFast = results.latencies.filter(l => l < 500).length;
  const fast = results.latencies.filter(l => l >= 500 && l < 2000).length;
  const medium = results.latencies.filter(l => l >= 2000 && l < 10000).length;
  const slow = results.latencies.filter(l => l >= 10000).length;
  
  console.log(`⚡⚡⚡ Ultra Fast (< 500ms):    ${ultraFast} tools (${(ultraFast/results.passed*100).toFixed(1)}%)`);
  console.log(`⚡⚡  Fast (500ms - 2s):        ${fast} tools (${(fast/results.passed*100).toFixed(1)}%)`);
  console.log(`⚡   Medium (2s - 10s):        ${medium} tools (${(medium/results.passed*100).toFixed(1)}%)`);
  console.log(`🐌   Slow (> 10s):            ${slow} tools (${(slow/results.passed*100).toFixed(1)}%)`);

  if (failures.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('❌ FAILURES');
    console.log('='.repeat(70));
    failures.forEach((f, idx) => {
      console.log(`\n[${idx + 1}] ${f.test.category} - ${f.test.name}`);
      console.log(`    Error: ${f.result.error.slice(0, 100)}`);
      console.log(`    Time: ${f.result.time}ms`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log(results.failed === 0 && results.timeout === 0 ? '✅ ALL TESTS PASSED!' : `⚠️  ${results.failed + results.timeout} TEST(S) FAILED`);
  console.log('='.repeat(70));

  process.exit(results.failed > 0 || results.timeout > 0 ? 1 : 0);
}

runTests().catch(console.error);
