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

// Environment configuration
const BASE_URL = process.env.OPENSVM_BASE_URL || 'https://osvm.ai/api';
const API_KEY = process.env.OPENSVM_API_KEY;
const JWT_TOKEN = process.env.OPENSVM_JWT_TOKEN;

/**
 * OpenSVM API Client wrapper
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
          }
        },
        // Transaction Tools
        {
          name: 'get_transaction',
          description: 'Get detailed transaction information with enhanced parsing',
          inputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature (base58, 87-88 chars)' }
            },
            required: ['signature']
          }
        },
        {
          name: 'batch_transactions',
          description: 'Batch fetch multiple transactions',
          inputSchema: {
            type: 'object',
            properties: {
              signatures: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of transaction signatures (max 20)',
                maxItems: 20
              },
              includeDetails: { type: 'boolean', description: 'Include detailed transaction information' }
            },
            required: ['signatures']
          }
        },
        {
          name: 'analyze_transaction',
          description: 'AI-powered transaction analysis',
          inputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature' },
              model: { type: 'string', description: 'AI model to use (optional)' }
            },
            required: ['signature']
          }
        },
        {
          name: 'explain_transaction',
          description: 'Get natural language explanation of a transaction',
          inputSchema: {
            type: 'object',
            properties: {
              signature: { type: 'string', description: 'Transaction signature' },
              language: { type: 'string', description: 'Output language (optional)' }
            },
            required: ['signature']
          }
        },
        // Account Tools
        {
          name: 'get_account_stats',
          description: 'Get account transaction statistics (total transactions, token transfers, last updated) - NOTE: Does NOT include balance! Use get_account_portfolio for SOL balance.',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address' }
            },
            required: ['address']
          }
        },
        {
          name: 'get_account_portfolio',
          description: 'Get complete account portfolio including SOL balance, token holdings, prices, and total portfolio value in USD',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address' }
            },
            required: ['address']
          }
        },
        {
          name: 'get_solana_balance',
          description: 'Get Solana (SOL) balance for an account - convenience wrapper around get_account_portfolio that returns only native SOL balance',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address' }
            },
            required: ['address']
          }
        },
        {
          name: 'get_account_transactions',
          description: 'Get account transaction history',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana account address' },
              limit: { type: 'number', description: 'Number of transactions to return (max 100)', maximum: 100 },
              before: { type: 'string', description: 'Pagination cursor' },
              type: { type: 'string', description: 'Transaction type filter' }
            },
            required: ['address']
          }
        },
        {
          name: 'get_account_token_stats',
          description: 'Get token statistics for specific account',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address' },
              mint: { type: 'string', description: 'Token mint address' }
            },
            required: ['address', 'mint']
          }
        },
        {
          name: 'check_account_type',
          description: 'Determine account type (wallet, program, token, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Account address to check' }
            },
            required: ['address']
          }
        },
        // Block Tools
        {
          name: 'get_block',
          description: 'Get specific block information',
          inputSchema: {
            type: 'object',
            properties: {
              slot: { type: 'number', description: 'Block slot number' }
            },
            required: ['slot']
          }
        },
        {
          name: 'get_recent_blocks',
          description: 'List recent blocks',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of blocks to return (default 20)' },
              before: { type: 'number', description: 'Slot number for pagination' }
            }
          }
        },
        {
          name: 'get_block_stats',
          description: 'Get block statistics and performance metrics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        // Search Tools
        {
          name: 'universal_search',
          description: 'Search across all data types (accounts, transactions, tokens, programs)',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query (address, signature, token name)' },
              type: { type: 'string', enum: ['account', 'transaction', 'token', 'program'], description: 'Filter by type' },
              start: { type: 'string', description: 'Start date ISO string' },
              end: { type: 'string', description: 'End date ISO string' },
              status: { type: 'string', enum: ['success', 'failed'], description: 'Transaction status filter' },
              min: { type: 'number', description: 'Minimum amount' },
              max: { type: 'number', description: 'Maximum amount' }
            },
            required: ['query']
          }
        },
        {
          name: 'search_accounts',
          description: 'Account-specific search with filters',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              tokenMint: { type: 'string', description: 'Filter by token mint address' },
              minBalance: { type: 'number', description: 'Minimum balance filter' },
              maxBalance: { type: 'number', description: 'Maximum balance filter' }
            },
            required: ['query']
          }
        },
        // Analytics Tools
        {
          name: 'get_defi_overview',
          description: 'Get comprehensive DeFi ecosystem overview',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_dex_analytics',
          description: 'Get DEX-specific analytics with real-time prices',
          inputSchema: {
            type: 'object',
            properties: {
              dex: { type: 'string', description: 'Specific DEX name' },
              timeframe: { type: 'string', enum: ['1h', '24h', '7d'], description: 'Time period' }
            }
          }
        },
        {
          name: 'get_defi_health',
          description: 'Get DeFi ecosystem health metrics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_validator_analytics',
          description: 'Get validator network analytics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        // Token & NFT Tools
        {
          name: 'get_token_info',
          description: 'Get token details and metadata',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Token mint address' }
            },
            required: ['address']
          }
        },
        {
          name: 'get_token_metadata',
          description: 'Batch token metadata lookup',
          inputSchema: {
            type: 'object',
            properties: {
              mints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of token mint addresses'
              }
            },
            required: ['mints']
          }
        },
        {
          name: 'get_nft_collections',
          description: 'List NFT collections',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of collections to return' },
              sort: { type: 'string', enum: ['volume', 'floor', 'items'], description: 'Sort criteria' }
            }
          }
        },
        {
          name: 'get_trending_nfts',
          description: 'Get trending NFT collections',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        // User Management Tools
        {
          name: 'verify_wallet_signature',
          description: 'Verify wallet signature for authentication',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Message that was signed' },
              signature: { type: 'string', description: 'Wallet signature' },
              publicKey: { type: 'string', description: 'Public key of the wallet' }
            },
            required: ['message', 'signature', 'publicKey']
          }
        },
        {
          name: 'get_user_history',
          description: 'Get user transaction history',
          inputSchema: {
            type: 'object',
            properties: {
              walletAddress: { type: 'string', description: 'User wallet address' },
              limit: { type: 'number', description: 'Number of transactions to return' }
            },
            required: ['walletAddress']
          }
        },
        // Monetization Tools
        {
          name: 'get_balance',
          description: 'Get user SVMAI token balance (requires JWT) - NOTE: This is for SVMAI tokens only, NOT Solana/SOL balance! Use get_account_stats or get_solana_balance for Solana account balance.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_usage_stats',
          description: 'Track API usage and metrics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'manage_api_keys',
          description: 'List, create, or manage API keys',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['list', 'create', 'delete'], description: 'Action to perform' },
              keyId: { type: 'string', description: 'Key ID for delete action' },
              name: { type: 'string', description: 'Name for new key' },
              permissions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Permissions for new key'
              }
            },
            required: ['action']
          }
        },
        // Infrastructure Tools
        {
          name: 'get_api_metrics',
          description: 'Get API performance metrics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'report_error',
          description: 'Report client-side errors',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Error message' },
              stack: { type: 'string', description: 'Error stack trace' },
              url: { type: 'string', description: 'URL where error occurred' },
              userAgent: { type: 'string', description: 'User agent string' }
            },
            required: ['message']
          }
        },
        // Program Registry Tools
        {
          name: 'get_program_registry',
          description: 'List registered Solana programs',
          inputSchema: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Program category filter' },
              verified: { type: 'boolean', description: 'Show only verified programs' }
            }
          }
        },
        {
          name: 'get_program_info',
          description: 'Get specific program details and metadata',
          inputSchema: {
            type: 'object',
            properties: {
              programId: { type: 'string', description: 'Program address' }
            },
            required: ['programId']
          }
        },
        // Utility Tools
        {
          name: 'solana_rpc_call',
          description: 'Make direct Solana RPC calls through OpenSVM proxy',
          inputSchema: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'RPC method name' },
              params: {
                type: 'array',
                description: 'RPC method parameters'
              }
            },
            required: ['method']
          }
        }
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
        // Return all tools
        const tools = [
          // Transaction Tools
          {
            name: 'get_transaction',
            description: 'Get detailed transaction information with enhanced parsing',
            inputSchema: {
              type: 'object',
              properties: {
                signature: { type: 'string', description: 'Transaction signature (base58, 87-88 chars)' }
              },
              required: ['signature']
            }
          },
          {
            name: 'batch_transactions',
            description: 'Batch fetch multiple transactions',
            inputSchema: {
              type: 'object',
              properties: {
                signatures: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of transaction signatures (max 20)',
                  maxItems: 20
                },
                includeDetails: { type: 'boolean', description: 'Include detailed transaction information' }
              },
              required: ['signatures']
            }
          },
          {
            name: 'analyze_transaction',
            description: 'AI-powered transaction analysis',
            inputSchema: {
              type: 'object',
              properties: {
                signature: { type: 'string', description: 'Transaction signature' },
                model: { type: 'string', description: 'AI model to use (optional)' }
              },
              required: ['signature']
            }
          },
          {
            name: 'explain_transaction',
            description: 'Get natural language explanation of a transaction',
            inputSchema: {
              type: 'object',
              properties: {
                signature: { type: 'string', description: 'Transaction signature' },
                language: { type: 'string', description: 'Output language (optional)' }
              },
              required: ['signature']
            }
          },
          // Account Tools
          {
            name: 'get_account_stats',
            description: 'Get account transaction statistics (total transactions, token transfers, last updated) - NOTE: Does NOT include balance! Use get_account_portfolio for SOL balance.',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Solana account address' }
              },
              required: ['address']
            }
          },
          {
            name: 'get_account_portfolio',
            description: 'Get complete account portfolio including SOL balance, token holdings, prices, and total portfolio value in USD',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Solana account address' }
              },
              required: ['address']
            }
          },
          {
            name: 'get_solana_balance',
            description: 'Get Solana (SOL) balance for an account - convenience wrapper around get_account_portfolio that returns only native SOL balance',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Solana account address' }
              },
              required: ['address']
            }
          },
          {
            name: 'get_account_transactions',
            description: 'Get account transaction history',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Solana account address' },
                limit: { type: 'number', description: 'Number of transactions to return (max 100)', maximum: 100 },
                before: { type: 'string', description: 'Pagination cursor' },
                type: { type: 'string', description: 'Transaction type filter' }
              },
              required: ['address']
            }
          },
          {
            name: 'get_account_token_stats',
            description: 'Get token statistics for specific account',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Account address' },
                mint: { type: 'string', description: 'Token mint address' }
              },
              required: ['address', 'mint']
            }
          },
          {
            name: 'check_account_type',
            description: 'Determine account type (wallet, program, token, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Account address to check' }
              },
              required: ['address']
            }
          },
          // Block Tools
          {
            name: 'get_block',
            description: 'Get specific block information',
            inputSchema: {
              type: 'object',
              properties: {
                slot: { type: 'number', description: 'Block slot number' }
              },
              required: ['slot']
            }
          },
          {
            name: 'get_recent_blocks',
            description: 'List recent blocks',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Number of blocks to return (default 20)' },
                before: { type: 'number', description: 'Slot number for pagination' }
              }
            }
          },
          {
            name: 'get_block_stats',
            description: 'Get block statistics and performance metrics',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          // Search Tools
          {
            name: 'universal_search',
            description: 'Search across all data types (accounts, transactions, tokens, programs)',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query (address, signature, token name)' },
                type: { type: 'string', enum: ['account', 'transaction', 'token', 'program'], description: 'Filter by type' },
                start: { type: 'string', description: 'Start date ISO string' },
                end: { type: 'string', description: 'End date ISO string' },
                status: { type: 'string', enum: ['success', 'failed'], description: 'Transaction status filter' },
                min: { type: 'number', description: 'Minimum amount' },
                max: { type: 'number', description: 'Maximum amount' }
              },
              required: ['query']
            }
          },
          {
            name: 'search_accounts',
            description: 'Account-specific search with filters',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                tokenMint: { type: 'string', description: 'Filter by token mint address' },
                minBalance: { type: 'number', description: 'Minimum balance filter' },
                maxBalance: { type: 'number', description: 'Maximum balance filter' }
              },
              required: ['query']
            }
          },
          // Analytics Tools
          {
            name: 'get_defi_overview',
            description: 'Get comprehensive DeFi ecosystem overview',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_dex_analytics',
            description: 'Get DEX-specific analytics with real-time prices',
            inputSchema: {
              type: 'object',
              properties: {
                dex: { type: 'string', description: 'Specific DEX name' },
                timeframe: { type: 'string', enum: ['1h', '24h', '7d'], description: 'Time period' }
              }
            }
          },
          {
            name: 'get_defi_health',
            description: 'Get DeFi ecosystem health metrics',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_validator_analytics',
            description: 'Get validator network analytics',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          // Token & NFT Tools
          {
            name: 'get_token_info',
            description: 'Get token details and metadata',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Token mint address' }
              },
              required: ['address']
            }
          },
          {
            name: 'get_token_metadata',
            description: 'Batch token metadata lookup',
            inputSchema: {
              type: 'object',
              properties: {
                mints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of token mint addresses'
                }
              },
              required: ['mints']
            }
          },
          {
            name: 'get_nft_collections',
            description: 'List NFT collections',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Number of collections to return' },
                sort: { type: 'string', enum: ['volume', 'floor', 'items'], description: 'Sort criteria' }
              }
            }
          },
          {
            name: 'get_trending_nfts',
            description: 'Get trending NFT collections',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          // User Management Tools
          {
            name: 'verify_wallet_signature',
            description: 'Verify wallet signature for authentication',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'Message that was signed' },
                signature: { type: 'string', description: 'Wallet signature' },
                publicKey: { type: 'string', description: 'Public key of the wallet' }
              },
              required: ['message', 'signature', 'publicKey']
            }
          },
          {
            name: 'get_user_history',
            description: 'Get user transaction history',
            inputSchema: {
              type: 'object',
              properties: {
                walletAddress: { type: 'string', description: 'User wallet address' },
                limit: { type: 'number', description: 'Number of transactions to return' }
              },
              required: ['walletAddress']
            }
          },
          // Monetization Tools
          {
            name: 'get_balance',
            description: 'Get user SVMAI token balance (requires JWT) - NOTE: This is for SVMAI tokens only, NOT Solana/SOL balance! Use get_account_stats or get_solana_balance for Solana account balance.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_usage_stats',
            description: 'Track API usage and metrics',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'manage_api_keys',
            description: 'List, create, or manage API keys',
            inputSchema: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['list', 'create', 'delete'], description: 'Action to perform' },
                keyId: { type: 'string', description: 'Key ID for delete action' },
                name: { type: 'string', description: 'Name for new key' },
                permissions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Permissions for new key'
                }
              },
              required: ['action']
            }
          },
          // Infrastructure Tools
          {
            name: 'get_api_metrics',
            description: 'Get API performance metrics',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'report_error',
            description: 'Report client-side errors',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'Error message' },
                stack: { type: 'string', description: 'Error stack trace' },
                url: { type: 'string', description: 'URL where error occurred' },
                userAgent: { type: 'string', description: 'User agent string' }
              },
              required: ['message']
            }
          },
          // Program Registry Tools
          {
            name: 'get_program_registry',
            description: 'List registered Solana programs',
            inputSchema: {
              type: 'object',
              properties: {
                category: { type: 'string', description: 'Program category filter' },
                verified: { type: 'boolean', description: 'Show only verified programs' }
              }
            }
          },
          {
            name: 'get_program_info',
            description: 'Get specific program details and metadata',
            inputSchema: {
              type: 'object',
              properties: {
                programId: { type: 'string', description: 'Program address' }
              },
              required: ['programId']
            }
          },
          // Utility Tools
          {
            name: 'solana_rpc_call',
            description: 'Make direct Solana RPC calls through OpenSVM proxy',
            inputSchema: {
              type: 'object',
              properties: {
                method: { type: 'string', description: 'RPC method name' },
                params: {
                  type: 'array',
                  description: 'RPC method parameters'
                }
              },
              required: ['method']
            }
          }
        ];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(tools, null, 2)
          }]
        };
      // Transaction Tools
      case 'get_transaction':
        if (!isValidTransactionSignature(args.signature)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid transaction signature format');
        }
        const txData = await this.client.get(`/transaction/${args.signature}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(txData, null, 2)
          }]
        };

      case 'batch_transactions':
        if (!Array.isArray(args.signatures) || args.signatures.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Signatures array is required');
        }
        const batchData = await this.client.post('/transaction/batch', {
          signatures: args.signatures,
          includeDetails: args.includeDetails ?? true
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(batchData, null, 2)
          }]
        };

      case 'analyze_transaction':
        if (!isValidTransactionSignature(args.signature)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid transaction signature format');
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
          throw new McpError(ErrorCode.InvalidParams, 'Invalid transaction signature format');
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
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid Solana address format');
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
          throw new McpError(ErrorCode.InvalidParams, 'Invalid Solana address format');
        }
        const portfolio = await this.client.get(`/account-portfolio/${args.address}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(portfolio, null, 2)
          }]
        };

      case 'get_solana_balance':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid Solana address format');
        }
        const portfolioData = await this.client.get(`/account-portfolio/${args.address}`);
        // Extract just the native SOL balance from portfolio
        const balanceInfo = {
          address: args.address,
          balance: portfolioData.native?.balance || 0,
          price: portfolioData.native?.price || 0,
          value: portfolioData.native?.value || 0,
          change24h: portfolioData.native?.change24h || 0
        };
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(balanceInfo, null, 2)
          }]
        };

      case 'get_account_transactions':
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid Solana address format');
        }
        const accountTxs = await this.client.get(`/account-transactions/${args.address}`, {
          limit: args.limit,
          before: args.before,
          type: args.type
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accountTxs, null, 2)
          }]
        };

      case 'get_account_token_stats':
        if (!isValidSolanaAddress(args.address) || !isValidSolanaAddress(args.mint)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid address or mint format');
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
          throw new McpError(ErrorCode.InvalidParams, 'Invalid Solana address format');
        }
        const accountType = await this.client.get('/check-account-type', {
          address: args.address
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(accountType, null, 2)
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
        if (!isValidSolanaAddress(args.address)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid token address format');
        }
        const tokenInfo = await this.client.get(`/token/${args.address}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(tokenInfo, null, 2)
          }]
        };

      case 'get_token_metadata':
        if (!Array.isArray(args.mints) || args.mints.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Mints array is required');
        }
        const tokenMetadata = await this.client.get('/token-metadata', {
          mints: args.mints.join(',')
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(tokenMetadata, null, 2)
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
            text: JSON.stringify(verifyResult, null, 2)
          }]
        };

      case 'get_user_history':
        if (!isValidSolanaAddress(args.walletAddress)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid wallet address format');
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
              throw new McpError(ErrorCode.InvalidParams, 'Key ID is required for delete action');
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
          throw new McpError(ErrorCode.InvalidParams, 'Invalid program ID format');
        }
        const programInfo = await this.client.get(`/program-registry/${args.programId}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(programInfo, null, 2)
          }]
        };

      // Utility Tools
      case 'solana_rpc_call':
        const rpcResult = await this.client.post('/solana-rpc', {
          jsonrpc: '2.0',
          id: Date.now(),
          method: args.method,
          params: args.params || []
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(rpcResult, null, 2)
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
