/**
 * Worker Pool Manager for multi-threaded MCP request processing
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private pendingRequests = new Map<number, PendingRequest>();
  private nextRequestId = 1;
  private currentWorkerIndex = 0;
  private poolSize: number;

  constructor(poolSize: number = cpus().length) {
    this.poolSize = poolSize;
    console.error(`🔧 Initializing worker pool with ${poolSize} threads...`);
  }

  async initialize(): Promise<void> {
    const workerPath = join(__dirname, 'worker.js');

    const initPromises = [];

    for (let i = 0; i < this.poolSize; i++) {
      const promise = new Promise<void>((resolve, reject) => {
        const worker = new Worker(workerPath);

        worker.on('message', (message) => {
          if (message.ready) {
            console.error(`   ✅ Worker ${i + 1}/${this.poolSize} ready`);
            resolve();
          } else {
            this.handleWorkerMessage(message);
          }
        });

        worker.on('error', (error) => {
          console.error(`❌ Worker ${i + 1} error:`, error);
          reject(error);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`⚠️  Worker ${i + 1} exited with code ${code}`);
          }
        });

        this.workers.push(worker);
      });

      initPromises.push(promise);
    }

    await Promise.all(initPromises);
    console.error(`✅ Worker pool ready with ${this.poolSize} threads\n`);
  }

  async execute(toolName: string, args: any): Promise<any> {
    const requestId = this.nextRequestId++;

    return new Promise((resolve, reject) => {
      // Store the promise callbacks
      this.pendingRequests.set(requestId, { resolve, reject });

      // Round-robin worker selection
      const worker = this.workers[this.currentWorkerIndex];
      this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;

      // Send request to worker
      worker.postMessage({
        id: requestId,
        toolName,
        args
      });
    });
  }

  private handleWorkerMessage(message: any) {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      console.error(`⚠️  Received response for unknown request ID: ${message.id}`);
      return;
    }

    this.pendingRequests.delete(message.id);

    if (message.success) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error.message));
    }
  }

  async shutdown(): Promise<void> {
    console.error('🛑 Shutting down worker pool...');

    await Promise.all(
      this.workers.map((worker) => worker.terminate())
    );

    this.workers = [];
    this.pendingRequests.clear();

    console.error('✅ Worker pool shut down');
  }

  getPoolSize(): number {
    return this.poolSize;
  }

  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}
