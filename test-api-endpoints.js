#!/usr/bin/env node

import axios from 'axios';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test configuration
const API_BASE = 'https://opensvm.com';
const API_KEY = process.env.OPENSVM_API_KEY || '';

const axiosConfig = {
  headers: API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {},
  timeout: 10000,
  validateStatus: () => true // Don't throw on any status code
};

// Test data
const TEST_DATA = {
  validSignature: '5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk',
  validAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  validMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  validSlot: 250000000
};

// Define API endpoints to test
const ENDPOINTS = [
  // Transaction endpoints
  {
    name: 'get_transaction (path param)',
    url: `/api/transaction/${TEST_DATA.validSignature}`,
    method: 'GET',
    category: 'Transaction'
  },
  {
    name: 'get_transaction (query param)',
    url: `/api/transaction`,
    params: { signature: TEST_DATA.validSignature },
    method: 'GET',
    category: 'Transaction'
  },

  // Account endpoints
  {
    name: 'account-stats',
    url: `/api/account-stats`,
    params: { address: TEST_DATA.validAddress },
    method: 'GET',
    category: 'Account'
  },
  {
    name: 'account-portfolio',
    url: `/api/account-portfolio/${TEST_DATA.validAddress}`,
    method: 'GET',
    category: 'Account'
  },
  {
    name: 'account-transactions',
    url: `/api/account-transactions`,
    params: { address: TEST_DATA.validAddress, limit: 5 },
    method: 'GET',
    category: 'Account'
  },
  {
    name: 'account-token-stats',
    url: `/api/account-token-stats`,
    params: { address: TEST_DATA.validAddress, mint: TEST_DATA.validMint },
    method: 'GET',
    category: 'Account'
  },
  {
    name: 'check-account-type',
    url: `/api/check-account-type`,
    params: { address: TEST_DATA.validAddress },
    method: 'GET',
    category: 'Account'
  },

  // Block endpoints
  {
    name: 'block',
    url: `/api/block`,
    params: { slot: TEST_DATA.validSlot },
    method: 'GET',
    category: 'Block'
  },
  {
    name: 'blocks/recent',
    url: `/api/blocks/recent`,
    params: { limit: 5 },
    method: 'GET',
    category: 'Block'
  },
  {
    name: 'blocks/stats',
    url: `/api/blocks/stats`,
    method: 'GET',
    category: 'Block'
  },

  // Search endpoints
  {
    name: 'search',
    url: `/api/search`,
    params: { q: 'bonk' },
    method: 'GET',
    category: 'Search'
  },
  {
    name: 'search/accounts',
    url: `/api/search/accounts`,
    params: { q: 'bonk', limit: 5 },
    method: 'GET',
    category: 'Search'
  },

  // Analytics endpoints
  {
    name: 'analytics/overview',
    url: `/api/analytics/overview`,
    method: 'GET',
    category: 'Analytics'
  },
  {
    name: 'analytics/defi-health',
    url: `/api/analytics/defi-health`,
    method: 'GET',
    category: 'Analytics'
  },
  {
    name: 'analytics/validators',
    url: `/api/analytics/validators`,
    method: 'GET',
    category: 'Analytics'
  },

  // Market data
  {
    name: 'market-data',
    url: `/api/market-data`,
    params: { mint: TEST_DATA.validMint },
    method: 'GET',
    category: 'Market'
  },
  {
    name: 'chart',
    url: `/api/chart`,
    params: { mint: TEST_DATA.validMint, type: '1h' },
    method: 'GET',
    category: 'Market'
  },

  // Token endpoints
  {
    name: 'token',
    url: `/api/token/${TEST_DATA.validMint}`,
    method: 'GET',
    category: 'Token'
  },
  {
    name: 'token-metadata',
    url: `/api/token-metadata`,
    params: { mint: TEST_DATA.validMint },
    method: 'GET',
    category: 'Token'
  }
];

async function testEndpoint(endpoint) {
  try {
    const config = { ...axiosConfig };
    if (endpoint.params) {
      config.params = endpoint.params;
    }

    const fullUrl = `${API_BASE}${endpoint.url}`;
    const response = await axios.get(fullUrl, config);

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      hasData: response.data && Object.keys(response.data).length > 0,
      error: response.status >= 400 ? response.data?.error || response.statusText : null
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      hasData: false,
      error: error.message
    };
  }
}

