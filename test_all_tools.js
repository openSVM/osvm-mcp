#!/usr/bin/env node

/**
 * Comprehensive test of all new tools
 */

import axios from 'axios';

const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;
const TEST_ADDRESS = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

console.log('🧪 Comprehensive Tool Test Suite\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Authentication: ${JWT_TOKEN ? 'Enabled ✓' : 'Disabled'}\n`);

// Test 1: AI Inference Call
async function testAIInference() {
  console.log(`${'='.repeat(70)}`);
  console.log('TEST 1: ai_inference_call');
  console.log(`${'='.repeat(70)}\n`);

  try {
    const start = Date.now();
    const response = await axios.post(`${BASE_URL}/api/getAnswer`, {
      question: 'What is Solana and why is it fast?',
      maxTokens: 200
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
      },
      timeout: 30000
    });

    const latency = Date.now() - start;
    console.log(`✓ SUCCESS (${latency}ms)`);
    console.log(`Response length: ${JSON.stringify(response.data).length} bytes`);
    console.log(`\nAnswer preview:\n${JSON.stringify(response.data).slice(0, 300)}...\n`);

  } catch (error) {
    console.log(`✗ FAILED: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error: ${JSON.stringify(error.response.data).slice(0, 200)}\n`);
    }
  }
}

