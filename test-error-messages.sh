#!/bin/bash

# Test error messages with examples

echo "Testing invalid address (too short)..."
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_token_info","arguments":{"address":"invalid"}}}' | node build/index.js 2>&1 | jq -r '.error.message // .result.content[0].text' 2>/dev/null | head -1

echo ""
echo "Testing invalid signature (too short)..."
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_transaction","arguments":{"signature":"tooshort"}}}' | node build/index.js 2>&1 | jq -r '.error.message // .result.content[0].text' 2>/dev/null | head -1

echo ""
echo "Testing valid address (should work or API error)..."
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_token_info","arguments":{"address":"So11111111111111111111111111111111111111112"}}}' | node build/index.js 2>&1 | jq -r '.error.message // .result.content[0].text' 2>/dev/null | head -3
