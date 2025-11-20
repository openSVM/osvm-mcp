#!/usr/bin/env bun

/**
 * OpenSVM API MCP Server
 * Provides comprehensive access to the OpenSVM Solana blockchain API
 * Supports 85+ endpoints covering transactions, accounts, analytics, tokens, NFTs, and real-time data
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from 'axios';
import bs58 from 'bs58';
import zlib from 'zlib';

// Environment configuration
const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://opensvm.com';
const API_KEY = process.env.OPENSVM_API_KEY;
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;

/**
 * OpenSVM API Client wrapper
 *
 * Note on Solana RPC Limits:
 * - getSignaturesForAddress and similar methods have a maximum limit of 1000 per request
 * - This is enforced by Solana RPC endpoints to prevent excessive load
 * - For larger datasets, use pagination with the 'before' parameter
 */
class OpenSVMClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 120000, // Increased to 120s for AI inference and slow blockchain queries
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'X-API-Key': API_KEY }),
        ...(JWT_TOKEN && { 'Authorization': `Bearer ${JWT_TOKEN}` }),
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('OpenSVM API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async get(endpoint: string, params?: any) {
    const response = await this.client.get(endpoint, { params });
    return response.data;
  }

  async post(endpoint: string, data?: any) {
    const response = await this.client.post(endpoint, data);
    return response.data;
  }

  async delete(endpoint: string) {
    const response = await this.client.delete(endpoint);
    return response.data;
  }
}

/**
 * Input validation helpers
 */
const isValidSolanaAddress = (address: string): boolean => {
  return typeof address === 'string' && address.length >= 32 && address.length <= 44;
};

const isValidTransactionSignature = (signature: string): boolean => {
  return typeof signature === 'string' && signature.length >= 87 && signature.length <= 88;
};

/**
 * Error message helpers with usage examples
 */
const getAddressValidationError = (address: any, fieldName: string = 'address'): string => {
  if (address === undefined) {
    return `Missing required parameter: ${fieldName} is required. Example: {"${fieldName}": "So11111111111111111111111111111111111111112"}`;
  }
  if (typeof address !== 'string') {
    return `Invalid Solana ${fieldName} format: expected string, got ${typeof address}. Example: "So11111111111111111111111111111111111111112"`;
  }
  return `Invalid Solana ${fieldName} format: must be 32-44 characters (got ${address.length}). Example: "So11111111111111111111111111111111111111112"`;
};

const getSignatureValidationError = (signature: any): string => {
  if (signature === undefined) {
    return `Missing required parameter: signature is required. Example: {"signature": "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"}`;
  }
  if (typeof signature !== 'string') {
    return `Invalid transaction signature format: expected string, got ${typeof signature}. Example: "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"`;
  }
  return `Invalid transaction signature format: must be 87-88 characters (got ${signature.length}). Example: "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"`;
};

const getArrayValidationError = (arr: any, fieldName: string, itemExample: string, maxItems?: number): string => {
  if (!Array.isArray(arr)) {
    return `${fieldName} must be an array. Example: [${itemExample}]`;
  }
  if (arr.length === 0) {
    return `${fieldName} cannot be empty. Example: [${itemExample}]`;
  }
  if (maxItems && arr.length > maxItems) {
    return `${fieldName} exceeds maximum of ${maxItems} items (got ${arr.length}). Reduce the array size.`;
  }
  return `Invalid ${fieldName}. Example: [${itemExample}]`;
};

const getRequiredFieldError = (fieldName: string, example: string): string => {
  return `${fieldName} is required. Example: ${example}`;
};

const getNumberValidationError = (value: any, fieldName: string, constraints?: { min?: number; max?: number }): string => {
  if (typeof value !== 'number') {
    return `${fieldName} must be a number, got ${typeof value}. Example: ${constraints?.min ?? 1}`;
  }
  if (constraints?.min !== undefined && value < constraints.min) {
    return `${fieldName} must be >= ${constraints.min} (got ${value}).`;
  }
  if (constraints?.max !== undefined && value > constraints.max) {
    return `${fieldName} must be <= ${constraints.max} (got ${value}).`;
  }
  return `Invalid ${fieldName}: ${value}`;
};

const getMultiAddressValidationError = (address: any, mint: any): string => {
  if (!isValidSolanaAddress(address)) {
    return getAddressValidationError(address, 'address');
  }
  if (!isValidSolanaAddress(mint)) {
    return getAddressValidationError(mint, 'mint');
  }
  return 'Invalid address or mint format';
};

/**
 * Convert base58 Solana address to base64 for RPC filter use
 * Solana RPC getProgramAccounts requires base64 encoding for memcmp filters
 */
const base58ToBase64 = (base58Address: string): string => {
  try {
    const decoded = bs58.decode(base58Address);
    return Buffer.from(decoded).toString('base64');
  } catch (error) {
    throw new Error(`Failed to convert base58 address to base64: ${error}`);
  }
};

/**
 * Process RPC filters to convert base58 addresses to base64
 * This is required for getProgramAccounts memcmp filters
 */
const processRpcFilters = (filters: any[]): any[] => {
  if (!Array.isArray(filters)) return filters;

  return filters.map(filter => {
    if (filter.memcmp && filter.memcmp.bytes) {
      // Check if bytes looks like a base58 address (32-44 chars, base58 alphabet)
      const bytes = filter.memcmp.bytes;
      if (typeof bytes === 'string' && bytes.length >= 32 && bytes.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(bytes)) {
        return {
          ...filter,
          memcmp: {
            ...filter.memcmp,
            bytes: base58ToBase64(bytes),
            encoding: 'base64'
          }
        };
      }
    }
    return filter;
  });
};

/**
 * Auto-correct common parameter name mistakes
 * Returns true if a correction was made
 */
const autoCorrectParam = (args: any, correctName: string, alternatives: string[], toolName: string): boolean => {
  if (args[correctName] !== undefined) return false;

  for (const alt of alternatives) {
    if (args[alt] !== undefined) {
      args[correctName] = args[alt];
      console.warn(`[${toolName}] Auto-corrected parameter: "${alt}" → "${correctName}"`);
      return true;
    }
  }
  return false;
};

/**
 * OpenSVM MCP Server implementation
 */
class OpenSVMServer {
  private server: Server;
  private client: OpenSVMClient;

