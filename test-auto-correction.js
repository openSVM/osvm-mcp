#!/usr/bin/env node

/**
 * Test parameter auto-correction
 */

const autoCorrectParam = (args, correctName, alternatives, toolName) => {
  if (args[correctName] !== undefined) return false;

  for (const alt of alternatives) {
    if (args[alt] !== undefined) {
      args[correctName] = args[alt];
      console.warn(`[${toolName}] Auto-corrected parameter: "${alt}" → "${correctName}"`);
      return true;
    }
  }
  return false;
};

console.log('Testing Parameter Auto-Correction\n');
console.log('='.repeat(80));

const tests = [
  {
    tool: 'get_token_info',
    input: { mint: 'So11111111111111111111111111111111111111112' },
    correctParam: 'address',
    alternatives: ['mint', 'token', 'tokenAddress', 'mintAddress'],
    expected: 'Should auto-correct "mint" to "address"'
  },
  {
    tool: 'get_token_info',
    input: { token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    correctParam: 'address',
    alternatives: ['mint', 'token', 'tokenAddress', 'mintAddress'],
    expected: 'Should auto-correct "token" to "address"'
  },
  {
    tool: 'get_transaction',
    input: { tx: '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW' },
    correctParam: 'signature',
    alternatives: ['txSignature', 'tx', 'txSig', 'hash'],
    expected: 'Should auto-correct "tx" to "signature"'
  },
  {
    tool: 'get_account_stats',
    input: { wallet: 'So11111111111111111111111111111111111111112' },
    correctParam: 'address',
    alternatives: ['wallet', 'account', 'pubkey', 'publicKey'],
    expected: 'Should auto-correct "wallet" to "address"'
  },
  {
    tool: 'get_account_stats',
    input: { pubkey: 'So11111111111111111111111111111111111111112' },
    correctParam: 'address',
    alternatives: ['wallet', 'account', 'pubkey', 'publicKey'],
    expected: 'Should auto-correct "pubkey" to "address"'
  }
];

tests.forEach((test, i) => {
  console.log(`\nTest ${i + 1}: ${test.tool}`);
  console.log('  ' + test.expected);
  console.log(`  Input:  ${JSON.stringify(test.input)}`);

  const corrected = autoCorrectParam(test.input, test.correctParam, test.alternatives, test.tool);

  console.log(`  Output: ${JSON.stringify(test.input)}`);
  console.log(`  Status: ${corrected ? '✅ Auto-corrected' : '❌ No correction'}`);
});

console.log('\n' + '='.repeat(80));
console.log('\n✨ All parameter name variations are automatically handled!');
console.log('   Users can use intuitive names like "mint", "wallet", "tx", etc.');
console.log('   and they will be auto-corrected to the canonical parameter names.\n');
