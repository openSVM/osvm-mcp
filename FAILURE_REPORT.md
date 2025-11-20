# Failed Tools - Comprehensive Analysis Report

**Date**: 2025-11-20
**Test**: Response Validation
**Failed Tools**: 11/17 (65%)

---

## 🚨 CRITICAL: HTML Instead of JSON (4 tools)

### 1. batch_transactions

**Status**: ❌ BROKEN - Returns HTML instead of JSON

**What was sent**:
```json
{
  "signatures": ["24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu"],
  "includeDetails": true
}
```

**API Endpoint**: `POST https://opensvm.com/api/batch-transactions`

**MCP Implementation** (src/index.ts:2645-2667):
```typescript
case 'batch_transactions':
  const batchTxData = await this.client.post('/api/batch-transactions', {
    signatures: args.signatures,
    ...(args.includeDetails !== undefined && { includeDetails: args.includeDetails })
  });
```

**Curl command to reproduce**:
```bash
curl -X POST "https://opensvm.com/api/batch-transactions" \
  -H "Content-Type: application/json" \
  -d '{"signatures":["24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu"],"includeDetails":true}'
```

**What was received**:
```html
<!DOCTYPE html><html lang="en" class="ai-html-root __variable_f367f3 __variable_3c557b">
<head><meta charSet="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover"/>
...
```

**What was expected**:
```json
[
  {
    "signature": "24XUJcfcph1s9z72...",
    "timestamp": 1700000000000,
    "slot": 250000000,
    "success": true,
    "type": "token",
    "details": {
      "instructions": [...],
      "accounts": [...]
    }
  }
]
```

**Root Cause**: API endpoint does not exist or has been moved/renamed.

---

### 2. get_account_stats

**Status**: ❌ BROKEN - Returns HTML instead of JSON

**What was sent**:
```json
{
  "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck"
}
```

**API Endpoint**: `GET https://opensvm.com/api/account-stats?address=REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck`

**MCP Implementation** (src/index.ts:2802-2825):
```typescript
case 'get_account_stats':
  const accountStats = await this.client.get('/api/account-stats', {
    params: {
      address: args.address,
      includeTokens: args.includeTokens
    }
  });
```

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/account-stats?address=REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck"
```

**What was received**:
```html
<!DOCTYPE html><html lang="en" class="ai-html-root __variable_f367f3 __variable_3c557b">
...
```

**What was expected**:
```json
{
  "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck",
  "solBalance": 0.5,
  "totalTransactions": 1234,
  "tokenCount": 15,
  "firstSeenAt": 1700000000000,
  "lastActiveAt": 1710000000000
}
```

**Root Cause**: API endpoint does not exist or has been moved/renamed.

---

### 3. get_account_token_stats

**Status**: ❌ BROKEN - Returns HTML instead of JSON

**What was sent**:
```json
{
  "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck",
  "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
}
```

**API Endpoint**: `GET https://opensvm.com/api/account-token-stats?params[address]=...&params[mint]=...`

**MCP Implementation** (src/index.ts:2990-3005):
```typescript
case 'get_account_token_stats':
  const tokenStats = await this.client.get('/api/account-token-stats', {
    params: {
      address: args.address,
      mint: args.mint
    }
  });
```

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/account-token-stats?address=REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck&mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

**What was received**:
```html
<!DOCTYPE html><html lang="en" class="ai-html-root __variable_f367f3 __variable_3c557b">
...
```

**What was expected**:
```json
{
  "balance": 1000.5,
  "transferCount": 45,
  "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "decimals": 6
}
```

**Root Cause**: API endpoint does not exist or has been moved/renamed. Also has double-wrapping issue (params[address] instead of address).

---

### 4. search_accounts

**Status**: ❌ BROKEN - Returns HTML instead of JSON

**What was sent**:
```json
{
  "query": "So11111111111111111111111111111111111111112"
}
```

**API Endpoint**: `GET https://opensvm.com/api/search/accounts?q=So11111111111111111111111111111111111111112`

