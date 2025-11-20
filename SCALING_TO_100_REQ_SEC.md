# Scaling to 100 Requests/Second

## Current Bottleneck Analysis

**Current Performance:**
- 8 MCP servers: 2.11 req/sec
- Average response time: 18.89s per request
- Throughput limited by API latency, not MCP

**Problem:** Each request takes ~19 seconds. To hit 100 req/sec, you need **1,900 concurrent requests** in flight at any time!

```
100 req/sec × 19s latency = 1,900 concurrent requests needed
```

---

## Solution 1: Massive Pool (Simple but Resource Heavy)

Spawn **400 MCP server instances** (50 requests each = 19s each):

```rust
// In your Rust research agent
const POOL_SIZE: usize = 400;
const MAX_CONCURRENT: usize = 1900;

pub struct MegaPool {
    clients: Vec<Arc<Mutex<McpClient>>>,
    semaphore: Arc<Semaphore>,
}

impl MegaPool {
    pub fn new() -> Result<Self> {
        let mut clients = Vec::new();

        // Spawn 400 MCP server processes
        for i in 0..POOL_SIZE {
            let mut cmd = Command::new("node");
            cmd.arg("./build/index.js")
               .current_dir("/home/larp/.osvm/mcp/osvm-mcp")
               .stdin(Stdio::piped())
               .stdout(Stdio::piped())
               .stderr(Stdio::piped());

            let child = cmd.spawn()?;
            clients.push(Arc::new(Mutex::new(McpClient::from_process(child))));
        }

        Ok(MegaPool {
            clients,
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT)),
        })
    }
}
```

**Resource Usage:**
- 400 Node.js processes × ~50MB RAM = **20GB RAM**
- CPU: Minimal (mostly I/O bound)

**Expected Performance:**
- 400 servers / 19s = **21 req/sec** per wave
- With pipelining: **~100 req/sec** sustained

---

## Solution 2: API Optimization (Fix Root Cause)

**The real bottleneck is OpenSVM API latency (19s per request).**

### Optimize API Response Time:

1. **Database Indexing** - Ensure account_transfers table has indexes:
```sql
CREATE INDEX idx_account_transfers_address ON account_transfers(address);
CREATE INDEX idx_account_transfers_date ON account_transfers(date DESC);
```

2. **Redis Caching** - Cache recent transfers:
```rust
// Cache hot wallets for 60s
let cache_key = format!("transfers:{}", address);
if let Some(cached) = redis.get(&cache_key).await? {
    return Ok(cached);
}
```

3. **Pagination** - Return fewer transfers faster:
```
limit=20 → ~5s response time
limit=100 → ~19s response time
```

4. **CDN/Edge Caching** - CloudFlare cache for popular wallets

**Target:** Reduce API latency from 19s → 2s

**Result:** 100 req/sec with only 200 servers (or 20 req/sec with 40 servers)

---

## Solution 3: Request Batching (Most Efficient)

Add a **batch endpoint** to get multiple wallets at once:

### API Change:
```typescript
// New tool: get_batch_account_transfers
{
  name: 'get_batch_account_transfers',
  description: 'Get transfers for multiple accounts in one request',
  inputSchema: {
    addresses: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 100  // Batch up to 100 wallets
    },
    limit: { type: 'number', default: 50 }
  }
}
```

### Implementation:
```typescript
case 'get_batch_account_transfers': {
  const addresses = args.addresses as string[];
  const limit = args.limit || 50;

  // Fetch all wallets in parallel
  const results = await Promise.all(
    addresses.map(addr =>
      apiClient.get(`/api/account-transfers/${addr}`, {
        params: { limit }
      })
    )
  );

  // Return as map
  const response = {};
  addresses.forEach((addr, i) => {
    response[addr] = results[i].data;
  });

  return response;
}
```

**Performance:**
- 1 request → 100 wallets in ~20s
- **100 wallets / 20s = 5 wallets/sec per server**
- 20 servers = **100 wallets/sec**

**Benefits:**
- ✅ 20x less memory (20 servers vs 400)
- ✅ Simpler infrastructure
- ✅ Better API efficiency

---

## Solution 4: Async Streaming (Best for Real-time)

Stream results as they arrive instead of waiting for all:

```typescript
// New tool: stream_account_transfers
{
  name: 'stream_account_transfers',
  description: 'Stream transfers as they are fetched (non-blocking)',
}
```

```typescript
case 'stream_account_transfers': {
  const addresses = args.addresses as string[];

  // Start fetching all wallets
  const promises = addresses.map(async (addr) => {
    const result = await apiClient.get(`/api/account-transfers/${addr}`);

    // Send result immediately via progress notification
    this.server.sendProgress({
      wallet: addr,
      transfers: result.data
    });
  });

  await Promise.all(promises);
  return { status: 'complete', processed: addresses.length };
}
```

**Performance:**
- Start processing results **immediately** (don't wait for batch)
- 100 concurrent fetches in flight
- First results arrive in 2-5s, complete in 20s

---

## Recommended Approach

**Hybrid Strategy:**

1. **Add batch endpoint** (Solution 3) - Gets you to 100 req/sec with 20 servers
2. **Optimize API** (Solution 2) - Reduce latency from 19s → 5s
3. **Pool of 40 servers** (Solution 1) - Handle burst traffic

**Final Performance:**
```
40 servers × 5s latency × batches of 100 = 800 wallets/sec
```

---

## Quick Win: Test Batch Approach Now

Let me implement the batch tool to prove the concept:

```typescript
// Add to src/index.ts tools array
{
  name: 'get_batch_account_transfers',
  description: 'Get transfers for multiple accounts (up to 50) in parallel',
  inputSchema: {
    type: 'object',
    properties: {
      addresses: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of wallet addresses',
        maxItems: 50
      },
      limit: {
        type: 'number',
        description: 'Transfers per wallet (default 50)',
        default: 50,
        maximum: 5000
      },
      compress: {
        type: 'boolean',
        description: 'Enable Brotli compression',
        default: false
      }
    },
    required: ['addresses']
  }
}
```

**Expected Results:**
- **50 wallets in ~20s = 2.5 wallets/sec per server**
- **10 servers = 25 wallets/sec**
- **40 servers = 100 wallets/sec**

---

## Cost Comparison

| Solution | Servers | RAM | CPU | Req/sec | Cost/month |
|----------|---------|-----|-----|---------|------------|
| Current | 8 | 400MB | Low | 2 | $10 |
| Massive Pool | 400 | 20GB | Medium | 100 | $200 |
| API Optimized | 40 | 2GB | Low | 100 | $40 |
| Batch API | 20 | 1GB | Low | 100 | $20 |
| Hybrid | 40 | 2GB | Low | 800 | $40 |

**Winner:** Batch API (20x cheaper than massive pool)

---

## Next Steps

1. **Implement batch tool** (30 min)
2. **Test with 10 servers × 50 wallets/batch** (5 min)
3. **Profile API performance** to find optimization opportunities
4. **Add Redis caching** for hot wallets (1 hour)

Want me to implement the batch tool now?
