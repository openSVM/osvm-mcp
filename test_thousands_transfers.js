#!/usr/bin/env node

import axios from 'axios';

const WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const BASE_URL = 'https://opensvm.com';

async function testThousandsOfTransfers() {
  console.log('🚀 Thousands of Transfers Test (Using Correct 500 Limit)\n');
  console.log(`Wallet: ${WALLET}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const tests = [
    { name: 'Single batch (500)', batches: 1 },
    { name: 'Double batch (1,000)', batches: 2 },
    { name: 'Triple batch (1,500)', batches: 3 },
    { name: 'Large test (2,500)', batches: 5 },
    { name: 'Massive test (5,000)', batches: 10 },
  ];

  const allResults = [];

  for (const test of tests) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 ${test.name}`);
    console.log('='.repeat(70));

    let totalTransfers = 0;
    let totalDuration = 0;
    let lastSignature = null;
    const batchResults = [];
    let hasMore = true;

    for (let i = 0; i < test.batches && hasMore; i++) {
      const batchNum = i + 1;
      console.log(`\n  Batch ${batchNum}/${test.batches}:`);

      const startTime = Date.now();

      try {
        const params = { limit: 500 };

        // Use beforeSignature for pagination
        if (lastSignature) {
          params.beforeSignature = lastSignature;
        }

        const response = await axios.get(`${BASE_URL}/api/account-transfers/${WALLET}`, {
          params,
          headers: { 'Accept': 'application/json' },
          timeout: 120000
        });

        const duration = Date.now() - startTime;
        totalDuration += duration;

        const data = response.data;
        const transfers = data.data || [];
        const count = Array.isArray(transfers) ? transfers.length : 0;
        totalTransfers += count;
        hasMore = data.hasMore || false;

        // Save last signature for next batch
        if (transfers.length > 0) {
          lastSignature = data.nextPageSignature || transfers[transfers.length - 1].txId;
        }

        const throughput = count / (duration / 1000);

        console.log(`    ✅ SUCCESS (${(duration/1000).toFixed(2)}s)`);
        console.log(`       Transfers: ${count}`);
        console.log(`       Running total: ${totalTransfers.toLocaleString()}`);
        console.log(`       Has More: ${hasMore}`);
        console.log(`       From Cache: ${data.fromCache || false}`);
        console.log(`       Response Size: ${(JSON.stringify(data).length / 1024).toFixed(1)} KB`);
        console.log(`       RPC Calls: ${data.rpcCalls || 'N/A'}`);
        console.log(`       Throughput: ${throughput.toFixed(1)} transfers/sec`);

        if (count > 0 && i === 0) {
          console.log(`\n       First Transfer (overall):`);
          console.log(`       - Date: ${transfers[0].date}`);
          console.log(`       - TxID: ${transfers[0].txId?.slice(0, 40)}...`);
        }

        if (count > 0) {
          const last = transfers[count - 1];
          console.log(`\n       Last Transfer (this batch):`);
          console.log(`       - Date: ${last.date}`);
          console.log(`       - TxID: ${last.txId?.slice(0, 40)}...`);
        }

        batchResults.push({
          batchNum,
          success: true,
          duration,
          count,
          throughput,
          responseSize: JSON.stringify(data).length
        });

        // Don't continue if no more data
        if (!hasMore) {
          console.log(`\n    ℹ️  No more transfers available (reached end of history)`);
          break;
        }

      } catch (error) {
        const duration = Date.now() - startTime;
        totalDuration += duration;

        console.log(`    ❌ ERROR (${(duration/1000).toFixed(2)}s)`);

        if (error.response) {
          console.log(`       Status: ${error.response.status}`);
          const errorData = error.response.data;
          console.log(`       Error: ${JSON.stringify(errorData).slice(0, 150)}`);

          // Check for rate limiting
          if (error.response.status === 429 && errorData.retryAfter) {
            console.log(`       ⏳ Rate limited! Retry after: ${errorData.retryAfter}s`);
            console.log(`       Waiting ${errorData.retryAfter}s before continuing...`);
            await new Promise(resolve => setTimeout(resolve, errorData.retryAfter * 1000));
            i--; // Retry this batch
            continue;
          }
        } else if (error.code === 'ECONNABORTED') {
          console.log(`       Error: Timeout (>120s)`);
        } else {
          console.log(`       Error: ${error.message}`);
        }

        batchResults.push({
          batchNum,
          success: false,
          duration,
          error: error.response?.status || error.code || error.message
        });

        break; // Stop on error
      }

      // Wait between batches to avoid rate limiting
      if (i < test.batches - 1 && hasMore) {
        console.log(`\n  ⏳ Waiting 2s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Test summary
    const successfulBatches = batchResults.filter(b => b.success).length;
    const avgDuration = successfulBatches > 0 ? totalDuration / successfulBatches : 0;
    const overallThroughput = totalDuration > 0 ? totalTransfers / (totalDuration / 1000) : 0;

    console.log(`\n  📈 Test Summary:`);
    console.log(`     Target: ${test.batches * 500} transfers`);
    console.log(`     Actual: ${totalTransfers.toLocaleString()} transfers`);
    console.log(`     Batches completed: ${successfulBatches}/${test.batches}`);
    console.log(`     Total Duration: ${(totalDuration/1000).toFixed(2)}s`);
    console.log(`     Avg per batch: ${(avgDuration/1000).toFixed(2)}s`);
    console.log(`     Overall Throughput: ${overallThroughput.toFixed(1)} transfers/sec`);

    allResults.push({
      name: test.name,
      target: test.batches * 500,
      actual: totalTransfers,
      batches: batchResults,
      totalDuration,
      avgBatchDuration: avgDuration,
      overallThroughput
    });

    // Wait between tests
    if (tests.indexOf(test) < tests.length - 1) {
      console.log(`\n⏳ Waiting 5s before next test...\n`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Overall Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(70));

  const grandTotalTransfers = allResults.reduce((sum, r) => sum + r.actual, 0);
  const grandTotalDuration = allResults.reduce((sum, r) => sum + r.totalDuration, 0);
  const allBatches = allResults.flatMap(r => r.batches);
  const successfulBatches = allBatches.filter(b => b.success);

  console.log(`\nTotal Tests: ${tests.length}`);
  console.log(`Total Batches Attempted: ${allBatches.length}`);
  console.log(`✓ Successful Batches: ${successfulBatches.length}/${allBatches.length} (${(successfulBatches.length/allBatches.length*100).toFixed(1)}%)`);
  console.log(`\nGrand Total Transfers: ${grandTotalTransfers.toLocaleString()}`);
  console.log(`Grand Total Duration: ${(grandTotalDuration/1000).toFixed(2)}s (${(grandTotalDuration/60000).toFixed(1)} minutes)`);
  console.log(`Overall Throughput: ${(grandTotalTransfers/(grandTotalDuration/1000)).toFixed(1)} transfers/sec`);

  if (successfulBatches.length > 0) {
    const durations = successfulBatches.map(b => b.duration);
    const throughputs = successfulBatches.map(b => b.throughput);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;

    console.log(`\nBatch Latency Statistics:`);
    console.log(`  Min:    ${(Math.min(...durations)/1000).toFixed(2)}s`);
    console.log(`  Avg:    ${(avg/1000).toFixed(2)}s`);
    console.log(`  Median: ${(median/1000).toFixed(2)}s`);
    console.log(`  p95:    ${(p95/1000).toFixed(2)}s`);
    console.log(`  Max:    ${(Math.max(...durations)/1000).toFixed(2)}s`);

    console.log(`\nThroughput Statistics:`);
    console.log(`  Min:    ${Math.min(...throughputs).toFixed(1)} transfers/sec`);
    console.log(`  Avg:    ${avgThroughput.toFixed(1)} transfers/sec`);
    console.log(`  Max:    ${Math.max(...throughputs).toFixed(1)} transfers/sec`);
  }

  // Performance breakdown
  console.log(`\n${'='.repeat(70)}`);
  console.log('🏆 PERFORMANCE BREAKDOWN');
  console.log('='.repeat(70));

  allResults.forEach((result, idx) => {
    const successRate = result.batches.filter(b => b.success).length / result.batches.length * 100;
    const efficiency = result.target > 0 ? (result.actual / result.target * 100) : 0;

    console.log(`\n[${idx + 1}] ${result.name}`);
    console.log(`    Target: ${result.target.toLocaleString()} transfers`);
    console.log(`    Actual: ${result.actual.toLocaleString()} transfers (${efficiency.toFixed(1)}%)`);
    console.log(`    Duration: ${(result.totalDuration/1000).toFixed(2)}s`);
    console.log(`    Avg Batch: ${(result.avgBatchDuration/1000).toFixed(2)}s`);
    console.log(`    Success: ${successRate.toFixed(0)}%`);
    console.log(`    Throughput: ${result.overallThroughput.toFixed(1)} transfers/sec`);
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Thousands of Transfers Test Complete');
  console.log('='.repeat(70));
}

testThousandsOfTransfers().catch(console.error);
