#!/usr/bin/env node

/**
 * Test the correct endpoint format with address as path parameter
 */

import axios from 'axios';

const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;
const TEST_ADDRESS = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';

async function testCorrectEndpoint() {
  console.log('🔬 Testing Correct Endpoint Format\n');
  console.log(`Address: ${TEST_ADDRESS}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Authentication: ${JWT_TOKEN ? 'Enabled ✓' : 'Disabled (may be required) ⚠'}\n`);

  const tests = [
    {
      name: 'Correct format - address as path param (no auth)',
      url: `${BASE_URL}/api/account-transfers/${TEST_ADDRESS}`,
      params: {}
    },
    {
      name: 'With limit parameter',
      url: `${BASE_URL}/api/account-transfers/${TEST_ADDRESS}`,
      params: { limit: 10 }
    },
    {
      name: 'With transferType filter',
      url: `${BASE_URL}/api/account-transfers/${TEST_ADDRESS}`,
      params: { transferType: 'IN', limit: 20 }
    },
    {
      name: 'SOL only transfers',
      url: `${BASE_URL}/api/account-transfers/${TEST_ADDRESS}`,
      params: { solanaOnly: true, limit: 10 }
    }
  ];

  for (const test of tests) {
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 Test: ${test.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`URL: ${test.url}`);
    console.log(`Params: ${JSON.stringify(test.params, null, 2)}\n`);

    const startTime = Date.now();

    try {
      const response = await axios.get(test.url, {
        params: test.params,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
        },
        timeout: 30000,
        validateStatus: () => true
      });

      const latency = Date.now() - startTime;
      const contentType = response.headers['content-type'] || 'unknown';
      const isJSON = contentType.includes('application/json');
      const isHTML = typeof response.data === 'string' && response.data.trim().startsWith('<!');

      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Latency: ${latency}ms`);
      console.log(`Content-Type: ${contentType}`);
      console.log(`Is JSON: ${isJSON}`);
      console.log(`Is HTML: ${isHTML}`);

      if (isJSON && !isHTML) {
        console.log(`✓ SUCCESS - Valid JSON response`);
        console.log(`Response size: ${JSON.stringify(response.data).length} bytes`);

        if (Array.isArray(response.data)) {
          console.log(`Transfer count: ${response.data.length}`);
          if (response.data.length > 0) {
            console.log(`\nSample transfer:`);
            console.log(JSON.stringify(response.data[0], null, 2));
          }
        } else if (typeof response.data === 'object') {
          console.log(`Response keys: ${Object.keys(response.data).join(', ')}`);
          const transfers = response.data.transfers || response.data.data || [];
          console.log(`Transfer count: ${Array.isArray(transfers) ? transfers.length : 'N/A'}`);
        }
      } else if (isHTML) {
        console.log(`⚠ HTML response received (likely Next.js page)`);
      } else if (response.status === 401) {
        console.log(`⚠ Authentication required`);
        console.log(`Response: ${JSON.stringify(response.data, null, 2).slice(0, 500)}`);
      } else {
        console.log(`Response preview: ${JSON.stringify(response.data, null, 2).slice(0, 500)}`);
      }

    } catch (error) {
      const latency = Date.now() - startTime;
      console.log(`✗ ERROR - ${latency}ms`);
      console.log(`Message: ${error.message}`);
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log(`Data: ${JSON.stringify(error.response.data, null, 2).slice(0, 300)}`);
      }
    }

    console.log('');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`${'='.repeat(70)}`);
  console.log('✅ Test Complete');
  console.log(`${'='.repeat(70)}\n`);
}

testCorrectEndpoint().catch(console.error);
