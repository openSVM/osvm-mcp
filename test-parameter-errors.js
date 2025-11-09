#!/usr/bin/env node

/**
 * Test parameter name error detection
 */

console.log('Testing parameter name error detection:\n');

// Simulate the error that would occur
const testCases = [
  {
    description: 'Using "mint" instead of "address" in get_token_info',
    args: { mint: 'So11111111111111111111111111111111111111112' },
    expectedParam: 'address',
    actualValue: 'So11111111111111111111111111111111111111112'
  },
  {
    description: 'Missing address parameter entirely',
    args: {},
    expectedParam: 'address',
    actualValue: undefined
  },
  {
    description: 'Correct usage',
    args: { address: 'So11111111111111111111111111111111111111112' },
    expectedParam: 'address',
    actualValue: 'So11111111111111111111111111111111111111112'
  }
];

testCases.forEach((test, i) => {
  console.log(`Test ${i + 1}: ${test.description}`);
  console.log(`  Input: ${JSON.stringify(test.args)}`);

  if (test.args.address === undefined && test.args.mint !== undefined) {
    console.log(`  ❌ Error: Parameter name error: use "address" instead of "mint". Example: {"address": "${test.args.mint}"}`);
  } else if (test.args.address === undefined) {
    console.log(`  ❌ Error: Missing required parameter: address is required. Example: {"address": "So11111111111111111111111111111111111111112"}`);
  } else {
    console.log(`  ✅ Valid - would proceed to validation`);
  }
  console.log();
});
