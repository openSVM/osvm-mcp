#!/usr/bin/env node

/**
 * Test script for ai_inference_call tool
 */

import axios from 'axios';

const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;

async function testAiInference() {
  console.log('Testing ai_inference_call tool...\n');

  const testCases = [
    {
      name: 'Basic question',
      payload: {
        question: 'What is Solana?'
      }
    },
    {
      name: 'Question with maxTokens',
      payload: {
        question: 'Explain how Solana validators work',
        maxTokens: 500
      }
    },
    {
      name: 'Question with systemPrompt',
      payload: {
        question: 'What is the current market trend?',
        systemPrompt: 'You are a crypto market analyst. Be concise.',
        maxTokens: 200
      }
    },
    {
      name: 'Get execution plan',
      payload: {
        question: 'Analyze the top 10 validators',
        ownPlan: true
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test: ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log('Payload:', JSON.stringify(testCase.payload, null, 2));

    try {
      const response = await axios.post(`${BASE_URL}/api/getAnswer`, testCase.payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` })
        },
        timeout: 30000
      });

      console.log('\n✓ Response received:');
      console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
      console.error('\n✗ Error:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        console.log('\n⚠ Note: This endpoint may require authentication.');
        console.log('Set OPENSVM_JWT_TOKEN environment variable if you have one.');
      }
    }

    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testAiInference().catch(console.error);
