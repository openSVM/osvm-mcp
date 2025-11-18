#!/usr/bin/env node

/**
 * Final latency test with corrected implementation
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

async function testTransfers(params = {}) {
  const startTime = Date.now();

  try {
    const response = await axios.get(`${BASE_URL}/api/account-transfers/${TEST_ADDRESS}`, {
      params,
      headers: {
        'Accept': 'application/json',
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
      },
      timeout: 30000
    });

    const latency = Date.now() - startTime;
    const transferCount = response.data?.data?.length || 0;
    const fromCache = response.data?.fromCache || false;

    return {
      success: true,
      latency,
      transferCount,
      fromCache,
      dataSize: JSON.stringify(response.data).length
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      latency,
      error: error.response?.status || error.message
    };
  }
}

async function runFinalTest() {
  console.log('🚀 Final Account Transfers Latency Test\n');
  console.log(`Address: ${TEST_ADDRESS}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const scenarios = [
    { name: 'Default (50 transfers)', params: {}, iterations: 10 },
    { name: 'Limit: 10', params: { limit: 10 }, iterations: 5 },
    { name: 'Limit: 100', params: { limit: 100 }, iterations: 5 },
    { name: 'Limit: 200', params: { limit: 200 }, iterations: 5 },
    { name: 'Transfer IN only', params: { transferType: 'IN', limit: 50 }, iterations: 3 },
    { name: 'Transfer OUT only', params: { transferType: 'OUT', limit: 50 }, iterations: 3 },
    { name: 'SOL only', params: { solanaOnly: true, limit: 50 }, iterations: 3 },
    { name: 'With pagination', params: { limit: 20, offset: 10 }, iterations: 3 }
  ];

  let allResults = [];

  for (const scenario of scenarios) {
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 ${scenario.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Params: ${JSON.stringify(scenario.params)}\n`);

    const results = [];

    for (let i = 0; i < scenario.iterations; i++) {
      process.stdout.write(`  Request ${i + 1}/${scenario.iterations}... `);

      const result = await testTransfers(scenario.params);
      results.push(result);
      allResults.push(result);

      if (result.success) {
        const cacheIndicator = result.fromCache ? '💾' : '🌐';
        console.log(`✓ ${formatLatency(result.latency)} ${cacheIndicator} (${result.transferCount} transfers, ${(result.dataSize / 1024).toFixed(1)}KB)`);
      } else {
        console.log(`✗ ${formatLatency(result.latency)} (Error: ${result.error})`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const successResults = results.filter(r => r.success);

    if (successResults.length > 0) {
      const latencies = successResults.map(r => r.latency);
      const stats = getStats(latencies);
      const avgTransfers = successResults.reduce((a, b) => a + b.transferCount, 0) / successResults.length;
      const cachedCount = successResults.filter(r => r.fromCache).length;

      console.log(`\n  📈 Latency: min=${formatLatency(stats.min)} avg=${formatLatency(stats.avg)} med=${formatLatency(stats.median)} p95=${formatLatency(stats.p95)} max=${formatLatency(stats.max)}`);
      console.log(`  📊 Avg Transfers: ${avgTransfers.toFixed(0)}`);
      console.log(`  💾 Cached: ${cachedCount}/${successResults.length}\n`);
    }
  }

  // Overall summary
  console.log(`${'='.repeat(70)}`);
  console.log('📊 OVERALL SUMMARY');
  console.log(`${'='.repeat(70)}\n`);

  const allSuccess = allResults.filter(r => r.success);
  if (allSuccess.length > 0) {
    const allLatencies = allSuccess.map(r => r.latency);
    const stats = getStats(allLatencies);

    console.log(`Total Requests: ${allResults.length}`);
    console.log(`Success Rate: ${allSuccess.length}/${allResults.length} (${(allSuccess.length / allResults.length * 100).toFixed(1)}%)`);
    console.log(`\nLatency Statistics:`);
    console.log(`  Min:    ${formatLatency(stats.min)}`);
    console.log(`  Avg:    ${formatLatency(stats.avg)}`);
    console.log(`  Median: ${formatLatency(stats.median)}`);
    console.log(`  p95:    ${formatLatency(stats.p95)}`);
    console.log(`  p99:    ${formatLatency(stats.p99)}`);
    console.log(`  Max:    ${formatLatency(stats.max)}`);

    const totalTransfers = allSuccess.reduce((sum, r) => sum + r.transferCount, 0);
    const avgTransfers = totalTransfers / allSuccess.length;
    console.log(`\nAvg Transfers per Request: ${avgTransfers.toFixed(1)}`);

    const cachedRequests = allSuccess.filter(r => r.fromCache).length;
    console.log(`Cache Hit Rate: ${cachedRequests}/${allSuccess.length} (${(cachedRequests / allSuccess.length * 100).toFixed(1)}%)`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Test Complete');
  console.log(`${'='.repeat(70)}\n`);
}

runFinalTest().catch(console.error);
