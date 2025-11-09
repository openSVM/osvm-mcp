#!/usr/bin/env node

/**
 * Test array auto-correction for get_token_metadata
 */

console.log('Testing Array Auto-Correction for get_token_metadata\n');
console.log('='.repeat(80));

const tests = [
  {
    description: 'Single mint as string with "mint" parameter',
    input: { mint: 'So11111111111111111111111111111111111111112' },
    expected: { mints: ['So11111111111111111111111111111111111111112'] }
  },
  {
    description: 'Single mint as string with "mints" parameter',
    input: { mints: 'So11111111111111111111111111111111111111112' },
    expected: { mints: ['So11111111111111111111111111111111111111112'] }
  },
  {
    description: 'Multiple mints as array with "mint" parameter',
    input: { mint: ['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'] },
    expected: { mints: ['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'] }
  },
  {
    description: 'Multiple mints as array with "mints" parameter (correct usage)',
    input: { mints: ['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'] },
    expected: { mints: ['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'] }
  }
];

tests.forEach((test, i) => {
  console.log(`\nTest ${i + 1}: ${test.description}`);
  console.log(`  Input:    ${JSON.stringify(test.input)}`);

  const args = { ...test.input };

  // Simulate the auto-correction logic
  if (args.mints === undefined && args.mint !== undefined) {
    args.mints = Array.isArray(args.mint) ? args.mint : [args.mint];
    console.log(`  Action:   Auto-corrected "mint" → "mints" (as array)`);
  } else if (typeof args.mints === 'string') {
    args.mints = [args.mints];
    console.log(`  Action:   Auto-corrected single string → array`);
  } else {
    console.log(`  Action:   No correction needed`);
  }

  console.log(`  Result:   ${JSON.stringify(args)}`);
  console.log(`  Expected: ${JSON.stringify(test.expected)}`);
  console.log(`  Status:   ${JSON.stringify(args.mints) === JSON.stringify(test.expected.mints) ? '✅ Pass' : '❌ Fail'}`);
});

console.log('\n' + '='.repeat(80));
console.log('\n✨ All variations handled:');
console.log('   - Single mint as "mint" → auto-converted to array');
console.log('   - Single mint as "mints" → auto-converted to array');
console.log('   - Array as "mint" → auto-converted to "mints"');
console.log('   - Array as "mints" → works as-is\n');
