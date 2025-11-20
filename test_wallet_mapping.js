#!/usr/bin/env node

/**
 * Test wallet mapping/connection tools
 */

import axios from 'axios';

const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;
const TEST_ADDRESS = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

// Known Solana program addresses for testing
const PROGRAMS = {
  RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  JUPITER_AGG: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  ORCA: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP'
};

async function testFindRelatedTransactions() {
  console.log('🔍 Testing find_related_transactions\n');
  console.log(`Address: ${TEST_ADDRESS}\n`);

  try {
    const response = await axios.post(`${BASE_URL}/api/find-related-transactions`, {
      address: TEST_ADDRESS,
      includeTokenTransfers: true,
      maxDepth: 2
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
      },
      timeout: 120000,
      validateStatus: () => true
    });

    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers['content-type']}\n`);

    if (response.status === 200) {
      console.log('✓ SUCCESS\n');
      console.log('Response structure:');
      console.log(JSON.stringify(response.data, null, 2).slice(0, 2000));

      if (response.data.nodes) {
        console.log(`\n📊 Found ${response.data.nodes.length} connected wallet nodes`);
      }
      if (response.data.edges) {
        console.log(`📊 Found ${response.data.edges.length} transaction edges`);
      }
      if (response.data.relationships) {
        console.log(`📊 Found ${response.data.relationships.length} relationships`);
      }
    } else {
      console.log(`⚠ Response: ${JSON.stringify(response.data, null, 2)}`);
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2).slice(0, 500));
    }
  }
}

async function testHoldersByInteraction() {
  console.log(`\n${'='.repeat(70)}`);
  console.log('🔍 Testing holders_by_interaction\n');

  const tests = [
    { name: 'Raydium V4', program: PROGRAMS.RAYDIUM_V4 },
    { name: 'Jupiter Aggregator', program: PROGRAMS.JUPITER_AGG },
    { name: 'Orca', program: PROGRAMS.ORCA }
  ];

  for (const test of tests) {
    console.log(`\nProgram: ${test.name}`);
    console.log(`Address: ${test.program}`);

    try {
      const response = await axios.get(`${BASE_URL}/api/holdersByInteraction`, {
        params: {
          program: test.program,
          limit: 10,
          minInteractions: 5
        },
        headers: {
          'Accept': 'application/json',
          ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
        },
        timeout: 120000,
        validateStatus: () => true
      });

      console.log(`Status: ${response.status}`);

      if (response.status === 200) {
        console.log('✓ SUCCESS\n');

        if (Array.isArray(response.data)) {
          console.log(`📊 Found ${response.data.length} holders`);
          if (response.data.length > 0) {
            console.log('\nTop holder sample:');
            console.log(JSON.stringify(response.data[0], null, 2));
          }
        } else {
          console.log('Response:', JSON.stringify(response.data, null, 2).slice(0, 500));
        }
      } else {
        console.log(`⚠ Response: ${JSON.stringify(response.data, null, 2).slice(0, 300)}`);
      }

    } catch (error) {
      console.error('✗ Error:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function runTests() {
  console.log('🗺️  Wallet Mapping & Connection Tools Test\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Authentication: ${JWT_TOKEN ? 'Enabled ✓' : 'Disabled'}\n`);
  console.log(`${'='.repeat(70)}\n`);

  await testFindRelatedTransactions();
  await testHoldersByInteraction();

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ All Tests Complete');
  console.log(`${'='.repeat(70)}\n`);

  console.log('💡 Usage for wallet visualization:');
  console.log('1. Use find_related_transactions to discover wallet connections');
  console.log('2. Use holders_by_interaction to find wallet clusters by program');
  console.log('3. Use get_account_transfers to analyze transaction flows');
  console.log('4. Combine data to build a wallet connection graph/map\n');
}

runTests().catch(console.error);
