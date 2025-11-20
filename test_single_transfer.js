#!/usr/bin/env node

import axios from 'axios';

const WALLET = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
const BASE_URL = 'https://opensvm.com';

async function testTransfers() {
  console.log('🔍 Testing get_account_transfers\n');
  console.log(`Wallet: ${WALLET}\n`);
  
  const tests = [
    { name: 'Default (50)', params: { address: WALLET } },
    { name: 'Limit 10', params: { address: WALLET, limit: 10 } },
    { name: 'Limit 100', params: { address: WALLET, limit: 100 } },
    { name: 'Limit 500', params: { address: WALLET, limit: 500 } },
    { name: 'Transfer IN', params: { address: WALLET, limit: 50, transferType: 'IN' } },
    { name: 'Transfer OUT', params: { address: WALLET, limit: 50, transferType: 'OUT' } },
    { name: 'SOL only', params: { address: WALLET, limit: 50, solanaOnly: true } },
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 ${test.name}`);
    console.log('='.repeat(70));
    console.log(`Params: ${JSON.stringify(test.params, null, 2)}\n`);

    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${BASE_URL}/api/account-transfers`, {
        params: test.params,
        headers: { 'Accept': 'application/json' },
        timeout: 120000
      });

      const duration = Date.now() - startTime;
      const data = response.data;
      const transfers = data.data || data;
      const count = Array.isArray(transfers) ? transfers.length : 0;
      
      console.log(`✅ SUCCESS (${(duration/1000).toFixed(2)}s)`);
      console.log(`   Transfers: ${count}`);
      console.log(`   Total: ${data.total || 'N/A'}`);
      console.log(`   Has More: ${data.hasMore || false}`);
      console.log(`   From Cache: ${data.fromCache || false}`);
      console.log(`   Response Size: ${JSON.stringify(data).length} bytes`);
      
      if (count > 0) {
        console.log(`\n   Sample Transfer:`);
        console.log(`   - From: ${transfers[0].from?.slice(0, 20)}...`);
        console.log(`   - To: ${transfers[0].to?.slice(0, 20)}...`);
        console.log(`   - Amount: ${transfers[0].amount}`);
        console.log(`   - Token: ${transfers[0].token || 'SOL'}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ERROR (${(duration/1000).toFixed(2)}s)`);
      
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${JSON.stringify(error.response.data)}`);
      } else if (error.code === 'ECONNABORTED') {
        console.log(`   Error: Timeout (>120s)`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    
    // Wait 2 seconds between requests to avoid rate limiting
    if (tests.indexOf(test) < tests.length - 1) {
      console.log('\n⏳ Waiting 2s to avoid rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ All tests complete');
  console.log('='.repeat(70));
}

testTransfers().catch(console.error);
