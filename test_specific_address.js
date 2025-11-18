#!/usr/bin/env node

/**
 * Latency test for specific address: REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck
 */

import axios from 'axios';

const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;
const TEST_ADDRESS = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

function formatLatency(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

async function testAccountTransfers(params = {}) {
  const startTime = Date.now();

  try {
    const response = await axios.get(`${BASE_URL}/api/account-transfers`, {
      params: {
        address: TEST_ADDRESS,
        ...params
      },
      headers: {
        'Content-Type': 'application/json',
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
      },
      timeout: 60000
    });

    const latency = Date.now() - startTime;
    const transferCount = Array.isArray(response.data) ? response.data.length :
                         response.data?.transfers?.length || 0;

    return {
      success: true,
      latency,
      transferCount,
      dataSize: JSON.stringify(response.data).length,
      data: response.data
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      latency,
      error: error.response?.data || error.message,
      statusCode: error.response?.status,
      transferCount: 0,
      dataSize: 0
    };
  }
}

async function runTests() {
  console.log('🚀 Account Transfers Latency Test - Specific Address\n');
  console.log(`Address: ${TEST_ADDRESS}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Authentication: ${JWT_TOKEN ? 'Enabled' : 'Disabled'}\n`);

  const testScenarios = [
    {
      name: 'Default parameters',
      params: {},
      iterations: 10
    },
    {
      name: 'Limit: 10',
      params: { limit: 10 },
      iterations: 5
    },
    {
      name: 'Limit: 50',
      params: { limit: 50 },
      iterations: 5
    },
    {
      name: 'Limit: 100',
      params: { limit: 100 },
      iterations: 5
    },
    {
      name: 'Limit: 200',
      params: { limit: 200 },
      iterations: 5
    },
    {
      name: 'Type: token only',
      params: { type: 'token', limit: 100 },
      iterations: 3
    },
    {
      name: 'Type: sol only',
      params: { type: 'sol', limit: 100 },
      iterations: 3
    },
    {
      name: 'With pagination (offset: 50)',
      params: { limit: 50, offset: 50 },
      iterations: 3
    }
  ];

  let firstResponse = null;

  for (const scenario of testScenarios) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Scenario: ${scenario.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Parameters: ${JSON.stringify(scenario.params)}`);
    console.log(`Iterations: ${scenario.iterations}\n`);

    const results = [];

    for (let i = 0; i < scenario.iterations; i++) {
      process.stdout.write(`  Request ${i + 1}/${scenario.iterations}... `);

      const result = await testAccountTransfers(scenario.params);
      results.push(result);

      if (result.success) {
        console.log(`✓ ${formatLatency(result.latency)} (${result.transferCount} transfers, ${(result.dataSize / 1024).toFixed(1)}KB)`);

        // Store first successful response for data inspection
        if (!firstResponse && result.data) {
          firstResponse = result.data;
        }
      } else {
        console.log(`✗ ${formatLatency(result.latency)} (Error: ${result.statusCode || result.error})`);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Calculate statistics
    const successResults = results.filter(r => r.success);

    if (successResults.length > 0) {
      const latencies = successResults.map(r => r.latency);
      const transferCounts = successResults.map(r => r.transferCount);
      const dataSizes = successResults.map(r => r.dataSize);

      const latencyStats = getStats(latencies);
      const avgTransfers = transferCounts.reduce((a, b) => a + b, 0) / transferCounts.length;
      const avgDataSize = dataSizes.reduce((a, b) => a + b, 0) / dataSizes.length;

      console.log('\n📈 Statistics:');
      console.log(`  Success Rate: ${successResults.length}/${scenario.iterations} (${(successResults.length / scenario.iterations * 100).toFixed(1)}%)`);
      console.log(`  Latency:`);
      console.log(`    Min:    ${formatLatency(latencyStats.min)}`);
      console.log(`    Avg:    ${formatLatency(latencyStats.avg)}`);
      console.log(`    Median: ${formatLatency(latencyStats.median)}`);
      console.log(`    p95:    ${formatLatency(latencyStats.p95)}`);
      console.log(`    p99:    ${formatLatency(latencyStats.p99)}`);
      console.log(`    Max:    ${formatLatency(latencyStats.max)}`);
      console.log(`  Avg Transfers: ${avgTransfers.toFixed(0)}`);
      console.log(`  Avg Data Size: ${(avgDataSize / 1024).toFixed(1)}KB`);

      // Show transfer count range if there's variation
      const minTransfers = Math.min(...transferCounts);
      const maxTransfers = Math.max(...transferCounts);
      if (minTransfers !== maxTransfers) {
        console.log(`  Transfer Count Range: ${minTransfers}-${maxTransfers}`);
      }
    } else {
      console.log('\n❌ All requests failed');
      const errors = results.map(r => r.error);
      const statusCodes = results.map(r => r.statusCode).filter(Boolean);
      console.log(`  Status Codes: ${[...new Set(statusCodes)].join(', ') || 'N/A'}`);
      console.log(`  Errors: ${JSON.stringify([...new Set(errors)].slice(0, 3))}`);
    }
  }

  // Show sample data structure
  if (firstResponse) {
    console.log(`\n${'='.repeat(70)}`);
    console.log('📋 Sample Response Structure');
    console.log(`${'='.repeat(70)}\n`);

    if (Array.isArray(firstResponse)) {
      console.log(`Response is an array with ${firstResponse.length} items`);
      if (firstResponse.length > 0) {
        console.log('\nFirst transfer sample:');
        console.log(JSON.stringify(firstResponse[0], null, 2));
      }
    } else {
      console.log('Response structure:');
      console.log(JSON.stringify(firstResponse, null, 2).slice(0, 2000));
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Latency Test Complete');
  console.log(`${'='.repeat(70)}\n`);
}

runTests().catch(console.error);
