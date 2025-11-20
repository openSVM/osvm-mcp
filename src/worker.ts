#!/usr/bin/env node

/**
 * Worker thread for processing MCP tool requests
 * Each worker is a separate thread that can process requests independently
 */

import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';

// Simple API client (copied from main, no MCP SDK needed in worker)
const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Tool execution logic
async function executeToolCall(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'get_account_transfers':
      const response = await apiClient.get(`/api/account-transfers/${args.address}`, {
        params: {
          limit: args.limit,
          offset: args.offset,
          beforeSignature: args.beforeSignature,
          transferType: args.transferType,
          solanaOnly: args.solanaOnly,
          txType: args.txType,
          mints: args.mints,
          bypassCache: args.bypassCache
        }
      });

      // Handle compression if requested
      if (args.compress === true) {
        const zlib = await import('zlib');
        const jsonStr = JSON.stringify(response.data);
        const compressed = zlib.brotliCompressSync(Buffer.from(jsonStr), {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11
          }
        });
        return {
          _compressed: 'brotli',
          _originalSize: jsonStr.length,
          _compressedSize: compressed.length,
          data: compressed.toString('base64')
        };
      }

      return response.data;

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Listen for messages from main thread
if (parentPort) {
  parentPort.on('message', async (message: { id: number; toolName: string; args: any }) => {
    try {
      const result = await executeToolCall(message.toolName, message.args);
      parentPort!.postMessage({
        id: message.id,
        success: true,
        result
      });
    } catch (error: any) {
      parentPort!.postMessage({
        id: message.id,
        success: false,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      });
    }
  });

  // Signal ready
  parentPort.postMessage({ ready: true });
}
