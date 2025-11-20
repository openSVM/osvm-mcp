#!/usr/bin/env node

import axios from 'axios';

const WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const BASE_URL = 'https://opensvm.com';

async function testMassiveTransfers() {
  console.log('🚀 Massive Transfer Test - Thousands of Transfers\n');
  console.log(`Wallet: ${WALLET}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const tests = [
    { name: 'Max Limit (1000)', params: { limit: 1000 }, repeats: 1 },
    { name: 'Max Limit x3 (3000 total)', params: { limit: 1000 }, repeats: 3, usePagination: true },
    { name: 'Max Limit x5 (5000 total)', params: { limit: 1000 }, repeats: 5, usePagination: true },
    { name: 'Large offset test', params: { limit: 500, offset: 1000 }, repeats: 1 },
    { name: 'Deep pagination', params: { limit: 100, offset: 2000 }, repeats: 1 },
  ];

  const allResults = [];

  for (const test of tests) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 ${test.name}`);
    console.log('='.repeat(70));

    const batchResults = [];
    let totalTransfers = 0;
    let totalDuration = 0;
    let lastSignature = null;

    for (let i = 0; i < test.repeats; i++) {
      const batchNum = i + 1;
      const isFinalBatch = (i === test.repeats - 1);

      if (test.repeats > 1) {
        console.log(`\n  Batch ${batchNum}/${test.repeats}:`);
      }

      const startTime = Date.now();

      try {
        const params = { ...test.params };

        // Use beforeSignature for pagination instead of offset
        if (test.usePagination && lastSignature) {
          delete params.offset;
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

        // Save last signature for next batch
        if (transfers.length > 0) {
          lastSignature = transfers[transfers.length - 1].txId;
        }

        console.log(`    ✅ SUCCESS (${(duration/1000).toFixed(2)}s)`);
        console.log(`       Transfers: ${count}`);
        console.log(`       Total so far: ${totalTransfers}`);
        console.log(`       Has More: ${data.hasMore || false}`);
        console.log(`       From Cache: ${data.fromCache || false}`);
        console.log(`       Response Size: ${(JSON.stringify(data).length / 1024).toFixed(1)} KB`);
        console.log(`       RPC Calls: ${data.rpcCalls || 'N/A'}`);

        if (count > 0 && i === 0) {
          console.log(`\n       First Transfer:`);
          console.log(`       - TxID: ${transfers[0].txId?.slice(0, 30)}...`);
          console.log(`       - Date: ${transfers[0].date}`);
          console.log(`       - Amount: ${transfers[0].tokenAmount} ${transfers[0].tokenSymbol}`);
        }

        if (count > 0 && isFinalBatch) {
          console.log(`\n       Last Transfer:`);
          const last = transfers[count - 1];
          console.log(`       - TxID: ${last.txId?.slice(0, 30)}...`);
          console.log(`       - Date: ${last.date}`);
          console.log(`       - Amount: ${last.tokenAmount} ${last.tokenSymbol}`);
        }

        batchResults.push({
          batchNum,
          success: true,
          duration,
          count,
          responseSize: JSON.stringify(data).length
        });

      } catch (error) {
        const duration = Date.now() - startTime;
        totalDuration += duration;

        console.log(`    ❌ ERROR (${(duration/1000).toFixed(2)}s)`);

        if (error.response) {
          console.log(`       Status: ${error.response.status}`);
          console.log(`       Error: ${JSON.stringify(error.response.data).slice(0, 100)}`);
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
      }

      // Wait between batches to avoid rate limiting
      if (i < test.repeats - 1) {
        console.log(`\n  ⏳ Waiting 2s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Test summary
    console.log(`\n  📈 Test Summary:`);
    console.log(`     Total Transfers: ${totalTransfers}`);
    console.log(`     Total Duration: ${(totalDuration/1000).toFixed(2)}s`);
    console.log(`     Avg per batch: ${(totalDuration/test.repeats/1000).toFixed(2)}s`);
    console.log(`     Transfers/sec: ${(totalTransfers/(totalDuration/1000)).toFixed(1)}`);
    console.log(`     Success Rate: ${batchResults.filter(b => b.success).length}/${test.repeats}`);

    allResults.push({
      name: test.name,
      batches: batchResults,
      totalTransfers,
      totalDuration,
      avgBatchDuration: totalDuration / test.repeats
    });

    // Wait between tests
    if (tests.indexOf(test) < tests.length - 1) {
      console.log(`\n⏳ Waiting 3s before next test...\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Overall Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(70));

  const grandTotalTransfers = allResults.reduce((sum, r) => sum + r.totalTransfers, 0);
  const grandTotalDuration = allResults.reduce((sum, r) => sum + r.totalDuration, 0);
  const allBatches = allResults.flatMap(r => r.batches);
  const successfulBatches = allBatches.filter(b => b.success);

  console.log(`\nTotal Tests: ${tests.length}`);
  console.log(`Total Batches: ${allBatches.length}`);
  console.log(`✓ Successful: ${successfulBatches.length}/${allBatches.length}`);
  console.log(`\nGrand Total Transfers: ${grandTotalTransfers.toLocaleString()}`);
  console.log(`Grand Total Duration: ${(grandTotalDuration/1000).toFixed(2)}s`);
  console.log(`Overall Throughput: ${(grandTotalTransfers/(grandTotalDuration/1000)).toFixed(1)} transfers/sec`);

  if (successfulBatches.length > 0) {
    const durations = successfulBatches.map(b => b.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    console.log(`\nBatch Latency Statistics:`);
    console.log(`  Min:    ${(Math.min(...durations)/1000).toFixed(2)}s`);
    console.log(`  Avg:    ${(avg/1000).toFixed(2)}s`);
    console.log(`  Median: ${(median/1000).toFixed(2)}s`);
    console.log(`  p95:    ${(p95/1000).toFixed(2)}s`);
    console.log(`  Max:    ${(Math.max(...durations)/1000).toFixed(2)}s`);
  }

  // Performance breakdown
  console.log(`\n${'='.repeat(70)}`);
  console.log('🏆 PERFORMANCE BREAKDOWN');
  console.log('='.repeat(70));

  allResults.forEach((result, idx) => {
    const successRate = result.batches.filter(b => b.success).length / result.batches.length * 100;
    console.log(`\n[${idx + 1}] ${result.name}`);
    console.log(`    Transfers: ${result.totalTransfers.toLocaleString()}`);
    console.log(`    Duration: ${(result.totalDuration/1000).toFixed(2)}s`);
    console.log(`    Avg Batch: ${(result.avgBatchDuration/1000).toFixed(2)}s`);
    console.log(`    Success: ${successRate.toFixed(0)}%`);
    console.log(`    Throughput: ${(result.totalTransfers/(result.totalDuration/1000)).toFixed(1)} transfers/sec`);
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Massive Transfer Test Complete');
  console.log('='.repeat(70));
}

testMassiveTransfers().catch(console.error);