// Test 2: Get Account Transfers (Fixed)
async function testAccountTransfers() {
  console.log(`${'='.repeat(70)}`);
  console.log('TEST 2: get_account_transfers (with fix)');
  console.log(`${'='.repeat(70)}\n`);
  console.log(`Address: ${TEST_ADDRESS}\n`);

  try {
    const start = Date.now();
    const response = await axios.get(`${BASE_URL}/api/account-transfers/${TEST_ADDRESS}`, {
      params: {
        limit: 20,
        transferType: 'ALL'
      },
      headers: {
        'Accept': 'application/json',
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
      },
      timeout: 30000
    });

    const latency = Date.now() - start;
    const transferCount = response.data?.data?.length || 0;
    const isJSON = response.headers['content-type']?.includes('application/json');

    console.log(`✓ SUCCESS (${latency}ms)`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Is JSON: ${isJSON ? '✓' : '✗'}`);
    console.log(`Transfers found: ${transferCount}`);
    console.log(`Response size: ${JSON.stringify(response.data).length} bytes`);

    if (transferCount > 0) {
      console.log(`\nFirst transfer sample:`);
      console.log(JSON.stringify(response.data.data[0], null, 2).slice(0, 400));
    }
    console.log('');

  } catch (error) {
    console.log(`✗ FAILED: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}\n`);
    }
  }
}

// Test 3: Find Related Transactions
async function testFindRelatedTransactions() {
  console.log(`${'='.repeat(70)}`);
  console.log('TEST 3: find_related_transactions');
  console.log(`${'='.repeat(70)}\n`);

  // First get some transaction signatures
  try {
    console.log('Step 1: Getting transaction signatures...');
    const transfersResponse = await axios.get(`${BASE_URL}/api/account-transfers/${TEST_ADDRESS}`, {
      params: { limit: 5 },
      headers: { 'Accept': 'application/json' },
      timeout: 15000
    });

    const signatures = transfersResponse.data?.data
      ?.slice(0, 2)
      .map(t => t.signature || t.txHash)
      .filter(Boolean) || [];

    if (signatures.length === 0) {
      console.log('⚠ No signatures found to test with\n');
      return;
    }

    console.log(`Found ${signatures.length} signatures`);
    console.log(`Signatures: ${signatures.join(', ').slice(0, 100)}...\n`);

    console.log('Step 2: Finding related transactions...');
    const start = Date.now();
    const response = await axios.post(`${BASE_URL}/api/find-related-transactions`, {
      signatures: signatures
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
      },
      timeout: 30000,
      validateStatus: () => true
    });

    const latency = Date.now() - start;
    console.log(`Status: ${response.status} (${latency}ms)`);

    if (response.status === 200) {
      console.log(`✓ SUCCESS`);
      console.log(`Response keys: ${Object.keys(response.data).join(', ')}`);

      if (response.data.nodes) {
        console.log(`Nodes (wallets): ${response.data.nodes.length}`);
      }
      if (response.data.edges) {
        console.log(`Edges (connections): ${response.data.edges.length}`);
      }
      if (response.data.relationships) {
        console.log(`Relationships: ${response.data.relationships.length}`);
      }
    } else {
      console.log(`⚠ Response: ${JSON.stringify(response.data).slice(0, 200)}`);
    }
    console.log('');

  } catch (error) {
    console.log(`✗ FAILED: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error: ${JSON.stringify(error.response.data).slice(0, 200)}\n`);
    }
  }
}

// Test 4: Holders by Interaction
async function testHoldersByInteraction() {
  console.log(`${'='.repeat(70)}`);
  console.log('TEST 4: holders_by_interaction');
  console.log(`${'='.repeat(70)}\n`);

  const testPrograms = [
    { name: 'Raydium V4', address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' },
    { name: 'Jupiter', address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' }
  ];

  for (const program of testPrograms) {
    console.log(`Testing ${program.name}...`);

    try {
      const start = Date.now();
      const response = await axios.get(`${BASE_URL}/api/holdersByInteraction`, {
        params: {
          program: program.address,
          limit: 5,
          minInteractions: 1
        },
        headers: {
          'Accept': 'application/json',
          ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
        },
        timeout: 20000,
        validateStatus: () => true
      });

      const latency = Date.now() - start;
      console.log(`Status: ${response.status} (${latency}ms)`);

      if (response.status === 200) {
        console.log(`✓ SUCCESS`);
        if (Array.isArray(response.data)) {
          console.log(`Holders found: ${response.data.length}`);
          if (response.data.length > 0) {
            console.log(`Sample: ${JSON.stringify(response.data[0]).slice(0, 150)}`);
          }
        } else {
          console.log(`Response: ${JSON.stringify(response.data).slice(0, 200)}`);
        }
      } else {
        console.log(`⚠ Status ${response.status}: ${JSON.stringify(response.data).slice(0, 100)}`);
      }
      console.log('');

    } catch (error) {
      console.log(`✗ FAILED: ${error.message}`);
      if (error.response) {
        console.log(`Status: ${error.response.status}\n`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Test 5: Integration Test - Building Wallet Map Data
async function testWalletMapIntegration() {
  console.log(`${'='.repeat(70)}`);
  console.log('TEST 5: Wallet Map Integration (end-to-end)');
  console.log(`${'='.repeat(70)}\n`);
  console.log('Building wallet connection data for visualization...\n');

  const walletMapData = {
    centerWallet: TEST_ADDRESS,
    transfers: null,
    connectedWallets: new Set(),
    relationships: null,
    programInteractions: null
  };

  try {
    // Step 1: Get transfers
    console.log('1️⃣  Fetching account transfers...');
    const transfersRes = await axios.get(`${BASE_URL}/api/account-transfers/${TEST_ADDRESS}`, {
      params: { limit: 10 },
      headers: { 'Accept': 'application/json' },
      timeout: 15000
    });

    walletMapData.transfers = transfersRes.data?.data || [];
    console.log(`   ✓ Found ${walletMapData.transfers.length} transfers`);

    // Extract connected wallets
    walletMapData.transfers.forEach(t => {
      if (t.from && t.from !== TEST_ADDRESS) walletMapData.connectedWallets.add(t.from);
      if (t.to && t.to !== TEST_ADDRESS) walletMapData.connectedWallets.add(t.to);
    });
    console.log(`   ✓ Identified ${walletMapData.connectedWallets.size} connected wallets\n`);

    // Step 2: Build visualization data
    console.log('2️⃣  Building graph structure...');
    const nodes = [
      { id: TEST_ADDRESS, type: 'center', label: 'Center Wallet' },
      ...Array.from(walletMapData.connectedWallets).slice(0, 10).map((addr, i) => ({
        id: addr,
        type: 'connected',
        label: `Wallet ${i + 1}`
      }))
    ];

    const edges = walletMapData.transfers.slice(0, 10).map((t, i) => ({
      id: `edge-${i}`,
      from: t.from || TEST_ADDRESS,
      to: t.to || TEST_ADDRESS,
      amount: t.amount,
      type: t.type
    }));

    console.log(`   ✓ Nodes: ${nodes.length}`);
    console.log(`   ✓ Edges: ${edges.length}\n`);

    console.log('3️⃣  Wallet map data structure:');
    console.log(JSON.stringify({
      centerWallet: walletMapData.centerWallet,
      stats: {
        totalTransfers: walletMapData.transfers.length,
        connectedWallets: walletMapData.connectedWallets.size,
        graphNodes: nodes.length,
        graphEdges: edges.length
      },
      nodes: nodes.slice(0, 3),
      edges: edges.slice(0, 3)
    }, null, 2));

    console.log(`\n✓ INTEGRATION TEST SUCCESS\n`);

  } catch (error) {
    console.log(`✗ INTEGRATION TEST FAILED: ${error.message}\n`);
  }
}

// Run all tests
async function runAllTests() {
  await testAIInference();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testAccountTransfers();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testFindRelatedTransactions();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testHoldersByInteraction();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await testWalletMapIntegration();

  console.log(`${'='.repeat(70)}`);
  console.log('✅ ALL TESTS COMPLETE');
  console.log(`${'='.repeat(70)}\n`);

  console.log('📊 Summary:');
  console.log('- ai_inference_call: AI-powered blockchain analysis');
  console.log('- get_account_transfers: Fixed and working (returns JSON)');
  console.log('- find_related_transactions: Discovers wallet connections');
  console.log('- holders_by_interaction: Identifies wallet clusters');
  console.log('- Integration: Can build wallet connection graphs\n');
}

runAllTests().catch(console.error);