**MCP Implementation** (src/index.ts:3084-3097):
```typescript
case 'search_accounts':
  const accountSearch = await this.client.get('/search/accounts', {
    q: args.query,
    tokenMint: args.tokenMint,
    minBalance: args.minBalance,
    maxBalance: args.maxBalance
  });
```

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/search/accounts?q=So11111111111111111111111111111111111111112"
```

**What was received**:
```html
<!DOCTYPE html><html lang="en" class="ai-html-root __variable_f367f3 __variable_3c557b">
...
```

**What was expected**:
```json
{
  "results": [
    {
      "address": "So11111111111111111111111111111111111111112",
      "balance": 1000000,
      "type": "token",
      "name": "Wrapped SOL"
    }
  ],
  "total": 1
}
```

**Root Cause**: API endpoint does not exist or has been moved/renamed.

---

## ⚠️ Response Structure Issues (6 tools)

### 5. get_transaction

**Status**: ⚠️ PARTIAL - Returns data but structure doesn't match validation

**What was sent**:
```json
{
  "signature": "24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu"
}
```

**API Endpoint**: `GET https://opensvm.com/api/transaction/24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu`

**MCP Implementation** (src/index.ts:2597-2620):
```typescript
case 'get_transaction':
  const txData = await this.client.get(`/api/transaction/${args.signature}`);
```

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/transaction/24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu"
```

**What was received**:
```json
{
  "signature": "24XUJcfcph1s9z72Mu8Xtn7v5sqqamVfYhLyxVQ21csDMsb5c1DnYcrBkxYtzF2fw46BTM9YKk811SvpPtByBSZu",
  "timestamp": 1757787371000,
  "slot": 366599506,
  "success": true,
  "type": "token",
  "cached": false
}
```

**What was expected**:
```json
{
  "signature": "24XUJc...",
  "timestamp": 1757787371000,
  "slot": 366599506,
  "success": true,
  "type": "token",
  "details": {
    "instructions": [...],
    "accounts": [...],
    "preBalances": [...],
    "postBalances": [...]
  }
}
```

**Issue**: Missing `details`, `instructions`, and `accounts` fields. API may have changed or `includeDetails` parameter needed.

---

### 6. get_account_portfolio

**Status**: ⚠️ PARTIAL - Returns data but missing totalValue at root

**What was sent**:
```json
{
  "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck"
}
```

**API Endpoint**: `GET https://opensvm.com/api/account-portfolio/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck`

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/account-portfolio/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck"
```

**What was received**:
```json
{
  "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck",
  "timestamp": "2025-11-20T02:00:47.046Z",
  "native": {
    "balance": 0,
    "symbol": "SOL"
  },
  "data": {
    "totalValue": 123.45
  }
}
```

**What was expected** (by validation):
```json
{
  "totalValue": 123.45,  // At root level
  "tokens": [...],
  "native": {...}
}
```

**Issue**: `totalValue` is in `data` object, not at root. Validation logic needs update OR MCP wrapper should flatten.

---

### 7. get_account_transactions

**Status**: ⚠️ PARTIAL - Returns data in different structure

**What was sent**:
```json
{
  "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck",
  "limit": 5
}
```

**API Endpoint**: `GET https://opensvm.com/api/account-transactions/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck?limit=5`

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/account-transactions/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck?limit=5"
```

**What was received**:
```json
{
  "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck",
  "transactions": [
    {
      "signature": "3MVRgKMttV55t5y19Q6KqrtshxM5FGBhfe3Tx58Xs7p5SoU82fSnzNi23w23hy5YGJk3Da7c",
      "timestamp": 1731637447000
    }
  ]
}
```

**What was expected**:
```json
[
  {
    "signature": "3MVRg...",
    "timestamp": 1731637447000
  }
]
```

**Issue**: Transactions are in `transactions` array, not root array. Validation expected root-level array.

---

### 8. get_account_transfers

**Status**: ⚠️ PARTIAL - Field naming difference

**What was sent**:
```json
{
  "address": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck",
  "limit": 5
}
```

**API Endpoint**: `GET https://opensvm.com/api/account-transfers/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck?limit=5`

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/account-transfers/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck?limit=5"
```

**What was received**:
```json
{
  "data": [
    {
      "txId": "tRzNwL2KdRrX4KBtahx1ZfHqGnbmkPaeRDpNRC5M4qGebnDjxB2MxPyso8FRoA52Dgwaj6owGbyCL9z3fiM5uWk",
      "date": "2025-11-15T03:44:07.000Z",
      "from": "REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck",
      "to": "...",
      "tokenSymbol": "USDC",
      "tokenAmount": "100.5",  // ← Field name
      "transferType": "OUT"
    }
  ],
  "total": 100,
  "hasMore": true
}
```

**What was expected** (by validation):
```json
{
  "data": [
    {
      "from": "...",
      "to": "...",
      "amount": 100.5  // ← Expected field name
    }
  ]
}
```

**Issue**: Field is named `tokenAmount` instead of `amount`. Minor naming inconsistency.

---

### 9. get_block

**Status**: ⚠️ PARTIAL - Data wrapped in extra object

**What was sent**:
```json
{
  "slot": 250000000
}
```

**API Endpoint**: `GET https://opensvm.com/api/blocks/250000000`

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/blocks/250000000"
```

**What was received**:
```json
{
  "success": true,
  "data": {
    "slot": 381232077,
    "blockhash": "EjZvPPdNTo1Xmobvn4KSnHduMfpaDvP8mNfvDVUHh2tB",
    "parentSlot": 381232076,
    "blockTime": 1763604050,
    "previousBlockhash": "Auwv1XUxGZGvDH5KNLX9pF2kqh6p7rAz6",
    "transactions": [...]
  }
}
```

**What was expected**:
```json
{
  "blockHeight": 250000000,
  "blockTime": 1763604050,
  "parentSlot": 381232076,
  "transactions": [...]
}
```

**Issue**: Data wrapped in `{success: true, data: {...}}`. Validation expected flattened structure. Also field name: `blockTime` vs `blockHeight`.

---

### 10. get_block_stats

**Status**: ⚠️ PARTIAL - Data wrapped in extra object

**What was sent**:
```json
{}
```

**API Endpoint**: `GET https://opensvm.com/api/block-stats`

