#!/usr/bin/env node

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

// Environment configuration
const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://osvm.ai/api';
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
      timeout: 30000,
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
          description: 'Get detailed transaction information. Returns: {signature, timestamp: number (ms), slot: number, success: boolean, type: "sol"|"token", details: {instructions: [...], accounts: [...], preBalances: number[], postBalances: number[], tokenChanges: [...], solChanges: [...], logs: string[]}}. Use case: Transaction verification, debugging failed transactions, analyzing program interactions, tracking token transfers.',
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
          description: 'Fetch multiple transactions in one call (up to 20). Returns: array of transaction objects. More efficient than individual calls. Use case: Bulk transaction analysis, historical data collection, parallel processing of multiple transactions.',
          inputSchema: {
            type: 'object',
            properties: {
              signatures: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of transaction signatures (max 20)',
                maxItems: 20
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
          description: 'AI-powered transaction analysis. Returns: structured analysis including detected programs, token transfers, NFT actions, DeFi interactions, security insights. Use case: Understand complex transactions, detect MEV, identify malicious behavior, explain DeFi operations.',
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
          description: 'Get human-readable explanation of transaction. Returns: natural language summary of what happened in the transaction. Use case: User-friendly transaction summaries, educational purposes, non-technical explanations.',
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
              signature: { type: 'string', description: 'Transaction signature' },
              explanation: { type: 'string', description: 'Human-readable explanation of the transaction' },
              language: { type: 'string', description: 'Language of explanation' }
            },
            required: ['signature', 'explanation']
          }
        },
        // Account Tools
        {
          name: 'get_account_stats',
          description: 'Get account activity statistics. Returns: {totalTransactions: string (e.g. "3000+"), tokenTransfers: number, lastUpdated: timestamp}. NOTE: Does NOT include balance! Use get_account_portfolio for SOL balance. Use case: Check account activity level, transaction volume analysis, bot detection.',
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
          description: 'Get complete account portfolio with prices. Returns: {address, timestamp, data: {native: {balance: number, symbol: "SOL", price: number, value: number, change24h: number}, tokens: [{balance, symbol, name, price, value}...], totalValue: number, totalTokens: number, summary: {hasData, dataSource, pricesAvailable}}}. Use case: Portfolio tracking, wallet analysis, asset valuation, DeFi position monitoring.',
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
          description: 'Get SOL balance and all token holdings (same as get_account_portfolio). Returns: {address, timestamp, native: {balance, symbol, name, decimals, price, value, change24h}, tokens: [...], totalValue, totalTokens, summary}. Use case: Quick balance check, portfolio overview, wallet monitoring.',
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
          description: 'Get paginated transaction history for account with optional date filtering. Returns: array of transaction objects with {signature, timestamp, slot, status, type}. Supports pagination via "before" cursor and date range filtering via startDate/endDate (ISO strings or Unix timestamps in ms). Note: Solana RPC enforces a maximum limit of 1000 transactions per request. Use case: Transaction history tracking, account activity analysis, audit trails, finding transactions in date ranges.',
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
          name: 'get_account_token_stats',
          description: 'Get specific token statistics for an account/mint pair. Returns: token balance, transfer count, and activity metrics for a specific token held by an account. Use case: Track specific token holdings, analyze token-specific activity, monitor airdrop claims.',
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
              address: { type: 'string', description: 'Account address' },
              mint: { type: 'string', description: 'Token mint address' },
              balance: { type: 'number', description: 'Token balance' },
              transferCount: { type: 'number', description: 'Number of transfers' },
              lastActivity: { type: 'number', description: 'Timestamp of last activity' }
            },
            required: ['address', 'mint']
          }
        },
        {
          name: 'check_account_type',
          description: 'Identify account type. Returns: {type: "wallet"|"program"|"token"|"nft"|"system", details: {...}}. Use case: Distinguish between user wallets, smart contracts, token accounts, validate address types before operations.',
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
          description: 'Get detailed block information by slot. Returns: {slot: number, blockhash: string, transactions: [...], blockTime: number, blockHeight: number}. Use case: Block verification, analyze block contents, find transactions in specific block, blockchain forensics.',
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
          description: 'Get list of recent blocks with pagination. Returns: array of {slot, blockhash, transactionCount, blockTime}. Use case: Monitor latest blocks, blockchain explorer, real-time block analysis.',
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
          description: 'Get blockchain statistics and performance metrics. Returns: {currentSlot, avgBlockTime, tps, recentBlockTimes: number[]}. Use case: Network performance monitoring, TPS calculation, blockchain health checks. Note: This endpoint is currently unavailable due to API issues.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              currentSlot: { type: 'number', description: 'Current blockchain slot' },
              avgBlockTime: { type: 'number', description: 'Average block time in milliseconds' },
              tps: { type: 'number', description: 'Transactions per second' },
              recentBlockTimes: { type: 'array', items: { type: 'number' }, description: 'Recent block times array' }
            }
          }
        },
        // Search Tools
        {
          name: 'universal_search',
          description: 'Universal search across accounts, transactions, tokens, programs. Returns: {results: [...], type: string, count: number}. Accepts addresses, signatures, token names. Use case: Find any blockchain entity, multi-type search, discovery, address/signature lookup.',
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
          description: 'Advanced account search with balance and token filters. Returns: array of account objects matching criteria. Use case: Find wallets by balance range, token holder search, whale detection, airdrop targeting.',
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
        // Analytics Tools
        {
          name: 'get_defi_overview',
          description: 'Get Solana DeFi ecosystem overview. Returns: {totalTvl: number, totalVolume24h: number, activeDexes: number, totalTransactions: number, topProtocols: [{name, tvl, volume24h, category}...]}. Use case: DeFi market analysis, TVL tracking, protocol comparison, market research.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              totalTvl: { type: 'number', description: 'Total value locked in DeFi protocols' },
              totalVolume24h: { type: 'number', description: '24-hour trading volume across all DEXes' },
              activeDexes: { type: 'number', description: 'Number of active DEX protocols' },
              totalTransactions: { type: 'number', description: 'Total number of DeFi transactions' },
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
              }
            }
          }
        },
        {
          name: 'get_dex_analytics',
          description: 'Get DEX-specific trading analytics. Returns: {dex: string, volume: number, trades: number, uniqueTraders: number, topPairs: [...], priceImpact: {...}}. Use case: DEX performance tracking, trading volume analysis, liquidity monitoring, arbitrage opportunities.',
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
          description: 'Get DeFi ecosystem health indicators. Returns: {riskScore: number, liquidityDepth: number, marketStability: number, alerts: string[]}. Use case: Risk assessment, market health monitoring, identify systemic risks, DeFi safety checks.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              riskScore: { type: 'number', description: 'Overall risk score (0-100)' },
              liquidityDepth: { type: 'number', description: 'Aggregate liquidity depth' },
              marketStability: { type: 'number', description: 'Market stability indicator' },
              alerts: { type: 'array', items: { type: 'string' }, description: 'Health alerts and warnings' }
            }
          }
        },
        {
          name: 'get_validator_analytics',
          description: 'Get Solana validator network statistics. Returns: {totalValidators: number, activeStake: number, averageCommission: number, decentralization: {...}, topValidators: [...]}. Use case: Network health monitoring, stake distribution analysis, validator selection, decentralization metrics.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'object',
            properties: {
              totalValidators: { type: 'number', description: 'Total number of validators' },
              activeStake: { type: 'number', description: 'Total active stake in lamports' },
              averageCommission: { type: 'number', description: 'Average validator commission percentage' },
              decentralization: { type: 'object', description: 'Decentralization metrics' },
              topValidators: { type: 'array', description: 'Top validators by stake' }
            }
          }
        },
        // Token & NFT Tools
        {
          name: 'get_token_info',
          description: 'Get SPL token details and metadata. Returns FLATTENED object with all fields at top level: {name: string, symbol: string, description: string, uri: string, decimals: number, holders: number, isInitialized: boolean, supply: number (raw amount with decimals), volume24h: number, price: number, priceChange24h: number, liquidity: number}. Metadata fields (name, symbol, description, uri) are at TOP LEVEL for easy access. Use case: Token research, verify token legitimacy, check supply/holders.',
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
          description: 'Batch fetch token metadata for multiple mints. Returns: array of {mint, metadata, supply, decimals}. More efficient than individual calls. Use case: Portfolio token info, multi-token analysis, batch validation.',
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
          description: 'List NFT collections with stats. Returns: array of {name, symbol, floorPrice, volume24h, totalItems, listed, verified}. Use case: NFT marketplace data, collection discovery, floor price tracking, volume analysis.',
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
          description: 'Get trending NFT collections (24h volume). Returns: array of trending collections sorted by volume spike. Use case: Identify hot NFT collections, market trends, viral collections, trading opportunities.',
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
          description: 'Verify Solana wallet signature for authentication. Returns: {valid: boolean, address: string}. Use case: Wallet-based auth, sign-in with Solana, verify message ownership, secure authentication.',
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
          description: 'Get user transaction history by wallet. Returns: array of user transactions. Use case: User activity tracking, transaction history display, account analysis.',
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
          description: 'Get SVMAI token balance for API billing (requires JWT auth). Returns: {balance: number, reserved: number, available: number, sufficient: boolean}. NOTE: This is SVMAI tokens for API payments, NOT Solana/SOL! Use get_account_portfolio for SOL balance. Use case: Check API credit balance, billing management, payment verification.',
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
          description: 'Get API usage statistics and billing info (requires JWT). Returns: {totalRequests: number, totalTokensSpent: number, avgCostPerRequest: number, recentTransactions: [...]}. Use case: Track API consumption, analyze costs, budget monitoring, usage optimization.',
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
          description: 'Manage Anthropic API keys (requires JWT). Actions: list (get all keys), create (generate new key), delete (revoke key). Returns: key objects with id, name, permissions, created date. Use case: API key lifecycle management, access control, security management.',
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
          description: 'Get OpenSVM API performance metrics. Returns: {uptime: number, avgResponseTime: number, requestsPerSecond: number, errorRate: number, cacheHitRate: number}. Use case: Monitor API health, performance tracking, SLA verification, system diagnostics.',
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
          description: 'Report client-side errors to OpenSVM. Returns: {reported: boolean, errorId: string}. Use case: Error tracking, bug reports, telemetry, improve API reliability.',
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
              reported: { type: 'boolean', description: 'Whether error was successfully reported' },
              errorId: { type: 'string', description: 'Unique error report ID' }
            },
            required: ['reported']
          }
        },
        // Program Registry Tools
        {
          name: 'get_program_registry',
          description: 'List registered Solana programs with metadata. Returns: array of {programId, name, category, verified: boolean, description, website, audit}. Use case: Discover Solana programs, program verification, integration research, find DeFi protocols.',
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
          description: 'Get detailed program information and metadata. Returns: {programId, name, category, verified, description, website, github, audit, deployDate, upgradeAuthority}. Use case: Program due diligence, verify program authenticity, integration validation, security research.',
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
            },
            required: ['programId']
          }
        },
        // Solana RPC Direct Methods (commonly used)
        {
          name: 'rpc_getAccountInfo',
          description: 'Get account information including lamports and owner. Returns NESTED: {context: {slot, apiVersion}, value: {lamports: number, owner: string, executable: boolean, rentEpoch: number, data: string/object}}. Access account data via: result.value.lamports, result.value.owner, etc. Use case: Check account details, verify account ownership, inspect account data.',
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
          description: 'Get SOL balance for an account in lamports. Returns NESTED: {context: {slot, apiVersion}, value: number (lamports)}. Access balance via: result.value (1 SOL = 1,000,000,000 lamports). Use case: Check wallet balance, verify payment received, monitor account funding.',
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
          description: 'Get information for multiple accounts in one call (up to 100). Returns NESTED: {context: {slot, apiVersion}, value: [{lamports, owner, executable, rentEpoch, data}, ...]}.  Access accounts via: result.value[0], result.value[1], etc. More efficient than individual getAccountInfo calls. Use case: Bulk account queries, portfolio analysis, multi-account validation.',
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
          description: 'Get all accounts owned by a program with optional filters. Returns: array of {pubkey, account} objects. Use case: Find token holders, query program state, discover accounts by criteria. WARNING: Can be slow for large programs - use filters!',
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
          description: 'Get transaction signatures for an address with pagination. Returns: array of {signature, slot, blockTime, err}. Max 1000 per request. Use case: Transaction history, signature lookup, activity monitoring.',
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
          description: 'Get current slot number. Returns: number (current slot). Use case: Timestamp transactions, monitor blockchain progress, calculate block times.',
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
          description: 'Get current block height. Returns: number (current block height). Use case: Monitor chain progress, calculate block confirmations, blockchain metrics.',
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
          description: 'Get latest blockhash and last valid block height. Returns: {blockhash: string, lastValidBlockHeight: number}. Use case: Transaction creation, determine transaction validity period, ensure timely submission.',
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
          description: 'Get SPL token balance for a token account. Returns NESTED: {context: {slot, apiVersion}, value: {amount: string (raw with decimals), decimals: number, uiAmount: number (human-readable), uiAmountString: string}}. Access balance via: result.value.uiAmount or result.value.amount. Use case: Check token balance, display formatted amounts, verify token transfers.',
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
          description: 'Get all SPL token accounts owned by an address. Filter by mint or program. Returns NESTED: {context: {slot, apiVersion}, value: [{pubkey: string, account: {data: {parsed: {info: {mint, owner, tokenAmount: {amount, decimals, uiAmount}}}}, lamports, owner}}]}. Access with jsonParsed encoding: result.value[0].account.data.parsed.info for token details. Use case: Portfolio queries, token holder analysis, wallet scanning.',
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
          description: 'Get total supply for an SPL token. Returns NESTED: {context: {slot, apiVersion}, value: {amount: string (raw with decimals), decimals: number, uiAmount: number (human-readable), uiAmountString: string}}. Access supply via: result.value.uiAmount or result.value.amount. Use case: Verify token supply, calculate market cap, monitor token issuance.',
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
          description: 'Get current epoch information. Returns: {epoch: number, slotIndex: number, slotsInEpoch: number, absoluteSlot: number, blockHeight: number}. Use case: Epoch calculations, staking info, network timing.',
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
          description: 'Get node health status. Returns: "ok" if healthy, error otherwise. Use case: Node monitoring, health checks, uptime verification.',
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
          description: 'Get Solana node version. Returns: {solana-core: string, feature-set: number}. Use case: Version verification, compatibility checks, node info.',
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
          description: 'Simulate transaction execution without submitting. Returns: {err: null/object, logs: string[], accounts: array}. Use case: Pre-flight checks, estimate compute units, debug transactions, validate before sending.',
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
          description: 'Submit signed transaction to the network. Returns: transaction signature (base58 string). Use case: Execute transactions, transfer tokens/SOL, invoke programs. NOTE: Transaction must be properly signed!',
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
          description: 'Get confirmed transaction details. Returns NESTED: {slot, transaction: {message, signatures}, meta: {err, fee, preBalances, postBalances, logMessages, preTokenBalances, postTokenBalances}, blockTime}. Access via: result.meta.err (null if success), result.meta.logMessages. Use case: Transaction verification, debugging, analyzing token transfers.',
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
          description: 'Get confirmed block with transactions. Returns NESTED: {blockhash, previousBlockhash, parentSlot, transactions: [...], rewards: [...], blockTime, blockHeight}. Access via: result.transactions, result.blockTime. Use case: Block analysis, transaction discovery, blockchain forensics.',
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
          description: 'Get minimum lamports required for rent exemption. Returns: number (lamports). Access via: result. Use case: Calculate rent for new accounts, transaction planning, account creation.',
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
          description: 'Request SOL airdrop (devnet/testnet only). Returns: transaction signature. Access via: result. Use case: Fund test wallets, development testing. NOTE: Only works on devnet/testnet!',
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
          description: 'Get statuses of transaction signatures. Returns NESTED: {context, value: [{slot, confirmations, err, confirmationStatus}, ...]}. Access via: result.value[0].err (null if success). Use case: Check transaction confirmation, monitor pending transactions.',
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
          description: 'Check if blockhash is still valid. Returns NESTED: {context, value: boolean}. Access via: result.value. Use case: Verify transaction validity window, prevent expired transactions.',
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
          description: 'Get recent prioritization fees for transactions. Returns: [{slot, prioritizationFee}, ...]. Access via: result[0].prioritizationFee. Use case: Estimate priority fees, optimize transaction cost, ensure timely execution.',
          inputSchema: {
            type: 'object',
            properties: {
              addresses: { type: 'array', items: { type: 'string' }, description: 'Account addresses to get fees for (optional, max 128)' }
            }
          }
        },
        {
          name: 'rpc_getFeeForMessage',
          description: 'Get fee for a message. Returns NESTED: {context, value: number (lamports)}. Access via: result.value. Use case: Calculate transaction fees before sending, budget planning.',
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
          description: 'Get total transaction count on the blockchain. Returns: number (total transactions). Access via: result. Use case: Network statistics, blockchain metrics.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          }
        },
        {
          name: 'rpc_getBlockTime',
          description: 'Get estimated block time (Unix timestamp). Returns: number (Unix timestamp in seconds) or null. Access via: result. Use case: Convert slot to time, historical analysis.',
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
            description: 'Total number of transactions processed'
          }
        },
        {
          name: 'rpc_getSlotLeader',
          description: 'Get current slot leader. Returns: string (validator identity pubkey). Access via: result. Use case: Validator monitoring, network analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          }
        },
        {
          name: 'rpc_getSlotLeaders',
          description: 'Get slot leaders for a range. Returns: array of validator identity pubkeys. Access via: result[0], result[1], etc. Use case: Leader schedule, validator rotation analysis.',
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
            type: 'string',
            description: 'Validator identity pubkey for current slot leader'
          }
        },
        {
          name: 'rpc_getVoteAccounts',
          description: 'Get validator vote accounts. Returns NESTED: {current: [{votePubkey, nodePubkey, activatedStake, commission, ...}], delinquent: [...]}. Access via: result.current, result.delinquent. Use case: Validator selection, staking analysis, network health.',
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
          description: 'Get total SOL supply information. Returns NESTED: {context, value: {total, circulating, nonCirculating, nonCirculatingAccounts}}. Access via: result.value.total, result.value.circulating. Use case: Economics analysis, market cap calculations.',
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
          description: 'Get cluster node information. Returns: [{pubkey, gossip, tpu, rpc, version, featureSet, shredVersion}, ...]. Access via: result[0].pubkey. Use case: Network topology, RPC endpoint discovery, version monitoring.',
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
          description: 'Get epoch schedule. Returns: {slotsPerEpoch, leaderScheduleSlotOffset, warmup, firstNormalEpoch, firstNormalSlot}. Access via: result.slotsPerEpoch. Use case: Epoch calculations, timing analysis.',
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
          description: 'Get current inflation rate. Returns: {total, validator, foundation, epoch}. Access via: result.total, result.validator. Use case: Economics analysis, staking rewards estimation.',
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
          description: 'Get inflation rewards for addresses. Returns: [{epoch, effectiveSlot, amount, postBalance, commission}, ...] or null. Access via: result[0].amount. Use case: Staking reward tracking, validator performance.',
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
          name: 'rpc_getEpochSchedule',
          description: 'Get epoch schedule information. Returns: {slotsPerEpoch, leaderScheduleSlotOffset, warmup, firstNormalEpoch, firstNormalSlot}. Use case: Calculate epoch boundaries, timing predictions.',
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
          name: 'rpc_getClusterNodes',
          description: 'Get cluster node information. Returns: array of {pubkey, gossip, tpu, rpc, version}. Use case: Network topology, node discovery, cluster health.',
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
          name: 'rpc_getSupply',
          description: 'Get information about current supply. Returns NESTED: {context, value: {total, circulating, nonCirculating, nonCirculatingAccounts}}. Use case: Economic analysis, circulating supply tracking.',
          inputSchema: {
            type: 'object',
            properties: {
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
          name: 'rpc_getVoteAccounts',
          description: 'Get vote account status. Returns: {current: array, delinquent: array}. Use case: Validator voting status, stake distribution.',
          inputSchema: {
            type: 'object',
            properties: {
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
          name: 'rpc_getTokenAccountsByDelegate',
          description: 'Get token accounts by delegate authority. Returns NESTED: {context, value: [{pubkey, account: {data: {parsed: {info: {...}}}}}]}. Access via: result.value[0].account.data.parsed.info. Use case: Delegated account management, DeFi applications.',
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
          description: 'Get largest token accounts by balance. Returns NESTED: {context, value: [{address, amount, decimals, uiAmount, uiAmountString}, ...]}. Access via: result.value[0].uiAmount. Use case: Whale watching, token distribution analysis, holder rankings.',
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
          description: 'Get largest accounts by SOL balance. Returns NESTED: {context, value: [{address, lamports}, ...]}. Access via: result.value[0].lamports. Use case: Whale watching, richlist analysis.',
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
          description: 'Get leader schedule for an epoch. Returns: {validatorPubkey: [slot1, slot2, ...], ...} or null. Access via: result[validatorPubkey]. Use case: Validator schedule, leader prediction.',
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
          description: 'Get lowest slot that the node has ledger information for. Returns: number (slot). Access via: result. Use case: Data availability check, historical query validation.',
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
          description: 'Get first available block in the ledger. Returns: number (slot). Access via: result. Use case: Historical data boundaries, ledger pruning info.',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          outputSchema: {
            type: 'number',
            description: 'Slot of the first available block in the ledger'
          }
        },
        {
          name: 'rpc_getBlockHeight',
          description: 'Get current block height (different from slot). Returns NESTED: number. Access via: result. Use case: Block confirmations, chain progress tracking.',
          inputSchema: {
            type: 'object',
            properties: {
              commitment: { type: 'string', enum: ['processed', 'confirmed', 'finalized'], description: 'Commitment level (default: finalized)' }
            }
          }
        },
        // Utility Tools
        {
          name: 'solana_rpc_call',
          description: 'Make direct Solana RPC calls through OpenSVM proxy. Returns: standard Solana RPC response for the method. Supports all 51 Solana RPC methods. Use case: Access methods not wrapped by other tools (getVoteAccounts, getInflationRate, etc.), custom RPC queries, advanced blockchain operations.',
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
          description: 'List all available tools (compatibility shim for stdio transport)',
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
        const txData = await this.client.get(`/transaction/${args.signature}`);

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
          // Remove nested details object
          details: undefined
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(flattenedTx, null, 2)
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
            text: JSON.stringify(flattenedBatch, null, 2)
          }]
        };

      case 'analyze_transaction':
        if (!isValidTransactionSignature(args.signature)) {
          throw new McpError(ErrorCode.InvalidParams, getSignatureValidationError(args.signature));
        }
        const analysis = await this.client.get(`/transaction/${args.signature}/analysis`, {
          model: args.model
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(analysis, null, 2)
          }]
        };

      case 'explain_transaction':
        if (!isValidTransactionSignature(args.signature)) {
          throw new McpError(ErrorCode.InvalidParams, getSignatureValidationError(args.signature));
        }
        const explanation = await this.client.get(`/transaction/${args.signature}/explain`, {
          language: args.language
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(explanation, null, 2)
          }]
        };

      // Account Tools
      case 'get_account_stats':
        autoCorrectParam(args, 'address', ['wallet', 'account', 'pubkey', 'publicKey'], 'get_account_stats');
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const accountStats = await this.client.get(`/account-stats/${args.address}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accountStats, null, 2)
          }]
        };

      case 'get_account_portfolio':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const portfolio = await this.client.get(`/account-portfolio/${args.address}`);

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
            text: JSON.stringify(flattenedPortfolio, null, 2)
          }]
        };

      case 'get_solana_balance':
        autoCorrectParam(args, 'address', ['wallet', 'account', 'pubkey', 'publicKey'], 'get_solana_balance');
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const portfolioData = await this.client.get(`/account-portfolio/${args.address}`);
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
            text: JSON.stringify(balanceInfo, null, 2)
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
        const accountTxs = await this.client.get(`/account-transactions/${args.address}`, {
          limit,
          before: args.before,
          type: args.type,
          startDate: args.startDate,
          endDate: args.endDate
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accountTxs, null, 2)
          }]
        };

      case 'get_account_token_stats':
        if (!isValidSolanaAddress(args.address) || !isValidSolanaAddress(args.mint)) {
          throw new McpError(ErrorCode.InvalidParams, getMultiAddressValidationError(args.address, args.mint));
        }
        const tokenStats = await this.client.get(`/account-token-stats/${args.address}/${args.mint}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(tokenStats, null, 2)
          }]
        };

      case 'check_account_type':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const accountType = await this.client.get('/check-account-type', {
          address: args.address
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
            text: JSON.stringify(flattenedAccountType, null, 2)
          }]
        };

      // Block Tools
      case 'get_block':
        const blockData = await this.client.get(`/blocks/${args.slot}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(blockData, null, 2)
          }]
        };

      case 'get_recent_blocks':
        const recentBlocks = await this.client.get('/blocks', {
          limit: args.limit,
          before: args.before
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(recentBlocks, null, 2)
          }]
        };

      case 'get_block_stats':
        // Note: This endpoint currently returns an error from the API
        // Keeping the tool for future use when the API is fixed
        const blockStats = await this.client.get('/blocks/stats');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(blockStats, null, 2)
          }]
        };

      // Search Tools
      case 'universal_search':
        const searchResults = await this.client.get('/search', {
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
            text: JSON.stringify(searchResults, null, 2)
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
            text: JSON.stringify(accountSearch, null, 2)
          }]
        };

      // Analytics Tools
      case 'get_defi_overview':
        const defiOverview = await this.client.get('/analytics/overview');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(defiOverview, null, 2)
          }]
        };

      case 'get_dex_analytics':
        const dexAnalytics = await this.client.get('/analytics/dex', {
          dex: args.dex,
          timeframe: args.timeframe
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(dexAnalytics, null, 2)
          }]
        };

      case 'get_defi_health':
        const defiHealth = await this.client.get('/analytics/defi-health');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(defiHealth, null, 2)
          }]
        };

      case 'get_validator_analytics':
        const validatorAnalytics = await this.client.get('/analytics/validators');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(validatorAnalytics, null, 2)
          }]
        };

      // Token & NFT Tools
      case 'get_token_info':
        autoCorrectParam(args, 'address', ['mint', 'token', 'tokenAddress', 'mintAddress'], 'get_token_info');
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, getAddressValidationError(args.address));
        }
        const tokenInfo = await this.client.get(`/token/${args.address}`);

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
            text: JSON.stringify(flattenedTokenInfo, null, 2)
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
        const tokenMetadata = await this.client.get('/token-metadata', {
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
            text: JSON.stringify(flattenedMetadata, null, 2)
          }]
        };

      case 'get_nft_collections':
        const nftCollections = await this.client.get('/nft-collections', {
          limit: args.limit,
          sort: args.sort
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(nftCollections, null, 2)
          }]
        };

      case 'get_trending_nfts':
        const trendingNFTs = await this.client.get('/nft-collections/trending');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(trendingNFTs, null, 2)
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
        const userHistory = await this.client.get(`/user-history/${args.walletAddress}`, {
          limit: args.limit
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(userHistory, null, 2)
          }]
        };

      // Monetization Tools
      case 'get_balance':
        const balance = await this.client.get('/opensvm/balance');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(balance, null, 2)
          }]
        };

      case 'get_usage_stats':
        const usage = await this.client.get('/opensvm/usage');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(usage, null, 2)
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
            text: JSON.stringify(result, null, 2)
          }]
        };

      // Infrastructure Tools
      case 'get_api_metrics':
        const metrics = await this.client.get('/monitoring/api');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(metrics, null, 2)
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
            text: JSON.stringify(errorReport, null, 2)
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
            text: JSON.stringify(programs, null, 2)
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
            text: JSON.stringify(programInfo, null, 2)
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
