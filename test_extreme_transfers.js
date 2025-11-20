#!/usr/bin/env node

import axios from 'axios';

const WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const BASE_URL = 'https://opensvm.com';

async function testExtremeTransfers() {
  console.log('🚀 EXTREME Transfer Test - Tens of Thousands!\n');
  console.log(`Wallet: ${WALLET}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const tests = [
    { name: '10,000 transfers', target: 10000 },
    { name: '25,000 transfers', target: 25000 },
    { name: '50,000 transfers', target: 50000 },
  ];

  const allResults = [];

  for (const test of tests) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 ${test.name}`);
    console.log('='.repeat(70));

    let totalTransfers = 0;
    let totalDuration = 0;
    let lastSignature = null;
    let batchNum = 0;
    let hasMore = true;
    const startTime = Date.now();

    const batchResults = [];

    while (totalTransfers < test.target && hasMore) {
      batchNum++;

      // Progress update every 10 batches
      if (batchNum % 10 === 1 || batchNum <= 3) {
        const progress = ((totalTransfers / test.target) * 100).toFixed(1);
        console.log(`\n  [Batch ${batchNum}] Progress: ${totalTransfers.toLocaleString()}/${test.target.toLocaleString()} (${progress}%)`);
      }

      const batchStart = Date.now();

      try {
        const params = { limit: 500 };

        if (lastSignature) {
          params.beforeSignature = lastSignature;
        }

        const response = await axios.get(`${BASE_URL}/api/account-transfers/${WALLET}`, {
          params,
          headers: { 'Accept': 'application/json' },
          timeout: 120000
        });

        const batchDuration = Date.now() - batchStart;
        totalDuration += batchDuration;

        const data = response.data;
        const transfers = data.data || [];
        const count = Array.isArray(transfers) ? transfers.length : 0;
        totalTransfers += count;
        hasMore = data.hasMore || false;

        if (transfers.length > 0) {
          lastSignature = data.nextPageSignature || transfers[transfers.length - 1].txId;
        }

        const throughput = count / (batchDuration / 1000);

        batchResults.push({
          batchNum,
          success: true,
          duration: batchDuration,
          count,
          throughput
        });

        // Show details for first few and milestone batches
        if (batchNum <= 3 || batchNum % 10 === 0) {
          console.log(`    ✅ ${(batchDuration/1000).toFixed(2)}s | ${count} transfers | ${throughput.toFixed(1)}/s | Total: ${totalTransfers.toLocaleString()}`);
        }

        if (!hasMore) {
          console.log(`\n    ℹ️  Reached end of transfer history at ${totalTransfers.toLocaleString()} transfers`);
          break;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        const batchDuration = Date.now() - batchStart;
        totalDuration += batchDuration;

        console.log(`\n    ❌ ERROR at batch ${batchNum} (${(batchDuration/1000).toFixed(2)}s)`);

        if (error.response) {
          const errorData = error.response.data;
          console.log(`       Status: ${error.response.status}`);
          console.log(`       Error: ${JSON.stringify(errorData).slice(0, 100)}`);

          if (error.response.status === 429 && errorData.retryAfter) {
            console.log(`       ⏳ Rate limited! Waiting ${errorData.retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, errorData.retryAfter * 1000 + 1000));
            continue; // Retry
          }
        } else if (error.code === 'ECONNABORTED') {
          console.log(`       Error: Timeout`);
        } else {
          console.log(`       Error: ${error.message}`);
        }

        batchResults.push({
          batchNum,
          success: false,
          duration: batchDuration,
          error: error.response?.status || error.code
        });

        break; // Stop on non-rate-limit error
      }
    }

    const totalTime = Date.now() - startTime;
    const successfulBatches = batchResults.filter(b => b.success);
    const avgBatchDuration = successfulBatches.length > 0
      ? successfulBatches.reduce((sum, b) => sum + b.duration, 0) / successfulBatches.length
      : 0;
    const overallThroughput = totalDuration > 0 ? totalTransfers / (totalDuration / 1000) : 0;

    console.log(`\n  📈 Test Summary:`);
    console.log(`     Target: ${test.target.toLocaleString()} transfers`);
    console.log(`     Actual: ${totalTransfers.toLocaleString()} transfers (${((totalTransfers/test.target)*100).toFixed(1)}%)`);
    console.log(`     Batches: ${successfulBatches.length}/${batchNum}`);
    console.log(`     Total Time: ${(totalTime/1000).toFixed(2)}s (${(totalTime/60000).toFixed(1)} min)`);
    console.log(`     Working Time: ${(totalDuration/1000).toFixed(2)}s (excludes delays)`);
    console.log(`     Avg Batch: ${(avgBatchDuration/1000).toFixed(2)}s`);
    console.log(`     Throughput: ${overallThroughput.toFixed(1)} transfers/sec`);

    allResults.push({
      name: test.name,
      target: test.target,
      actual: totalTransfers,
      batches: batchResults,
      totalTime,
      totalDuration,
      avgBatchDuration,
      overallThroughput
    });

    // Wait between tests
    if (tests.indexOf(test) < tests.length - 1) {
      console.log(`\n⏳ Waiting 10s before next test...\n`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  // Overall Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 EXTREME TEST SUMMARY');
  console.log('='.repeat(70));

  const grandTotalTransfers = allResults.reduce((sum, r) => sum + r.actual, 0);
  const grandTotalTime = allResults.reduce((sum, r) => sum + r.totalTime, 0);
  const grandTotalDuration = allResults.reduce((sum, r) => sum + r.totalDuration, 0);
  const allBatches = allResults.flatMap(r => r.batches);
  const successfulBatches = allBatches.filter(b => b.success);

  console.log(`\nTotal Tests: ${tests.length}`);
  console.log(`Total Batches: ${allBatches.length}`);
  console.log(`✓ Successful: ${successfulBatches.length}/${allBatches.length} (${(successfulBatches.length/allBatches.length*100).toFixed(1)}%)`);

  console.log(`\n🎯 GRAND TOTALS:`);
  console.log(`   Transfers: ${grandTotalTransfers.toLocaleString()}`);
  console.log(`   Wall Time: ${(grandTotalTime/1000).toFixed(2)}s (${(grandTotalTime/60000).toFixed(1)} min)`);
  console.log(`   Working Time: ${(grandTotalDuration/1000).toFixed(2)}s (${(grandTotalDuration/60000).toFixed(1)} min)`);
  console.log(`   Overall Throughput: ${(grandTotalTransfers/(grandTotalDuration/1000)).toFixed(1)} transfers/sec`);

  if (successfulBatches.length > 0) {
    const durations = successfulBatches.map(b => b.duration);
    const throughputs = successfulBatches.map(b => b.throughput);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;

    console.log(`\n📊 Batch Statistics:`);
    console.log(`   Latency Min:    ${(Math.min(...durations)/1000).toFixed(2)}s`);
    console.log(`   Latency Avg:    ${(avg/1000).toFixed(2)}s`);
    console.log(`   Latency Median: ${(median/1000).toFixed(2)}s`);
    console.log(`   Latency p95:    ${(p95/1000).toFixed(2)}s`);
    console.log(`   Latency p99:    ${(p99/1000).toFixed(2)}s`);
    console.log(`   Latency Max:    ${(Math.max(...durations)/1000).toFixed(2)}s`);
    console.log(`\n   Throughput Min: ${Math.min(...throughputs).toFixed(1)} transfers/sec`);
    console.log(`   Throughput Avg: ${avgThroughput.toFixed(1)} transfers/sec`);
    console.log(`   Throughput Max: ${Math.max(...throughputs).toFixed(1)} transfers/sec`);
  }

  // Performance breakdown
  console.log(`\n${'='.repeat(70)}`);
  console.log('🏆 TEST BREAKDOWN');
  console.log('='.repeat(70));

  allResults.forEach((result, idx) => {
    const successRate = result.batches.filter(b => b.success).length / result.batches.length * 100;
    const efficiency = result.target > 0 ? (result.actual / result.target * 100) : 0;

    console.log(`\n[${idx + 1}] ${result.name}`);
    console.log(`    Target:     ${result.target.toLocaleString()}`);
    console.log(`    Actual:     ${result.actual.toLocaleString()} (${efficiency.toFixed(1)}%)`);
    console.log(`    Batches:    ${result.batches.filter(b => b.success).length}`);
    console.log(`    Wall Time:  ${(result.totalTime/1000).toFixed(2)}s (${(result.totalTime/60000).toFixed(1)} min)`);
    console.log(`    Work Time:  ${(result.totalDuration/1000).toFixed(2)}s (${(result.totalDuration/60000).toFixed(1)} min)`);
    console.log(`    Avg Batch:  ${(result.avgBatchDuration/1000).toFixed(2)}s`);
    console.log(`    Success:    ${successRate.toFixed(1)}%`);
    console.log(`    Throughput: ${result.overallThroughput.toFixed(1)} transfers/sec`);
  });

  // Estimate for even larger numbers
  if (successfulBatches.length > 10) {
    console.log(`\n${'='.repeat(70)}`);
    console.log('📈 PROJECTIONS');
    console.log('='.repeat(70));

    const avgBatchTime = successfulBatches.reduce((sum, b) => sum + b.duration, 0) / successfulBatches.length;
    const avgTransfersPerBatch = successfulBatches.reduce((sum, b) => sum + b.count, 0) / successfulBatches.length;

    const targets = [100000, 250000, 500000, 1000000];
    console.log(`\nBased on avg batch: ${(avgBatchTime/1000).toFixed(2)}s for ${avgTransfersPerBatch.toFixed(0)} transfers\n`);

    targets.forEach(target => {
      const batchesNeeded = Math.ceil(target / avgTransfersPerBatch);
      const estimatedTime = (batchesNeeded * (avgBatchTime + 1500)) / 1000; // Include 1.5s delay
      const minutes = (estimatedTime / 60).toFixed(1);
      const hours = (estimatedTime / 3600).toFixed(2);

      console.log(`   ${target.toLocaleString().padEnd(10)} transfers: ~${batchesNeeded} batches, ~${minutes} min (${hours} hrs)`);
    });
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Extreme Transfer Test Complete');
  console.log('='.repeat(70));
}

testExtremeTransfers().catch(console.error);