**Curl command to reproduce**:
```bash
curl "https://opensvm.com/api/block-stats"
```

**What was received**:
```json
{
  "success": true,
  "data": {
    "currentSlot": 381232095,
    "averageBlockTime": 12,
    "recentTPS": 2938.87,
    "totalTransactions": 881661,
    "validatorCount": 884,
    "epochInfo": {...}
  }
}
```

**What was expected**:
```json
{
  "slot": 381232095,
  "tps": 2938.87,
  "epoch": 882
}
```

**Issue**: Data wrapped in `{success, data}`. Field names: `currentSlot` vs `slot`.

---

## ❌ Timeout (1 tool)

### 11. ai_inference_call

**Status**: ❌ API TIMEOUT (504)

**What was sent**:
```json
{
  "question": "What is Solana?",
  "maxTokens": 100
}
```

**API Endpoint**: `POST https://opensvm.com/api/getAnswer`

**MCP Implementation** (src/index.ts:3100-3113):
```typescript
case 'ai_inference_call':
  const aiAnswer = await this.client.post('/api/getAnswer', {
    question: args.question,
    ...(args.systemPrompt && { systemPrompt: args.systemPrompt }),
    ...(args.maxTokens && { maxTokens: args.maxTokens }),
    ...(args.ownPlan !== undefined && { ownPlan: args.ownPlan })
  });
```

**Curl command to reproduce**:
```bash
curl -X POST "https://opensvm.com/api/getAnswer" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is Solana?","maxTokens":100}' \
  --max-time 120
```

**What was received**:
```
504 Gateway Timeout
(empty response body)
```

**What was expected**:
```json
{
  "answer": "Solana is a high-performance blockchain..."
}
```

**Root Cause**: Upstream API issue - endpoint times out after ~30 seconds. Intermittent issue based on server load.

---

## Summary Statistics

- **Critical Failures (HTML)**: 4 tools (24%)
  - batch_transactions
  - get_account_stats
  - get_account_token_stats
  - search_accounts

- **Structure Mismatches**: 6 tools (35%)
  - get_transaction
  - get_account_portfolio
  - get_account_transactions
  - get_account_transfers
  - get_block
  - get_block_stats

- **API Timeouts**: 1 tool (6%)
  - ai_inference_call

- **Working Correctly**: 6 tools (35%)
  - get_solana_balance
  - universal_search
  - get_defi_overview
  - get_dex_analytics
  - get_defi_health
  - get_market_data

## Recommended Actions

### Immediate (Critical)
1. Investigate the 4 HTML-returning endpoints with OpenSVM API team
2. Check OpenAPI spec at https://osvm.ai/openapi for correct endpoint URLs
3. Remove or deprecate broken tools until API is fixed

### Short-term
4. Update validation logic to match actual API response structures
5. Add response flattening for wrapped data structures
6. Add retry logic for 504 timeouts

### Long-term
7. Monitor API endpoint changes
8. Add automated API contract testing
9. Implement circuit breakers for consistently failing endpoints

