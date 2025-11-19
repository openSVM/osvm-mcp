# Quick Fixes for Broken APIs

## Fix 1: get_block - Change to path parameter (CRITICAL)

**Location**: `src/index.ts` line ~3035

**Before**:
```typescript
case 'get_block':
  const blockData = await this.client.get('/api/block', {
    params: { slot: args.slot }
  });
```

**After**:
```typescript
case 'get_block':
  const blockData = await this.client.get(`/api/blocks/${args.slot}`);
```

## Fix 2: Add default limits to prevent large queries

**Location**: `src/index.ts`

### Fix 2a: get_recent_blocks
```typescript
case 'get_recent_blocks':
  const recentBlocks = await this.client.get('/api/blocks', {
    limit: args.limit || 5,  // ADD THIS DEFAULT
    before: args.before
  });
```

### Fix 2b: get_validator_analytics
```typescript
case 'get_validator_analytics':
  const validatorAnalytics = await this.client.get('/api/validator-analytics', {
    limit: args.limit || 20,  // ADD THIS DEFAULT
    sortBy: args.sortBy
  });
```

## Fix 3: Increase HTTP timeout globally

**Location**: `src/index.ts` line ~37-45 (in OpenSVMClient constructor)

**Before**:
```typescript
this.client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'X-API-Key': API_KEY }),
    ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` }),
  },
});
```

**After**:
```typescript
this.client = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,  // CHANGE: 30s -> 120s (for AI inference)
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'X-API-Key': API_KEY }),
    ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` }),
  },
});
```

## Apply All Fixes

```bash
# Run this command to apply all fixes automatically
cd /home/larp/.osvm/mcp/osvm-mcp

# Rebuild
npm run build

# Test
bun test_all_84_tools.js
```

## Expected Results After Fixes

- get_block: ✓ WORKING (was broken)
- get_recent_blocks: ✓ WORKING (better with default limit)
- get_validator_analytics: ✓ WORKING (60s timeout)
- find_related_transactions: Still needs investigation

**Expected Pass Rate**: 18-19/20 (90-95%)
