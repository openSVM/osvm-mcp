#!/bin/bash

echo "🧪 Simple MCP Server Test"
echo ""

echo "TEST 1: Initialize"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node build/index.js 2>/dev/null | jq -r '.result.serverInfo.name' && echo "✓ Initialize works" || echo "✗ Initialize failed"

echo ""
echo "TEST 2: List Tools (showing count)"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node build/index.js 2>/dev/null | tail -1 | jq -r '.result.tools | length' | xargs -I {} echo "✓ Found {} tools"

echo ""
echo "TEST 3: Check for wallet mapping tools"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node build/index.js 2>/dev/null | tail -1 | jq -r '.result.tools[] | select(.name | contains("find_related") or contains("holders_by") or contains("ai_inference") or contains("account_transfers")) | .name'

echo ""
echo "✅ MCP Server Tests Complete"
