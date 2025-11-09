# Enhanced Error Messages - OpenSVM MCP Server

## Overview
All validation error messages have been enhanced with helpful examples and detailed information to improve the developer experience. Additionally, **automatic parameter name correction** handles common naming variations.

## Parameter Auto-Correction (NEW!)

The server now intelligently auto-corrects common parameter name variations, making the API more intuitive and forgiving.

### Supported Auto-Corrections

**`get_token_info`** - Accepts any of these for the address parameter:
- `mint` → `address` ✨
- `token` → `address` ✨
- `tokenAddress` → `address` ✨
- `mintAddress` → `address` ✨

**`get_transaction`** - Accepts any of these for the signature parameter:
- `tx` → `signature` ✨
- `txSignature` → `signature` ✨
- `txSig` → `signature` ✨
- `hash` → `signature` ✨

**`get_account_stats`** - Accepts any of these for the address parameter:
- `wallet` → `address` ✨
- `account` → `address` ✨
- `pubkey` → `address` ✨
- `publicKey` → `address` ✨

### Example
```bash
# All of these work now! 🎉
osvm mcp call osvm-mcp get_token_info --args '{"mint":"So11..."}'
osvm mcp call osvm-mcp get_token_info --args '{"token":"So11..."}'
osvm mcp call osvm-mcp get_token_info --args '{"address":"So11..."}'
```

The server will log the auto-correction (visible in debug logs):
```
[get_token_info] Auto-corrected parameter: "mint" → "address"
```

## Error Message Helpers

### 1. Address Validation (`getAddressValidationError`)
Validates Solana addresses (wallets, programs, mints, etc.)

**Examples:**
```
❌ Input: "short"
✅ Error: Invalid Solana address format: must be 32-44 characters (got 5). Example: "So11111111111111111111111111111111111111112"

❌ Input: 12345 (number)
✅ Error: Invalid Solana address format: expected string, got number. Example: "So11111111111111111111111111111111111111112"

❌ Input: "abc" for mint parameter
✅ Error: Invalid Solana mint format: must be 32-44 characters (got 3). Example: "So11111111111111111111111111111111111111112"
```

**Features:**
- Shows actual length vs required (32-44 chars)
- Detects type mismatches
- Field-specific error messages (address, mint, program ID, wallet address, etc.)
- Includes valid example

### 2. Signature Validation (`getSignatureValidationError`)
Validates Solana transaction signatures

**Examples:**
```
❌ Input: "tooshort"
✅ Error: Invalid transaction signature format: must be 87-88 characters (got 8). Example: "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"

❌ Input: 999 (number)
✅ Error: Invalid transaction signature format: expected string, got number. Example: "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"
```

**Features:**
- Shows actual length vs required (87-88 chars)
- Detects type mismatches
- Includes valid example

### 3. Array Validation (`getArrayValidationError`)
Validates array parameters with optional max size

**Examples:**
```
❌ Input: "notarray"
✅ Error: Mints must be an array. Example: ["So11111111111111111111111111111111111111112"]

❌ Input: []
✅ Error: Signatures cannot be empty. Example: ["5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"]

❌ Input: 150-item array with max 100
✅ Error: Addresses exceeds maximum of 100 items (got 150). Reduce the array size.
```

**Features:**
- Checks if input is an array
- Validates non-empty
- Enforces maximum size limits
- Shows item examples

### 4. Required Field Validation (`getRequiredFieldError`)
Validates required parameters

**Examples:**
```
❌ Input: missing transaction
✅ Error: Transaction is required. Example: "base64EncodedTransaction"

❌ Input: missing blockhash
✅ Error: Blockhash is required. Example: "9sHcv6xwn9YkB8nxTUGKDwPwNnmqVp5oAXxU8Fdkm4J6"
```

**Features:**
- Clear field name
- Includes example value

### 5. Number Validation (`getNumberValidationError`)
Validates numeric parameters with optional constraints

**Examples:**
```
❌ Input: "string" for Limit
✅ Error: Limit must be a number, got string. Example: 1

❌ Input: 0 with min constraint of 1
✅ Error: Limit must be >= 1 (got 0).

❌ Input: 2000 with max constraint of 1000
✅ Error: Limit must be <= 1000 (got 2000).
```

**Features:**
- Type checking
- Min/max constraint validation
- Shows actual value vs constraints

### 6. Multi-Address Validation (`getMultiAddressValidationError`)
Validates multiple address fields (e.g., address + mint)

**Examples:**
```
❌ Input: invalid address or mint
✅ Error: Invalid Solana address format: must be 32-44 characters (got 5). Example: "So11111111111111111111111111111111111111112"
```

**Features:**
- Validates multiple fields
- Returns specific error for failed field
- Maintains field context

## Coverage

All 42 validation error points have been updated:

### Transaction Tools (5)
- `get_transaction` - signature validation
- `batch_transactions` - signatures array validation
- `analyze_transaction` - signature validation
- `explain_transaction` - signature validation
- `rpc_getTransaction` - signature validation

### Account Tools (7)
- `get_account_stats` - address validation
- `get_account_portfolio` - address validation
- `get_solana_balance` - address validation
- `get_account_transactions` - address + limit validation
- `get_account_token_stats` - address + mint validation
- `check_account_type` - address validation
- `rpc_getAccountInfo` - address validation

### Token & NFT Tools (3)
- `get_token_info` - address validation
- `get_token_metadata` - mints array validation
- `get_user_history` - wallet address validation

### RPC Direct Methods (20+)
- All RPC methods with address, signature, array, or numeric parameters

### Other Tools (5)
- `manage_anthropic_keys` - action + keyId validation
- `get_program_info` - program ID validation
- Various RPC methods with blockhash, message, slot, etc.

## Testing

Run the comprehensive test suite:
```bash
node test-all-error-messages.js
```

Expected output: **18/18 tests passed**

## Benefits

1. **Better Developer Experience**: Clear, actionable error messages
2. **Faster Debugging**: Examples show exactly what's expected
3. **Type Safety**: Detects and reports type mismatches
4. **Context-Aware**: Field-specific messages (address vs mint vs program ID)
5. **Constraint Validation**: Shows actual values vs limits
6. **Consistent Format**: All errors follow similar patterns

## Examples in Production

### Before:
```bash
$ osvm mcp call osvm-mcp get_token_info --args '{"mint":"pvv4fu..."}'
❌ Error: Invalid token address format
```

### After:
```bash
$ osvm mcp call osvm-mcp get_token_info --args '{"mint":"pvv4fu..."}'
❌ Error: Unknown parameter 'mint'. Use 'address' instead.

$ osvm mcp call osvm-mcp get_token_info --args '{"address":"short"}'
❌ Error: Invalid Solana address format: must be 32-44 characters (got 5).
   Example: "So11111111111111111111111111111111111111112"

$ osvm mcp call osvm-mcp get_token_info --args '{"address":"So11111111111111111111111111111111111111112"}'
✅ Success!
```

## Implementation Details

Location: `src/index.ts:83-138`

All helper functions are pure functions with no side effects, making them easy to test and maintain.
