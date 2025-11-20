#!/usr/bin/env node

import { readFileSync } from 'fs';
import zlib from 'zlib';

// Get sample data
const sampleData = readFileSync('/tmp/sample_transfer.json', 'utf8');
const original = Buffer.from(sampleData);

console.log('🔍 Compression Algorithm Comparison\n');
console.log(`Original size: ${original.length.toLocaleString()} bytes\n`);

// Test Gzip
const gzipStart = Date.now();
const gzipped = zlib.gzipSync(original, { level: 6 });
const gzipTime = Date.now() - gzipStart;
const gzipRatio = ((1 - gzipped.length / original.length) * 100).toFixed(1);

console.log('📦 Gzip (level 6):');
console.log(`   Size: ${gzipped.length.toLocaleString()} bytes`);
console.log(`   Ratio: ${gzipRatio}% reduction`);
console.log(`   Time: ${gzipTime}ms\n`);

// Test Gzip max compression
const gzipMaxStart = Date.now();
const gzippedMax = zlib.gzipSync(original, { level: 9 });
const gzipMaxTime = Date.now() - gzipMaxStart;
const gzipMaxRatio = ((1 - gzippedMax.length / original.length) * 100).toFixed(1);

console.log('📦 Gzip (level 9 - max):');
console.log(`   Size: ${gzippedMax.length.toLocaleString()} bytes`);
console.log(`   Ratio: ${gzipMaxRatio}% reduction`);
console.log(`   Time: ${gzipMaxTime}ms\n`);

// Test Deflate
const deflateStart = Date.now();
const deflated = zlib.deflateSync(original, { level: 6 });
const deflateTime = Date.now() - deflateStart;
const deflateRatio = ((1 - deflated.length / original.length) * 100).toFixed(1);

console.log('📦 Deflate (level 6):');
console.log(`   Size: ${deflated.length.toLocaleString()} bytes`);
console.log(`   Ratio: ${deflateRatio}% reduction`);
console.log(`   Time: ${deflateTime}ms\n`);

// Test Brotli (if available)
try {
  const brotliStart = Date.now();
  const brotlied = zlib.brotliCompressSync(original, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 6
    }
  });
  const brotliTime = Date.now() - brotliStart;
  const brotliRatio = ((1 - brotlied.length / original.length) * 100).toFixed(1);

  console.log('📦 Brotli (quality 6):');
  console.log(`   Size: ${brotlied.length.toLocaleString()} bytes`);
  console.log(`   Ratio: ${brotliRatio}% reduction`);
  console.log(`   Time: ${brotliTime}ms`);
  console.log(`   vs Gzip: ${((1 - brotlied.length / gzipped.length) * 100).toFixed(1)}% smaller\n`);

  // Brotli max
  const brotliMaxStart = Date.now();
  const brotliedMax = zlib.brotliCompressSync(original, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11
    }
  });
  const brotliMaxTime = Date.now() - brotliMaxStart;
  const brotliMaxRatio = ((1 - brotliedMax.length / original.length) * 100).toFixed(1);

  console.log('📦 Brotli (quality 11 - max):');
  console.log(`   Size: ${brotliedMax.length.toLocaleString()} bytes`);
  console.log(`   Ratio: ${brotliMaxRatio}% reduction`);
  console.log(`   Time: ${brotliMaxTime}ms`);
  console.log(`   vs Gzip: ${((1 - brotliedMax.length / gzippedMax.length) * 100).toFixed(1)}% smaller\n`);
} catch (e) {
  console.log('⚠️  Brotli not available\n');
}

// Summary
console.log('='.repeat(60));
console.log('📊 RECOMMENDATION');
console.log('='.repeat(60));
console.log('\nFor JSON over stdio:');
console.log('✅ Brotli (quality 6): Best compression + good speed');
console.log('✅ Gzip (level 6): Good fallback if Brotli unavailable');
console.log('❌ Max compression: Too slow for real-time use\n');
