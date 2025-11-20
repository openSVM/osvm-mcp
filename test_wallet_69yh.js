#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🧪 Testing Wallet 69yhtoJR... with different limits\n');

async function testCall(limit, txType = undefined) {
  return new Promise((resolve) => {
    const server = spawn('node', ['./build/index.js'], {
      cwd: '/home/larp/.osvm/mcp/osvm-mcp',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    const startTime = Date.now();

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', () => {});

    server.on('close', () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      try {
        const lines = output.trim().split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === 2) {
              if (response.error) {
                resolve({ success: false, elapsed, error: 'Tool error' });
              } else if (response.result?.content?.[0]?.text) {
                const data = JSON.parse(response.result.content[0].text);
                resolve({
                  success: true,
                  elapsed,
                  count: data.data?.length || 0,
                  hasMore: data.hasMore,
                  total: data.total
                });
              }
              return;
            }
          } catch (e) {}
        }
        resolve({ success: false, elapsed, error: 'No response' });
      } catch (error) {
        resolve({ success: false, elapsed, error: error.message });
      }
    });

    const init = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    };
    server.stdin.write(JSON.stringify(init) + '\n');

    setTimeout(() => {
      const args = {
        address: '69yhtoJR4JYPPABZcSNkzuqbaFbwHsCkja1sP1Q2aVT5',
        limit: limit
      };
      if (txType) args.txType = txType;

      const toolCall = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_account_transfers',
          arguments: args
        }
      };
      server.stdin.write(JSON.stringify(toolCall) + '\n');
      server.stdin.end();
    }, 100);

    setTimeout(() => {
      server.kill();
      resolve({ success: false, elapsed: 30, error: 'Timeout' });
    }, 35000);
  });
}

(async () => {
  const tests = [
    { limit: 5, txType: undefined, name: 'Limit 5, no filter' },
    { limit: 10, txType: undefined, name: 'Limit 10, no filter' },
    { limit: 20, txType: undefined, name: 'Limit 20, no filter' },
    { limit: 5, txType: 'sol,spl', name: 'Limit 5, txType=sol,spl' },
    { limit: 10, txType: 'sol,spl', name: 'Limit 10, txType=sol,spl' },
    { limit: 20, txType: 'sol,spl', name: 'Limit 20, txType=sol,spl' },
  ];

  for (const test of tests) {
    process.stdout.write(`${test.name}... `);
    const result = await testCall(test.limit, test.txType);

    if (result.success) {
      console.log(`✅ ${result.elapsed}s | ${result.count} transfers`);
    } else {
      console.log(`❌ ${result.elapsed}s | ${result.error}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\nDone!');
})();
