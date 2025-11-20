#!/usr/bin/env node

/**
 * Test AI inference: MCP vs Direct API
 * Compare calling through MCP stdio vs direct HTTP
 */

import { spawn } from 'child_process';
import axios from 'axios';

const BASE_URL = 'https://opensvm.com';

async function testDirectAPI() {
  console.log('\n🌐 Testing Direct API Call\n');
  console.log('='.repeat(70));
  
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${BASE_URL}/api/getAnswer`,
      {
        question: 'What is Solana?',
        maxTokens: 100,
        ownPlan: false
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
      }
    );
    
    const duration = Date.now() - startTime;
    const answer = response.data?.answer || response.data;
    
    console.log(`✅ SUCCESS (${duration}ms)`);
    console.log(`Status: ${response.status}`);
    console.log(`Response type: ${typeof answer}`);
    console.log(`Response length: ${typeof answer === 'string' ? answer.length : JSON.stringify(answer).length} chars`);
    console.log(`\nAnswer preview:\n${typeof answer === 'string' ? answer.slice(0, 200) : JSON.stringify(answer, null, 2).slice(0, 200)}`);
    
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ FAILED (${duration}ms)`);
    console.log(`Error: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return { success: false, duration, error: error.message };
  }
}

async function testMCPCall() {
  console.log('\n🔧 Testing MCP Server Call\n');
  console.log('='.repeat(70));
  
  return new Promise((resolve) => {
    const server = spawn('./build/index.js', [], {
      stdio: ['pipe', 'pipe', 'inherit']
    });
    
    // Initialize
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    };
    
    server.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // Wait for init
    server.stdout.once('data', () => {
      console.log('✓ Server initialized\n');
      
      // Call AI tool
      const toolRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'ai_inference_call',
          arguments: {
            question: 'What is Solana?',
            maxTokens: 100,
            ownPlan: false
          }
        }
      };
      
      const startTime = Date.now();
      let responded = false;
      
      const timeout = setTimeout(() => {
        if (!responded) {
          responded = true;
          server.kill();
          const duration = Date.now() - startTime;
          console.log(`❌ TIMEOUT (${duration}ms)`);
          resolve({ success: false, duration, error: 'timeout' });
        }
      }, 120000);
      
      server.stdout.once('data', (data) => {
        if (responded) return;
        responded = true;
        clearTimeout(timeout);
        server.kill();
        
        const duration = Date.now() - startTime;
        
        try {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (!line.trim() || !line.includes('"id"')) continue;
            const response = JSON.parse(line);
            if (response.id === 2) {
              if (response.error) {
                console.log(`❌ MCP ERROR (${duration}ms)`);
                console.log(`Error: ${response.error.message}`);
                console.log(`Code: ${response.error.code}`);
                resolve({ success: false, duration, error: response.error.message });
              } else if (response.result?.isError) {
                const errorText = response.result.content?.[0]?.text || 'Unknown error';
                console.log(`❌ TOOL ERROR (${duration}ms)`);
                console.log(`Error: ${errorText.slice(0, 200)}`);
                resolve({ success: false, duration, error: errorText });
              } else {
                const resultText = response.result?.content?.[0]?.text || '';
                console.log(`✅ SUCCESS (${duration}ms)`);
                console.log(`Response length: ${resultText.length} chars`);
                console.log(`\nResult preview:\n${resultText.slice(0, 200)}`);
                resolve({ success: true, duration, result: resultText });
              }
              return;
            }
          }
          console.log(`❌ NO MATCHING RESPONSE (${duration}ms)`);
          resolve({ success: false, duration, error: 'no matching response' });
        } catch (e) {
          console.log(`❌ PARSE ERROR (${duration}ms)`);
          console.log(`Error: ${e.message}`);
          console.log(`Raw data: ${data.toString().slice(0, 200)}`);
          resolve({ success: false, duration, error: e.message });
        }
      });
      
      console.log('Sending AI inference request...');
      server.stdin.write(JSON.stringify(toolRequest) + '\n');
    });
  });
}

async function runComparison() {
  console.log('🔍 AI Inference: MCP vs Direct API Comparison');
  console.log('='.repeat(70));
  
  const directResult = await testDirectAPI();
  await new Promise(r => setTimeout(r, 1000));
  
  const mcpResult = await testMCPCall();
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 COMPARISON SUMMARY');
  console.log('='.repeat(70));
  console.log(`Direct API:  ${directResult.success ? '✅ PASS' : '❌ FAIL'} (${directResult.duration}ms)`);
  console.log(`MCP Server:  ${mcpResult.success ? '✅ PASS' : '❌ FAIL'} (${mcpResult.duration}ms)`);
  
  if (!directResult.success || !mcpResult.success) {
    console.log('\n❌ One or both tests failed');
    if (!directResult.success) console.log(`  Direct API Error: ${directResult.error}`);
    if (!mcpResult.success) console.log(`  MCP Error: ${mcpResult.error}`);
  } else {
    console.log('\n✅ Both tests passed!');
    const speedDiff = Math.abs(directResult.duration - mcpResult.duration);
    console.log(`Speed difference: ${speedDiff}ms`);
  }
  
  console.log('='.repeat(70));
  
  process.exit(directResult.success && mcpResult.success ? 0 : 1);
}

runComparison().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
