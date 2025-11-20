#!/usr/bin/env bun

/**
 * Response Validation Test
 * Validates actual response data from each tool
 */

import { spawn } from 'child_process';

const TEST_WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const WRAPPED_SOL = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const RECENT_TX = '24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu';
const RECENT_SLOT = 250000000;

const validationTests = [
  {
    name: 'get_transaction',
    args: { signature: RECENT_TX },
    validate: (data) => {
      const checks = {
        hasSignature: !!data.signature,
        signatureMatches: data.signature === RECENT_TX,
        hasTimestamp: typeof data.timestamp === 'number' && data.timestamp > 0,
        hasSlot: typeof data.slot === 'number' && data.slot > 0,
        hasSuccess: typeof data.success === 'boolean',
        hasType: !!data.type,
        hasDetails: !!data.details,
        hasInstructions: Array.isArray(data.details?.instructions),
        hasAccounts: Array.isArray(data.details?.accounts),
      };
      return checks;
    }
  },
  {
    name: 'batch_transactions',
    args: { signatures: [RECENT_TX], includeDetails: true },
    validate: (data) => {
      const checks = {
        isArray: Array.isArray(data),
        hasElements: data.length > 0,
        firstHasSignature: !!data[0]?.signature,
        firstHasTimestamp: typeof data[0]?.timestamp === 'number',
        firstHasSlot: typeof data[0]?.slot === 'number',
      };
      return checks;
    }
  },
  {
    name: 'get_account_stats',
    args: { address: TEST_WALLET },
    validate: (data) => {
      const checks = {
        hasAddress: data.address === TEST_WALLET,
        hasBalance: typeof data.solBalance === 'number',
        hasTxCount: typeof data.totalTransactions === 'number',
        hasTokenCount: typeof data.tokenCount === 'number',
        hasFirstSeen: typeof data.firstSeenAt === 'number' || data.firstSeenAt === null,
        hasLastActive: typeof data.lastActiveAt === 'number' || data.lastActiveAt === null,
      };
      return checks;
    }
  },
  {
    name: 'get_account_portfolio',
    args: { address: TEST_WALLET },
    validate: (data) => {
      const checks = {
        hasTokens: Array.isArray(data.tokens) || !!data.data?.tokens,
        hasNative: !!data.native || !!data.data?.native,
        hasTotalValue: typeof data.totalValue === 'number' || typeof data.data?.totalValue === 'number',
      };
      return checks;
    }
  },
  {
    name: 'get_solana_balance',
    args: { address: TEST_WALLET },
    validate: (data) => {
      const checks = {
        hasAddress: data.address === TEST_WALLET,
        hasNative: !!data.native,
        hasBalance: typeof data.native?.balance === 'number' || typeof data.native?.lamports === 'number',
      };
      return checks;
    }
  },
  {
    name: 'get_account_transactions',
    args: { address: TEST_WALLET, limit: 5 },
    validate: (data) => {
      const checks = {
        isArray: Array.isArray(data) || Array.isArray(data.data),
        hasTransactions: (data.length || data.data?.length) > 0,
        firstHasSignature: !!(data[0]?.signature || data.data?.[0]?.signature),
        firstHasTimestamp: typeof (data[0]?.timestamp || data.data?.[0]?.timestamp) === 'number',
        limitRespected: (data.length || data.data?.length) <= 5,
      };
      return checks;
    }
  },
  {
    name: 'get_account_transfers',
    args: { address: TEST_WALLET, limit: 5 },
    validate: (data) => {
      const checks = {
        hasData: Array.isArray(data.data) || Array.isArray(data),
        transfers: data.data || data,
        hasTransfers: (data.data?.length || data.length || 0) > 0,
        limitRespected: (data.data?.length || data.length || 0) <= 5,
        firstHasFrom: !!(data.data?.[0]?.from || data[0]?.from),
        firstHasTo: !!(data.data?.[0]?.to || data[0]?.to),
        firstHasAmount: typeof (data.data?.[0]?.amount || data[0]?.amount) === 'number',
        hasTotal: typeof data.total === 'number' || data.total === undefined,
      };
      return checks;
    }
  },
  {
    name: 'get_account_token_stats',
    args: { address: TEST_WALLET, mint: USDC_MINT },
    validate: (data) => {
      const checks = {
        hasBalance: typeof data.balance === 'number' || typeof data.solBalance === 'number',
        hasTransferCount: typeof data.transferCount === 'number' || data.transferCount === undefined,
        isValidJSON: typeof data === 'object',
      };
      return checks;
    }
  },
  {
    name: 'get_block',
    args: { slot: RECENT_SLOT },
    validate: (data) => {
      const checks = {
        hasBlockHeight: typeof data.blockHeight === 'number',
        hasBlockTime: typeof data.blockTime === 'number',
        hasParentSlot: typeof data.parentSlot === 'number',
        hasTransactions: Array.isArray(data.transactions),
        hasRewards: Array.isArray(data.rewards) || data.rewards === undefined,
      };
      return checks;
    }
  },
  {
    name: 'get_block_stats',
    args: {},
    validate: (data) => {
      const checks = {
        hasSlot: typeof data.currentSlot === 'number' || typeof data.slot === 'number',
        hasTPS: typeof data.tps === 'number' || data.tps === undefined,
        hasEpoch: typeof data.epoch === 'number' || data.epoch === undefined,
        isValidJSON: typeof data === 'object',
      };
      return checks;
    }
  },
  {
    name: 'universal_search',
    args: { query: 'SOL' },
    validate: (data) => {
      const checks = {
        hasResults: Array.isArray(data.results) || Array.isArray(data),
        isValidJSON: typeof data === 'object' || Array.isArray(data),
      };
      return checks;
    }
  },
  {
    name: 'search_accounts',
    args: { query: WRAPPED_SOL },
    validate: (data) => {
      const checks = {
        hasData: !!data,
        isObject: typeof data === 'object',
        hasAddress: typeof data.address === 'string' || Array.isArray(data) || !!data.data,
      };
      return checks;
    }
  },
  {
    name: 'ai_inference_call',
    args: { question: 'What is Solana?', maxTokens: 100 },
    validate: (data) => {
      const checks = {
        hasAnswer: typeof data === 'string' || typeof data.answer === 'string',
        answerNotEmpty: (data.answer?.length || data.length || 0) > 0,
        withinTokenLimit: (data.answer?.length || data.length || 0) < 1000,
      };
      return checks;
    }
  },
  {
    name: 'get_defi_overview',
    args: {},
    validate: (data) => {
      const checks = {
        hasData: !!data,
        isObject: typeof data === 'object',
        hasTVL: typeof data.totalTVL === 'number' || data.totalTVL === undefined,
        hasProtocols: typeof data.protocols === 'number' || Array.isArray(data.protocols) || data.protocols === undefined,
      };
      return checks;
    }
  },
  {
    name: 'get_dex_analytics',
    args: { dex: 'raydium' },
    validate: (data) => {
      const checks = {
        hasData: !!data,
        isObject: typeof data === 'object',
        hasVolume: typeof data.volume === 'number' || typeof data.volume24h === 'number' || data.volume === undefined,
        hasTVL: typeof data.tvl === 'number' || data.tvl === undefined,
      };
      return checks;
    }
  },
  {
    name: 'get_defi_health',
    args: {},
    validate: (data) => {
      const checks = {
        hasData: !!data,
        isObject: typeof data === 'object',
        hasHealth: typeof data.health === 'string' || typeof data.health === 'number' || data.health === undefined,
        hasMetrics: typeof data.metrics === 'object' || data.metrics === undefined,
      };
      return checks;
    }
  },
  {
    name: 'get_market_data',
    args: { mint: WRAPPED_SOL, endpoint: 'markets' },
    validate: (data) => {
      const checks = {
        hasData: !!data,
        isObject: typeof data === 'object',
        hasPrice: typeof data.price === 'number' || typeof data.price === 'string' || data.price === undefined,
        hasVolume: typeof data.volume === 'number' || typeof data.volume24h === 'number' || data.volume === undefined,
      };
      return checks;
    }
  },
];

