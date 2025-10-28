# OpenSVM MCP Server

A Model Context Protocol (MCP) server providing comprehensive access to the Solana blockchain via the OpenSVM API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-35%20passing-brightgreen)](./test-mcp-server.sh)

## Overview

The OpenSVM MCP server enables AI assistants and applications to interact with the Solana blockchain through 33 specialized tools and direct RPC access to 90+ standard Solana methods.

**Key Features:**
- 🔍 **Account Analytics** - Query balances, token holdings, transaction history
- 💸 **Transaction Analysis** - Detailed transaction parsing with AI-powered insights
- 📊 **DeFi Data** - Real-time TVL, volume, and protocol analytics
- 🪙 **Token Information** - Metadata, supply, holders, and price data
- ⛓️ **Block Explorer** - Block data, validator analytics, and network statistics
- 🔌 **Direct RPC Access** - Call any of 90+ Solana RPC methods via `solana_rpc_call`

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/openSVM/osvm-mcp.git
cd osvm-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

### Configuration

#### With Claude Desktop

Add to your Claude Desktop configuration:

**MacOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "osvm-mcp": {
      "command": "node",
      "args": ["/path/to/osvm-mcp/build/index.js"],
      "env": {
        "OPENSVM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### With OSVM CLI

```bash
# Already configured if you're using osvm CLI
osvm mcp list

# Test a tool
osvm mcp call osvm-mcp get_account_stats --args '{"address":"vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg"}'
```

## Tools

### Account Tools (6 tools)

| Tool | Purpose |
|------|---------|
| `get_account_stats` | Transaction statistics (total transactions, token transfers) |
| `get_account_portfolio` | Complete portfolio with SOL balance, tokens, prices, total value |
| `get_solana_balance` | SOL balance and token holdings (same as portfolio) |
| `get_account_transactions` | Paginated transaction history |
| `get_account_token_stats` | Token-specific statistics for an account |
| `check_account_type` | Identify account type (wallet, program, token, etc.) |

### Transaction Tools (4 tools)

| Tool | Purpose |
|------|---------|
| `get_transaction` | Detailed transaction with instructions, accounts, balances, logs |
| `batch_transactions` | Fetch up to 20 transactions in one call |
| `analyze_transaction` | AI-powered transaction analysis (programs, tokens, risk) |
| `explain_transaction` | Natural language explanation of transaction |

### Block Tools (3 tools)

| Tool | Purpose |
|------|---------|
| `get_block` | Block data by slot number |
| `get_recent_blocks` | List recent blocks with pagination |
| `get_block_stats` | Network performance metrics (TPS, block time) |

### Analytics Tools (4 tools)

| Tool | Purpose |
|------|---------|
| `get_defi_overview` | DeFi ecosystem overview (TVL, volume, top protocols) |
| `get_dex_analytics` | DEX-specific trading analytics |
| `get_defi_health` | DeFi ecosystem health indicators |
| `get_validator_analytics` | Validator network statistics |

### Token & NFT Tools (4 tools)

| Tool | Purpose |
|------|---------|
| `get_token_info` | SPL token metadata, supply, decimals, holders |
| `get_token_metadata` | Batch fetch metadata for multiple tokens |
| `get_nft_collections` | NFT collection stats (floor price, volume) |
| `get_trending_nfts` | Trending NFT collections by volume |

### Search Tools (2 tools)

| Tool | Purpose |
|------|---------|
| `universal_search` | Search across accounts, transactions, tokens, programs |
| `search_accounts` | Advanced account search with balance/token filters |

### Utility Tools (5 tools)

| Tool | Purpose |
|------|---------|
| `solana_rpc_call` | Direct access to 90+ Solana RPC methods |
| `verify_wallet_signature` | Verify wallet signatures for authentication |
| `get_program_registry` | List registered Solana programs |
| `get_program_info` | Program metadata and verification status |
| `report_error` | Report client-side errors for telemetry |

### Monetization Tools (3 tools)

| Tool | Purpose |
|------|---------|
| `get_balance` | SVMAI token balance for API billing (requires JWT) |
| `get_usage_stats` | API usage statistics (requires JWT) |
| `manage_api_keys` | Manage Anthropic API keys (requires JWT) |

**Total:** 33 tools + direct RPC access

## Usage Examples

### Get Account Balance

```bash
osvm mcp call osvm-mcp get_account_portfolio --args '{
  "address": "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg"
}'
```

Returns:
```json
{
  "address": "vines1...",
  "timestamp": "2025-10-28T06:22:19.028Z",
  "data": {
    "native": {
      "balance": 0,
      "symbol": "SOL",
      "price": 202.02,
      "value": 0
    },
    "tokens": [],
    "totalValue": 0
  }
}
```

### Get Transaction Details

```bash
osvm mcp call osvm-mcp get_transaction --args '{
  "signature": "2rzXJ5ntftwV9RnrDvxxqPLAtGUphVrrWemZpkaxEuFqGNE2sckNZXSYfMg4rvayJXdx9roM7MinTtpUULbp35yG"
}'
```

### Direct RPC Call

```bash
osvm mcp call osvm-mcp solana_rpc_call --args '{
  "method": "getSlot"
}'
```

Returns current slot number:
```json
{
  "jsonrpc": "2.0",
  "result": 376301301,
  "id": 1761543291769
}
```

### DeFi Analytics

```bash
osvm mcp call osvm-mcp get_defi_overview --args '{}'
```

Returns:
```json
{
  "totalTvl": 1385500000,
  "totalVolume24h": 2703866854.95,
  "activeDexes": 41,
  "topProtocols": [
    {"name": "raydium", "tvl": 0, "volume24h": 647361015},
    {"name": "jupiter", "tvl": 950000000, "volume24h": 45000000}
  ]
}
```

See [EXAMPLES.md](./EXAMPLES.md) for more usage examples.

## Testing

Run the comprehensive test suite:

```bash
./test-mcp-server.sh
```

**Current Coverage:** 35/35 tests passing (100% of tested tools)

The test suite validates:
- JSON response format
- Required fields presence
- Data type correctness
- Null value handling
- API endpoint connectivity

## Development

### Build

```bash
npm run build
```

### Watch Mode (Auto-rebuild)

```bash
npm run watch
```

### Debugging

Use the MCP Inspector for debugging:

```bash
npm run inspector
```

The Inspector provides a web UI for testing tools and viewing requests/responses.

### Project Structure

```
osvm-mcp/
├── src/
│   └── index.ts          # Main MCP server implementation
├── build/                # Compiled JavaScript output
├── test-mcp-server.sh    # Comprehensive test suite
├── llms.txt             # Tool documentation for LLMs
└── README.md            # This file
```

## API Reference

### Tool Naming Convention

All tool names use **lowercase with underscores** (snake_case):
- ✅ `get_account_transactions` (correct)
- ❌ `GET_ACCOUNT_TRANSACTIONS` (wrong - will fail!)

### Response Format

All tools return MCP-compliant responses:

```json
{
  "content": [{
    "type": "text",
    "text": "{...json data...}"
  }]
}
```

### Error Handling

Errors follow MCP error codes:
- `InvalidParams` - Invalid or missing parameters
- `MethodNotFound` - Unknown tool name
- `InternalError` - API or network errors

Example error:
```json
{
  "error": {
    "code": -32602,
    "message": "Invalid Solana address format"
  }
}
```

## Authentication

Some tools require authentication:

### API Key (Recommended)

```bash
export OPENSVM_API_KEY="your-api-key-here"
```

### JWT Token

```bash
export OPENSVM_JWT_TOKEN="your-jwt-token"
```

**Tools requiring authentication:**
- `get_balance` (SVMAI token balance)
- `get_usage_stats` (API usage tracking)
- `manage_api_keys` (API key management)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `./test-mcp-server.sh`
5. Submit a pull request

### Adding New Tools

1. Define the tool in `getToolDefinitions()`
2. Implement the handler in `handleToolCall()`
3. Add validation and error handling
4. Add tests in `test-mcp-server.sh`
5. Update documentation

## Troubleshooting

### "Undefined tool" error

**Cause:** Tool name case mismatch
**Solution:** Use lowercase with underscores (e.g., `get_account_transactions`)

### "Missing Authorization header"

**Cause:** JWT required but not provided
**Solution:** Only affects `get_balance`, `get_usage_stats`, `manage_api_keys`

### Connection timeout

**Cause:** Network issues or API downtime
**Solution:** Check https://osvm.ai/status

## Resources

- **Documentation:** [llms.txt](./llms.txt) - Complete tool reference
- **Examples:** [EXAMPLES.md](./EXAMPLES.md) - Common use cases
- **OpenSVM API:** https://osvm.ai/api
- **MCP Specification:** https://modelcontextprotocol.io
- **GitHub Issues:** https://github.com/openSVM/osvm-mcp/issues

## License

MIT License - see [LICENSE](LICENSE) for details

## Support

- **Issues:** https://github.com/openSVM/osvm-mcp/issues
- **Discord:** https://discord.gg/opensvm
- **Docs:** https://docs.osvm.ai

---

**Built with ❤️ by the OpenSVM team**
