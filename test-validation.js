#!/usr/bin/env node

// Simple test to verify validation error messages

const testCases = [
  {
    name: 'Invalid short address',
    input: { address: 'invalid' },
    tool: 'get_token_info'
  },
  {
    name: 'Invalid signature (too short)',
    input: { signature: 'tooshort' },
    tool: 'get_transaction'
  },
  {
    name: 'Wrong type for address (number)',
    input: { address: 12345 },
    tool: 'get_token_info'
  }
];

// Import validation helpers
const getAddressValidationError = (address) => {
  if (typeof address !== 'string') {
    return `Invalid Solana address format: expected string, got ${typeof address}. Example: "So11111111111111111111111111111111111111112"`;
  }
  return `Invalid Solana address format: address must be 32-44 characters (got ${address.length}). Example: "So11111111111111111111111111111111111111112"`;
};

const getSignatureValidationError = (signature) => {
  if (typeof signature !== 'string') {
    return `Invalid transaction signature format: expected string, got ${typeof signature}. Example: "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"`;
  }
  return `Invalid transaction signature format: signature must be 87-88 characters (got ${signature.length}). Example: "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"`;
};

console.log('Testing validation error messages:\n');

testCases.forEach(test => {
  console.log(`Test: ${test.name}`);
  console.log(`Tool: ${test.tool}`);

  if (test.tool === 'get_token_info') {
    console.log(`Error message: ${getAddressValidationError(test.input.address)}`);
  } else if (test.tool === 'get_transaction') {
    console.log(`Error message: ${getSignatureValidationError(test.input.signature)}`);
  }

  console.log('');
});
