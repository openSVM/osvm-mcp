#!/usr/bin/env node

/**
 * Latency test for get_account_transfers tool
 */

import axios from 'axios';

const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;

// Test accounts - using known active Solana addresses
const TEST_ADDRESSES = [
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  '7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q', // Random active wallet
];

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

async function testAccountTransfers(address, params = {}) {
  const startTime = Date.now();

  try {
    const response = await axios.get(`${BASE_URL}/api/account-transfers`, {
      params: {
        address,
        ...params
      },
      headers: {
        'Content-Type': 'application/json',
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
      },
      timeout: 120000
    });

    const latency = Date.now() - startTime;
    const transferCount = Array.isArray(response.data) ? response.data.length :
                         response.data?.transfers?.length || 0;

    return {
      success: true,
      latency,
      transferCount,
      dataSize: JSON.stringify(response.data).length
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      latency,
      error: error.response?.status || error.message,
      transferCount: 0,
      dataSize: 0
    };
  }
}

async function runLatencyTests() {
  console.log('🚀 Account Transfers Latency Test\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Authentication: ${JWT_TOKEN ? 'Enabled' : 'Disabled'}\n`);

  const testScenarios = [
    {
      name: 'Default parameters (limit=100)',
      params: {}
    },
    {
      name: 'Small limit (limit=10)',
      params: { limit: 10 }
    },
    {
      name: 'Medium limit (limit=50)',
      params: { limit: 50 }
    },
    {
      name: 'Large limit (limit=200)',
      params: { limit: 200 }
    },
    {
      name: 'With type filter (type=token)',
      params: { type: 'token', limit: 100 }
    },
    {
      name: 'With type filter (type=sol)',
      params: { type: 'sol', limit: 100 }
    },
    {
      name: 'With status filter (status=success)',
      params: { status: 'success', limit: 100 }
    },
    {
      name: 'With pagination (offset=10)',
      params: { limit: 50, offset: 10 }
    }
  ];

  for (const scenario of testScenarios) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Scenario: ${scenario.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Parameters: ${JSON.stringify(scenario.params)}\n`);

    const results = [];
    const ITERATIONS = 5;

    for (let i = 0; i < ITERATIONS; i++) {
      // Use different addresses for variety
      const address = TEST_ADDRESSES[i % TEST_ADDRESSES.length];

      process.stdout.write(`  Request ${i + 1}/${ITERATIONS}... `);

      const result = await testAccountTransfers(address, scenario.params);
      results.push(result);

      if (result.success) {
        console.log(`✓ ${formatLatency(result.latency)} (${result.transferCount} transfers, ${(result.dataSize / 1024).toFixed(1)}KB)`);
      } else {
        console.log(`✗ ${formatLatency(result.latency)} (Error: ${result.error})`);
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
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
      console.log(`  Success Rate: ${successResults.length}/${ITERATIONS} (${(successResults.length / ITERATIONS * 100).toFixed(1)}%)`);
      console.log(`  Latency:`);
      console.log(`    Min:    ${formatLatency(latencyStats.min)}`);
      console.log(`    Avg:    ${formatLatency(latencyStats.avg)}`);
      console.log(`    Median: ${formatLatency(latencyStats.median)}`);
      console.log(`    p95:    ${formatLatency(latencyStats.p95)}`);
      console.log(`    p99:    ${formatLatency(latencyStats.p99)}`);
      console.log(`    Max:    ${formatLatency(latencyStats.max)}`);
      console.log(`  Avg Transfers: ${avgTransfers.toFixed(0)}`);
      console.log(`  Avg Data Size: ${(avgDataSize / 1024).toFixed(1)}KB`);
    } else {
      console.log('\n❌ All requests failed');
      const errors = results.map(r => r.error);
      console.log(`  Errors: ${[...new Set(errors)].join(', ')}`);
    }
  }

  // Overall summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Latency Test Complete');
  console.log(`${'='.repeat(70)}\n`);
}

runLatencyTests().catch(console.error);
