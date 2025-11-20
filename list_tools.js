#!/usr/bin/env node
import { spawn } from 'child_process';

const server = spawn('./build/index.js', [], { stdio: ['pipe', 'pipe', 'inherit'] });

server.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'list', version: '1.0.0' }
  }
}) + '\n');

server.stdout.once('data', () => {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  }) + '\n');

  server.stdout.once('data', (data) => {
    const response = JSON.parse(data.toString().split('\n').find(l => l.includes('"id"')));
    const tools = response.result.tools;
    
    console.log(`\n📋 Available Tools: ${tools.length}\n`);
    
    const byCategory = {};
    tools.forEach(tool => {
      const category = tool.description.split('.')[0].includes('Transaction') ? 'Transaction' :
                       tool.description.includes('account') || tool.description.includes('Account') ? 'Account' :
                       tool.description.includes('block') || tool.description.includes('Block') ? 'Block' :
                       tool.description.includes('search') || tool.description.includes('Search') ? 'Search' :
                       tool.description.includes('token') || tool.description.includes('Token') ? 'Token' :
                       tool.description.includes('DeFi') || tool.description.includes('defi') ? 'DeFi' :
                       tool.description.includes('market') || tool.description.includes('Market') ? 'Market' :
                       tool.description.includes('NFT') || tool.description.includes('nft') ? 'NFT' :
                       tool.description.includes('validator') || tool.description.includes('Validator') ? 'Validator' :
                       tool.description.includes('AI') || tool.description.includes('ai_') ? 'AI' :
                       tool.description.includes('wallet') || tool.description.includes('mapping') ? 'Wallet Mapping' :
                       'Other';
      
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(tool.name);
    });
    
    Object.keys(byCategory).sort().forEach(cat => {
      console.log(`\n${cat} (${byCategory[cat].length}):`);
      byCategory[cat].forEach(name => console.log(`  - ${name}`));
    });
    
    console.log(`\n\nTotal: ${tools.length} tools\n`);
    server.kill();
    process.exit(0);
  });
});
