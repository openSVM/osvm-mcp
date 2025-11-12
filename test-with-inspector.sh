#!/bin/bash

echo "Testing MCP server with inspector..."
echo "Navigate to http://localhost:5173 in your browser"
echo "Then test the get_transaction tool with signature: 5wHu1qwD7q5ifKcZKKDQF2HVLdDNDpSiLPWx5QzKWMBBx2qHKeqbHJKHbpJPPNZXvP8rXDQvSxDW8gZVgKxkCAkk"
echo ""
echo "Press Ctrl+C to stop"
npx @modelcontextprotocol/inspector build/index.js
