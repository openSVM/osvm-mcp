#!/usr/bin/env node

/**
 * Test all error messages with examples
 */

// Import validation helpers (duplicated for testing)
const isValidSolanaAddress = (address) => {
  return typeof address === 'string' && address.length >= 32 && address.length <= 44;
};

const getAddressValidationError = (address, fieldName = 'address') => {
  if (typeof address !== 'string') {
    return `Invalid Solana ${fieldName} format: expected string, got ${typeof address}. Example: "So11111111111111111111111111111111111111112"`;
  }
  return `Invalid Solana ${fieldName} format: must be 32-44 characters (got ${address.length}). Example: "So11111111111111111111111111111111111111112"`;
};

const getSignatureValidationError = (signature) => {
  if (typeof signature !== 'string') {
    return `Invalid transaction signature format: expected string, got ${typeof signature}. Example: "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"`;
  }
  return `Invalid transaction signature format: must be 87-88 characters (got ${signature.length}). Example: "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"`;
};

const getArrayValidationError = (arr, fieldName, itemExample, maxItems) => {
  if (!Array.isArray(arr)) {
    return `${fieldName} must be an array. Example: [${itemExample}]`;
  }
  if (arr.length === 0) {
    return `${fieldName} cannot be empty. Example: [${itemExample}]`;
  }
  if (maxItems && arr.length > maxItems) {
    return `${fieldName} exceeds maximum of ${maxItems} items (got ${arr.length}). Reduce the array size.`;
  }
  return `Invalid ${fieldName}. Example: [${itemExample}]`;
};

const getRequiredFieldError = (fieldName, example) => {
  return `${fieldName} is required. Example: ${example}`;
};

const getNumberValidationError = (value, fieldName, constraints = {}) => {
  if (typeof value !== 'number') {
    return `${fieldName} must be a number, got ${typeof value}. Example: ${constraints?.min ?? 1}`;
  }
  if (constraints?.min !== undefined && value < constraints.min) {
    return `${fieldName} must be >= ${constraints.min} (got ${value}).`;
  }
  if (constraints?.max !== undefined && value > constraints.max) {
    return `${fieldName} must be <= ${constraints.max} (got ${value}).`;
  }
  return `Invalid ${fieldName}: ${value}`;
};

// Test cases
const testCases = [
  {
    category: 'Address Validation',
    tests: [
      { name: 'Too short address', fn: () => getAddressValidationError('short') },
      { name: 'Wrong type (number)', fn: () => getAddressValidationError(12345) },
      { name: 'Wrong type (null)', fn: () => getAddressValidationError(null) },
      { name: 'Program ID validation', fn: () => getAddressValidationError('abc', 'program ID') },
      { name: 'Mint validation', fn: () => getAddressValidationError('xyz', 'mint') },
      { name: 'Wallet address validation', fn: () => getAddressValidationError('test', 'wallet address') },
    ]
  },
  {
    category: 'Signature Validation',
    tests: [
      { name: 'Too short signature', fn: () => getSignatureValidationError('tooshort') },
      { name: 'Wrong type (number)', fn: () => getSignatureValidationError(999) },
      { name: 'Too long signature', fn: () => getSignatureValidationError('a'.repeat(100)) },
    ]
  },
  {
    category: 'Array Validation',
    tests: [
      { name: 'Not an array', fn: () => getArrayValidationError('notarray', 'Mints', '"So11...112"') },
      { name: 'Empty array', fn: () => getArrayValidationError([], 'Signatures', '"5VER...QUW"') },
      { name: 'Array too large', fn: () => getArrayValidationError(new Array(150), 'Addresses', '"So11...112"', 100) },
    ]
  },
  {
    category: 'Required Fields',
    tests: [
      { name: 'Missing transaction', fn: () => getRequiredFieldError('Transaction', '"base64EncodedTransaction"') },
      { name: 'Missing key ID', fn: () => getRequiredFieldError('Key ID', '"key_abc123"') },
      { name: 'Missing blockhash', fn: () => getRequiredFieldError('Blockhash', '"9sHcv6xwn9YkB8nxTUGKDwPwNnmqVp5oAXxU8Fdkm4J6"') },
    ]
  },
  {
    category: 'Number Validation',
    tests: [
      { name: 'Wrong type', fn: () => getNumberValidationError('string', 'Limit', { min: 1 }) },
      { name: 'Too small', fn: () => getNumberValidationError(0, 'Limit', { min: 1 }) },
      { name: 'Too large', fn: () => getNumberValidationError(2000, 'Limit', { max: 1000 }) },
    ]
  },
];

console.log('='.repeat(80));
console.log('COMPREHENSIVE ERROR MESSAGE TESTS');
console.log('='.repeat(80));
console.log();

let totalTests = 0;
let passedTests = 0;

testCases.forEach(category => {
  console.log(`\n📋 ${category.category}`);
  console.log('-'.repeat(80));

  category.tests.forEach(test => {
    totalTests++;
    const result = test.fn();
    const hasExample = result.includes('Example:') || result.includes('example');
    const hasDetails = result.length > 20; // Reasonably detailed message
    const isHelpful = hasExample || result.includes('must be') || result.includes('required') || result.includes('exceeds');

    if (isHelpful && hasDetails) {
      passedTests++;
      console.log(`  ✅ ${test.name}`);
    } else {
      console.log(`  ❌ ${test.name}`);
    }
    console.log(`     ${result}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed`);
console.log('='.repeat(80));

process.exit(passedTests === totalTests ? 0 : 1);
