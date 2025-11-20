#!/usr/bin/env bun

/**
 * Debug get_account_transfers - Comprehensive Analysis
 */

import { spawn } from 'child_process';
import axios from 'axios';

const TEST_WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const BASE_URL = 'https://opensvm.com';

// Test scenarios
const debugTests = [
  // === Parameter Validation ===
  {
    category: 'Validation',
    name: 'Invalid address (too short)',
    args: { address: 'invalid' },
    expectError: true
  },
  {
    category: 'Validation',
    name: 'Invalid address (wrong chars)',
    args: { address: '000000000000000000000000000000000000000!' },
    expectError: true
  },
  {
    category: 'Validation',
    name: 'Invalid limit (negative)',
    args: { address: TEST_WALLET, limit: -1 },
    expectError: true
  },
  {
    category: 'Validation',
    name: 'Invalid limit (zero)',
    args: { address: TEST_WALLET, limit: 0 },
    expectError: true
  },
  {
    category: 'Validation',
    name: 'Invalid offset (negative)',
    args: { address: TEST_WALLET, offset: -1 },
    expectError: true
  },
  
  // === Edge Cases ===
  {
    category: 'Edge Cases',
    name: 'Minimal limit (1)',
    args: { address: TEST_WALLET, limit: 1 },
    expectError: false
  },
  {
    category: 'Edge Cases',
    name: 'Maximum limit (1000)',
    args: { address: TEST_WALLET, limit: 1000 },
    expectError: false
  },
  {
    category: 'Edge Cases',
    name: 'Exceeds maximum (1001)',
    args: { address: TEST_WALLET, limit: 1001 },
    expectError: false, // Should cap to 1000
    expectWarning: true
  },
  {
    category: 'Edge Cases',
    name: 'Large offset',
    args: { address: TEST_WALLET, limit: 10, offset: 100 },
    expectError: false
  },
  
  // === Transfer Type Filters ===
  {
    category: 'Filters',
    name: 'Transfer IN only',
    args: { address: TEST_WALLET, limit: 20, transferType: 'IN' },
    expectError: false
  },
  {
    category: 'Filters',
    name: 'Transfer OUT only',
    args: { address: TEST_WALLET, limit: 20, transferType: 'OUT' },
    expectError: false
  },
  {
    category: 'Filters',
    name: 'Transfer ALL',
    args: { address: TEST_WALLET, limit: 20, transferType: 'ALL' },
    expectError: false
  },
  {
    category: 'Filters',
    name: 'SOL only transfers',
    args: { address: TEST_WALLET, limit: 20, solanaOnly: true },
    expectError: false
  },
  {
    category: 'Filters',
    name: 'DeFi transactions',
    args: { address: TEST_WALLET, limit: 20, txType: 'defi' },
    expectError: false
  },
  {
    category: 'Filters',
    name: 'Multiple tx types',
    args: { address: TEST_WALLET, limit: 20, txType: 'sol,spl,defi' },
    expectError: false
  },
  
  // === Performance Tests ===
  {
    category: 'Performance',
    name: 'Default (no limit)',
    args: { address: TEST_WALLET },
    expectError: false
  },
  {
    category: 'Performance',
    name: 'Small batch (10)',
    args: { address: TEST_WALLET, limit: 10 },
    expectError: false
  },
  {
    category: 'Performance',
    name: 'Medium batch (50)',
    args: { address: TEST_WALLET, limit: 50 },
    expectError: false
  },
  {
    category: 'Performance',
    name: 'Large batch (200)',
    args: { address: TEST_WALLET, limit: 200 },
    expectError: false
  },
  
  // === Cache Behavior ===
  {
    category: 'Cache',
    name: 'With cache (default)',
    args: { address: TEST_WALLET, limit: 10 },
    expectError: false
  },
  {
    category: 'Cache',
    name: 'Bypass cache',
    args: { address: TEST_WALLET, limit: 10, bypassCache: true },
    expectError: false
  },
  
  // === Response Format Validation ===
  {
    category: 'Format',
    name: 'Check response structure',
    args: { address: TEST_WALLET, limit: 5 },
    expectError: false,
    validateResponse: true
  }
];