  constructor() {
    this.server = new Server(
      {
        name: "opensvm-api-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.client = new OpenSVMClient();
    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Flatten RPC response structure for AI accessibility
   * Converts {result: {context: {...}, value: {...}}} to {context: {...}, ...value}
   */
  private flattenRpcResponse(rpcResult: any): any {
    if (!rpcResult || typeof rpcResult !== 'object') {
      return rpcResult;
    }

    // If result has context/value structure, flatten it
    if (rpcResult.result && typeof rpcResult.result === 'object') {
      const { context, value } = rpcResult.result;

      if (context !== undefined || value !== undefined) {
        return {
          ...rpcResult,
          result: undefined,
          context: context,
          // Spread value to top level if it's an object, otherwise use it directly
          ...(value && typeof value === 'object' ? value : { value })
        };
      }
    }

    return rpcResult;
  }

  private getToolDefinitions() {
    return [
      // Transaction Tools
        {
          name: 'get_transaction',
          description: 'Get detailed transaction information including signatures, timestamps, instructions, balance changes, and logs. Request: {signature: string (87-88 chars)} Response: {signature: string, timestamp: number, slot: number, success: boolean, type: "sol"|"token", details: {instructions, accounts, preBalances, postBalances, tokenChanges, solChanges, logs}} Use case: Transaction verification, debugging failed transactions, analyzing program interactions, tracking token transfers.',
          inputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature (base58, 87-88 chars)' }
            },
            required: ['signature']
          },
          outputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature' },
              timestamp: { type: 'number', description: 'Transaction timestamp in milliseconds' },
              slot: { type: 'number', description: 'Slot number when transaction was processed' },
              success: { type: 'boolean', description: 'Whether transaction succeeded' },
              type: { type: 'string', enum: ['sol', 'token'], description: 'Transaction type' },
              details: {
                type: 'object',
                properties: {
                  instructions: { type: 'array', description: 'Transaction instructions' },
                  accounts: { type: 'array', description: 'Accounts involved in transaction' },
                  preBalances: { type: 'array', items: { type: 'number' }, description: 'Account balances before transaction' },
                  postBalances: { type: 'array', items: { type: 'number' }, description: 'Account balances after transaction' },
                  tokenChanges: { type: 'array', description: 'Token balance changes' },
                  solChanges: { type: 'array', description: 'SOL balance changes' },
                  logs: { type: 'array', items: { type: 'string' }, description: 'Transaction logs' }
                }
              }
            },
            required: ['signature', 'timestamp', 'slot', 'success']
          }
        },
        {
          name: 'batch_transactions',
          description: 'Fetch multiple transactions in one call (up to 100). Request: {signatures: array, includeDetails?: boolean} Response: Array of objects Use case: Bulk transaction analysis, historical data collection, parallel processing of multiple transactions.',
          inputSchema: {
            type: 'object',
            properties: {
              signatures: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of transaction signatures (max 100)',
                maxItems: 100
              },
              includeDetails: { type: 'boolean', description: 'Include full transaction details (default true)' }
            },
            required: ['signatures']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                signature: { type: 'string', description: 'Transaction signature' },
                timestamp: { type: 'number', description: 'Transaction timestamp in milliseconds' },
                slot: { type: 'number', description: 'Slot number' },
                success: { type: 'boolean', description: 'Whether transaction succeeded' },
                type: { type: 'string', description: 'Transaction type' },
                details: { type: 'object', description: 'Detailed transaction data (if includeDetails=true)' }
              }
            }
          }
        },
        {
          name: 'analyze_transaction',
          description: 'AI-powered transaction analysis. Request: {signature: string, model?: string} Response: Array of objects Use case: Understand complex transactions, detect MEV, identify malicious behavior, explain DeFi operations.',
          inputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature (base58, 87-88 chars)' },
              model: { type: 'string', description: 'AI model to use: "gpt-4", "claude", etc. (optional)' }
            },
            required: ['signature']
          },
          outputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature' },
              programs: { type: 'array', items: { type: 'string' }, description: 'Detected program IDs' },
              tokenTransfers: { type: 'array', description: 'Token transfer events' },
              nftActions: { type: 'array', description: 'NFT-related actions' },
              defiInteractions: { type: 'array', description: 'DeFi protocol interactions' },
              securityInsights: { type: 'object', description: 'Security analysis results' },
              summary: { type: 'string', description: 'AI-generated summary' }
            }
          }
        },
        {
          name: 'explain_transaction',
          description: 'Get human-readable explanation of transaction. Request: {signature: string, language?: string} Response: {success: boolean, data: {explanation}, timestamp: number} Use case: User-friendly transaction summaries, educational purposes, non-technical explanations.',
          inputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature (base58, 87-88 chars)' },
              language: { type: 'string', description: 'Output language: "en", "es", "zh", etc. (default "en")' }
            },
            required: ['signature']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  explanation: { type: 'string', description: 'Natural language explanation' }
                }
              },
              timestamp: { type: 'number' }
            },
            required: ['success', 'data', 'timestamp']
          }
        },
        // Account Tools
        {
          name: 'get_account_stats',
          description: 'Get account activity statistics. Request: {address: string} Response: {totalTransactions: string, tokenTransfers?: number, lastUpdated?: number} Use case: Check account activity level, transaction volume analysis, bot detection.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address (base58, 32-44 chars)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              totalTransactions: { type: 'string', description: 'Total number of transactions (may be approximated, e.g., "3000+")' },
              tokenTransfers: { type: 'number', description: 'Number of token transfer transactions' },
              lastUpdated: { type: 'number', description: 'Timestamp when stats were last updated (Unix timestamp in milliseconds)' }
            },
            required: ['totalTransactions']
          }
        },
        {
          name: 'get_account_portfolio',
          description: 'Get complete account portfolio with prices. Request: {address: string} Response: {address, timestamp, data: {native: {balance, symbol, price, value, change24h}, tokens: [{balance, symbol, name, price, value}], totalValue, totalTokens, summary}} Use case: Portfolio tracking, wallet analysis, asset valuation, DeFi position monitoring.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address (base58, 32-44 chars)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address' },
              timestamp: { type: 'number', description: 'Timestamp of data retrieval' },
              data: {
                type: 'object',
                properties: {
                  native: {
                    type: 'object',
                    properties: {
                      balance: { type: 'number', description: 'SOL balance' },
                      symbol: { type: 'string', description: 'Token symbol (SOL)' },
                      price: { type: 'number', description: 'Current SOL price in USD' },
                      value: { type: 'number', description: 'Total value in USD' },
                      change24h: { type: 'number', description: '24-hour price change percentage' }
                    }
                  },
                  tokens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        balance: { type: 'number', description: 'Token balance' },
                        symbol: { type: 'string', description: 'Token symbol' },
                        name: { type: 'string', description: 'Token name' },
                        price: { type: 'number', description: 'Token price in USD' },
                        value: { type: 'number', description: 'Token value in USD' }
                      }
                    }
                  },
                  totalValue: { type: 'number', description: 'Total portfolio value in USD' },
                  totalTokens: { type: 'number', description: 'Number of different tokens held' },
                  summary: {
                    type: 'object',
                    properties: {
                      hasData: { type: 'boolean', description: 'Whether portfolio data is available' },
                      dataSource: { type: 'string', description: 'Source of price data' },
                      pricesAvailable: { type: 'boolean', description: 'Whether price data is available' }
                    }
                  }
                }
              }
            },
            required: ['address', 'timestamp']
          }
        },
        {
          name: 'get_solana_balance',
          description: 'Get SOL balance and all token holdings (same as get_account_portfolio). Request: {address: string} Response: Array of objects Use case: Quick balance check, portfolio overview, wallet monitoring.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address (base58, 32-44 chars)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address' },
              timestamp: { type: 'number', description: 'Timestamp of data retrieval' },
              native: {
                type: 'object',
                properties: {
                  balance: { type: 'number', description: 'SOL balance' },
                  symbol: { type: 'string', description: 'Token symbol (SOL)' },
                  name: { type: 'string', description: 'Token name (Solana)' },
                  decimals: { type: 'number', description: 'Token decimals (9 for SOL)' },
                  price: { type: 'number', description: 'Current SOL price in USD' },
                  value: { type: 'number', description: 'Total value in USD' },
                  change24h: { type: 'number', description: '24-hour price change percentage' }
                }
              },
              tokens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    balance: { type: 'number', description: 'Token balance' },
                    symbol: { type: 'string', description: 'Token symbol' },
                    name: { type: 'string', description: 'Token name' },
                    price: { type: 'number', description: 'Token price in USD' },
                    value: { type: 'number', description: 'Token value in USD' }
                  }
                }
              },
              totalValue: { type: 'number', description: 'Total portfolio value in USD' },
              totalTokens: { type: 'number', description: 'Number of different tokens held' },
              summary: {
                type: 'object',
                properties: {
                  hasData: { type: 'boolean', description: 'Whether portfolio data is available' },
                  dataSource: { type: 'string', description: 'Source of price data' },
                  pricesAvailable: { type: 'boolean', description: 'Whether price data is available' }
                }
              }
            },
            required: ['address', 'timestamp']
          }
        },
        {
          name: 'get_account_transactions',
          description: 'Get paginated transaction history for account with optional date filtering. Request: {address: string, limit?: number, before?: string} Response: OBJECT with {transactions: ARRAY, address: string}. Access transaction array: response.transactions (NOT response directly). Each transaction object has {signature, timestamp, slot, success, accounts, transfers, details}. Use case: Transaction history tracking, account activity analysis, audit trails, finding transactions in date ranges.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address (base58, 32-44 chars)' },
              limit: { type: 'number', description: 'Number of transactions to return (max 1000 due to Solana RPC limit, default 20)', maximum: 1000, minimum: 1 },
              before: { type: 'string', description: 'Pagination cursor (signature) to fetch older transactions' },
              type: { type: 'string', description: 'Filter by transaction type: "token", "sol", "nft", etc.' },
              startDate: { type: ['string', 'number'], description: 'Filter start date: ISO string (e.g., "2025-10-21") or Unix timestamp in ms (e.g., 1729800000000)' },
              endDate: { type: ['string', 'number'], description: 'Filter end date: ISO string (e.g., "2025-10-28") or Unix timestamp in ms (e.g., 1730160000000)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address queried' },
              transactions: {
                type: 'array',
                description: 'Array of transaction objects',
                items: {
                  type: 'object',
                  properties: {
                    signature: { type: 'string', description: 'Transaction signature' },
                    timestamp: { type: 'number', description: 'Transaction timestamp in milliseconds' },
                    slot: { type: 'number', description: 'Slot number' },
                    err: { type: ['object', 'null'], description: 'Error details if transaction failed' },
                    success: { type: 'boolean', description: 'Whether transaction succeeded' },
                    accounts: { type: 'array', description: 'Accounts involved in transaction' },
                    transfers: { type: 'array', description: 'SOL transfers in the transaction' },
                    memo: { type: ['string', 'null'], description: 'Transaction memo if present' }
                  },
                  required: ['signature', 'timestamp']
                }
              },
              includeInflow: { type: 'boolean', description: 'Whether inflow transactions are included' },
              classified: { type: 'boolean', description: 'Whether transactions are classified by type' },
              rpcCount: { type: 'number', description: 'Number of RPC calls made' }
            },
            required: ['address', 'transactions']
          }
        },
        {
          name: 'get_batch_account_transfers',
          description: 'BATCH API: Get transfers for multiple wallets (up to 100) in parallel - 20x faster than individual calls. Returns map of address→transfers. Use for bulk wallet analysis. Response: {[address]: {data: ARRAY, hasMore: bool, total: number}}. Each wallet processed concurrently.',
          inputSchema: {
            type: 'object',
            properties: {
              addresses: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of Solana wallet addresses (max 100)',
                minItems: 1,
                maxItems: 100
              },
              limit: { type: 'number', description: 'Transfers per wallet (default 50, max 5000)', default: 50, maximum: 5000, minimum: 1 },
              transferType: { type: 'string', description: 'Filter by transfer direction', enum: ['IN', 'OUT', 'ALL'], default: 'ALL' },
              compress: { type: 'boolean', description: 'Enable Brotli compression for response', default: false }
            },
            required: ['addresses']
          },
          outputSchema: {
            type: 'object',
            description: 'Map of wallet addresses to their transfer data',
            additionalProperties: {
              type: 'object',
              properties: {
                data: { type: 'array' },
                hasMore: { type: 'boolean' },
                total: { type: 'number' }
              }
            }
          }
        },
        {
          name: 'get_account_transfers',
          description: 'Get SOL/token transfer history for an account with bidirectional visibility, real token symbols, and DeFi attribution. Request: {address: string, limit?: number, transferType?: string, compress?: boolean} Response: OBJECT with {data: ARRAY, hasMore: boolean, total: number, nextPageSignature: string}. Access transfer array: response.data (NOT response directly). Each transfer has {txId, date, from, to, tokenSymbol, tokenAmount, transferType}. COMPRESSION: Set compress=true for Brotli compression (92.6% smaller, 182KB→13.6KB for 500 transfers, fits in 64KB pipe buffer, prevents chunking/deadlocks). Use case: Track token movements, analyze trading history, monitor inflows/outflows, filter by tx type.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address (base58, 32-44 chars)' },
              limit: { type: 'number', description: 'Maximum number of transfers to return (default 50)', maximum: 5000, minimum: 1 },
              beforeSignature: { type: 'string', description: 'Pagination cursor - use nextPageSignature from previous response' },
              offset: { type: 'number', description: 'Pagination offset (default 0)', minimum: 0 },
              transferType: { type: 'string', description: 'Filter by transfer direction (default "ALL")', enum: ['IN', 'OUT', 'ALL'], default: 'ALL' },
              solanaOnly: { type: 'boolean', description: 'Show only native SOL transfers - default false' },
              txType: { type: 'string', description: 'Filter by transaction type (comma-separated): sol, spl, defi, nft, program, system, funding' },
              mints: { type: 'string', description: 'Filter by specific token mint addresses (comma-separated)' },
              bypassCache: { type: 'boolean', description: 'Fetch fresh data directly from RPC - default false' },
              compress: { type: 'boolean', description: 'Enable Brotli compression (92.6% reduction: 182KB→13.6KB for 500 transfers, fits in 64KB pipe buffer, prevents chunking/deadlocks in stdio) - default false' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                description: 'Array of transfer objects',
                items: {
                  type: 'object',
                  properties: {
                    signature: { type: 'string', description: 'Transaction signature' },
                    timestamp: { type: 'number', description: 'Transfer timestamp in milliseconds' },
                    mint: { type: 'string', description: 'Token mint address' },
                    tokenSymbol: { type: 'string', description: 'Token symbol if available' },
                    from: { type: 'string', description: 'Source address' },
                    to: { type: 'string', description: 'Destination address' },
                    amount: { type: 'number', description: 'Transfer amount in token units' },
                    decimals: { type: 'number', description: 'Token decimals' },
                    type: { type: 'string', description: 'Transfer type (e.g., "in", "out")' }
                  }
                }
              },
              hasMore: { type: 'boolean', description: 'Whether more results are available' },
              total: { type: 'number', description: 'Total number of transfers' },
              originalTotal: { type: 'number', description: 'Original total before filtering' },
              nextPageSignature: { type: 'string', description: 'Signature to use for next page (use as beforeSignature)' },
              fromCache: { type: 'boolean', description: 'Whether response was served from cache' }
            },
            required: ['data']
          }
        },
        {
          name: 'get_account_token_stats',
          description: 'Get specific token statistics for an account/mint pair. Request: {address: string, mint: string} Response: {solBalance: number, transferCount: number} Use case: Track specific token holdings, analyze token-specific activity, monitor airdrop claims.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address holding the token' },
              mint: { type: 'string', description: 'Token mint address to query stats for' }
            },
            required: ['address', 'mint']
          },
          outputSchema: {
            type: 'object',
            properties: {
              solBalance: { type: 'number', description: 'SOL balance in lamports' },
              transferCount: { type: 'number', description: 'Number of token transfers' }
            }
          }
        },
        {
          name: 'check_account_type',
          description: 'Identify account type. Request: {address: string} Response: {details?: object} Use case: Distinguish between user wallets, smart contracts, token accounts, validate address types before operations.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address to identify (base58, 32-44 chars)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['wallet', 'program', 'token', 'nft', 'system'], description: 'Account type' },
              details: { type: 'object', description: 'Additional account details based on type' }
            },
            required: ['type']
          }
        },
        // Block Tools
        {
          name: 'get_block',
          description: 'Get detailed block information by slot. Request: {slot: number} Response: {slot: number, blockhash: string, transactions: array, blockTime: number, blockHeight: number} Use case: Block verification, analyze block contents, find transactions in specific block, blockchain forensics.',
          inputSchema: {
            type: 'object',
            properties: {
              slot: { type: 'number', description: 'Block slot number (positive integer)' }
            },
            required: ['slot']
          },
          outputSchema: {
            type: 'object',
            properties: {
              slot: { type: 'number', description: 'Block slot number' },
              blockhash: { type: 'string', description: 'Block hash' },
              transactions: { type: 'array', description: 'Array of transactions in the block' },
              blockTime: { type: 'number', description: 'Block timestamp (Unix timestamp)' },
              blockHeight: { type: 'number', description: 'Block height' }
            },
            required: ['slot', 'blockhash']
          }
        },
        {
          name: 'get_recent_blocks',
          description: 'Get list of recent blocks with pagination. Request: {limit?: number, before?: number} Response: Array of objects Use case: Monitor latest blocks, blockchain explorer, real-time block analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of blocks to return (default 20, max 100)' },
              before: { type: 'number', description: 'Slot number to fetch blocks before (for pagination)' }
            }
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slot: { type: 'number', description: 'Block slot number' },
                blockhash: { type: 'string', description: 'Block hash' },
                transactionCount: { type: 'number', description: 'Number of transactions in block' },
                blockTime: { type: 'number', description: 'Block timestamp (Unix timestamp)' }
              },
              required: ['slot']
            }
          }
        },
        {
          name: 'get_block_stats',
          description: 'Get blockchain statistics and performance metrics. Request: {} Response: {success: boolean, data: {currentSlot: number, averageBlockTime: number, epochInfo: object, recentTPS: number, totalTransactions: number}, timestamp: number} Use case: Network performance monitoring, TPS calculation, blockchain health checks. Note: This endpoint is currently unavailable due to API issues.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  currentSlot: { type: 'number', description: 'Current blockchain slot' },
                  averageBlockTime: { type: 'number', description: 'Average block time in ms' },
                  epochInfo: { type: 'object', description: 'Current epoch information' },
                  recentTPS: { type: 'number', description: 'Recent transactions per second' },
                  totalTransactions: { type: 'number', description: 'Total transaction count' },
                  recentBlockMetrics: { type: 'object', description: 'Recent block performance' },
                  validatorCount: { type: 'number', description: 'Active validator count' }
                }
              },
              timestamp: { type: 'number' },
              cached: { type: 'boolean' },
              processingTime: { type: 'number' }
            }
          }
        },
        // Search Tools
        {
          name: 'universal_search',
          description: 'Universal search across accounts, transactions, tokens, programs. Request: {query: string, start?: string, end?: string, status?: string, min?: number, max?: number} Response: Array of objects Use case: Find any blockchain entity, multi-type search, discovery, address/signature lookup.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query: address, signature, token symbol/name, or program name' },
              type: { type: 'string', enum: ['account', 'transaction', 'token', 'program'], description: 'Filter results by type (optional)' },
              start: { type: 'string', description: 'Start date filter (ISO string, optional)' },
              end: { type: 'string', description: 'End date filter (ISO string, optional)' },
              status: { type: 'string', enum: ['success', 'failed'], description: 'Transaction status filter (optional)' },
              min: { type: 'number', description: 'Minimum amount filter (optional)' },
              max: { type: 'number', description: 'Maximum amount filter (optional)' }
            },
            required: ['query']
          },
          outputSchema: {
            type: 'object',
            properties: {
              results: { type: 'array', description: 'Search results array' },
              type: { type: 'string', description: 'Type of results returned' },
              count: { type: 'number', description: 'Total number of results' }
            },
            required: ['results', 'count']
          }
        },
        {
          name: 'search_accounts',
          description: 'Advanced account search with balance and token filters. Request: {query: string, tokenMint?: string, minBalance?: number, maxBalance?: number} Response: Array of objects Use case: Find wallets by balance range, token holder search, whale detection, airdrop targeting.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query (address, ENS name, label)' },
              tokenMint: { type: 'string', description: 'Filter accounts holding specific token mint' },
              minBalance: { type: 'number', description: 'Minimum SOL balance filter (in SOL)' },
              maxBalance: { type: 'number', description: 'Maximum SOL balance filter (in SOL)' }
            },
            required: ['query']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Account address' },
                balance: { type: 'number', description: 'SOL balance' },
                tokens: { type: 'array', description: 'Token holdings' }
              }
            }
          }
        },
        // AI Tools
        {
          name: 'ai_inference_call',
          description: 'AI-powered question answering with blockchain data analysis capabilities. Supports blockchain data analysis, market insights, and general Solana knowledge. Request: {question: string, systemPrompt?: string, maxTokens?: number, ownPlan?: boolean} Response: AI analysis and answer. Use case: Natural language queries about blockchain data, market analysis, Solana ecosystem questions.',
          inputSchema: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'The question or query to ask the AI assistant'
              },
              systemPrompt: {
                type: 'string',
                description: 'Custom system prompt to control AI behavior. When provided, bypasses internal tools and uses only the LLM with your custom instructions.'
              },
              maxTokens: {
                type: 'number',
                description: 'Response length control (1-32000). Default: 32000',
                minimum: 1,
                maximum: 32000
              },
              ownPlan: {
                type: 'boolean',
                description: 'Returns execution plan in XML format instead of executing the query. Default: false'
              },
              _healthCheck: {
                type: 'boolean',
                description: 'Internal flag for health monitoring. Default: false'
              }
            },
            required: ['question']
          },
          outputSchema: {
            type: 'object',
            properties: {
              answer: { type: 'string', description: 'AI-generated answer to the question' },
              plan: { type: 'string', description: 'Execution plan (if ownPlan=true)' },
              sources: { type: 'array', description: 'Data sources used for the answer' }
            }
          }
        },
        // Wallet Connection & Mapping Tools
        {
          name: 'find_related_transactions',
          description: 'Discover transactions that share common characteristics or participants to map wallet connections and transaction flows. Useful for: wallet relationship mapping, transaction chain analysis, identifying connected wallets, building transaction graphs.',
          inputSchema: {
            type: 'object',
            properties: {
              signatures: {
                type: 'array',
                items: { type: 'string' },
                description: 'Transaction signatures to find relationships for'
              },
              address: {
                type: 'string',
                description: 'Wallet address to find related transactions for'
              },
              includeTokenTransfers: {
                type: 'boolean',
                description: 'Include token transfer relationships (default: true)'
              },
              maxDepth: {
                type: 'number',
                description: 'Maximum depth for relationship discovery (default: 2)'
              }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              relationships: {
                type: 'array',
                description: 'Array of related transaction relationships'
              },
              nodes: {
                type: 'array',
                description: 'Wallet addresses involved in the relationship graph'
              },
              edges: {
                type: 'array',
                description: 'Transaction connections between wallets'
              }
            }
          }
        },
        {
          name: 'holders_by_interaction',
          description: 'Retrieve holders ranked by interaction metrics with a program. Identifies wallet clusters and interaction patterns. Request: {program: string (required), period?: string, limit?: number, offset?: number, minInteractions?: number} Use case: Finding connected wallets through program interaction, wallet clustering, community analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              program: {
                type: 'string',
                description: 'Program address to analyze holder interactions for (required)'
              },
              period: {
                type: 'string',
                description: 'Time period filter (e.g., "24h", "7d", "30d")'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of holders to return (default: 100)'
              },
              offset: {
                type: 'number',
                description: 'Pagination offset for results (default: 0)'
              },
              minInteractions: {
                type: 'number',
                description: 'Minimum interaction count threshold'
              }
            },
            required: ['program']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                holder: { type: 'string', description: 'Wallet address' },
                interactions: { type: 'number', description: 'Interaction count' },
                lastInteraction: { type: 'string', description: 'Timestamp of last interaction' },
                firstInteraction: { type: 'string', description: 'Timestamp of first interaction' }
              }
            }
          }
        },
        // Analytics Tools
        {
          name: 'get_defi_overview',
          description: 'Get Solana DeFi ecosystem overview. Request: {} Response: {success: boolean, data: {totalTvl: number, totalVolume24h: number, activeDexes: number, topProtocols: array, totalTransactions: number, healthStatus: object, sectorBreakdown: object}, timestamp: number}. Access data fields: response.data.totalTvl (NOT response.totalTvl). Each protocol in topProtocols array has {name, tvl, volume24h, category}. Use case: DeFi market analysis, TVL tracking, protocol comparison, market research.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalTvl: { type: 'number', description: 'Total value locked in DeFi protocols' },
                  totalVolume24h: { type: 'number', description: '24-hour trading volume across all DEXes' },
                  activeDexes: { type: 'number', description: 'Number of active DEX protocols' },
                  topProtocols: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Protocol name' },
                        tvl: { type: 'number', description: 'Total value locked' },
                        volume24h: { type: 'number', description: '24-hour volume' },
                        category: { type: 'string', description: 'Protocol category' }
                      }
                    }
                  },
                  totalTransactions: { type: 'number', description: 'Total number of DeFi transactions' },
                  healthStatus: { type: 'object', description: 'DeFi health indicators' },
                  sectorBreakdown: { type: 'object', description: 'DeFi sector breakdown' }
                }
              },
              timestamp: { type: 'number' }
            },
            required: ['success', 'data', 'timestamp']
          }
        },
        {
          name: 'get_dex_analytics',
          description: 'Get DEX-specific trading analytics. Request: {dex?: string, timeframe?: string} Response: Array of objects Use case: DEX performance tracking, trading volume analysis, liquidity monitoring, arbitrage opportunities.',
          inputSchema: {
            type: 'object',
            properties: {
              dex: { type: 'string', description: 'DEX name: "raydium", "orca", "jupiter", "meteora", etc.' },
              timeframe: { type: 'string', enum: ['1h', '24h', '7d'], description: 'Time period for analytics (default "24h")' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              dex: { type: 'string', description: 'DEX name' },
              volume: { type: 'number', description: 'Trading volume' },
              trades: { type: 'number', description: 'Number of trades' },
              uniqueTraders: { type: 'number', description: 'Number of unique traders' },
              topPairs: { type: 'array', description: 'Top trading pairs' },
              priceImpact: { type: 'object', description: 'Price impact statistics' }
            }
          }
        },
        {
          name: 'get_defi_health',
          description: 'Get DeFi ecosystem health indicators. Request: {} Response: {success: boolean, data: {health: object, ecosystem: object, protocols: array, alerts: array, rankings: array}, timestamp: number} Use case: Risk assessment, market health monitoring, identify systemic risks, DeFi safety checks.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  health: { type: 'object', description: 'Health indicators including risk score, liquidity depth, market stability' },
                  ecosystem: { type: 'object', description: 'Ecosystem metrics and statistics' },
                  protocols: { type: 'array', description: 'Protocol-level health data' },
                  alerts: { type: 'array', items: { type: 'string' }, description: 'Health alerts and warnings' },
                  rankings: { type: 'array', description: 'Protocol rankings by various metrics' }
                }
              },
              timestamp: { type: 'number' }
            },
            required: ['success', 'data', 'timestamp']
          }
        },
        {
          name: 'get_validator_analytics',
          description: 'Get Solana validator network statistics. Request: {} Response: {success: boolean, data: {networkStats: object, validators: array, health: object, decentralization: object, rpcNodes: array}, timestamp: number} Use case: Network health monitoring, stake distribution analysis, validator selection, decentralization metrics.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  networkStats: {
                    type: 'object',
                    description: 'Network-wide statistics',
                    properties: {
                      totalValidators: { type: 'number', description: 'Total number of validators' },
                      activeStake: { type: 'number', description: 'Total active stake in lamports' },
                      averageCommission: { type: 'number', description: 'Average validator commission percentage' }
                    }
                  },
                  validators: { type: 'array', description: 'List of validators with details' },
                  health: { type: 'object', description: 'Network health metrics' },
                  decentralization: { type: 'object', description: 'Decentralization metrics including Nakamoto coefficient' },
                  rpcNodes: { type: 'array', description: 'Available RPC nodes information' }
                }
              },
              timestamp: { type: 'number' }
            },
            required: ['success', 'data', 'timestamp']
          }
        },
        {
          name: 'get_market_data',
          description: 'Get orderbook depth and pool/liquidity information for trading analysis. Supports two endpoints: endpoint="orderbook" for market depth and bid-ask analysis, endpoint="markets" for pool discovery and liquidity tracking. Request: {mint: string, endpoint: "markets"|"orderbook", poolAddress?: string, baseMint?: string, offset?: string}. Use cases: Analyzing order book liquidity, finding trading pools, tracking market depth.',
          inputSchema: {
            type: 'object',
            properties: {
              mint: { type: 'string', description: 'Token mint address (required)' },
              endpoint: { type: 'string', enum: ['markets', 'orderbook'], description: 'Data type to fetch: markets (pools/liquidity), orderbook (market depth)' },
              poolAddress: { type: 'string', description: 'Specific pool address for pool-specific data (optional)' },
              baseMint: { type: 'string', description: 'Filter markets by base token mint (optional)' },
              offset: { type: 'string', description: 'Price offset in basis points for orderbook (default: 100)' }
            },
            required: ['mint', 'endpoint']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Request success status' },
              endpoint: { type: 'string', description: 'Endpoint type used' },
              mint: { type: 'string', description: 'Token mint address' },
              tokenInfo: {
                type: 'object',
                description: 'Token information (OHLCV only)',
                properties: {
                  symbol: { type: 'string', description: 'Token symbol' },
                  name: { type: 'string', description: 'Token name' },
                  price: { type: 'number', description: 'Current price' },
                  liquidity: { type: 'number', description: 'Total liquidity' },
                  volume24h: { type: 'number', description: '24h volume' }
                }
              },
              mainPair: {
                type: 'object',
                description: 'Main trading pair (OHLCV only)',
                properties: {
                  pair: { type: 'string', description: 'Pair name' },
                  dex: { type: 'string', description: 'DEX name' },
                  poolAddress: { type: 'string', description: 'Pool address' }
                }
              },
              pools: {
                type: 'array',
                description: 'Available pools/markets',
                items: {
                  type: 'object',
                  properties: {
                    dex: { type: 'string', description: 'DEX name (Phoenix, Raydium, Orca, etc.)' },
                    pair: { type: 'string', description: 'Trading pair' },
                    poolAddress: { type: 'string', description: 'Pool address' },
                    price: { type: 'number', description: 'Current price in pool' },
                    liquidity: { type: 'number', description: 'Pool liquidity' },
                    volume24h: { type: 'number', description: '24h trading volume' },
                    txCount24h: { type: 'number', description: '24h transaction count' },
                    baseToken: { type: 'string', description: 'Base token symbol' },
                    quoteToken: { type: 'string', description: 'Quote token symbol' }
                  }
                }
              },
              data: {
                type: 'object',
                description: 'OHLCV candlestick data',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        o: { type: 'number', description: 'Open price' },
                        h: { type: 'number', description: 'High price' },
                        l: { type: 'number', description: 'Low price' },
                        c: { type: 'number', description: 'Close price' },
                        v: { type: 'number', description: 'Volume' },
                        unixTime: { type: 'number', description: 'Unix timestamp' }
                      }
                    }
                  }
                }
              },
              indicators: {
                type: 'object',
                description: 'Technical indicators (OHLCV only)',
                properties: {
                  ma7: { type: 'array', description: '7-period moving average', items: { type: ['number', 'null'] } },
                  ma25: { type: 'array', description: '25-period moving average', items: { type: ['number', 'null'] } },
                  macd: {
                    type: 'object',
                    properties: {
                      line: { type: 'array', description: 'MACD line' },
                      signal: { type: 'array', description: 'Signal line' },
                      histogram: { type: 'array', description: 'MACD histogram' }
                    }
                  }
                }
              },
              bids: { type: 'array', description: 'Orderbook bids (orderbook only)', items: { type: 'array' } },
              asks: { type: 'array', description: 'Orderbook asks (orderbook only)', items: { type: 'array' } }
            },
            required: ['success', 'endpoint', 'mint']
          }
        },
        {
          name: 'chart',
          description: '📊 PRIMARY TOOL FOR ALL OHLCV/CANDLESTICK/PRICE CHART DATA. Returns ARRAYS not objects! Request: {mint: string, interval?: "1m"|"5m"|"15m"|"30m"|"1H"|"2H"|"4H"|"6H"|"8H"|"12H"|"1D"|"3D"|"1W"|"1M", timeFrom?: unix_seconds, timeTo?: unix_seconds, includeZeroVolume?: bool}. TIME RANGE: Use timeFrom/timeTo for exact ranges (e.g., timeFrom=1704067200, timeTo=1735689600 for all of 2024), OR omit for default: 1m=~16h, 5m=~3.5d, 1H=~30d, 1D=~1y. Response: {data: {items: [ARRAY, ARRAY, ...]}, metadata: {currency: "usd"|"sol"|"btc", format: ["o","h","l","c","v_CURRENCY","t_delta"], t_start: unix_timestamp}}. CRITICAL: data.items is array of arrays (NOT objects). Each candle is 6-element array [open, high, low, close, volume_in_currency, time_delta]. Prices (OHLC) and volume are in SAME currency (check metadata.currency, usually "usd"). Volume computed as avg(high,low) * token_volume. DO NOT use .close or .open - use array indices! Access: candles = response.data.items (array), first = candles[0] (array), open = first[0], high = first[1], low = first[2], close = first[3], volume = first[4], time_delta = first[5]. Map example: closes = map(candles, lambda c: c[3]). NO object keys!',
          inputSchema: {
            type: 'object',
            properties: {
              mint: {
                type: 'string',
                description: 'Token mint address (Solana base58 public key, 32-44 chars). Example: "So11111111111111111111111111111111111111112"',
                minLength: 32,
                maxLength: 44
              },
              interval: {
                type: 'string',
                enum: ['1m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M'],
                description: 'Candlestick interval/timeframe. CONTROLS TIME RANGE: 1m=~16h of data (~1000 candles), 5m=~3.5d, 15m=~10d, 30m=~20d, 1H=~30d (default), 2H=~60d, 4H=~120d, 1D=~1y, 1W=~7y, 1M=~30y. Choose interval based on desired time range (e.g., use 1D for yearly analysis, 1H for monthly, 1m for intraday). Shorter intervals = more granularity but less historical range.',
                default: '1H'
              },
              includeZeroVolume: {
                type: 'boolean',
                description: 'Include zero-volume candles in results (default: false). When false, filters out ~70-80% of candles for 78% token reduction. Set to true only if you need complete time-series data with all timestamps.',
                default: false
              },
              timeFrom: {
                type: 'number',
                description: 'Start of time range as Unix timestamp in seconds. Example: 1704067200 (Jan 1, 2024). Use with timeTo to get specific date range. If not provided, returns most recent data based on interval.'
              },
              timeTo: {
                type: 'number',
                description: 'End of time range as Unix timestamp in seconds. Example: 1735689600 (Jan 1, 2025). Use with timeFrom to get specific date range. If not provided, defaults to current time.'
              }
            },
            required: ['mint']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Request success status' },
              endpoint: { type: 'string', description: 'Always "ohlcv"' },
              mint: { type: 'string', description: 'Token mint address' },
              tokenInfo: {
                type: 'object',
                description: 'Token information',
                properties: {
                  symbol: { type: 'string', description: 'Token symbol' },
                  name: { type: 'string', description: 'Token name' },
                  price: { type: 'number', description: 'Current price' },
                  liquidity: { type: 'number', description: 'Total liquidity' },
                  volume24h: { type: 'number', description: '24h volume' }
                }
              },
              mainPair: {
                type: 'object',
                description: 'Main trading pair',
                properties: {
                  pair: { type: 'string', description: 'Pair name' },
                  dex: { type: 'string', description: 'DEX name' },
                  poolAddress: { type: 'string', description: 'Pool address' }
                }
              },
              pools: {
                type: 'array',
                description: 'Available pools/markets',
                items: {
                  type: 'object',
                  properties: {
                    dex: { type: 'string', description: 'DEX name' },
                    pair: { type: 'string', description: 'Trading pair' },
                    poolAddress: { type: 'string', description: 'Pool address' },
                    price: { type: 'number', description: 'Current price' },
                    liquidity: { type: 'number', description: 'Pool liquidity' },
                    volume24h: { type: 'number', description: '24h volume' }
                  }
                }
              },
              metadata: {
                type: 'object',
                description: 'Metadata explaining the ultra-compact data format and providing reconstruction instructions',
                properties: {
                  address: { type: 'string', description: 'Token mint address that was queried' },
                  type: { type: 'string', description: 'Candle interval type requested (1m, 5m, 1H, etc)', example: '1H' },
                  currency: { type: 'string', description: 'Price currency for OHLCV values', enum: ['usd'], default: 'usd' },
                  format: {
                    type: 'array',
                    description: 'Array format definition: [open, high, low, close, volume, time_delta_seconds]. Each candle is an array of 6 numbers.',
                    items: { type: 'string' },
                    default: ['o', 'h', 'l', 'c', 'v', 't_delta']
                  },
                  t_start: {
                    type: 'number',
                    description: 'Starting timestamp in unix seconds (e.g., 1699876800). To reconstruct each candle timestamp: t_start + sum(all_previous_t_deltas) + current_t_delta. First candle has t_delta=0.',
                    example: 1699876800
                  },
                  filtered: { type: 'boolean', description: 'True if zero-volume candles were filtered out (when includeZeroVolume=false)' },
                  original_count: { type: 'number', description: 'Original number of candles before filtering (if filtered=true)', example: 1000 },
                  filtered_count: { type: 'number', description: 'Number of candles after filtering (actual data.items.length)', example: 250 }
                }
              },
              data: {
                type: 'object',
                description: 'OHLCV candlestick data in ultra-compact array format. Each candle is [open, high, low, close, volume, time_delta]. Example: [[0.123, 0.125, 0.122, 0.124, 1000, 0], [0.124, 0.126, 0.123, 0.125, 1500, 3600]] means first candle at t_start, second at t_start + 3600 seconds (1 hour later).',
                properties: {
                  items: {
                    type: 'array',
                    description: 'Array of candles, each in format [open, high, low, close, volume, time_delta_seconds]. time_delta is seconds since previous candle (0 for first candle). To get timestamp for candle N: metadata.t_start + sum(items[0...N-1][5]) + items[N][5]. Zero-volume candles are filtered by default unless includeZeroVolume=true.',
                    items: {
                      type: 'array',
                      description: 'Single candle: [open_price, high_price, low_price, close_price, volume_usd, seconds_since_previous_candle]. Prices in USD, volume in USD. Example: [0.00012345, 0.00012678, 0.00012100, 0.00012567, 123456.78, 3600]',
                      items: { type: 'number' },
                      minItems: 6,
                      maxItems: 6
                    }
                  }
                }
              },
              indicators: {
                type: 'object',
                description: 'Technical indicators',
                properties: {
                  ma7: { type: 'array', description: '7-period moving average' },
                  ma25: { type: 'array', description: '25-period moving average' },
                  macd: {
                    type: 'object',
                    properties: {
                      line: { type: 'array', description: 'MACD line' },
                      signal: { type: 'array', description: 'Signal line' },
                      histogram: { type: 'array', description: 'MACD histogram' }
                    }
                  }
                }
              }
            },
            required: ['success', 'endpoint', 'mint', 'metadata']
          }
        },
        {
          name: 'get_dex_profile',
          description: 'Get comprehensive DEX profile and analytics including volume, TVL, fees, security info, and top pools. Request: {name: string} Response: Array of objects Use case: DEX comparison, protocol research, trading venue selection, security verification.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'DEX identifier (raydium, orca, phoenix, meteora, jupiter, drift, mango, serum, lifinity, saber, mercurial, aldrin, crema, cropper, penguin, sencha, stepn, etc.)' }
            },
            required: ['name']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Request success status' },
              data: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'DEX name' },
                  description: { type: 'string', description: 'DEX description' },
                  logo: { type: 'string', description: 'Logo URL' },
                  website: { type: 'string', description: 'Official website' },
                  twitter: { type: 'string', description: 'Twitter handle' },
                  github: { type: 'string', description: 'GitHub repository' },
                  programId: { type: 'string', description: 'Solana program ID' },
                  totalVolume: { type: 'number', description: 'All-time trading volume' },
                  volume24h: { type: 'number', description: '24h trading volume' },
                  volumeChange: { type: 'number', description: '24h volume change %' },
                  tvl: { type: 'number', description: 'Total value locked' },
                  tvlChange: { type: 'number', description: '24h TVL change %' },
                  marketShare: { type: 'number', description: 'Market share %' },
                  activeUsers: { type: 'number', description: 'Active users count' },
                  transactions: { type: 'number', description: 'Transaction count' },
                  avgTransactionSize: { type: 'number', description: 'Average transaction size' },
                  fees24h: { type: 'number', description: '24h fees collected' },
                  totalFees: { type: 'number', description: 'All-time fees' },
                  commission: { type: 'number', description: 'Trading commission rate' },
                  status: { type: 'string', description: 'Operational status' },
                  security: {
                    type: 'object',
                    properties: {
                      audited: { type: 'boolean', description: 'Is audited' },
                      auditors: { type: 'array', items: { type: 'string' }, description: 'Audit firms' },
                      lastAudit: { type: 'string', description: 'Last audit date' },
                      bugBounty: { type: 'boolean', description: 'Has bug bounty' },
                      multisig: { type: 'boolean', description: 'Uses multisig' },
                      timelock: { type: 'boolean', description: 'Has timelock' }
                    }
                  },
                  metrics: {
                    type: 'object',
                    properties: {
                      uptime: { type: 'number', description: 'Uptime %' },
                      avgSlippage: { type: 'number', description: 'Average slippage %' },
                      poolCount: { type: 'number', description: 'Number of pools' },
                      tokenCount: { type: 'number', description: 'Number of tokens' },
                      liquidityDepth: { type: 'number', description: 'Liquidity depth' }
                    }
                  },
                  topPools: { type: 'array', description: 'Top trading pools' },
                  recentTrades: { type: 'array', description: 'Recent trades' }
                }
              }
            },
            required: ['success']
          }
        },
        {
          name: 'get_trending_validators',
          description: 'Get trending validators ranked by various metrics (stake growth, performance, new entries). Request: {metric?: string} Response: Array of objects Use case: Discover high-performing validators, track validator growth trends, identify new validators.',
          inputSchema: {
            type: 'object',
            properties: {
              metric: { type: 'string', enum: ['stake', 'performance', 'new'], description: 'Metric to rank by (default: stake)' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              trending: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    address: { type: 'string', description: 'Validator address' },
                    name: { type: 'string', description: 'Validator name' },
                    stake: { type: 'number', description: 'Total stake amount' },
                    trend: { type: 'string', enum: ['up', 'down', 'stable'], description: 'Trend direction' },
                    change24h: { type: 'number', description: '24h change %' },
                    apy: { type: 'number', description: 'Annual percentage yield' },
                    commission: { type: 'number', description: 'Commission rate %' },
                    uptime: { type: 'number', description: 'Uptime %' }
                  }
                }
              }
            }
          }
        },
        {
          name: 'get_cross_chain_analytics',
          description: 'Get cross-chain bridge analytics for Solana. Request: {} Response: {totalVolume: number, bridges: [{name, volume24h, transactions, topAssets, supportedChains}], topAssets: array} Use case: Track cross-chain flows, identify popular bridges, monitor bridge security.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              totalVolume: { type: 'number', description: 'Total cross-chain volume' },
              bridges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Bridge name (e.g., Wormhole, Allbridge)' },
                    volume24h: { type: 'number', description: '24h volume' },
                    transactions: { type: 'number', description: 'Transaction count' },
                    topAssets: { type: 'array', description: 'Most bridged assets' },
                    supportedChains: { type: 'array', description: 'Supported chains' }
                  }
                }
              },
              topAssets: { type: 'array', description: 'Most bridged assets overall' }
            }
          }
        },
        {
          name: 'get_bot_analytics',
          description: 'Get bot activity analytics on Solana. Request: {} Response: {success: boolean, data: {totalBots?: number, activeBots?: number, volume24h?: number, topStrategies?: array}, timestamp: number} (Note: endpoint may be unavailable) Use case: Monitor bot activity, identify trading strategies, analyze market making.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalBots: { type: 'number', description: 'Total detected bots' },
                  activeBots: { type: 'number', description: 'Currently active bots' },
                  volume24h: { type: 'number', description: '24h bot trading volume' },
                  topStrategies: { type: 'array', items: { type: 'string' }, description: 'Most common bot strategies' }
                }
              },
              timestamp: { type: 'number' }
            },
            required: ['success', 'timestamp']
          }
        },
        // Token & NFT Tools
        {
          name: 'get_token_info',
          description: 'Get SPL token details and metadata. Returns FLATTENED object with all fields at top level: {name: string, symbol: string, description: string, uri: string, decimals: number, holders: number, isInitialized: boolean, supply: number (raw amount with decimals), volume24h: number, price: number, priceChange24h: number, liquidity: number}. Metadata fields (name, symbol, description, uri) are at TOP LEVEL for easy access. Request: {address: string} Response: {name?: string, symbol?: string, uri?: string, decimals: number, holders?: number, totalHolders?: number, ...} Use case: Token research, verify token legitimacy, check supply/holders.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'SPL token mint address (base58, 32-44 chars)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Token name (flattened from metadata)' },
              symbol: { type: 'string', description: 'Token symbol/ticker (flattened from metadata)' },
              description: { type: 'string', description: 'Token description (flattened from metadata)' },
              uri: { type: 'string', description: 'Metadata URI (flattened from metadata)' },
              decimals: { type: 'number', description: 'Number of decimal places for the token' },
              holders: { type: 'number', description: 'Total number of token holders' },
              totalHolders: { type: 'number', description: 'Total holders count' },
              isInitialized: { type: 'boolean', description: 'Whether the token mint is initialized' },
              supply: { type: 'number', description: 'Total supply (raw amount including decimals)' },
              volume24h: { type: 'number', description: '24-hour trading volume' },
              price: { type: 'number', description: 'Current token price in USD' },
              priceChange24h: { type: 'number', description: '24-hour price change percentage' },
              liquidity: { type: 'number', description: 'Total liquidity in USD' },
              top10Balance: { type: 'number', description: 'Balance held by top 10 holders' },
              top50Balance: { type: 'number', description: 'Balance held by top 50 holders' },
              top100Balance: { type: 'number', description: 'Balance held by top 100 holders' }
            },
            required: ['decimals', 'supply', 'isInitialized']
          }
        },
        {
          name: 'get_token_metadata',
          description: 'Batch fetch token metadata for multiple mints. Request: {mints: array} Response: [{mint, decimals, supply, metadata: {name, symbol, description, uri}}] Use case: Portfolio token info, multi-token analysis, batch validation.',
          inputSchema: {
            type: 'object',
            properties: {
              mints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of SPL token mint addresses (max 50 recommended)'
              }
            },
            required: ['mints']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                mint: { type: 'string', description: 'Token mint address' },
                decimals: { type: 'number', description: 'Number of decimal places' },
                supply: { type: 'number', description: 'Total supply (raw amount)' },
                metadata: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Token name' },
                    symbol: { type: 'string', description: 'Token symbol' },
                    description: { type: 'string', description: 'Token description' },
                    uri: { type: 'string', description: 'Metadata URI' }
                  }
                }
              },
              required: ['mint']
            }
          }
        },
        {
          name: 'get_nft_collections',
          description: 'List NFT collections with stats. Request: {limit?: number, sort?: string} Response: [{name, symbol, floorPrice, volume24h, totalItems, listed, verified}] Use case: NFT marketplace data, collection discovery, floor price tracking, volume analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of collections to return (default 20, max 100)' },
              sort: { type: 'string', enum: ['volume', 'floor', 'items'], description: 'Sort by volume24h, floor price, or item count (default "volume")' }
            }
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Collection name' },
                symbol: { type: 'string', description: 'Collection symbol' },
                floorPrice: { type: 'number', description: 'Floor price in SOL' },
                volume24h: { type: 'number', description: '24-hour trading volume' },
                totalItems: { type: 'number', description: 'Total number of NFTs in collection' },
                listed: { type: 'number', description: 'Number of NFTs currently listed' },
                verified: { type: 'boolean', description: 'Whether collection is verified' }
              }
            }
          }
        },
        {
          name: 'get_trending_nfts',
          description: 'Get trending NFT collections (24h volume). Request: {} Response: [{name: string, symbol: string, volume24h: number, volumeChange: number, floorPrice: number}] Use case: Identify hot NFT collections, market trends, viral collections, trading opportunities.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Collection name' },
                symbol: { type: 'string', description: 'Collection symbol' },
                volume24h: { type: 'number', description: '24-hour trading volume' },
                volumeChange: { type: 'number', description: 'Volume change percentage' },
                floorPrice: { type: 'number', description: 'Floor price in SOL' }
              }
            }
          }
        },
        // User Management Tools
        {
          name: 'verify_wallet_signature',
          description: 'Verify Solana wallet signature for authentication. Request: {message: string, signature: string, publicKey: string} Response: {valid: boolean, address?: string} Use case: Wallet-based auth, sign-in with Solana, verify message ownership, secure authentication.',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Original message that was signed by the wallet' },
              signature: { type: 'string', description: 'Signature bytes from wallet.signMessage() (base58)' },
              publicKey: { type: 'string', description: 'Public key of the signing wallet (base58)' }
            },
            required: ['message', 'signature', 'publicKey']
          },
          outputSchema: {
            type: 'object',
            properties: {
              valid: { type: 'boolean', description: 'Whether the signature is valid' },
              address: { type: 'string', description: 'Wallet address that signed the message' }
            },
            required: ['valid']
          }
        },
        {
          name: 'get_user_history',
          description: 'Get user transaction history by wallet. Request: {walletAddress: string, limit?: number} Response: Array of objects Use case: User activity tracking, transaction history display, account analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              walletAddress: { type: 'string', description: 'User wallet address (base58, 32-44 chars)' },
              limit: { type: 'number', description: 'Number of transactions to return (default 20, max 100)' }
            },
            required: ['walletAddress']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                signature: { type: 'string', description: 'Transaction signature' },
                timestamp: { type: 'number', description: 'Transaction timestamp' },
                type: { type: 'string', description: 'Transaction type' },
                status: { type: 'string', description: 'Transaction status' }
              }
            }
          }
        },
        // Monetization Tools
        {
          name: 'get_balance',
          description: 'Get SVMAI token balance for API billing (requires JWT auth). Response: {balance: number, reserved?: number, available: number, sufficient?: boolean}. Request: {} Use case: Check API credit balance, billing management, payment verification.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              balance: { type: 'number', description: 'Total SVMAI token balance' },
              reserved: { type: 'number', description: 'Reserved SVMAI tokens' },
              available: { type: 'number', description: 'Available SVMAI tokens for use' },
              sufficient: { type: 'boolean', description: 'Whether balance is sufficient for operations' }
            },
            required: ['balance', 'available']
          }
        },
        {
          name: 'get_usage_stats',
          description: 'Get API usage statistics and billing info (requires JWT). Request: {} Response: {totalRequests: number, totalTokensSpent: number, avgCostPerRequest: number, recentTransactions: array} Use case: Track API consumption, analyze costs, budget monitoring, usage optimization.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              totalRequests: { type: 'number', description: 'Total number of API requests made' },
              totalTokensSpent: { type: 'number', description: 'Total SVMAI tokens spent' },
              avgCostPerRequest: { type: 'number', description: 'Average cost per API request' },
              recentTransactions: { type: 'array', description: 'Recent billing transactions' }
            }
          }
        },
        {
          name: 'manage_api_keys',
          description: 'Manage Anthropic API keys (requires JWT). Actions: list (get all keys), create (generate new key), delete (revoke key). Request: {action: string, keyId?: string, name?: string, permissions?: array} Response: Array of objects Use case: API key lifecycle management, access control, security management.',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['list', 'create', 'delete'], description: 'Action: list, create, or delete' },
              keyId: { type: 'string', description: 'Key ID to delete (required for delete action)' },
              name: { type: 'string', description: 'Name for new API key (required for create action)' },
              permissions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Permission scopes for new key: ["read", "write", "admin"] (for create action)'
              }
            },
            required: ['action']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'API key ID' },
                name: { type: 'string', description: 'API key name' },
                permissions: { type: 'array', items: { type: 'string' }, description: 'Key permissions' },
                created: { type: 'string', description: 'Creation date' }
              }
            }
          }
        },
        // Infrastructure Tools
        {
          name: 'get_api_metrics',
          description: 'Get OpenSVM API performance metrics. Response: {uptime?: number, avgResponseTime?: number, requestsPerSecond?: number, errorRate?: number, cacheHitRate?: number}. Request: {} Use case: Monitor API health, performance tracking, SLA verification, system diagnostics.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              uptime: { type: 'number', description: 'API uptime percentage' },
              avgResponseTime: { type: 'number', description: 'Average response time in milliseconds' },
              requestsPerSecond: { type: 'number', description: 'Current requests per second' },
              errorRate: { type: 'number', description: 'Error rate percentage' },
              cacheHitRate: { type: 'number', description: 'Cache hit rate percentage' }
            }
          }
        },
        {
          name: 'report_error',
          description: 'Report client-side errors to OpenSVM. Request: {message: string, stack?: string, url?: string, userAgent?: string} Response: {success: boolean, message: string, processingTime: number} Use case: Error tracking, bug reports, telemetry, improve API reliability.',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Error message or description' },
              stack: { type: 'string', description: 'Error stack trace (optional but recommended)' },
              url: { type: 'string', description: 'URL/endpoint where error occurred (optional)' },
              userAgent: { type: 'string', description: 'Browser/client user agent string (optional)' }
            },
            required: ['message']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether error was successfully reported' },
              message: { type: 'string', description: 'Response message' },
              processingTime: { type: 'number', description: 'Time taken to process the request in ms' }
            },
            required: ['success', 'message']
          }
        },
        // Program Registry Tools
        {
          name: 'get_program_registry',
          description: 'List registered Solana programs with metadata. Request: {category?: string, verified?: boolean} Response: Array of objects Use case: Discover Solana programs, program verification, integration research, find DeFi protocols.',
          inputSchema: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Filter by category: "defi", "nft", "gaming", "infrastructure", etc.' },
              verified: { type: 'boolean', description: 'Show only verified/audited programs (default false)' }
            }
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                programId: { type: 'string', description: 'Program address' },
                name: { type: 'string', description: 'Program name' },
                category: { type: 'string', description: 'Program category' },
                verified: { type: 'boolean', description: 'Whether program is verified' },
                description: { type: 'string', description: 'Program description' },
                website: { type: 'string', description: 'Program website URL' },
                audit: { type: 'string', description: 'Audit information' }
              }
            }
          }
        },
        {
          name: 'get_program_info',
          description: 'Get detailed program information and metadata. Request: {programId: string} Response: {success: boolean, data: {programId: string, name?: string, category?: string, verified?: boolean}, timestamp: number, cached?: boolean} Use case: Program due diligence, verify program authenticity, integration validation, security research.',
          inputSchema: {
            type: 'object',
            properties: {
              programId: { type: 'string', description: 'Solana program address (base58, 32-44 chars)' }
            },
            required: ['programId']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  programId: { type: 'string', description: 'Program address' },
                  name: { type: 'string', description: 'Program name' },
                  category: { type: 'string', description: 'Program category' },
                  verified: { type: 'boolean', description: 'Whether program is verified' },
                  description: { type: 'string', description: 'Program description' },
                  website: { type: 'string', description: 'Program website URL' },
                  github: { type: 'string', description: 'GitHub repository URL' },
                  audit: { type: 'string', description: 'Audit information' },
                  deployDate: { type: 'string', description: 'Program deployment date' },
                  upgradeAuthority: { type: 'string', description: 'Upgrade authority address' }
                }
              },
              timestamp: { type: 'number' },
              cached: { type: 'boolean' }
            },
            required: ['success', 'data', 'timestamp']
          }
        },
        // Solana RPC Direct Methods (commonly used)
        {
          name: 'rpc_getAccountInfo',
          description: 'Get account information including lamports and owner. Returns NESTED: {context: {slot, apiVersion}, value: {lamports: number, owner: string, executable: boolean, rentEpoch: number, data: string/object}}. Access account data via: result.value.lamports, result.value.owner, etc. Request: {address: string, encoding?: string, commitment?: string} Response: {context?: object, slot?: number, apiVersion?: string, value?: object, lamports: number, owner: string, ...} Use case: Check account details, verify account ownership, inspect account data.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address (base58, 32-44 chars)' },
              encoding: { type: 'string', enum: ['base58', 'base64', 'jsonParsed'], description: 'Data encoding (default: base64)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' },
                  apiVersion: { type: 'string', description: 'API version' }
                }
              },
              value: {
                type: 'object',
                properties: {
                  lamports: { type: 'number', description: 'Account balance in lamports' },
                  owner: { type: 'string', description: 'Program that owns the account' },
                  executable: { type: 'boolean', description: 'Whether account is executable' },
                  rentEpoch: { type: 'number', description: 'Rent epoch' },
                  data: { description: 'Account data (format depends on encoding)' }
                },
                required: ['lamports', 'owner']
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getBalance',
          description: 'Get SOL balance for an account in lamports. Returns NESTED: {context: {slot, apiVersion}, value: number (lamports)}. Access balance via: result.value (1 SOL = 1,000,000,000 lamports). Request: {address: string, commitment?: string} Response: {context: object, slot?: number, apiVersion?: string, value: number} Use case: Check wallet balance, verify payment received, monitor account funding.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address (base58, 32-44 chars)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' },
                  apiVersion: { type: 'string', description: 'API version' }
                }
              },
              value: { type: 'number', description: 'Balance in lamports (1 SOL = 1,000,000,000 lamports)' }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getMultipleAccounts',
          description: 'Get information for multiple accounts in one call (up to 100). Returns NESTED: {context: {slot, apiVersion}, value: [{lamports, owner, executable, rentEpoch, data}, ...]}.  Access accounts via: result.value[0], result.value[1], etc. More efficient than individual getAccountInfo calls. Request: {addresses: array, encoding?: string, commitment?: string} Response: Array of objects Use case: Bulk account queries, portfolio analysis, multi-account validation.',
          inputSchema: {
            type: 'object',
            properties: {
              addresses: { type: 'array', items: { type: 'string' }, description: 'Array of account addresses (max 100)', maxItems: 100 },
              encoding: { type: 'string', enum: ['base58', 'base64', 'jsonParsed'], description: 'Data encoding (default: base64)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['addresses']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' },
                  apiVersion: { type: 'string', description: 'API version' }
                }
              },
              value: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    lamports: { type: 'number', description: 'Account balance in lamports' },
                    owner: { type: 'string', description: 'Program that owns the account' },
                    executable: { type: 'boolean', description: 'Whether account is executable' },
                    rentEpoch: { type: 'number', description: 'Rent epoch' },
                    data: { description: 'Account data' }
                  }
                }
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getProgramAccounts',
          description: 'Get all accounts owned by a program with optional filters. Request: {programId: string, encoding?: string, filters?: array, commitment?: string} Response: Array of objects Use case: Find token holders, query program state, discover accounts by criteria. WARNING: Can be slow for large programs - use filters!',
          inputSchema: {
            type: 'object',
            properties: {
              programId: { type: 'string', description: 'Program address (base58, 32-44 chars)' },
              encoding: { type: 'string', enum: ['base58', 'base64', 'jsonParsed'], description: 'Data encoding (default: base64)' },
              filters: { type: 'array', description: 'Array of filter objects: {dataSize: number} or {memcmp: {offset: number, bytes: string}}' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['programId']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pubkey: { type: 'string', description: 'Account public key' },
                account: {
                  type: 'object',
                  properties: {
                    lamports: { type: 'number', description: 'Account balance' },
                    owner: { type: 'string', description: 'Program owner' },
                    data: { description: 'Account data' }
                  }
                }
              }
            }
          }
        },
        {
          name: 'rpc_getSignaturesForAddress',
          description: 'Get transaction signatures for an address with pagination. Request: {address: string, limit?: number, before?: string, until?: string, commitment?: string} Response: Array of objects Use case: Transaction history, signature lookup, activity monitoring.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address (base58, 32-44 chars)' },
              limit: { type: 'number', description: 'Max signatures to return (max 1000, default 1000)', maximum: 1000, minimum: 1 },
              before: { type: 'string', description: 'Start before this signature (for pagination)' },
              until: { type: 'string', description: 'Search until this signature' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['address']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                signature: { type: 'string', description: 'Transaction signature' },
                slot: { type: 'number', description: 'Slot number' },
                blockTime: { type: 'number', description: 'Block timestamp' },
                err: { description: 'Error if transaction failed, null if successful' }
              },
              required: ['signature']
            }
          }
        },
        {
          name: 'rpc_getSlot',
          description: 'Get current slot number. Request: {commitment?: string}. Response: {result: number} - Current slot number. Use case: Timestamp transactions, monitor blockchain progress, calculate block times.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'number',
            description: 'Current slot number'
          }
        },
        {
          name: 'rpc_getBlockHeight',
          description: 'Get current block height. Request: {commitment?: string}. Response: {result: number} - Current block height. Use case: Monitor chain progress, calculate block confirmations, blockchain metrics.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'number',
            description: 'Current block height'
          }
        },
        {
          name: 'rpc_getLatestBlockhash',
          description: 'Get latest blockhash and last valid block height. Request: {commitment?: string} Response: {blockhash: string, lastValidBlockHeight: number} Use case: Transaction creation, determine transaction validity period, ensure timely submission.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              blockhash: { type: 'string', description: 'Latest blockhash' },
              lastValidBlockHeight: { type: 'number', description: 'Last block height where this blockhash is valid' }
            },
            required: ['blockhash', 'lastValidBlockHeight']
          }
        },
        {
          name: 'rpc_getTokenAccountBalance',
          description: 'Get SPL token balance for a token account. Returns NESTED: {context: {slot, apiVersion}, value: {amount: string (raw with decimals), decimals: number, uiAmount: number (human-readable), uiAmountString: string}}. Access balance via: result.value.uiAmount or result.value.amount. Request: {tokenAccount: string, commitment?: string} Response: {context?: object, slot?: number, apiVersion?: string, value?: object, amount: string, decimals: number, ...} Use case: Check token balance, display formatted amounts, verify token transfers.',
          inputSchema: {
            type: 'object',
            properties: {
              tokenAccount: { type: 'string', description: 'Token account address (base58, 32-44 chars)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['tokenAccount']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' },
                  apiVersion: { type: 'string', description: 'API version' }
                }
              },
              value: {
                type: 'object',
                properties: {
                  amount: { type: 'string', description: 'Raw token amount as string (with decimals)' },
                  decimals: { type: 'number', description: 'Number of decimals' },
                  uiAmount: { type: 'number', description: 'Human-readable token amount' },
                  uiAmountString: { type: 'string', description: 'Human-readable token amount as string' }
                },
                required: ['amount', 'decimals']
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getTokenAccountsByOwner',
          description: 'Get all SPL token accounts owned by an address. Filter by mint or program. Returns NESTED: {context: {slot, apiVersion}, value: [{pubkey: string, account: {data: {parsed: {info: {mint, owner, tokenAmount: {amount, decimals, uiAmount}}}}, lamports, owner}}]}. Access with jsonParsed encoding: result.value[0].account.data.parsed.info for token details. Request: {owner: string, mint?: string, programId?: string, encoding?: string, commitment?: string} Response: Array of objects Use case: Portfolio queries, token holder analysis, wallet scanning.',
          inputSchema: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: 'Owner address (base58, 32-44 chars)' },
              mint: { type: 'string', description: 'Filter by token mint address (optional, use mint OR programId)' },
              programId: { type: 'string', description: 'Filter by token program (optional, default: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA)' },
              encoding: { type: 'string', enum: ['base64', 'jsonParsed'], description: 'Data encoding (default: jsonParsed)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['owner']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' },
                  apiVersion: { type: 'string', description: 'API version' }
                }
              },
              value: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pubkey: { type: 'string', description: 'Token account public key' },
                    account: { type: 'object', description: 'Account data with parsed token information' }
                  }
                }
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getTokenSupply',
          description: 'Get total supply for an SPL token. Returns NESTED: {context: {slot, apiVersion}, value: {amount: string (raw with decimals), decimals: number, uiAmount: number (human-readable), uiAmountString: string}}. Access supply via: result.value.uiAmount or result.value.amount. Request: {mint: string, commitment?: string} Response: {context: object, slot?: number, apiVersion?: string, value: object, amount?: string, decimals?: number, ...} Use case: Verify token supply, calculate market cap, monitor token issuance.',
          inputSchema: {
            type: 'object',
            properties: {
              mint: { type: 'string', description: 'Token mint address (base58, 32-44 chars)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['mint']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' },
                  apiVersion: { type: 'string', description: 'API version' }
                }
              },
              value: {
                type: 'object',
                properties: {
                  amount: { type: 'string', description: 'Raw token supply as string' },
                  decimals: { type: 'number', description: 'Number of decimals' },
                  uiAmount: { type: 'number', description: 'Human-readable supply' },
                  uiAmountString: { type: 'string', description: 'Human-readable supply as string' }
                }
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getEpochInfo',
          description: 'Get current epoch information. Request: {commitment?: string} Response: {epoch?: number, slotIndex?: number, slotsInEpoch?: number, absoluteSlot?: number, blockHeight?: number} Use case: Epoch calculations, staking info, network timing.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              epoch: { type: 'number', description: 'Current epoch number' },
              slotIndex: { type: 'number', description: 'Current slot relative to epoch start' },
              slotsInEpoch: { type: 'number', description: 'Total slots in this epoch' },
              absoluteSlot: { type: 'number', description: 'Current absolute slot number' },
              blockHeight: { type: 'number', description: 'Current block height' }
            }
          }
        },
        {
          name: 'rpc_getHealth',
          description: 'Get node health status. Request: {} Response: {result: string} - "ok" if healthy. Use case: Node monitoring, health checks, uptime verification.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'string',
            description: 'Health status: "ok" if healthy'
          }
        },
        {
          name: 'rpc_getVersion',
          description: 'Get Solana node version. Request: {} Response: {result: {"solana-core": string, "feature-set": number}} Use case: Version verification, compatibility checks, node info.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              'solana-core': { type: 'string', description: 'Solana core version' },
              'feature-set': { type: 'number', description: 'Feature set number' }
            }
          }
        },
        {
          name: 'rpc_simulateTransaction',
          description: 'Simulate transaction execution without submitting. Request: {transaction: string, sigVerify?: boolean, commitment?: string, replaceRecentBlockhash?: boolean, accounts?: object} Response: Array of objects Use case: Pre-flight checks, estimate compute units, debug transactions, validate before sending.',
          inputSchema: {
            type: 'object',
            properties: {
              transaction: { type: 'string', description: 'Signed transaction as base64 string' },
              sigVerify: { type: 'boolean', description: 'Verify signatures (default: true)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' },
              replaceRecentBlockhash: { type: 'boolean', description: 'Replace blockhash with latest (default: false)' },
              accounts: { type: 'object', description: 'Account overrides for simulation' }
            },
            required: ['transaction']
          },
          outputSchema: {
            type: 'object',
            properties: {
              err: { description: 'Error object if simulation failed, null if successful' },
              logs: { type: 'array', items: { type: 'string' }, description: 'Transaction log messages' },
              accounts: { type: 'array', description: 'Account state after simulation' }
            }
          }
        },
        {
          name: 'rpc_sendTransaction',
          description: 'Submit signed transaction to the network. Request: {transaction: string, encoding?: string, skipPreflight?: boolean, preflightCommitment?: string, maxRetries?: number}. Response: {result: string} - Transaction signature. Use case: Execute transactions, transfer tokens/SOL, invoke programs. NOTE: Transaction must be properly signed!',
          inputSchema: {
            type: 'object',
            properties: {
              transaction: { type: 'string', description: 'Signed transaction as base64 string' },
              encoding: { type: 'string', enum: ['base58', 'base64'], description: 'Transaction encoding (default: base64)' },
              skipPreflight: { type: 'boolean', description: 'Skip preflight checks (default: false)' },
              preflightCommitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Preflight commitment (default: finalized)' },
              maxRetries: { type: 'number', description: 'Max retry attempts (default: 5)' }
            },
            required: ['transaction']
          },
          outputSchema: {
            type: 'string',
            description: 'Transaction signature (base58 encoded)'
          }
        },
        {
          name: 'rpc_getTransaction',
          description: 'Get confirmed transaction details. Returns NESTED: {slot, transaction: {message, signatures}, meta: {err, fee, preBalances, postBalances, logMessages, preTokenBalances, postTokenBalances}, blockTime}. Access via: result.meta.err (null if success), result.meta.logMessages. Request: {signature: string, encoding?: string, maxSupportedTransactionVersion?: number, commitment?: string}. Response: {result: {slot, transaction, meta, blockTime}} Use case: Transaction verification, debugging, analyzing token transfers.',
          inputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature (base58, 87-88 chars)' },
              encoding: { type: 'string', enum: ['json', 'jsonParsed', 'base58', 'base64'], description: 'Encoding format (default: json)' },
              maxSupportedTransactionVersion: { type: 'number', description: 'Max transaction version to support (0 for legacy only)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['signature']
          }
        ,
          outputSchema: {
            type: 'object',
            description: 'Transaction details including slot, transaction data, metadata, and blockTime'
          }
        },
        {
          name: 'rpc_getBlock',
          description: 'Get confirmed block with transactions. Returns NESTED: {blockhash, previousBlockhash, parentSlot, transactions: [...], rewards: [...], blockTime, blockHeight}. Access via: result.transactions, result.blockTime. Request: {slot: number, encoding?: string, transactionDetails?: string, maxSupportedTransactionVersion?: number, rewards?: boolean, commitment?: string}. Response: {result: {blockhash, previousBlockhash, parentSlot, transactions, rewards, blockTime, blockHeight}} Use case: Block analysis, transaction discovery, blockchain forensics.',
          inputSchema: {
            type: 'object',
            properties: {
              slot: { type: 'number', description: 'Slot number of the block' },
              encoding: { type: 'string', enum: ['json', 'jsonParsed', 'base58', 'base64'], description: 'Encoding format (default: json)' },
              transactionDetails: { type: 'string', enum: ['full', 'accounts', 'signatures', 'none'], description: 'Level of transaction detail (default: full)' },
              maxSupportedTransactionVersion: { type: 'number', description: 'Max transaction version (0 for legacy only)' },
              rewards: { type: 'boolean', description: 'Include rewards (default: true)' },
              commitment: { type: 'string', enum: ['confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['slot']
          }
        ,
          outputSchema: {
            type: 'object',
            description: 'Block details including blockhash, transactions, rewards, and timestamps'
          }
        },
        {
          name: 'rpc_getMinimumBalanceForRentExemption',
          description: 'Get minimum lamports required for rent exemption. Request: {dataLength: number, commitment?: string}. Response: {result: number} - Minimum lamports. Use case: Calculate rent for new accounts, transaction planning, account creation.',
          inputSchema: {
            type: 'object',
            properties: {
              dataLength: { type: 'number', description: 'Account data length in bytes' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['dataLength']
          }
        ,
          outputSchema: {
            type: 'number',
            description: 'Minimum lamports required for rent exemption'
          }
        },
        {
          name: 'rpc_requestAirdrop',
          description: 'Request SOL airdrop (devnet/testnet only). Request: {address: string, lamports: number, commitment?: string}. Response: {result: string} - Transaction signature. Use case: Fund test wallets, development testing. NOTE: Only works on devnet/testnet!',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Address to receive airdrop (base58, 32-44 chars)' },
              lamports: { type: 'number', description: 'Amount of lamports to airdrop (max 5 SOL = 5000000000 lamports on devnet)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['address', 'lamports']
          }
        ,
          outputSchema: {
            type: 'string',
            description: 'Airdrop transaction signature'
          }
        },
        {
          name: 'rpc_getSignatureStatuses',
          description: 'Get statuses of transaction signatures. Returns NESTED: {context, value: [{slot, confirmations, err, confirmationStatus}, ...]}. Access via: result.value[0].err (null if success). Request: {signatures: array, searchTransactionHistory?: boolean} Response: Array of objects Use case: Check transaction confirmation, monitor pending transactions.',
          inputSchema: {
            type: 'object',
            properties: {
              signatures: { type: 'array', items: { type: 'string' }, description: 'Array of transaction signatures (max 256)' },
              searchTransactionHistory: { type: 'boolean', description: 'Search full transaction history (default: false)' }
            },
            required: ['signatures']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' }
                }
              },
              value: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    slot: { type: 'number', description: 'Slot where transaction was processed' },
                    confirmations: { type: 'number', description: 'Number of confirmations' },
                    err: { description: 'Error if transaction failed, null if successful' },
                    confirmationStatus: { type: 'string', description: 'Confirmation status' }
                  }
                }
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_isBlockhashValid',
          description: 'Check if blockhash is still valid. Returns NESTED: {context, value: boolean}. Access via: result.value. Request: {blockhash: string, commitment?: string} Response: {context: object, slot?: number, value: boolean} Use case: Verify transaction validity window, prevent expired transactions.',
          inputSchema: {
            type: 'object',
            properties: {
              blockhash: { type: 'string', description: 'Blockhash to check' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['blockhash']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' }
                }
              },
              value: { type: 'boolean', description: 'Whether blockhash is valid' }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getRecentPrioritizationFees',
          description: 'Get recent prioritization fees for transactions. Returns array of {prioritizationFee: number (lamports), slot: number} objects from recent slots. Request: {addresses?: array} Response: [{prioritizationFee: number, slot: number}, ...] Use case: Estimate priority fees, optimize transaction cost, ensure timely execution.',
          inputSchema: {
            type: 'object',
            properties: {
              addresses: { type: 'array', items: { type: 'string' }, description: 'Account addresses to get fees for (optional, max 128)' }
            }
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prioritizationFee: { type: 'number', description: 'Prioritization fee in lamports (micro-lamports)' },
                slot: { type: 'number', description: 'Slot number this fee was observed in' }
              },
              required: ['prioritizationFee', 'slot']
            },
            description: 'Array of recent prioritization fees by slot (typically last 150 slots)'
          }
        },
        {
          name: 'rpc_getFeeForMessage',
          description: 'Get fee for a message. Returns NESTED: {context, value: number (lamports)}. Access via: result.value. Request: {message: string, commitment?: string} Response: Array of objects Use case: Calculate transaction fees before sending, budget planning.',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Base64 encoded message' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['message']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slot: { type: 'number', description: 'Slot number' },
                prioritizationFee: { type: 'number', description: 'Prioritization fee in micro-lamports' }
              }
            }
          }
        },
        {
          name: 'rpc_getTransactionCount',
          description: 'Get total transaction count on the blockchain. Request: {commitment?: string} Response: {result: number} - Total number of transactions processed. Use case: Network statistics, blockchain metrics.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'number',
            description: 'Total number of transactions processed on the blockchain'
          }
        },
        {
          name: 'rpc_getBlockTime',
          description: 'Get estimated block time (Unix timestamp). Request: {slot: number}. Response: {result: number} - Unix timestamp. Use case: Convert slot to time, historical analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              slot: { type: 'number', description: 'Block slot number' }
            },
            required: ['slot']
          }
        ,
          outputSchema: {
            type: 'number',
            description: 'Unix timestamp in seconds when the block was produced'
          }
        },
        {
          name: 'rpc_getSlotLeader',
          description: 'Get current slot leader. Request: {commitment?: string} Response: {result: string} - Validator identity pubkey for current slot leader. Use case: Validator monitoring, network analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'string',
            description: 'Validator identity pubkey for current slot leader'
          }
        },
        {
          name: 'rpc_getSlotLeaders',
          description: 'Get slot leaders for a range. Request: {startSlot: number, limit: number}. Response: {result: string[]} - Array of validator pubkeys. Use case: Leader schedule, validator rotation analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              startSlot: { type: 'number', description: 'Starting slot' },
              limit: { type: 'number', description: 'Number of leaders to return (max 5000)' }
            },
            required: ['startSlot', 'limit']
          }
        ,
          outputSchema: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of validator identity pubkeys for each slot in the range'
          }
        },
        {
          name: 'rpc_getVoteAccounts',
          description: 'Get validator vote accounts. Returns NESTED: {current: [{votePubkey, nodePubkey, activatedStake, commission, ...}], delinquent: [...]}. Access via: result.current, result.delinquent. Request: {votePubkey?: string, commitment?: string} Response: {result: {current: array, delinquent: array}} Use case: Validator selection, staking analysis, network health.',
          inputSchema: {
            type: 'object',
            properties: {
              votePubkey: { type: 'string', description: 'Filter by vote account pubkey (optional)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              current: { type: 'array', description: 'Current active vote accounts' },
              delinquent: { type: 'array', description: 'Delinquent vote accounts' }
            }
          }
        },
        {
          name: 'rpc_getSupply',
          description: 'Get total SOL supply information. Returns NESTED: {context, value: {total, circulating, nonCirculating, nonCirculatingAccounts}}. Access via: result.value.total, result.value.circulating. Request: {excludeNonCirculatingAccountsList?: boolean, commitment?: string} Response: {result: {context, value: {total, circulating, nonCirculating, nonCirculatingAccounts}}} Use case: Economics analysis, market cap calculations.',
          inputSchema: {
            type: 'object',
            properties: {
              excludeNonCirculatingAccountsList: { type: 'boolean', description: 'Exclude non-circulating accounts list (default: false)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' }
                }
              },
              value: {
                type: 'object',
                properties: {
                  total: { type: 'number', description: 'Total supply in lamports' },
                  circulating: { type: 'number', description: 'Circulating supply in lamports' },
                  nonCirculating: { type: 'number', description: 'Non-circulating supply in lamports' },
                  nonCirculatingAccounts: { type: 'array', items: { type: 'string' }, description: 'Non-circulating account addresses' }
                }
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getClusterNodes',
          description: 'Get cluster node information. Request: {} Response: {result: [{pubkey, gossip, tpu, rpc, version}]} Use case: Network topology, RPC endpoint discovery, version monitoring.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pubkey: { type: 'string', description: 'Node public key' },
                gossip: { type: 'string', description: 'Gossip network address' },
                tpu: { type: 'string', description: 'TPU network address' },
                rpc: { type: 'string', description: 'RPC network address' },
                version: { type: 'string', description: 'Software version' }
              }
            }
          }
        },
        {
          name: 'rpc_getEpochSchedule',
          description: 'Get epoch schedule. Response: {slotsPerEpoch?: number, leaderScheduleSlotOffset?: number, warmup?: boolean, firstNormalEpoch?: number, firstNormalSlot?: number}. Request: {} Use case: Epoch calculations, timing analysis.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              slotsPerEpoch: { type: 'number', description: 'Slots per epoch' },
              leaderScheduleSlotOffset: { type: 'number', description: 'Leader schedule slot offset' },
              warmup: { type: 'boolean', description: 'Whether epochs start short and grow' },
              firstNormalEpoch: { type: 'number', description: 'First normal-length epoch' },
              firstNormalSlot: { type: 'number', description: 'First normal-length slot' }
            }
          }
        },
        {
          name: 'rpc_getInflationRate',
          description: 'Get current inflation rate. Response: {total?: number, validator?: number, foundation?: number, epoch?: number}. Request: {} Use case: Economics analysis, staking rewards estimation.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              total: { type: 'number', description: 'Total inflation rate' },
              validator: { type: 'number', description: 'Validator inflation rate' },
              foundation: { type: 'number', description: 'Foundation inflation rate' },
              epoch: { type: 'number', description: 'Epoch number' }
            }
          }
        },
        {
          name: 'rpc_getInflationReward',
          description: 'Get inflation rewards for addresses. Request: {addresses: array, epoch?: number, commitment?: string} Response: Array of objects Use case: Staking reward tracking, validator performance.',
          inputSchema: {
            type: 'object',
            properties: {
              addresses: { type: 'array', items: { type: 'string' }, description: 'Array of addresses to query' },
              epoch: { type: 'number', description: 'Epoch to query (optional, defaults to current)' },
              commitment: { type: 'string', enum: ['confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['addresses']
          },
          outputSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                epoch: { type: 'number', description: 'Epoch for which reward was calculated' },
                effectiveSlot: { type: 'number', description: 'Slot in which rewards were effective' },
                amount: { type: 'number', description: 'Reward amount in lamports' },
                postBalance: { type: 'number', description: 'Post-reward account balance in lamports' },
                commission: { type: 'number', description: 'Vote account commission when the reward was credited' }
              }
            }
          }
        },
        {
          name: 'rpc_getTokenAccountsByDelegate',
          description: 'Get token accounts by delegate authority. Returns NESTED: {context, value: [{pubkey, account: {data: {parsed: {info: {...}}}}}]}. Access via: result.value[0].account.data.parsed.info. Request: {delegate: string, mint?: string, programId?: string, encoding?: string, commitment?: string} Response: {result: {context, value: [{pubkey, account}]}} Use case: Delegated account management, DeFi applications.',
          inputSchema: {
            type: 'object',
            properties: {
              delegate: { type: 'string', description: 'Delegate authority address' },
              mint: { type: 'string', description: 'Filter by token mint (use mint OR programId)' },
              programId: { type: 'string', description: 'Filter by token program (default: TokenkegQf...)' },
              encoding: { type: 'string', enum: ['base64', 'jsonParsed'], description: 'Encoding (default: jsonParsed)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['delegate']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' }
                }
              },
              value: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pubkey: { type: 'string', description: 'Token account public key' },
                    account: { type: 'object', description: 'Account data with parsed token information' }
                  }
                }
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getTokenLargestAccounts',
          description: 'Get largest token accounts by balance. Returns NESTED: {context, value: [{address, amount, decimals, uiAmount, uiAmountString}, ...]}. Access via: result.value[0].uiAmount. Request: {mint: string, commitment?: string} Response: {result: {context, value: [{address, amount, decimals, uiAmount, uiAmountString}]}} Use case: Whale watching, token distribution analysis, holder rankings.',
          inputSchema: {
            type: 'object',
            properties: {
              mint: { type: 'string', description: 'Token mint address' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            },
            required: ['mint']
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' }
                }
              },
              value: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    address: { type: 'string', description: 'Token account address' },
                    amount: { type: 'string', description: 'Raw token amount as string' },
                    decimals: { type: 'number', description: 'Number of decimals' },
                    uiAmount: { type: 'number', description: 'Human-readable amount' },
                    uiAmountString: { type: 'string', description: 'Human-readable amount as string' }
                  }
                }
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getLargestAccounts',
          description: 'Get largest accounts by SOL balance. Returns NESTED: {context, value: [{address, lamports}, ...]}. Access via: result.value[0].lamports. Request: {filter?: string, commitment?: string} Response: {result: {context, value: [{address, lamports}]}} Use case: Whale watching, richlist analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              filter: { type: 'string', enum: ['circulating', 'nonCirculating'], description: 'Filter by account type (optional)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'object',
                properties: {
                  slot: { type: 'number', description: 'Slot number' }
                }
              },
              value: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    address: { type: 'string', description: 'Account address' },
                    lamports: { type: 'number', description: 'SOL balance in lamports' }
                  }
                }
              }
            },
            required: ['context', 'value']
          }
        },
        {
          name: 'rpc_getLeaderSchedule',
          description: 'Get leader schedule for an epoch. Request: {slot?: number, identity?: string, commitment?: string}. Response: {result: object} - Object mapping validator pubkeys to arrays of slot numbers. Use case: Validator schedule, leader prediction.',
          inputSchema: {
            type: 'object',
            properties: {
              slot: { type: 'number', description: 'Slot to query epoch for (optional)' },
              identity: { type: 'string', description: 'Filter by validator identity (optional)' },
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          },
          outputSchema: {
            type: 'object',
            description: 'Object mapping validator pubkeys to arrays of slot numbers they will lead'
          }
        },
        {
          name: 'rpc_minimumLedgerSlot',
          description: 'Get lowest slot that the node has ledger information for. Request: {} Response: {result: number} - Lowest slot in ledger. Use case: Data availability check, historical query validation.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'number',
            description: 'Lowest slot that the node has information for in its ledger'
          }
        },
        {
          name: 'rpc_getFirstAvailableBlock',
          description: 'Get first available block in the ledger. Request: {} Response: {result: number} - Slot of first available block. Use case: Historical data boundaries, ledger pruning info.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'number',
            description: 'Slot of the first available block in the ledger'
          }
        },
        // Utility Tools
        {
          name: 'solana_rpc_call',
          description: 'Make direct Solana RPC calls through OpenSVM proxy. Request: {method: string, params?: array}. Response: {result: any} - Format varies by RPC method. Use case: Access methods not wrapped by other tools (getVoteAccounts, getInflationRate, etc.), custom RPC queries, advanced blockchain operations.',
          inputSchema: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'Solana RPC method name (e.g., "getAccountInfo", "getBlock", "getTransaction")' },
              params: {
                type: 'array',
                description: 'Method parameters as array (e.g., [address, {encoding: "jsonParsed"}])'
              }
            },
            required: ['method']
          },
          outputSchema: {
            description: 'Standard Solana RPC response for the specified method (format varies by method)'
          }
        }
      ];
  }

  private setupToolHandlers() {
    // List all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'tools/list',
          description: 'List all available tools (compatibility shim for stdio transport). Request: {} Response: [{name, description, inputSchema, outputSchema}] - Array of all available tool definitions',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'array',
            description: 'Array of all available tool definitions'
          }
        },
        ...this.getToolDefinitions()
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        return await this.handleToolCall(request.params.name, request.params.arguments);
      } catch (error) {
        console.error(`Error in tool ${request.params.name}:`, error);

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const message = error.response?.data?.error?.message || error.message;

          return {
            content: [{
              type: 'text',
              text: `API Error (${status}): ${message}`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    });
  }

  private async handleToolCall(toolName: string, args: any) {
    switch (toolName) {
      // Tools listing compatibility shim
      case 'tools/list':
        // Return all tools (reuse shared definition)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.getToolDefinitions(), null, 2)
          }]
        };
      case 'get_transaction':
        autoCorrectParam(args, 'signature', ['txSignature', 'tx', 'txSig', 'hash'], 'get_transaction');
        if (!isValidTransactionSignature(args.signature)) {
          throw new McpError(ErrorCode.InvalidParams, getSignatureValidationError(args.signature));
        }
        const txData = await this.client.get(`/api/transaction/${args.signature}`);

        // Flatten nested details object
        const flattenedTx = {
          ...txData,
          // Move details fields to top level
          instructions: txData.details?.instructions,
          accounts: txData.details?.accounts,
          preBalances: txData.details?.preBalances,
          postBalances: txData.details?.postBalances,
          tokenChanges: txData.details?.tokenChanges,
          solChanges: txData.details?.solChanges,
          logs: txData.details?.logs,
          // Map tokenTransfers with correct field names
          tokenTransfers: txData.details?.tokenTransfers?.map((transfer: any) => ({
            ...transfer,
            // Map account/change fields to from/to for compatibility
            from: transfer.account || transfer.from,
            to: transfer.to || (transfer.change > 0 ? transfer.account : null),
            amount: transfer.amount || Math.abs(transfer.change),
            // Keep original fields as well
            account: transfer.account,
            change: transfer.change
          })) || txData.tokenTransfers,
          // Remove nested details object
          details: undefined
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(flattenedTx)
          }]
        };

      case 'batch_transactions':
        // Auto-correct single signature to array
        if (args.signatures === undefined && args.signature !== undefined) {
          args.signatures = Array.isArray(args.signature) ? args.signature : [args.signature];
          console.warn(`[batch_transactions] Auto-corrected parameter: "signature" → "signatures" (as array)`);
        } else if (typeof args.signatures === 'string') {
          args.signatures = [args.signatures];
          console.warn(`[batch_transactions] Auto-corrected: single signature string → array`);
        }
        if (!Array.isArray(args.signatures) || args.signatures.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Signatures array is required. Example: ["5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"]');
        }
        const batchData = await this.client.post('/transaction/batch', {
          signatures: args.signatures,
          includeDetails: args.includeDetails ?? true
        });

        // Flatten nested details in each transaction
        const flattenedBatch = Array.isArray(batchData) ? batchData.map((item: any) => ({
          ...item,
          // Move details fields to top level
          instructions: item.details?.instructions,
          accounts: item.details?.accounts,
          preBalances: item.details?.preBalances,
          postBalances: item.details?.postBalances,
          tokenChanges: item.details?.tokenChanges,
          solChanges: item.details?.solChanges,
          logs: item.details?.logs,
          // Remove nested details object
          details: undefined
        })) : batchData;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(flattenedBatch)
          }]
        };

      case 'analyze_transaction':
        if (!isValidTransactionSignature(args.signature)) {
          throw new McpError(ErrorCode.InvalidParams, getSignatureValidationError(args.signature));
        }
        const analysis = await this.client.get(`/api/transaction/${args.signature}/analysis`, {
          model: args.model
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(analysis)
          }]
        };

      case 'explain_transaction':
        if (!isValidTransactionSignature(args.signature)) {
          throw new McpError(ErrorCode.InvalidParams, getSignatureValidationError(args.signature));
        }
        const explanation = await this.client.get(`/api/transaction/${args.signature}/explain`, {
          language: args.language
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(explanation)
          }]
        };

      // Account Tools
      case 'get_account_stats':
        autoCorrectParam(args, 'address', ['wallet', 'account', 'pubkey', 'publicKey'], 'get_account_stats');
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const accountStats = await this.client.get('/api/account-stats', {
          params: { address: args.address }
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accountStats)
          }]
        };

      case 'get_account_portfolio':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const portfolio = await this.client.get(`/api/account-portfolio/${args.address}`);

        // Flatten nested data structure
        const flattenedPortfolio = {
          ...portfolio,
          // Move data.native fields to top level
          native: portfolio.data?.native,
          tokens: portfolio.data?.tokens,
          totalValue: portfolio.data?.totalValue,
          totalTokens: portfolio.data?.totalTokens,
          summary: portfolio.data?.summary,
          // Remove nested data object
          data: undefined
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(flattenedPortfolio)
          }]
        };

      case 'get_solana_balance':
        autoCorrectParam(args, 'address', ['wallet', 'account', 'pubkey', 'publicKey'], 'get_solana_balance');
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const portfolioData = await this.client.get(`/api/account-portfolio/${args.address}`);
        // Return full portfolio data (same as get_account_portfolio for completeness)
        const balanceInfo = {
          address: args.address,
          timestamp: portfolioData.timestamp,
          native: portfolioData.data?.native || {},
          tokens: portfolioData.data?.tokens || [],
          totalValue: portfolioData.data?.totalValue || 0,
          totalTokens: portfolioData.data?.totalTokens || 0,
          summary: portfolioData.data?.summary || {}
        };
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(balanceInfo)
          }]
        };

      case 'get_account_transactions':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        // Validate and cap limit to Solana RPC maximum
        let limit = args.limit;
        if (limit !== undefined) {
          if (typeof limit !== 'number' || limit < 1) {
            throw new McpError(ErrorCode.InvalidParams, getNumberValidationError(limit, 'Limit', { min: 1 }));
          }
          if (limit > 1000) {
            console.warn(`Limit ${limit} exceeds Solana RPC maximum of 1000, capping to 1000`);
            limit = 1000;
          }
        }
        const accountTxs = await this.client.get(`/api/account-transactions/${args.address}`, {
          params: {
            limit,
            before: args.before,
            type: args.type,
            startDate: args.startDate,
            endDate: args.endDate,
            classify: true,
            includeInflow: true
          }
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accountTxs)
          }]
        };

      case 'get_batch_account_transfers':
        // Validate addresses array
        if (!Array.isArray(args.addresses)) {
          throw new McpError(ErrorCode.InvalidParams, 'addresses must be an array');
        }
        if (args.addresses.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'addresses array cannot be empty');
        }
        if (args.addresses.length > 100) {
          throw new McpError(ErrorCode.InvalidParams, 'Maximum 100 addresses per batch request');
        }

        // Validate each address
        for (const addr of args.addresses) {
          if (!isValidSolanaAddress(addr)) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid address: ${addr}`);
          }
        }

        const batchLimit = args.limit || 50;
        console.error(`📦 Batch request: ${args.addresses.length} wallets, ${batchLimit} transfers each`);

        // Fetch all wallets in parallel
        const batchResults = await Promise.allSettled(
          args.addresses.map(async (address: string) => {
            try {
              const result = await this.client.get(`/api/account-transfers/${address}`, {
                limit: batchLimit,
                transferType: args.transferType,
              });
              return { address, result };
            } catch (error: any) {
              console.error(`   ❌ ${address}: ${error.message}`);
              return { address, error: error.message };
            }
          })
        );

        // Build response map
        const batchResponse: Record<string, any> = {};
        let successCount = 0;
        let errorCount = 0;

        for (const settled of batchResults) {
          if (settled.status === 'fulfilled') {
            const { address, result, error } = settled.value;
            if (error) {
              batchResponse[address] = { error };
              errorCount++;
            } else {
              batchResponse[address] = result;
              successCount++;
            }
          } else {
            errorCount++;
          }
        }

        console.error(`   ✅ ${successCount} success, ❌ ${errorCount} errors`);

        // Optional compression
        if (args.compress === true) {
          const jsonStr = JSON.stringify(batchResponse);
          const compressed = zlib.brotliCompressSync(Buffer.from(jsonStr), {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11
            }
          });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                _compressed: 'brotli',
                _originalSize: jsonStr.length,
                _compressedSize: compressed.length,
                _wallets: args.addresses.length,
                _successCount: successCount,
                _errorCount: errorCount,
                data: compressed.toString('base64')
              })
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...batchResponse,
              _meta: {
                wallets: args.addresses.length,
                successCount,
                errorCount
              }
            })
          }]
        };

      case 'get_account_transfers':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        // Validate limit
        let transferLimit = args.limit;
        if (transferLimit !== undefined) {
          if (typeof transferLimit !== 'number' || transferLimit < 1) {
            throw new McpError(ErrorCode.InvalidParams, getNumberValidationError(transferLimit, 'Limit', { min: 1 }));
          }
        }
        // Validate offset
        if (args.offset !== undefined && (typeof args.offset !== 'number' || args.offset < 0)) {
          throw new McpError(ErrorCode.InvalidParams, getNumberValidationError(args.offset, 'Offset', { min: 0 }));
        }
        // Validate beforeSignature if provided
        if (args.beforeSignature && !isValidTransactionSignature(args.beforeSignature)) {
          throw new McpError(ErrorCode.InvalidParams, getSignatureValidationError(args.beforeSignature));
        }
        const accountTransfers = await this.client.get(`/api/account-transfers/${args.address}`, {
          limit: transferLimit,
          offset: args.offset,
          beforeSignature: args.beforeSignature,
          transferType: args.transferType,
          solanaOnly: args.solanaOnly,
          txType: args.txType,
          mints: args.mints,
          bypassCache: args.bypassCache
        });

        // Optional Brotli compression (saves ~60% bandwidth)
        if (args.compress === true) {
          const jsonStr = JSON.stringify(accountTransfers);
          const compressed = zlib.brotliCompressSync(Buffer.from(jsonStr), {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11
            }
          });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                _compressed: 'brotli',
                _originalSize: jsonStr.length,
                _compressedSize: compressed.length,
                data: compressed.toString('base64')
              })
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accountTransfers)
          }]
        };

      case 'get_account_token_stats':
        if (!isValidSolanaAddress(args.address) || !isValidSolanaAddress(args.mint)) {
          throw new McpError(ErrorCode.InvalidParams, getMultiAddressValidationError(args.address, args.mint));
        }
        const tokenStats = await this.client.get('/api/account-token-stats', {
          params: {
            address: args.address,
            mint: args.mint
          }
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(tokenStats)
          }]
        };

      case 'check_account_type':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const accountType = await this.client.get('/api/check-account-type', {
          params: {
            address: args.address
          }
        });

        // Flatten nested details object
        const flattenedAccountType = {
          ...accountType,
          // Spread details to top level (if exists)
          ...(accountType.details && typeof accountType.details === 'object' ? accountType.details : {}),
          // Remove nested details object
          details: undefined
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(flattenedAccountType)
          }]
        };

      // Block Tools
      case 'get_block':
        // FIXED: Use path parameter instead of query parameter
        const blockData = await this.client.get(`/api/blocks/${args.slot}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(blockData)
          }]
        };

      case 'get_recent_blocks':
        const recentBlocks = await this.client.get('/api/blocks', {
          limit: args.limit || 5, // Default to 5 to prevent timeouts
          before: args.before
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(recentBlocks)
          }]
        };

      case 'get_block_stats':
        // Note: This endpoint currently returns an error from the API
        // Keeping the tool for future use when the API is fixed
        const blockStats = await this.client.get('/api/blocks/stats');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(blockStats)
          }]
        };

      // Search Tools
      case 'universal_search':
        const searchResults = await this.client.get('/api/search', {
          q: args.query,
          type: args.type,
          start: args.start,
          end: args.end,
          status: args.status,
          min: args.min,
          max: args.max
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(searchResults)
          }]
        };

      case 'search_accounts':
        const accountSearch = await this.client.get('/search/accounts', {
          q: args.query,
          tokenMint: args.tokenMint,
          minBalance: args.minBalance,
          maxBalance: args.maxBalance
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accountSearch)
          }]
        };

      // AI Tools
      case 'ai_inference_call':
        const aiAnswer = await this.client.post('/api/getAnswer', {
          question: args.question,
          ...(args.systemPrompt && { systemPrompt: args.systemPrompt }),
          ...(args.maxTokens && { maxTokens: args.maxTokens }),
          ...(args.ownPlan !== undefined && { ownPlan: args.ownPlan }),
          ...(args._healthCheck !== undefined && { _healthCheck: args._healthCheck })
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(aiAnswer)
          }]
        };

      // Wallet Connection & Mapping Tools
      case 'find_related_transactions':
        const relatedTxData = await this.client.post('/api/find-related-transactions', {
          ...(args.signatures && { signatures: args.signatures }),
          ...(args.address && { address: args.address }),
          ...(args.includeTokenTransfers !== undefined && { includeTokenTransfers: args.includeTokenTransfers }),
          ...(args.maxDepth !== undefined && { maxDepth: args.maxDepth })
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(relatedTxData)
          }]
        };

      case 'holders_by_interaction':
        if (!isValidSolanaAddress(args.program)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.program, 'program'));
        }
        const holdersByInteraction = await this.client.get('/api/holdersByInteraction', {
          program: args.program,
          period: args.period,
          limit: args.limit,
          offset: args.offset,
          minInteractions: args.minInteractions
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(holdersByInteraction)
          }]
        };

      // Analytics Tools
      case 'get_defi_overview':
        const defiOverview = await this.client.get('/api/analytics/overview');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(defiOverview)
          }]
        };

      case 'get_dex_analytics':
        const dexAnalytics = await this.client.get('/api/analytics/dex', {
          dex: args.dex,
          timeframe: args.timeframe
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(dexAnalytics)
          }]
        };

      case 'get_defi_health':
        const defiHealth = await this.client.get('/api/analytics/defi-health');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(defiHealth)
          }]
        };

      case 'get_validator_analytics':
        const validatorAnalytics = await this.client.get('/api/analytics/validators');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(validatorAnalytics)
          }]
        };

      case 'chart':
      case 'ohlcv':
      case 'candles':
      case 'prices':
        // Chart tool - simplified OHLCV using optimized /chart endpoint
        // Supports automatic batching for large time ranges (up to 10 days of 1m data)
        if (!isValidSolanaAddress(args.mint)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.mint, 'token mint'));
        }

        // Validate unsupported parameters
        if (args.limit !== undefined || args.days !== undefined) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `❌ The "chart" tool does not support "limit" or "days" parameters. Use timeFrom/timeTo for custom time ranges, or omit for default historical data based on interval.`
          );
        }

        const chartParams: any = {
          mint: args.mint,
          type: args.interval || '1H'  // Default to 1 hour interval
        };

        // Add optional time range parameters
        if (args.timeFrom !== undefined) {
          chartParams.time_from = args.timeFrom;
        }
        if (args.timeTo !== undefined) {
          chartParams.time_to = args.timeTo;
        }

        // The /chart endpoint provides enhanced batching and ~10x more data than /market-data
        // Returns OHLCV data with technical indicators (MA7, MA25, MACD)
        const chartData = await this.client.get('/api/chart', chartParams);

        // Ultra-optimized response format:
        // 1. Array format instead of objects (saves ~40 bytes per candle)
        // 2. Filter zero-volume candles by default (reduces ~70-80% for low-activity tokens)
        // 3. Delta encoding for timestamps (saves ~8 bytes per candle)

        const items = chartData.data?.items || [];
        const includeZeroVolume = args.includeZeroVolume || false;

        // Filter zero-volume candles unless explicitly requested
        const filteredItems = includeZeroVolume
          ? items
          : items.filter((c: any) => c.v > 0);

        // Convert to array format with delta-encoded timestamps
        // Calculate volume in same currency as prices: avg(high, low) * token_volume
        const firstTimestamp = filteredItems[0]?.unixTime || 0;
        const currency = items[0]?.currency || 'usd';
        const candles = filteredItems.map((candle: any, index: number) => {
          const avgPrice = (candle.h + candle.l) / 2;
          const volumeInCurrency = avgPrice * candle.v;

          return [
            candle.o,
            candle.h,
            candle.l,
            candle.c,
            volumeInCurrency,  // Volume in same currency as prices (usd/sol/btc/etc)
            index === 0 ? 0 : candle.unixTime - filteredItems[index - 1].unixTime  // Delta from previous
          ];
        });

        const optimizedData = {
          ...chartData,
          metadata: {
            address: chartData.mint,
            type: items[0]?.type || chartParams.type,
            currency: currency,
            format: ['o', 'h', 'l', 'c', 'v_' + currency, 't_delta'],
            t_start: firstTimestamp,
            filtered: !includeZeroVolume,
            original_count: items.length,
            filtered_count: filteredItems.length
          },
          data: {
            items: candles
          }
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(optimizedData)
          }]
        };

      case 'get_market_data':
        if (!isValidSolanaAddress(args.mint)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.mint, 'token mint'));
        }

        // Check for OHLCV-related parameters and redirect to chart tool
        if (args.interval || args.timeframe || args.period || args.limit || args.days ||
            args.includeZeroVolume !== undefined || args.ohlcv || args.candles || args.candlestick ||
            (args.endpoint && args.endpoint.toLowerCase() === 'ohlcv')) {
          throw new McpError(
            ErrorCode.InvalidParams,
            '❌ WRONG TOOL! For OHLCV/candlestick/price chart data, use the "chart" tool (NOT get_market_data). ' +
            'get_market_data only supports endpoint="markets" (pools/liquidity) and endpoint="orderbook" (market depth). ' +
            'Example: chart({mint: "' + args.mint + '", interval: "1d", days: 30}) to get daily candles for 30 days.'
          );
        }

        const marketDataParams: any = {
          endpoint: args.endpoint,
          mint: args.mint
        };

        // Add optional parameters
        if (args.poolAddress) marketDataParams.poolAddress = args.poolAddress;
        if (args.baseMint) marketDataParams.baseMint = args.baseMint;
        if (args.offset) marketDataParams.offset = args.offset;

        const marketData = await this.client.get('/api/market-data', marketDataParams);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(marketData)
          }]
        };

      case 'get_dex_profile':
        const dexProfile = await this.client.get(`/api/dex/${args.name}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(dexProfile)
          }]
        };

      case 'get_trending_validators':
        const trendingValidators = await this.client.get('/api/analytics/trending-validators', {
          params: args.metric ? { metric: args.metric } : {}
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(trendingValidators)
          }]
        };

      case 'get_cross_chain_analytics':
        const crossChainAnalytics = await this.client.get('/api/analytics/cross-chain');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(crossChainAnalytics)
          }]
        };

      case 'get_bot_analytics':
        const botAnalytics = await this.client.get('/api/analytics/bots');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(botAnalytics)
          }]
        };

      // Token & NFT Tools
      case 'get_token_info':
        autoCorrectParam(args, 'address', ['mint', 'token', 'tokenAddress', 'mintAddress'], 'get_token_info');
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const tokenInfo = await this.client.get(`/api/token/${args.address}`);

        // Flatten metadata to top level for better AI accessibility
        const flattenedTokenInfo = {
          ...tokenInfo,
          // Move metadata fields to top level
          name: tokenInfo.metadata?.name,
          symbol: tokenInfo.metadata?.symbol,
          description: tokenInfo.metadata?.description,
          uri: tokenInfo.metadata?.uri,
          // Remove the nested metadata object
          metadata: undefined
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(flattenedTokenInfo)
          }]
        };

      case 'get_token_metadata':
        // Auto-correct single mint to array
        if (args.mints === undefined && args.mint !== undefined) {
          args.mints = Array.isArray(args.mint) ? args.mint : [args.mint];
          console.warn(`[get_token_metadata] Auto-corrected parameter: "mint" → "mints" (as array)`);
        } else if (typeof args.mints === 'string') {
          args.mints = [args.mints];
          console.warn(`[get_token_metadata] Auto-corrected: single mint string → array`);
        }
        if (!Array.isArray(args.mints) || args.mints.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, getArrayValidationError(args.mints, 'Mints', '"So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"'));
        }
        const tokenMetadata = await this.client.get('/api/token-metadata', {
          mint: args.mints.join(',')
        });

        // Flatten nested metadata objects in array
        const flattenedMetadata = Array.isArray(tokenMetadata) ? tokenMetadata.map((item: any) => ({
          ...item,
          // Move metadata fields to top level
          name: item.metadata?.name,
          symbol: item.metadata?.symbol,
          description: item.metadata?.description,
          uri: item.metadata?.uri,
          image: item.metadata?.image,
          // Remove nested metadata object
          metadata: undefined
        })) : tokenMetadata;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(flattenedMetadata)
          }]
        };

      case 'get_nft_collections':
        const nftCollections = await this.client.get('/api/nft-collections', {
          limit: args.limit,
          sort: args.sort
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(nftCollections)
          }]
        };

      case 'get_trending_nfts':
        const trendingNFTs = await this.client.get('/nft-collections/trending');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(trendingNFTs)
          }]
        };

      // User Management Tools
      case 'verify_wallet_signature':
        const verifyResult = await this.client.post('/auth/verify', {
          message: args.message,
          signature: args.signature,
          publicKey: args.publicKey
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(verifyResult), null, 2)
          }]
        };

      case 'get_user_history':
        if (!isValidSolanaAddress(args.walletAddress)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.walletAddress, 'wallet address'));
        }
        const userHistory = await this.client.get(`/api/user-history/${args.walletAddress}`, {
          limit: args.limit
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(userHistory)
          }]
        };

      // Monetization Tools
      case 'get_balance':
        const balance = await this.client.get('/opensvm/balance');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(balance)
          }]
        };

      case 'get_usage_stats':
        const usage = await this.client.get('/opensvm/usage');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(usage)
          }]
        };

      case 'manage_api_keys':
        let result;
        switch (args.action) {
          case 'list':
            result = await this.client.get('/opensvm/anthropic-keys');
            break;
          case 'create':
            result = await this.client.post('/opensvm/anthropic-keys', {
              name: args.name,
              permissions: args.permissions
            });
            break;
          case 'delete':
            if (!args.keyId) {
              throw new McpError(ErrorCode.InvalidParams, getRequiredFieldError('Key ID', '"key_abc123"'));
            }
            result = await this.client.delete(`/opensvm/anthropic-keys/${args.keyId}`);
            break;
          default:
            throw new McpError(ErrorCode.InvalidParams, 'Invalid action. Use: list, create, or delete');
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };

      // Infrastructure Tools
      case 'get_api_metrics':
        const metrics = await this.client.get('/monitoring/api');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(metrics)
          }]
        };

      case 'report_error':
        const errorReport = await this.client.post('/error-tracking', {
          error: {
            message: args.message,
            stack: args.stack,
            url: args.url,
            userAgent: args.userAgent
          }
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(errorReport)
          }]
        };

      // Program Registry Tools
      case 'get_program_registry':
        const programs = await this.client.get('/program-registry', {
          category: args.category,
          verified: args.verified
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(programs)
          }]
        };

      case 'get_program_info':
        if (!isValidSolanaAddress(args.programId)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.programId, 'program ID'));
        }
        const programInfo = await this.client.get(`/program-registry/${args.programId}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(programInfo)
          }]
        };

      // Solana RPC Direct Methods
      case 'rpc_getAccountInfo':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const accountInfoParams = [args.address];
        if (args.encoding || args.commitment) {
          const config: any = {};
          if (args.encoding) config.encoding = args.encoding;
          if (args.commitment) config.commitment = args.commitment;
          accountInfoParams.push(config);
        }
        const accountInfoResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getAccountInfo',
          params: accountInfoParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(accountInfoResult), null, 2)
          }]
        };

      case 'rpc_getBalance':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const balanceParams = [args.address];
        if (args.commitment) {
          balanceParams.push({ commitment: args.commitment });
        }
        const balanceResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getBalance',
          params: balanceParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(balanceResult), null, 2)
          }]
        };

      case 'rpc_getMultipleAccounts':
        // Auto-correct single address to array
        if (args.addresses === undefined && args.address !== undefined) {
          args.addresses = Array.isArray(args.address) ? args.address : [args.address];
          console.warn(`[rpc_getMultipleAccounts] Auto-corrected parameter: "address" → "addresses" (as array)`);
        } else if (typeof args.addresses === 'string') {
          args.addresses = [args.addresses];
          console.warn(`[rpc_getMultipleAccounts] Auto-corrected: single address string → array`);
        }
        if (!Array.isArray(args.addresses) || args.addresses.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, getArrayValidationError(args.addresses, 'Addresses', '"So11111111111111111111111111111111111111112"'));
        }
        if (args.addresses.length > 100) {
          throw new McpError(ErrorCode.InvalidParams, getArrayValidationError(args.addresses, 'Addresses', '"So11111111111111111111111111111111111111112"', 100));
        }
        const multiAcctParams = [args.addresses];
        if (args.encoding || args.commitment) {
          const config: any = {};
          if (args.encoding) config.encoding = args.encoding;
          if (args.commitment) config.commitment = args.commitment;
          multiAcctParams.push(config);
        }
        const multiAcctResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getMultipleAccounts',
          params: multiAcctParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(multiAcctResult), null, 2)
          }]
        };

      case 'rpc_getProgramAccounts':
        if (!isValidSolanaAddress(args.programId)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.programId, 'program ID'));
        }
        const progAcctParams = [args.programId];
        if (args.encoding || args.filters || args.commitment) {
          const config: any = {};
          if (args.encoding) config.encoding = args.encoding;
          // Process filters to convert base58 addresses to base64
          if (args.filters) {
            config.filters = processRpcFilters(args.filters);
            console.warn(`[rpc_getProgramAccounts] Processed ${args.filters.length} filters for base58→base64 conversion`);
          }
          if (args.commitment) config.commitment = args.commitment;
          progAcctParams.push(config);
        }
        const progAcctResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getProgramAccounts',
          params: progAcctParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(progAcctResult), null, 2)
          }]
        };

      case 'rpc_getSignaturesForAddress':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const sigParams = [args.address];
        if (args.limit || args.before || args.until || args.commitment) {
          const config: any = {};
          if (args.limit) {
            if (args.limit > 1000) {
              console.warn(`Limit ${args.limit} exceeds Solana RPC maximum of 1000, capping to 1000`);
              config.limit = 1000;
            } else {
              config.limit = args.limit;
            }
          }
          if (args.before) config.before = args.before;
          if (args.until) config.until = args.until;
          if (args.commitment) config.commitment = args.commitment;
          sigParams.push(config);
        }
        const sigResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getSignaturesForAddress',
          params: sigParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(sigResult), null, 2)
          }]
        };

      case 'rpc_getSlot':
        const slotParams = [];
        if (args.commitment) {
          slotParams.push({ commitment: args.commitment });
        }
        const slotResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getSlot',
          params: slotParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(slotResult), null, 2)
          }]
        };

      case 'rpc_getBlockHeight':
        const blockHeightParams = [];
        if (args.commitment) {
          blockHeightParams.push({ commitment: args.commitment });
        }
        const blockHeightResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getBlockHeight',
          params: blockHeightParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(blockHeightResult), null, 2)
          }]
        };

      case 'rpc_getLatestBlockhash':
        const blockhashParams = [];
        if (args.commitment) {
          blockhashParams.push({ commitment: args.commitment });
        }
        const blockhashResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getLatestBlockhash',
          params: blockhashParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(blockhashResult), null, 2)
          }]
        };

      case 'rpc_getTokenAccountBalance':
        if (!isValidSolanaAddress(args.tokenAccount)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.tokenAccount, 'token account'));
        }
        const tokenBalParams = [args.tokenAccount];
        if (args.commitment) {
          tokenBalParams.push({ commitment: args.commitment });
        }
        const tokenBalResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getTokenAccountBalance',
          params: tokenBalParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(tokenBalResult), null, 2)
          }]
        };

      case 'rpc_getTokenAccountsByOwner':
        if (!isValidSolanaAddress(args.owner)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.owner, 'owner'));
        }
        const tokenAcctParams: any[] = [args.owner];
        const filterObj: any = {};
        if (args.mint) {
          if (!isValidSolanaAddress(args.mint)) {
            throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.mint, 'mint'));
          }
          filterObj.mint = args.mint;
        } else if (args.programId) {
          if (!isValidSolanaAddress(args.programId)) {
            throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.programId, 'program ID'));
          }
          filterObj.programId = args.programId;
        } else {
          filterObj.programId = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        }
        tokenAcctParams.push(filterObj);

        const tokenAcctConfig: any = { encoding: args.encoding || 'jsonParsed' };
        if (args.commitment) tokenAcctConfig.commitment = args.commitment;
        tokenAcctParams.push(tokenAcctConfig);

        const tokenAcctResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getTokenAccountsByOwner',
          params: tokenAcctParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(tokenAcctResult), null, 2)
          }]
        };

      case 'rpc_getTokenSupply':
        if (!isValidSolanaAddress(args.mint)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.mint, 'mint'));
        }
        const tokenSupplyParams = [args.mint];
        if (args.commitment) {
          tokenSupplyParams.push({ commitment: args.commitment });
        }
        const tokenSupplyResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getTokenSupply',
          params: tokenSupplyParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(tokenSupplyResult), null, 2)
          }]
        };

      case 'rpc_getEpochInfo':
        const epochParams = [];
        if (args.commitment) {
          epochParams.push({ commitment: args.commitment });
        }
        const epochResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getEpochInfo',
          params: epochParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(epochResult), null, 2)
          }]
        };

      case 'rpc_getHealth':
        const healthResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getHealth',
          params: []
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(healthResult), null, 2)
          }]
        };

      case 'rpc_getVersion':
        const versionResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getVersion',
          params: []
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(versionResult), null, 2)
          }]
        };

      case 'rpc_simulateTransaction':
        if (!args.transaction) {
          throw new McpError(ErrorCode.InvalidParams, getRequiredFieldError('Transaction', '"base64EncodedTransaction"'));
        }
        const simParams: any[] = [args.transaction];
        const simConfig: any = {};
        if (args.sigVerify !== undefined) simConfig.sigVerify = args.sigVerify;
        if (args.commitment) simConfig.commitment = args.commitment;
        if (args.replaceRecentBlockhash !== undefined) simConfig.replaceRecentBlockhash = args.replaceRecentBlockhash;
        if (args.accounts) simConfig.accounts = args.accounts;
        if (Object.keys(simConfig).length > 0) {
          simParams.push(simConfig);
        }
        const simResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'simulateTransaction',
          params: simParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(simResult), null, 2)
          }]
        };

      case 'rpc_sendTransaction':
        if (!args.transaction) {
          throw new McpError(ErrorCode.InvalidParams, getRequiredFieldError('Transaction', '"base64EncodedTransaction"'));
        }
        const sendParams: any[] = [args.transaction];
        const sendConfig: any = {};
        if (args.encoding) sendConfig.encoding = args.encoding;
        if (args.skipPreflight !== undefined) sendConfig.skipPreflight = args.skipPreflight;
        if (args.preflightCommitment) sendConfig.preflightCommitment = args.preflightCommitment;
        if (args.maxRetries !== undefined) sendConfig.maxRetries = args.maxRetries;
        if (Object.keys(sendConfig).length > 0) {
          sendParams.push(sendConfig);
        }
        const sendResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'sendTransaction',
          params: sendParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(sendResult), null, 2)
          }]
        };

      case 'rpc_getTransaction':
        if (!isValidTransactionSignature(args.signature)) {
          throw new McpError(ErrorCode.InvalidParams, getSignatureValidationError(args.signature));
        }
        const getTxParams: any[] = [args.signature];
        const getTxConfig: any = {};
        if (args.encoding) getTxConfig.encoding = args.encoding;
        if (args.maxSupportedTransactionVersion !== undefined) getTxConfig.maxSupportedTransactionVersion = args.maxSupportedTransactionVersion;
        if (args.commitment) getTxConfig.commitment = args.commitment;
        if (Object.keys(getTxConfig).length > 0) getTxParams.push(getTxConfig);

        const getTxResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getTransaction',
          params: getTxParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(getTxResult), null, 2)
          }]
        };

      case 'rpc_getBlock':
        const getBlockParams: any[] = [args.slot];
        const getBlockConfig: any = {};
        if (args.encoding) getBlockConfig.encoding = args.encoding;
        if (args.transactionDetails) getBlockConfig.transactionDetails = args.transactionDetails;
        if (args.maxSupportedTransactionVersion !== undefined) getBlockConfig.maxSupportedTransactionVersion = args.maxSupportedTransactionVersion;
        if (args.rewards !== undefined) getBlockConfig.rewards = args.rewards;
        if (args.commitment) getBlockConfig.commitment = args.commitment;
        if (Object.keys(getBlockConfig).length > 0) getBlockParams.push(getBlockConfig);

        const getBlockResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getBlock',
          params: getBlockParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(getBlockResult), null, 2)
          }]
        };

      case 'rpc_getMinimumBalanceForRentExemption':
        const rentParams: any[] = [args.dataLength];
        if (args.commitment) rentParams.push({ commitment: args.commitment });

        const rentResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getMinimumBalanceForRentExemption',
          params: rentParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(rentResult), null, 2)
          }]
        };

      case 'rpc_requestAirdrop':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const airdropParams: any[] = [args.address, args.lamports];
        if (args.commitment) airdropParams.push({ commitment: args.commitment });

        const airdropResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'requestAirdrop',
          params: airdropParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(airdropResult), null, 2)
          }]
        };

      case 'rpc_getSignatureStatuses':
        if (!Array.isArray(args.signatures) || args.signatures.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, getArrayValidationError(args.signatures, 'Signatures', '"5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW"'));
        }
        const sigStatusParams: any[] = [args.signatures];
        if (args.searchTransactionHistory !== undefined) {
          sigStatusParams.push({ searchTransactionHistory: args.searchTransactionHistory });
        }

        const sigStatusResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getSignatureStatuses',
          params: sigStatusParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(sigStatusResult), null, 2)
          }]
        };

      case 'rpc_isBlockhashValid':
        if (!args.blockhash) {
          throw new McpError(ErrorCode.InvalidParams, getRequiredFieldError('Blockhash', '"9sHcv6xwn9YkB8nxTUGKDwPwNnmqVp5oAXxU8Fdkm4J6"'));
        }
        const bhValidParams: any[] = [args.blockhash];
        if (args.commitment) bhValidParams.push({ commitment: args.commitment });

        const bhValidResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'isBlockhashValid',
          params: bhValidParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(bhValidResult), null, 2)
          }]
        };

      case 'rpc_getRecentPrioritizationFees':
        const prioFeeParams: any[] = [];
        if (args.addresses && args.addresses.length > 0) {
          prioFeeParams.push(args.addresses);
        }

        const prioFeeResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getRecentPrioritizationFees',
          params: prioFeeParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(prioFeeResult), null, 2)
          }]
        };

      case 'rpc_getFeeForMessage':
        if (!args.message) {
          throw new McpError(ErrorCode.InvalidParams, getRequiredFieldError('Message', '"base64EncodedMessage"'));
        }
        const feeForMsgParams: any[] = [args.message];
        if (args.commitment) feeForMsgParams.push({ commitment: args.commitment });

        const feeForMsgResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getFeeForMessage',
          params: feeForMsgParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(feeForMsgResult), null, 2)
          }]
        };

      case 'rpc_getTransactionCount':
        const txCountParams: any[] = [];
        if (args.commitment) txCountParams.push({ commitment: args.commitment });

        const txCountResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getTransactionCount',
          params: txCountParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(txCountResult), null, 2)
          }]
        };

      case 'rpc_getBlockTime':
        if (args.slot === undefined) {
          throw new McpError(ErrorCode.InvalidParams, getRequiredFieldError('Slot', '12345'));
        }
        const blockTimeResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getBlockTime',
          params: [args.slot]
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(blockTimeResult), null, 2)
          }]
        };

      case 'rpc_getSlotLeader':
        const slotLeaderParams: any[] = [];
        if (args.commitment) slotLeaderParams.push({ commitment: args.commitment });

        const slotLeaderResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getSlotLeader',
          params: slotLeaderParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(slotLeaderResult), null, 2)
          }]
        };

      case 'rpc_getSlotLeaders':
        if (args.startSlot === undefined || args.limit === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'startSlot and limit are required. Example: {"startSlot": 12345, "limit": 10}');
        }
        const slotLeadersResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getSlotLeaders',
          params: [args.startSlot, args.limit]
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(slotLeadersResult), null, 2)
          }]
        };

      case 'rpc_getVoteAccounts':
        const voteAcctsParams: any[] = [];
        const voteAcctsConfig: any = {};
        if (args.votePubkey) voteAcctsConfig.votePubkey = args.votePubkey;
        if (args.commitment) voteAcctsConfig.commitment = args.commitment;
        if (Object.keys(voteAcctsConfig).length > 0) voteAcctsParams.push(voteAcctsConfig);

        const voteAcctsResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getVoteAccounts',
          params: voteAcctsParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(voteAcctsResult), null, 2)
          }]
        };

      case 'rpc_getSupply':
        const supplyParams: any[] = [];
        const supplyConfig: any = {};
        if (args.excludeNonCirculatingAccountsList !== undefined) supplyConfig.excludeNonCirculatingAccountsList = args.excludeNonCirculatingAccountsList;
        if (args.commitment) supplyConfig.commitment = args.commitment;
        if (Object.keys(supplyConfig).length > 0) supplyParams.push(supplyConfig);

        const supplyResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getSupply',
          params: supplyParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(supplyResult), null, 2)
          }]
        };

      case 'rpc_getClusterNodes':
        const clusterNodesResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getClusterNodes',
          params: []
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(clusterNodesResult), null, 2)
          }]
        };

      case 'rpc_getEpochSchedule':
        const epochScheduleResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getEpochSchedule',
          params: []
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(epochScheduleResult), null, 2)
          }]
        };

      case 'rpc_getInflationRate':
        const inflationRateResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getInflationRate',
          params: []
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(inflationRateResult), null, 2)
          }]
        };

      case 'rpc_getInflationReward':
        if (!Array.isArray(args.addresses) || args.addresses.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, getArrayValidationError(args.addresses, 'Addresses', '"So11111111111111111111111111111111111111112"'));
        }
        const inflRewardParams: any[] = [args.addresses];
        const inflRewardConfig: any = {};
        if (args.epoch !== undefined) inflRewardConfig.epoch = args.epoch;
        if (args.commitment) inflRewardConfig.commitment = args.commitment;
        if (Object.keys(inflRewardConfig).length > 0) inflRewardParams.push(inflRewardConfig);

        const inflRewardResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getInflationReward',
          params: inflRewardParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(inflRewardResult), null, 2)
          }]
        };

      case 'rpc_getTokenAccountsByDelegate':
        if (!isValidSolanaAddress(args.delegate)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.delegate, 'delegate'));
        }
        const tokenByDelegateParams: any[] = [args.delegate];
        const delegateFilterObj: any = {};
        if (args.mint) {
          if (!isValidSolanaAddress(args.mint)) {
            throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.mint, 'mint'));
          }
          delegateFilterObj.mint = args.mint;
        } else if (args.programId) {
          if (!isValidSolanaAddress(args.programId)) {
            throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.programId, 'program ID'));
          }
          delegateFilterObj.programId = args.programId;
        } else {
          delegateFilterObj.programId = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        }
        tokenByDelegateParams.push(delegateFilterObj);

        const delegateConfig: any = { encoding: args.encoding || 'jsonParsed' };
        if (args.commitment) delegateConfig.commitment = args.commitment;
        tokenByDelegateParams.push(delegateConfig);

        const tokenByDelegateResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getTokenAccountsByDelegate',
          params: tokenByDelegateParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(tokenByDelegateResult), null, 2)
          }]
        };

      case 'rpc_getTokenLargestAccounts':
        if (!isValidSolanaAddress(args.mint)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.mint, 'mint'));
        }
        const tokenLargestParams: any[] = [args.mint];
        if (args.commitment) tokenLargestParams.push({ commitment: args.commitment });

        const tokenLargestResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getTokenLargestAccounts',
          params: tokenLargestParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(tokenLargestResult), null, 2)
          }]
        };

      case 'rpc_getLargestAccounts':
        const largestAcctsParams: any[] = [];
        const largestAcctsConfig: any = {};
        if (args.filter) largestAcctsConfig.filter = args.filter;
        if (args.commitment) largestAcctsConfig.commitment = args.commitment;
        if (Object.keys(largestAcctsConfig).length > 0) largestAcctsParams.push(largestAcctsConfig);

        const largestAcctsResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getLargestAccounts',
          params: largestAcctsParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(largestAcctsResult), null, 2)
          }]
        };

      case 'rpc_getLeaderSchedule':
        const leaderSchedParams: any[] = [];
        const leaderSchedConfig: any = {};
        if (args.slot !== undefined) leaderSchedParams.push(args.slot);
        if (args.identity || args.commitment) {
          if (args.identity) leaderSchedConfig.identity = args.identity;
          if (args.commitment) leaderSchedConfig.commitment = args.commitment;
          leaderSchedParams.push(leaderSchedConfig);
        }

        const leaderSchedResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getLeaderSchedule',
          params: leaderSchedParams
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(leaderSchedResult), null, 2)
          }]
        };

      case 'rpc_minimumLedgerSlot':
        const minLedgerResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'minimumLedgerSlot',
          params: []
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(minLedgerResult), null, 2)
          }]
        };

      case 'rpc_getFirstAvailableBlock':
        const firstBlockResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getFirstAvailableBlock',
          params: []
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(firstBlockResult), null, 2)
          }]
        };

      // Utility Tools
      case 'solana_rpc_call':
        // Validate and cap limits for specific RPC methods that have Solana-imposed restrictions
        let params = args.params || [];

        // Handle methods with limit restrictions
        const limitRestrictedMethods = [
          'getSignaturesForAddress',
          'getConfirmedSignaturesForAddress2', // Deprecated but still used
          'getSignatures'
        ];

        if (limitRestrictedMethods.includes(args.method) && params.length > 1) {
          // These methods typically have the config object as the second parameter
          const config = params[1];
          if (config && typeof config === 'object' && 'limit' in config) {
            if (config.limit > 1000) {
              console.warn(`RPC method ${args.method}: limit ${config.limit} exceeds Solana maximum of 1000, capping to 1000`);
              params = [params[0], { ...config, limit: 1000 }];
            }
          }
        }

        const rpcResult = await this.client.post('/proxy/rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: args.method,
          params
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(this.flattenRpcResponse(rpcResult), null, 2)
          }]
        };

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OpenSVM API MCP server running on stdio');
  }
}

const server = new OpenSVMServer();
server.run().catch(console.error);
