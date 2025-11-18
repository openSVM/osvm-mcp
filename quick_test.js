import { spawn } from 'child_process';

const server = spawn('node', ['build/index.js'], { stdio: ['pipe', 'pipe', 'inherit'] });

server.stdout.on('data', (d) => console.log('[OUT]', d.toString().trim()));

setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' }}
  }) + '\n');
}, 500);

setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'get_account_transfers', arguments: {
      address: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck',
      limit: 3
    }}
  }) + '\n');
  console.log('Sent tool call for REVXui... address');
}, 2000);

setTimeout(() => { server.kill(); process.exit(0); }, 20000);
