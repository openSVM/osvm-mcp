#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function test() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js']
  });

  const client = new Client(
    { name: 'list-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected\n');

    const result = await client.listTools();
    console.log(`✅ Got ${result.tools.length} tools\n`);

    // Show first 10 tools
    console.log('First 10 tools:');
    result.tools.slice(0, 10).forEach((tool, i) => {
      console.log(`  ${i + 1}. ${tool.name}`);
    });

    console.log(`\n... and ${result.tools.length - 10} more tools`);

    await client.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.close();
    process.exit(1);
  }
}

test().catch(console.error);
