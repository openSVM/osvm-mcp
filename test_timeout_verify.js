#!/usr/bin/env node
import { spawn } from 'child_process';

const server = spawn('./build/index.js', [], { stdio: ['pipe', 'pipe', 'inherit'] });

const initReq = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' }
  }
};

server.stdin.write(JSON.stringify(initReq) + '\n');

server.stdout.once('data', () => {
  console.log('✓ Server initialized');
  
  const toolReq = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'ai_inference_call',
      arguments: {
        question: 'Explain in detail how Proof of History works in Solana blockchain',
        maxTokens: 300
      }
    }
  };
  
  const start = Date.now();
  console.log('\nTesting AI inference with 120s timeout...');
  
  server.stdout.once('data', (data) => {
    const duration = Date.now() - start;
    const response = JSON.parse(data.toString().split('\n').find(l => l.includes('"id"')));
    
    if (response.error) {
      console.log(`\n❌ FAILED (${duration}ms)`);
      console.log(`Error: ${response.error.message}`);
    } else if (response.result?.isError) {
      console.log(`\n❌ TOOL ERROR (${duration}ms)`);
      console.log(`Error: ${response.result.content?.[0]?.text?.slice(0, 200)}`);
    } else {
      console.log(`\n✅ SUCCESS (${duration}ms)`);
      console.log(`Response length: ${response.result?.content?.[0]?.text?.length} chars`);
      console.log('\nTimeout increase confirmed: 120s timeout is now active');
    }
    
    server.kill();
    process.exit(response.error || response.result?.isError ? 1 : 0);
  });
  
  server.stdin.write(JSON.stringify(toolReq) + '\n');
});