async function testMCP(scenario, testNum) {
  return new Promise((resolve) => {
    const server = spawn('./build/index.js', [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Initialize
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'debug', version: '1.0.0' }
      }
    };

    server.stdin.write(JSON.stringify(initRequest) + '\n');

    server.stdout.once('data', () => {
      // Server initialized, now test the tool
      const toolRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_account_transfers',
          arguments: scenario.args
        }
      };

      const startTime = Date.now();
      let responded = false;

      const timeout = setTimeout(() => {
        if (!responded) {
          responded = true;
          server.kill();
          resolve({
            success: false,
            error: 'timeout',
            time: 120000,
            stderr
          });
        }
      }, 120000);

      server.stdout.once('data', (data) => {
        if (responded) return;
        responded = true;
        clearTimeout(timeout);
        server.kill();

        const time = Date.now() - startTime;

        try {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (!line.trim() || !line.includes('"id"')) continue;
            const response = JSON.parse(line);
            if (response.id === 2) {
              // Check for MCP error
              if (response.error) {
                resolve({
                  success: scenario.expectError,
                  error: response.error.message,
                  errorCode: response.error.code,
                  time,
                  stderr,
                  isExpected: scenario.expectError
                });
                return;
              }

              // Check for tool error
              if (response.result?.isError) {
                const errorText = response.result.content?.[0]?.text || 'Unknown error';
                resolve({
                  success: scenario.expectError,
                  error: errorText.slice(0, 200),
                  time,
                  stderr,
                  isExpected: scenario.expectError
                });
                return;
              }

              // Success - validate response
              const resultText = response.result?.content?.[0]?.text || '{}';
              let parsedResult;
              try {
                parsedResult = JSON.parse(resultText);
              } catch (e) {
                resolve({
                  success: false,
                  error: `Invalid JSON response: ${e.message}`,
                  time,
                  stderr,
                  raw: resultText.slice(0, 200)
                });
                return;
              }

              // Validate response structure
              const validation = {
                hasData: Array.isArray(parsedResult.data) || Array.isArray(parsedResult),
                hasMore: 'hasMore' in parsedResult,
                hasTotal: 'total' in parsedResult,
                transferCount: Array.isArray(parsedResult.data) ? parsedResult.data.length : 
                               Array.isArray(parsedResult) ? parsedResult.length : 0,
                fromCache: parsedResult.fromCache,
                nextPageSignature: parsedResult.nextPageSignature
              };

              // Check if warning about limit capping occurred
              const hadWarning = stderr.includes('exceeds maximum') || stderr.includes('capping');

              resolve({
                success: !scenario.expectError,
                time,
                size: resultText.length,
                validation,
                stderr,
                hadWarning,
                isExpected: true,
                sampleData: parsedResult.data?.[0] || parsedResult[0]
              });
              return;
            }
          }
          resolve({
            success: false,
            error: 'no matching response',
            time,
            stderr
          });
        } catch (e) {
          resolve({
            success: false,
            error: e.message,
            time,
            stderr
          });
        }
      });

      server.stdin.write(JSON.stringify(toolRequest) + '\n');
    });
  });
}

async function runDebug() {
  console.log('🐛 Debug get_account_transfers\n');
  console.log(`Test Wallet: ${TEST_WALLET}`);
  console.log(`Total Tests: ${debugTests.length}\n`);

  const results = {
    total: debugTests.length,
    passed: 0,
    failed: 0,
    byCategory: {}
  };

  const failures = [];
  const warnings = [];
  let currentCategory = '';

  for (let i = 0; i < debugTests.length; i++) {
    const scenario = debugTests[i];

    if (scenario.category !== currentCategory) {
      currentCategory = scenario.category;
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📁 ${currentCategory}`);
      console.log('='.repeat(70));
    }

    if (!results.byCategory[scenario.category]) {
      results.byCategory[scenario.category] = {
        total: 0,
        passed: 0,
        failed: 0
      };
    }
    results.byCategory[scenario.category].total++;

    process.stdout.write(`[${i + 1}/${debugTests.length}] ${scenario.name.padEnd(35)} `);

    const result = await testMCP(scenario, i);

    if (result.success && result.isExpected) {
      results.passed++;
      results.byCategory[scenario.category].passed++;
      
      const timeStr = result.time < 1000 ? `${result.time}ms` : `${(result.time / 1000).toFixed(1)}s`;
      let extra = '';
      
      if (result.validation) {
        extra = ` (${result.validation.transferCount} transfers`;
        if (result.validation.fromCache) extra += ', cached';
        extra += ')';
      }
      
      console.log(`✓ ${timeStr}${extra}`);
      
      if (result.hadWarning && scenario.expectWarning) {
        warnings.push({
          scenario,
          warning: result.stderr
        });
      }
    } else {
      results.failed++;
      results.byCategory[scenario.category].failed++;
      
      if (result.isExpected) {
        console.log(`✓ Expected error: ${result.error?.slice(0, 40)}`);
      } else {
        console.log(`✗ ${result.error?.slice(0, 40)}`);
        failures.push({ scenario, result });
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 DEBUG SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tests:  ${results.total}`);
  console.log(`✓ Passed:     ${results.passed} (${(results.passed/results.total*100).toFixed(1)}%)`);
  console.log(`✗ Failed:     ${results.failed}`);

  console.log('\n' + '='.repeat(70));
  console.log('📁 BY CATEGORY');
  console.log('='.repeat(70));
  Object.entries(results.byCategory).forEach(([cat, stats]) => {
    console.log(`${cat.padEnd(20)} ${stats.passed}/${stats.total} (${(stats.passed/stats.total*100).toFixed(0)}%)`);
  });

  if (warnings.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  WARNINGS');
    console.log('='.repeat(70));
    warnings.forEach((w, idx) => {
      console.log(`\n[${idx + 1}] ${w.scenario.name}`);
      console.log(`    ${w.warning.slice(0, 150)}`);
    });
  }

  if (failures.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('❌ FAILURES');
    console.log('='.repeat(70));
    failures.forEach((f, idx) => {
      console.log(`\n[${idx + 1}] ${f.scenario.name}`);
      console.log(`    Args: ${JSON.stringify(f.scenario.args)}`);
      console.log(`    Error: ${f.result.error}`);
      if (f.result.stderr) {
        console.log(`    Stderr: ${f.result.stderr.slice(0, 200)}`);
      }
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log(results.failed === 0 ? '✅ ALL TESTS PASSED' : `⚠️  ${results.failed} TEST(S) FAILED`);
  console.log('='.repeat(70));

  process.exit(results.failed > 0 ? 1 : 0);
}

runDebug().catch(console.error);
