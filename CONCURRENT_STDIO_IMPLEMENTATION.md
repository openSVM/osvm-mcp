# Making MCP Stdio Concurrent

## Problem

The MCP SDK processes stdio requests **sequentially**. Even though handlers are async, responses wait for previous requests to complete.

## Solution: Concurrent Request Handler

We can override the SDK's sequential behavior by:
1. Processing multiple requests simultaneously
2. Matching responses by request ID
3. Writing responses as they complete (out of order is OK - client matches by ID)

---

## Implementation

### Option 1: Modify Server Handler (Simple)

Replace the sequential handler with a concurrent one:

```typescript
// src/index.ts - Add this after line 2706

private inflightRequests = new Map<number, Promise<any>>();
private maxConcurrentRequests = 10; // Limit concurrent requests

this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const requestId = request.id;

  // Wait if too many requests in flight
  while (this.inflightRequests.size >= this.maxConcurrentRequests) {
    await Promise.race(Array.from(this.inflightRequests.values()));
  }

  // Start processing (don't await yet!)
  const promise = (async () => {
    try {
      return await this.handleToolCall(
        request.params.name,
        request.params.arguments
      );
    } catch (error) {
      console.error(`Error in tool ${request.params.name}:`, error);
      throw error;
    } finally {
      this.inflightRequests.delete(requestId);
    }
  })();

  // Track this request
  this.inflightRequests.set(requestId, promise);

  // Return immediately (SDK will await this)
  return promise;
});
```

**Result**: Requests process concurrently up to `maxConcurrentRequests` limit.

---

### Option 2: Custom Stdio Handler (Advanced)

Bypass the SDK's stdio processing entirely:

```typescript
// src/concurrent-stdio.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as readline from 'readline';

export class ConcurrentStdioServer {
  private server: Server;
  private pendingRequests = new Map<number, Promise<any>>();
  private rl: readline.Interface;

  constructor(server: Server) {
    this.server = server;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
  }

  async start() {
    console.error('Starting concurrent stdio server...');

    this.rl.on('line', async (line) => {
      if (!line.trim()) return;

      try {
        const message = JSON.parse(line);

        // Handle request concurrently
        if (message.method) {
          this.handleRequest(message);
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    // Keep process alive
    await new Promise(() => {});
  }

  private async handleRequest(request: any) {
    const requestId = request.id;

    // Process request (don't await - let it run concurrently!)
    const promise = this.processRequest(request)
      .then((result) => {
        // Write response when ready
        const response = {
          jsonrpc: '2.0',
          id: requestId,
          result,
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      })
      .catch((error) => {
        // Write error response
        const response = {
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32603,
            message: error.message,
          },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      })
      .finally(() => {
        this.pendingRequests.delete(requestId);
      });

    this.pendingRequests.set(requestId, promise);
  }

  private async processRequest(request: any): Promise<any> {
    // Call your tool handler
    const opensvmServer = this.server as any;
    return await opensvmServer.handleToolCall(
      request.params.name,
      request.params.arguments
    );
  }

  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}
```

**Usage**:
```typescript
// src/index.ts - Replace server.run() with:

import { ConcurrentStdioServer } from './concurrent-stdio.js';

async function main() {
  const opensvmServer = new OpenSVMServer();
  const concurrentServer = new ConcurrentStdioServer(opensvmServer.server);

  await concurrentServer.start();
}

main().catch(console.error);
```

---

## Option 3: Worker Threads (Maximum Performance)

Use Node.js worker threads to truly parallelize:

```typescript
// src/worker-pool.ts

import { Worker } from 'worker_threads';
import { cpus } from 'os';

export class WorkerPool {
  private workers: Worker[] = [];
  private currentWorker = 0;

  constructor(workerScript: string, poolSize = cpus().length) {
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript);
      this.workers.push(worker);
    }
  }

  async execute(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = this.workers[this.currentWorker];
      this.currentWorker = (this.currentWorker + 1) % this.workers.length;

      const messageHandler = (result: any) => {
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        resolve(result);
      };

      const errorHandler = (error: Error) => {
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        reject(error);
      };

      worker.on('message', messageHandler);
      worker.on('error', errorHandler);
      worker.postMessage(request);
    });
  }
}
```

---

## Performance Comparison

### Sequential (Current):
```
Request 1: ████████ 4s
Request 2:         ████████ 4s (wait for #1)
Request 3:                 ████████ 4s (wait for #2)
Total: 12s
```

### Concurrent (Option 1 & 2):
```
Request 1: ████████ 4s ─┐
Request 2: ████████ 4s ─┤ All run simultaneously
Request 3: ████████ 4s ─┘
Total: 4s (responses arrive out-of-order, client matches by ID)
```

### Worker Threads (Option 3):
```
Request 1: ████ 2s ─┐ (CPU-bound work parallelized)
Request 2: ████ 2s ─┤
Request 3: ████ 2s ─┘
Total: 2s
```

---

## Recommended Approach

**For your use case (I/O-bound API calls):**

Use **Option 1** (modify handler) - it's:
- ✅ Simple to implement
- ✅ Works with existing SDK
- ✅ Handles concurrent I/O well
- ✅ No breaking changes

**Implementation**:
1. Add `inflightRequests` map to track promises
2. Modify `setRequestHandler` to not await immediately
3. Set `maxConcurrentRequests = 10` (or num CPUs)

---

## Testing Concurrent Mode

After implementing, run:
```bash
node test_concurrent_requests.js
```

**Expected results**:
```
Request 2: 3.58s  ─┐
Request 3: 3.65s  ─┤ All ~same time
Request 4: 3.72s  ─┤ (±200ms)
Request 5: 3.81s  ─┘
Time spread: 0.23s ✅ CONCURRENT
```

vs current:
```
Request 2: 3.58s
Request 3: 5.65s  (+2.07s)
Request 4: 6.88s  (+1.23s)
Time spread: 3.69s ❌ SEQUENTIAL
```

---

## Important Notes

1. **Stdio ordering doesn't matter** - JSON-RPC matches by `id` field
2. **Limit concurrent requests** - Too many can overwhelm the API
3. **Error handling is critical** - One failure shouldn't block others
4. **Memory usage** - Each concurrent request holds memory

---

## When NOT to Use This

❌ **If OpenSVM API rate limits you** - Concurrent requests = faster rate limiting
❌ **If responses must be ordered** - Stdio concurrency breaks ordering
✅ **For batch processing wallets** - Perfect use case!

---

## Next Steps

1. Implement Option 1 in `src/index.ts`
2. Test with `test_concurrent_requests.js`
3. Measure improvement
4. Adjust `maxConcurrentRequests` based on API limits

This will give you **3-10x throughput improvement** for batch wallet processing!
