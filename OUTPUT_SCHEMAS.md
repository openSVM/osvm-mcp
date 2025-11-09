# Output Schemas Implementation Guide

## Overview

This document describes the implementation of MCP 2025-06-18 specification output schemas for all OpenSVM MCP tools. Output schemas provide type-safe, validated responses that help clients and LLMs understand the structure of data returned by tools.

## Specification Compliance

According to the [MCP Specification (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/server/tools):

> **Tools may also provide an output schema for validation of structured results.**
>
> If an output schema is provided:
> - Servers **MUST** provide structured results that conform to this schema
> - Clients **SHOULD** validate structured results against this schema

## Benefits

1. **Type Safety**: Clients know exactly what fields to expect
2. **Better Integration**: IDEs and tools can provide autocomplete
3. **LLM Understanding**: AI models can better parse and use the data
4. **Validation**: Automatic validation of API responses
5. **Documentation**: Self-documenting API responses

## Implementation Status

### ✅ Completed (3/75 tools)

1. **`get_token_info`** - Full token information with metadata
2. **`get_token_metadata`** - Batch token metadata array
3. **`get_transaction`** - Detailed transaction information

### 🚧 In Progress (72/75 tools remaining)

The remaining tools need output schemas added following the same pattern.

## Output Schema Structure

All output schemas follow JSON Schema format:

```typescript
{
  outputSchema: {
    type: 'object' | 'array',
    properties: {
      // For object type
      fieldName: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array',
        description: 'Field description',
        // Optional: enum, items, properties, etc.
      }
    },
    required: ['requiredField1', 'requiredField2'],
    // For array type, use items instead
    items: {
      type: 'object',
      properties: { ... }
    }
  }
}
```

## Examples

### Example 1: Simple Object Response

```typescript
{
  name: 'get_token_info',
  inputSchema: { ... },
  outputSchema: {
    type: 'object',
    properties: {
      decimals: { type: 'number', description: 'Number of decimal places' },
      holders: { type: 'number', description: 'Total token holders' },
      supply: { type: 'number', description: 'Total supply' },
      metadata: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Token name' },
          symbol: { type: 'string', description: 'Token symbol' }
        },
        required: ['name', 'symbol']
      }
    },
    required: ['decimals', 'supply']
  }
}
```

### Example 2: Array Response

```typescript
{
  name: 'get_token_metadata',
  inputSchema: { ... },
  outputSchema: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        decimals: { type: 'number', description: 'Decimals' },
        metadata: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            symbol: { type: 'string' }
          }
        }
      },
      required: ['mint']
    }
  }
}
```

### Example 3: Complex Nested Response

```typescript
{
  name: 'get_transaction',
  inputSchema: { ... },
  outputSchema: {
    type: 'object',
    properties: {
      signature: { type: 'string', description: 'Transaction signature' },
      timestamp: { type: 'number', description: 'Timestamp in ms' },
      success: { type: 'boolean', description: 'Success status' },
      type: { type: 'string', enum: ['sol', 'token'], description: 'Type' },
      details: {
        type: 'object',
        properties: {
          instructions: { type: 'array', description: 'Instructions' },
          accounts: { type: 'array', description: 'Accounts' },
          logs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Transaction logs'
          }
        }
      }
    },
    required: ['signature', 'timestamp', 'success']
  }
}
```

## Tools by Category

### Transaction Tools (6 tools)
- ✅ `get_transaction` - Implemented
- `batch_transactions` - TODO
- `analyze_transaction` - TODO
- `explain_transaction` - TODO
- `get_recent_transactions` - TODO
- `search_transactions` - TODO

### Account Tools (8 tools)
- `get_account_stats` - TODO
- `get_account_portfolio` - TODO
- `get_solana_balance` - TODO
- `get_account_transactions` - TODO
- `get_account_token_stats` - TODO
- `check_account_type` - TODO
- `search_accounts` - TODO
- `get_recent_accounts` - TODO

### Token & NFT Tools (6 tools)
- ✅ `get_token_info` - Implemented
- ✅ `get_token_metadata` - Implemented
- `get_nft_collections` - TODO
- `get_trending_nfts` - TODO
- `get_token_price` - TODO
- `get_token_holders` - TODO

### Block Tools (4 tools)
- `get_block` - TODO
- `get_recent_blocks` - TODO
- `get_block_stats` - TODO
- `get_block_transactions` - TODO

### Analytics Tools (3 tools)
- `get_defi_overview` - TODO
- `get_dex_analytics` - TODO
- `get_defi_health` - TODO

### RPC Tools (40+ tools)
- All RPC passthrough tools - TODO

## Implementation Pattern

For each tool, extract the return type from the description and create a corresponding JSON Schema:

1. **Parse Description**: Look for "Returns: {...}" in the description
2. **Identify Type**: Determine if response is object or array
3. **Define Properties**: Map each field to JSON Schema type
4. **Set Required Fields**: Mark mandatory fields in `required` array
5. **Add Descriptions**: Include clear descriptions for each field

## Testing

After adding output schemas, test with:

```bash
# Build
npm run build

# Test a tool
osvm mcp call osvm-mcp get_token_info --args '{"address":"So11111111111111111111111111111111111111112"}'
```

The MCP client should now validate the response against the schema.

## Next Steps

1. Add output schemas to remaining 72 tools
2. Validate schemas against real API responses
3. Add unit tests for schema validation
4. Update client integrations to use schemas

## Contributing

When adding new tools:
1. Always include an `outputSchema`
2. Match the schema to actual API responses
3. Test with real data
4. Document complex nested structures
5. Use enums for known value sets

## Resources

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [JSON Schema Guide](https://json-schema.org/learn/getting-started-step-by-step)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
