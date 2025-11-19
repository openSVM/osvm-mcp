#!/usr/bin/env node

/**
 * Comprehensive AI Inference Tool Test
 * Tests the ai_inference_call tool with various prompts and parameters
 */

import axios from 'axios';

const BASE_URL = 'https://opensvm.com';

// Test cases for AI inference
const testCases = [
  {
    name: 'Simple blockchain question',
    params: {
      question: 'What is Solana?',
      maxTokens: 100
    }
  },
  {
    name: 'Technical analysis question',
    params: {
      question: 'Explain how Proof of History works in Solana',
      maxTokens: 200
    }
  },
  {
    name: 'Transaction analysis',
    params: {
      question: 'What are the key components of a Solana transaction?',
      maxTokens: 150
    }
  },
  {
    name: 'DeFi ecosystem question',
    params: {
      question: 'What are the major DeFi protocols on Solana?',
      maxTokens: 200
    }
  },
  {
    name: 'With custom system prompt',
    params: {
      question: 'Analyze the current state of Solana',
      systemPrompt: 'You are a blockchain analyst specializing in Solana. Provide technical insights.',
      maxTokens: 150
    }
  },
  {
    name: 'Short response (minimal tokens)',
    params: {
      question: 'What is SOL?',
      maxTokens: 50
    }
  },
  {
    name: 'Long response (max tokens)',
    params: {
      question: 'Provide a comprehensive overview of Solana blockchain architecture, consensus mechanism, and key features',
      maxTokens: 500
    }
  },
  {
    name: 'With ownPlan enabled',
    params: {
      question: 'How does Solana achieve high throughput?',
      maxTokens: 200,
      ownPlan: true
    }
  },
  {
    name: 'NFT-related question',
    params: {
      question: 'How do NFTs work on Solana compared to Ethereum?',
      maxTokens: 200
    }
  },
  {
    name: 'Smart contract question',
    params: {
      question: 'What programming languages are used for Solana smart contracts?',
      maxTokens: 150
    }
  }
];

async function testAIInference(testCase, testNum, total) {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${BASE_URL}/api/getAnswer`,
      testCase.params,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const duration = Date.now() - startTime;
    const answer = response.data?.answer || response.data;
    const answerLength = typeof answer === 'string' ? answer.length : JSON.stringify(answer).length;
    const tokenEstimate = Math.round(answerLength / 4); // Rough estimate: 4 chars per token

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${testNum}/${total}] ${testCase.name}`);
    console.log('='.repeat(70));
    console.log(`Question: ${testCase.params.question}`);
    if (testCase.params.systemPrompt) {
      console.log(`System Prompt: ${testCase.params.systemPrompt.slice(0, 50)}...`);
    }
    console.log(`Max Tokens: ${testCase.params.maxTokens}`);
    console.log(`Own Plan: ${testCase.params.ownPlan || false}`);
    console.log(`\nResponse Time: ${duration}ms`);
    console.log(`Response Length: ${answerLength} chars (~${tokenEstimate} tokens)`);
    console.log(`\nAnswer Preview:`);

    if (typeof answer === 'string') {
      // Show first 200 chars and last 100 chars if long
      if (answer.length > 300) {
        console.log(answer.slice(0, 200));
        console.log(`\n... [${answer.length - 300} chars omitted] ...\n`);
        console.log(answer.slice(-100));
      } else {
        console.log(answer);
      }
    } else {
      console.log(JSON.stringify(answer, null, 2).slice(0, 500));
    }

    return {
      success: true,
      duration,
      answerLength,
      tokenEstimate,
      status: response.status
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${testNum}/${total}] ${testCase.name}`);
    console.log('='.repeat(70));
    console.log(`Question: ${testCase.params.question}`);
    console.log(`\n❌ ERROR after ${duration}ms`);

    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.code === 'ECONNABORTED') {
      console.log('Error: Request timeout (>30s)');
    } else {
      console.log(`Error: ${error.message}`);
    }

    return {
      success: false,
      duration,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

async function runTests() {
  console.log('🤖 AI Inference Tool - Comprehensive Test\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Total Test Cases: ${testCases.length}\n`);

  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    totalDuration: 0,
    totalTokens: 0,
    totalChars: 0,
    durations: [],
    tokenCounts: []
  };

  for (let i = 0; i < testCases.length; i++) {
    const result = await testAIInference(testCases[i], i + 1, testCases.length);

    results.totalDuration += result.duration;

    if (result.success) {
      results.passed++;
      results.totalTokens += result.tokenEstimate || 0;
      results.totalChars += result.answerLength || 0;
      results.durations.push(result.duration);
      results.tokenCounts.push(result.tokenEstimate || 0);
    } else {
      results.failed++;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Calculate statistics
  results.durations.sort((a, b) => a - b);
  results.tokenCounts.sort((a, b) => a - b);

  const avgDuration = results.totalDuration / results.total;
  const medianDuration = results.durations[Math.floor(results.durations.length / 2)] || 0;
  const p95Duration = results.durations[Math.floor(results.durations.length * 0.95)] || 0;

  const avgTokens = results.passed > 0 ? results.totalTokens / results.passed : 0;
  const avgChars = results.passed > 0 ? results.totalChars / results.passed : 0;

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Tests:       ${results.total}`);
  console.log(`✓ Passed:          ${results.passed} (${(results.passed/results.total*100).toFixed(1)}%)`);
  console.log(`✗ Failed:          ${results.failed}`);
  console.log('');
  console.log('Performance Metrics:');
  console.log(`  Avg Response:    ${avgDuration.toFixed(0)}ms`);
  console.log(`  Median Response: ${medianDuration}ms`);
  console.log(`  p95 Response:    ${p95Duration}ms`);
  console.log(`  Min Response:    ${results.durations[0] || 0}ms`);
  console.log(`  Max Response:    ${results.durations[results.durations.length - 1] || 0}ms`);
  console.log('');
  console.log('Response Size Metrics:');
  console.log(`  Avg Characters:  ${avgChars.toFixed(0)}`);
  console.log(`  Avg Tokens:      ${avgTokens.toFixed(0)}`);
  console.log(`  Total Tokens:    ${results.totalTokens}`);
  console.log('');
  console.log('='.repeat(70));
  console.log(results.failed === 0 ? '✅ ALL TESTS PASSED!' : `⚠️  ${results.failed} TEST(S) FAILED`);
  console.log('='.repeat(70));

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
