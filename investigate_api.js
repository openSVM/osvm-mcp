#!/usr/bin/env node

/**
 * Investigation script for API response format issue
 */

import axios from 'axios';

const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;

async function investigateEndpoint(endpoint, params, description) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 ${description}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`URL: ${BASE_URL}${endpoint}`);
  console.log(`Params: ${JSON.stringify(params, null, 2)}\n`);

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
      },
      timeout: 30000,
      validateStatus: () => true // Accept all status codes
    });

    console.log(`✓ Status: ${response.status} ${response.statusText}`);
    console.log(`\n📋 Response Headers:`);
    Object.entries(response.headers).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log(`\n📦 Response Type: ${typeof response.data}`);
    console.log(`📏 Response Size: ${JSON.stringify(response.data).length} bytes`);

    // Detect content type
    const contentType = response.headers['content-type'] || 'unknown';
    console.log(`📄 Content-Type: ${contentType}`);

    // Check if HTML
    const isHTML = typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE') || response.data.trim().startsWith('<html');
    console.log(`🌐 Is HTML: ${isHTML}`);

    // Show preview
    console.log(`\n📝 Response Preview (first 500 chars):`);
    const preview = typeof response.data === 'string'
      ? response.data.slice(0, 500)
      : JSON.stringify(response.data, null, 2).slice(0, 500);
    console.log(preview);

    if (!isHTML && typeof response.data === 'object') {
      console.log(`\n✓ Valid JSON response`);
      console.log(`Keys: ${Object.keys(response.data).join(', ')}`);
    }

    return { success: true, isHTML, status: response.status, data: response.data };

  } catch (error) {
    console.log(`\n✗ Error: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
    }
    return { success: false, error: error.message };
  }
}

async function runInvestigation() {
  console.log('🔬 API Response Format Investigation\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Authentication: ${JWT_TOKEN ? 'Enabled' : 'Disabled'}\n`);

  const testAddress = 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck';
  const knownActiveAddress = 'So11111111111111111111111111111111111111112'; // Wrapped SOL

  // Test different endpoint variations
  const tests = [
    {
      endpoint: '/api/account-transfers',
      params: { address: testAddress },
      description: 'Original endpoint with test address'
    },
    {
      endpoint: '/api/account-transfers',
      params: { address: knownActiveAddress },
      description: 'Original endpoint with known active address (Wrapped SOL)'
    },
    {
      endpoint: '/api/account/transfers',
      params: { address: testAddress },
      description: 'Alternative endpoint format (account/transfers)'
    },
    {
      endpoint: '/account-transfers',
      params: { address: testAddress },
      description: 'Without /api prefix'
    },
    {
      endpoint: '/api/accounts/transfers',
      params: { address: testAddress },
      description: 'Plural accounts format'
    }
  ];

  const results = [];

  for (const test of tests) {
    const result = await investigateEndpoint(test.endpoint, test.params, test.description);
    results.push({ ...test, ...result });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 Investigation Summary');
  console.log(`${'='.repeat(70)}\n`);

  const jsonResponses = results.filter(r => r.success && !r.isHTML);
  const htmlResponses = results.filter(r => r.success && r.isHTML);
  const errorResponses = results.filter(r => !r.success);

  console.log(`✓ Valid JSON responses: ${jsonResponses.length}`);
  console.log(`⚠ HTML responses: ${htmlResponses.length}`);
  console.log(`✗ Error responses: ${errorResponses.length}\n`);

  if (jsonResponses.length > 0) {
    console.log('✅ Working endpoints:');
    jsonResponses.forEach(r => {
      console.log(`  - ${r.endpoint} (Status: ${r.status})`);
    });
  }

  if (htmlResponses.length > 0) {
    console.log('\n⚠ Endpoints returning HTML:');
    htmlResponses.forEach(r => {
      console.log(`  - ${r.endpoint} (Status: ${r.status})`);
    });
  }

  if (errorResponses.length > 0) {
    console.log('\n✗ Failed endpoints:');
    errorResponses.forEach(r => {
      console.log(`  - ${r.endpoint} (Error: ${r.error})`);
    });
  }

  // Check OpenAPI documentation
  console.log(`\n${'='.repeat(70)}`);
  console.log('📚 Checking OpenAPI Documentation');
  console.log(`${'='.repeat(70)}\n`);

  try {
    const openApiResponse = await axios.get(`${BASE_URL}/openapi`, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000
    });

    console.log('✓ OpenAPI spec retrieved');

    // Search for account-transfers endpoint
    const specString = JSON.stringify(openApiResponse.data);

    if (specString.includes('account-transfers')) {
      console.log('✓ Found "account-transfers" in OpenAPI spec');
    }
    if (specString.includes('account/transfers')) {
      console.log('✓ Found "account/transfers" in OpenAPI spec');
    }

    // Try to find the correct path
    const paths = openApiResponse.data.paths || {};
    const relevantPaths = Object.keys(paths).filter(p =>
      p.includes('transfer') || p.includes('account')
    );

    if (relevantPaths.length > 0) {
      console.log('\n📍 Relevant endpoints found in OpenAPI:');
      relevantPaths.forEach(path => {
        console.log(`  - ${path}`);
      });
    }

  } catch (error) {
    console.log(`✗ Could not retrieve OpenAPI spec: ${error.message}`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Investigation Complete');
  console.log(`${'='.repeat(70)}\n`);
}

runInvestigation().catch(console.error);
