#!/usr/bin/env node

import axios from 'axios';

const WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const BASE_URL = 'https://opensvm.com';

async function testTransferLatency() {
  console.log('🚀 Account Transfers Latency Test (Correct Endpoint)\n');
  console.log(`Wallet: ${WALLET}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const tests = [
    { name: 'Default (50)', params: { limit: 50 } },
    { name: 'Limit 10', params: { limit: 10 } },
    { name: 'Limit 100', params: { limit: 100 } },
    { name: 'Limit 200', params: { limit: 200 } },
    { name: 'Limit 500', params: { limit: 500 } },
    { name: 'Transfer IN', params: { limit: 50, transferType: 'IN' } },
    { name: 'Transfer OUT', params: { limit: 50, transferType: 'OUT' } },
    { name: 'SOL only', params: { limit: 50, solanaOnly: true } },
    { name: 'With offset', params: { limit: 20, offset: 10 } },
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 ${test.name}`);
    console.log('='.repeat(70));

    const startTime = Date.now();

    try {
      const response = await axios.get(`${BASE_URL}/api/account-transfers/${WALLET}`, {
        params: test.params,
        headers: { 'Accept': 'application/json' },
        timeout: 120000
      });

      const duration = Date.now() - startTime;
      const data = response.data;
      const transfers = data.data || [];
      const count = Array.isArray(transfers) ? transfers.length : 0;

      console.log(`✅ SUCCESS (${(duration/1000).toFixed(2)}s)`);
      console.log(`   Transfers: ${count}`);
      console.log(`   Total: ${data.total || data.originalTotal || 'N/A'}`);
      console.log(`   Has More: ${data.hasMore || false}`);
      console.log(`   From Cache: ${data.fromCache || false}`);
      console.log(`   Response Size: ${(JSON.stringify(data).length / 1024).toFixed(1)} KB`);
      console.log(`   RPC Calls: ${data.rpcCalls || 'N/A'}`);

      results.push({
        name: test.name,
        success: true,
        duration,
        count,
        responseSize: JSON.stringify(data).length
      });

      if (count > 0) {
        console.log(`\n   First Transfer:`);
        console.log(`   - TxID: ${transfers[0].txId?.slice(0, 20)}...`);
        console.log(`   - Date: ${transfers[0].date}`);
        console.log(`   - From: ${transfers[0].from?.slice(0, 20)}...`);
        console.log(`   - To: ${transfers[0].to?.slice(0, 20)}...`);
        console.log(`   - Amount: ${transfers[0].tokenAmount} ${transfers[0].tokenSymbol}`);
        console.log(`   - Type: ${transfers[0].transferType} (${transfers[0].txType})`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ERROR (${(duration/1000).toFixed(2)}s)`);

      results.push({
        name: test.name,
        success: false,
        duration,
        error: error.response?.status || error.code || error.message
      });

      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${JSON.stringify(error.response.data).slice(0, 100)}`);
      } else if (error.code === 'ECONNABORTED') {
        console.log(`   Error: Timeout (>120s)`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }

    // Wait 1 second between requests to avoid rate limiting
    if (tests.indexOf(test) < tests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✓ Success: ${successful.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
  console.log(`✗ Failed: ${failed.length}`);

  if (successful.length > 0) {
    const durations = successful.map(r => r.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    console.log(`\nLatency Statistics:`);
    console.log(`  Min:    ${(Math.min(...durations)/1000).toFixed(2)}s`);
    console.log(`  Avg:    ${(avg/1000).toFixed(2)}s`);
    console.log(`  Median: ${(median/1000).toFixed(2)}s`);
    console.log(`  p95:    ${(p95/1000).toFixed(2)}s`);
    console.log(`  Max:    ${(Math.max(...durations)/1000).toFixed(2)}s`);

    const totalTransfers = successful.reduce((sum, r) => sum + (r.count || 0), 0);
    console.log(`\nTotal Transfers Received: ${totalTransfers}`);
    console.log(`Avg Transfers per Request: ${(totalTransfers / successful.length).toFixed(1)}`);
  }

  if (failed.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log('❌ FAILURES');
    console.log('='.repeat(70));
    failed.forEach((f, idx) => {
      console.log(`\n[${idx + 1}] ${f.name}`);
      console.log(`    Error: ${f.error}`);
      console.log(`    Duration: ${(f.duration/1000).toFixed(2)}s`);
    });
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Test Complete');
  console.log('='.repeat(70));
}

testTransferLatency().catch(console.error);
