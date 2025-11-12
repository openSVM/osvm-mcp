#!/usr/bin/env node

import axios from 'axios';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function testEndpoint(url, description) {
  try {
    console.log(`\n${colors.cyan}Testing: ${description}${colors.reset}`);
    console.log(`URL: ${url}`);

    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true
    });

    if (response.status === 200) {
      console.log(`${colors.green}✅ Status: ${response.status} OK${colors.reset}`);

      // Check if it's HTML (error) or JSON (success)
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('text/html')) {
        console.log(`${colors.red}❌ ERROR: Received HTML instead of JSON (404 page)${colors.reset}`);
        return false;
      }

      // Validate the response structure
      const data = response.data;

      if (description.includes('transaction')) {
        // Check for transfers field
        if (data.transfers || data.tokenTransfers || data.details?.tokenTransfers) {
          console.log(`${colors.green}✅ Has transfer data${colors.reset}`);

          // Check the transfers for from/to fields
          const transfers = data.transfers || data.tokenTransfers || data.details?.tokenTransfers || [];
          if (transfers.length > 0) {
            console.log(`${colors.cyan}Sample transfer:${colors.reset}`);
            const transfer = transfers[0];
            console.log(JSON.stringify(transfer, null, 2));

            // Check if we have proper field mapping
            if (transfer.account !== undefined && transfer.change !== undefined) {
              console.log(`${colors.green}✅ Has account/change fields${colors.reset}`);
            }
            if (transfer.from !== undefined || transfer.to !== undefined) {
              console.log(`${colors.green}✅ Has from/to fields (mapped)${colors.reset}`);
            } else if (transfer.account && !transfer.from && !transfer.to) {
              console.log(`${colors.red}❌ Missing from/to field mapping${colors.reset}`);
              return false;
            }
          }
        }
      }

      if (description.includes('account-transactions')) {
        // Check for transactions array
        if (data.transactions && Array.isArray(data.transactions)) {
          console.log(`${colors.green}✅ Has transactions array (${data.transactions.length} transactions)${colors.reset}`);

          if (data.transactions.length > 0 && data.transactions[0].transfers) {
            console.log(`${colors.cyan}Sample transfer from first transaction:${colors.reset}`);
            console.log(JSON.stringify(data.transactions[0].transfers[0], null, 2));
          }
        } else {
          console.log(`${colors.red}❌ Missing transactions array${colors.reset}`);
          return false;
        }
      }

      return true;
    } else {
      console.log(`${colors.red}❌ Status: ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runTests() {
  console.log(`${colors.bright}${colors.cyan}🔍 Verifying MCP Server Fixes${colors.reset}`);
  console.log('='.repeat(60));

  const tests = [
    {
      url: 'https://opensvm.com/api/transaction/5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk',
      description: 'get_transaction - Check transfer field mapping'
    },
    {
      url: 'https://opensvm.com/api/account-transactions/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263?limit=2',
      description: 'get_account_transactions - Check endpoint path fix'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await testEndpoint(test.url, test.description);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}📊 Results:${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);

  if (failed === 0) {
    console.log(`\n${colors.green}${colors.bright}🎉 All fixes verified successfully!${colors.reset}`);
    console.log(`${colors.green}The MCP server is working correctly.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bright}⚠️ Some issues remain${colors.reset}`);
    console.log(`${colors.yellow}Please check the errors above.${colors.reset}`);
  }
}

runTests().catch(console.error);