async function testAndValidate(server, test, id) {
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
        resolve({ 
          success: false, 
          error: 'timeout', 
          time: 120000,
          validation: null
        });
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
              resolve({ 
                success: false, 
                error: response.error.message, 
                time,
                validation: null
              });
              return;
            }
            
            if (response.result?.isError) {
              const errorText = response.result.content?.[0]?.text || 'Unknown error';
              resolve({ 
                success: false, 
                error: errorText.slice(0, 100), 
                time,
                validation: null
              });
              return;
            }
            
            // Parse and validate response
            const resultText = response.result?.content?.[0]?.text || '{}';
            let parsedData;
            try {
              parsedData = JSON.parse(resultText);
            } catch (e) {
              resolve({
                success: false,
                error: `Invalid JSON: ${e.message}`,
                time,
                validation: { parseError: true }
              });
              return;
            }
            
            // Run validation
            const validation = test.validate(parsedData);
            const allPassed = Object.values(validation).every(v => v === true);
            
            resolve({
              success: allPassed,
              time,
              size: resultText.length,
              validation,
              sampleData: JSON.stringify(parsedData).slice(0, 200)
            });
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

async function runValidation() {
  console.log('✅ Response Validation Test\n');
  console.log(`Total Tools: ${validationTests.length}\n`);

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
      clientInfo: { name: 'validation-test', version: '1.0.0' }
    }
  }) + '\n');

  await new Promise(resolve => {
    server.stdout.once('data', () => resolve());
  });

  console.log('✓ Server initialized\n');

  const results = {
    total: validationTests.length,
    passed: 0,
    failed: 0,
    validationIssues: []
  };

  for (let i = 0; i < validationTests.length; i++) {
    const test = validationTests[i];
    
    process.stdout.write(`[${i + 1}/${validationTests.length}] ${test.name.padEnd(35)} `);

    const result = await testAndValidate(server, test, i + 1);

    if (result.success && result.validation) {
      results.passed++;
      const timeStr = result.time < 1000 ? `${result.time}ms` : `${(result.time / 1000).toFixed(1)}s`;
      const passedChecks = Object.values(result.validation).filter(v => v === true).length;
      const totalChecks = Object.keys(result.validation).length;
      console.log(`✓ ${timeStr} (${passedChecks}/${totalChecks} checks)`);
    } else if (result.validation && !result.success) {
      results.failed++;
      const failedChecks = Object.entries(result.validation)
        .filter(([_, v]) => v === false)
        .map(([k, _]) => k);
      console.log(`⚠️  Failed: ${failedChecks.join(', ')}`);
      results.validationIssues.push({
        tool: test.name,
        failed: failedChecks,
        data: result.sampleData
      });
    } else {
      results.failed++;
      console.log(`✗ ${result.error?.slice(0, 40)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  server.kill();

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tools:  ${results.total}`);
  console.log(`✓ Valid:      ${results.passed} (${(results.passed/results.total*100).toFixed(1)}%)`);
  console.log(`✗ Invalid:    ${results.failed}`);

  if (results.validationIssues.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  VALIDATION ISSUES');
    console.log('='.repeat(70));
    results.validationIssues.forEach((issue, idx) => {
      console.log(`\n[${idx + 1}] ${issue.tool}`);
      console.log(`    Failed checks: ${issue.failed.join(', ')}`);
      console.log(`    Sample data: ${issue.data}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log(results.failed === 0 ? '✅ ALL RESPONSES VALID!' : `⚠️  ${results.failed} INVALID RESPONSE(S)`);
  console.log('='.repeat(70));

  process.exit(results.failed > 0 ? 1 : 0);
}

runValidation().catch(console.error);