async function testAllEndpoints() {
  console.log(`${colors.bright}OpenSVM API Endpoint Test${colors.reset}`);
  console.log(`${'='.repeat(80)}\n`);

  if (!API_KEY) {
    console.log(`${colors.yellow}⚠️ Warning: No OPENSVM_API_KEY found in environment${colors.reset}`);
    console.log(`${colors.yellow}   Some endpoints may require authentication${colors.reset}\n`);
  }

  console.log(`${colors.cyan}Testing ${ENDPOINTS.length} API endpoints...${colors.reset}\n`);

  // Group by category
  const byCategory = {};
  for (const endpoint of ENDPOINTS) {
    if (!byCategory[endpoint.category]) {
      byCategory[endpoint.category] = [];
    }
    byCategory[endpoint.category].push(endpoint);
  }

  const results = {
    passed: [],
    failed: [],
    unauthorized: []
  };

  // Test each category
  for (const [category, endpoints] of Object.entries(byCategory)) {
    console.log(`${colors.blue}${colors.bright}📦 ${category} Endpoints${colors.reset}`);
    console.log(`${'-'.repeat(40)}`);

    for (const endpoint of endpoints) {
      process.stdout.write(`  Testing ${colors.yellow}${endpoint.name}${colors.reset}... `);

      const result = await testEndpoint(endpoint);

      if (result.success) {
        console.log(`${colors.green}✅ OK${colors.reset} (${result.status})`);
        results.passed.push(endpoint.name);
      } else if (result.status === 401 || result.status === 403) {
        console.log(`${colors.yellow}🔐 AUTH${colors.reset} (${result.status})`);
        results.unauthorized.push(endpoint.name);
      } else if (result.status === 404) {
        console.log(`${colors.red}❌ NOT FOUND${colors.reset} (404)`);
        results.failed.push({ name: endpoint.name, error: 'Endpoint not found' });
      } else if (result.status === 400) {
        console.log(`${colors.yellow}⚠️ BAD REQUEST${colors.reset} (400)`);
        results.failed.push({ name: endpoint.name, error: 'Bad request parameters' });
      } else {
        console.log(`${colors.red}❌ FAILED${colors.reset} (${result.status}) - ${result.error}`);
        results.failed.push({ name: endpoint.name, error: result.error });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log();
  }

  // Summary
  console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}📊 TEST SUMMARY${colors.reset}`);
  console.log(`${colors.bright}${'='.repeat(80)}${colors.reset}\n`);

  const total = ENDPOINTS.length;
  const passRate = ((results.passed.length / total) * 100).toFixed(1);

  console.log(`${colors.green}✅ Working: ${results.passed.length}/${total} (${passRate}%)${colors.reset}`);
  console.log(`${colors.yellow}🔐 Auth Required: ${results.unauthorized.length}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${results.failed.length}${colors.reset}`);

  if (results.failed.length > 0) {
    console.log(`\n${colors.red}Failed endpoints:${colors.reset}`);
    results.failed.forEach(item => {
      console.log(`  - ${item.name}: ${item.error}`);
    });
  }

  if (results.unauthorized.length > 0) {
    console.log(`\n${colors.yellow}Endpoints requiring authentication:${colors.reset}`);
    results.unauthorized.forEach(name => {
      console.log(`  - ${name}`);
    });
  }

  // Overall status
  console.log(`\n${colors.bright}${'='.repeat(80)}${colors.reset}`);
  if (results.failed.length === 0) {
    console.log(`${colors.green}${colors.bright}✅ ALL ENDPOINTS WORKING!${colors.reset}`);
    console.log(`${colors.green}API paths are correctly configured.${colors.reset}`);
  } else if (results.failed.length <= 3) {
    console.log(`${colors.yellow}${colors.bright}⚠️ MOSTLY SUCCESSFUL${colors.reset}`);
    console.log(`${colors.yellow}Most endpoints work, ${results.failed.length} endpoints need attention.${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}❌ MULTIPLE FAILURES${colors.reset}`);
    console.log(`${colors.red}${results.failed.length} endpoints failed. Check the API paths.${colors.reset}`);
  }

  if (results.unauthorized.length > 0 && !API_KEY) {
    console.log(`\n${colors.yellow}💡 Tip: Set OPENSVM_API_KEY environment variable to test authenticated endpoints${colors.reset}`);
  }
}

// Run the test
testAllEndpoints().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});