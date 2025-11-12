#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

// Start the MCP server
const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let buffer = '';
let messageId = 1;

// Create readline interface for server output
const rl = readline.createInterface({
  input: server.stdout,
  crlfDelay: Infinity
});

// Process each line from server
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log('\n📊 Chart Tool Response:');
    console.log(JSON.stringify(response, null, 2));

    // Check if we got the result
    if (response.result && response.result.content) {
      const content = response.result.content[0].text;
      const data = JSON.parse(content);

      console.log('\n✅ SUCCESS! Chart data retrieved:');
      console.log(`   Endpoint: ${data.endpoint}`);
      console.log(`   Token: ${data.tokenInfo?.symbol || 'Unknown'} (${data.tokenInfo?.name || 'Unknown'})`);
      console.log(`   Price: $${data.tokenInfo?.price || 'N/A'}`);
      console.log(`   Candles: ${data.data?.items?.length || 0} items`);
      console.log(`   Main Pair: ${data.mainPair?.pair || 'N/A'} on ${data.mainPair?.dex || 'N/A'}`);
      console.log(`   Pools: ${data.pools?.length || 0} available`);

      if (data.data?.items && data.data.items.length > 0) {
        const latest = data.data.items[data.data.items.length - 1];
        console.log(`\n   Latest Candle:`);
        console.log(`     Open:  $${latest.o}`);
        console.log(`     High:  $${latest.h}`);
        console.log(`     Low:   $${latest.l}`);
        console.log(`     Close: $${latest.c}`);
        console.log(`     Time:  ${new Date(latest.unixTime * 1000).toISOString()}`);
      }
    }

    server.kill();
    process.exit(0);
  } catch (e) {
    // Not JSON, might be initialization message
  }
});

// Wait for server to be ready
setTimeout(() => {
  // Test the chart tool with 1m interval (OVSM token)
  const testRequest = {
    jsonrpc: '2.0',
    id: messageId++,
    method: 'tools/call',
    params: {
      name: 'chart',
      arguments: {
        mint: 'pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS',
        interval: '1m'
      }
    }
  };

  console.log('🧪 Testing chart tool with 1m interval...\n');
  console.log('Request:', JSON.stringify(testRequest, null, 2));

  server.stdin.write(JSON.stringify(testRequest) + '\n');
}, 1000);

// Handle errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Server exited with code ${code}`);
    process.exit(code);
  }
});
