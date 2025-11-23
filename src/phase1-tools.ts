/**
 * Phase 1 Tools: Trading Terminal & OpenSVM Credits/Usage
 *
 * This file contains tool definitions and handlers for:
 * - Trading terminal operations (9 tools)
 * - OpenSVM credits and API key management (6 tools)
 *
 * Total: 15 new tools
 */

export const phase1ToolDefinitions = [
  // ============================================================================
  // TRADING TERMINAL TOOLS
  // ============================================================================
  {
    name: 'trading_get_markets',
    description: 'List all tradeable tokens/markets with real-time data. Supports filtering by DEX (raydium, orca, etc) and market type (trending, top, new). Request: {type?: "trending"|"top"|"new", limit?: number, dex?: string} Response: [{symbol, name, price, volume24h, change24h, liquidity, dex}] Use case: Market discovery, finding trading opportunities, DEX comparison.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['trending', 'top', 'new'],
          description: 'Market type filter: trending (hot tokens), top (by volume), new (recently listed)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of markets to return (default 50)',
          minimum: 1,
          maximum: 200
        },
        dex: {
          type: 'string',
          description: 'Filter by DEX name (e.g., "raydium", "orca", "jupiter")'
        }
      }
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mint: { type: 'string', description: 'Token mint address' },
          symbol: { type: 'string', description: 'Token symbol' },
          name: { type: 'string', description: 'Token name' },
          price: { type: 'number', description: 'Current price in USD' },
          volume24h: { type: 'number', description: '24h trading volume' },
          change24h: { type: 'number', description: '24h price change %' },
          liquidity: { type: 'number', description: 'Total liquidity' },
          dex: { type: 'string', description: 'Primary DEX' }
        }
      }
    }
  },
  {
    name: 'trading_get_pools',
    description: 'Get all trading pools/pairs for a specific token across multiple DEXes. Shows where token can be traded and pool liquidity. Request: {token: string} Response: [{poolAddress, dex, pair, price, liquidity, volume24h, apy}] Use case: Finding best liquidity, comparing DEX prices, identifying arbitrage opportunities.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token mint address (base58, 32-44 chars)'
        },
        symbol: {
          type: 'string',
          description: 'Token symbol (alternative to mint address)'
        },
        dex: {
          type: 'string',
          description: 'Filter by specific DEX'
        }
      },
      required: ['token']
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          poolAddress: { type: 'string', description: 'Pool/pair address' },
          dex: { type: 'string', description: 'DEX name' },
          pair: { type: 'string', description: 'Trading pair (e.g., "SOL/USDC")' },
          price: { type: 'number', description: 'Current pool price' },
          liquidity: { type: 'number', description: 'Pool liquidity' },
          volume24h: { type: 'number', description: '24h volume' },
          apy: { type: 'number', description: 'Annual percentage yield' }
        }
      }
    }
  },
  {
    name: 'trading_get_market_data',
    description: 'Get comprehensive real-time market data for a token including OHLCV, volume, and price action. Request: {mint: string, endpoint?: string} Response: {price, volume24h, priceChange24h, high24h, low24h, marketCap, holders} Use case: Technical analysis, price monitoring, market overview.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: {
          type: 'string',
          description: 'Token mint address'
        },
        endpoint: {
          type: 'string',
          description: 'Specific data endpoint (price, volume, holders, etc)'
        },
        baseMint: {
          type: 'string',
          description: 'Base token for pair (default: SOL)'
        },
        poolAddress: {
          type: 'string',
          description: 'Specific pool to query'
        }
      },
      required: ['mint']
    },
    outputSchema: {
      type: 'object',
      properties: {
        price: { type: 'number', description: 'Current price' },
        volume24h: { type: 'number', description: '24h volume' },
        priceChange24h: { type: 'number', description: '24h price change %' },
        high24h: { type: 'number', description: '24h high' },
        low24h: { type: 'number', description: '24h low' },
        marketCap: { type: 'number', description: 'Market capitalization' },
        holders: { type: 'number', description: 'Total holders' },
        liquidity: { type: 'number', description: 'Total liquidity' }
      }
    }
  },
  {
    name: 'trading_get_trades',
    description: 'Get recent trades for a token with buyer/seller info, amounts, and timestamps. Real-time trade feed. Request: {mint: string, limit?: number, source?: "birdeye"|"mock"} Response: [{signature, timestamp, side: "buy"|"sell", price, amount, volumeUSD, trader}] Use case: Watching whale activity, analyzing trade patterns, monitoring market sentiment.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: {
          type: 'string',
          description: 'Token mint address (use "So11111111111111111111111111111111111111112" for SOL)'
        },
        limit: {
          type: 'number',
          description: 'Number of trades to return (max 100)',
          minimum: 1,
          maximum: 100
        },
        source: {
          type: 'string',
          enum: ['auto', 'birdeye', 'mock'],
          description: 'Data source: auto (intelligent fallback), birdeye (real API), mock (test data)'
        }
      },
      required: ['mint']
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          signature: { type: 'string', description: 'Transaction signature' },
          timestamp: { type: 'number', description: 'Unix timestamp' },
          blockTime: { type: 'number', description: 'Block time' },
          side: { type: 'string', enum: ['buy', 'sell'], description: 'Trade direction' },
          price: { type: 'number', description: 'Trade price' },
          amount: { type: 'number', description: 'Trade amount' },
          volumeUSD: { type: 'number', description: 'Trade volume in USD' },
          trader: { type: 'string', description: 'Trader wallet address' },
          source: { type: 'string', description: 'DEX source' }
        }
      }
    }
  },
  {
    name: 'trading_get_positions',
    description: 'List user trading positions (open, closed, or all). Track P&L, entry/exit prices, and position status. Request: {status?: "open"|"closed"|"all", symbol?: string} Response: [{id, symbol, side, entryPrice, currentPrice, amount, pnl, unrealizedPnl, openTime}] Use case: Portfolio tracking, P&L monitoring, position management.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Specific position ID to query'
        },
        status: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          description: 'Filter by position status (default: open)'
        },
        symbol: {
          type: 'string',
          description: 'Filter by token symbol'
        }
      }
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Position ID' },
          symbol: { type: 'string', description: 'Token symbol' },
          side: { type: 'string', enum: ['long', 'short'], description: 'Position side' },
          entryPrice: { type: 'number', description: 'Entry price' },
          currentPrice: { type: 'number', description: 'Current market price' },
          amount: { type: 'number', description: 'Position size' },
          pnl: { type: 'number', description: 'Realized P&L' },
          unrealizedPnl: { type: 'number', description: 'Unrealized P&L' },
          openTime: { type: 'number', description: 'Position open timestamp' },
          closeTime: { type: 'number', description: 'Position close timestamp (if closed)' }
        }
      }
    }
  },
  {
    name: 'trading_create_position',
    description: 'Open a new trading position (long or short). Requires authentication. Request: {symbol: string, side: "long"|"short", amount: number, leverage?: number} Response: {id, symbol, side, entryPrice, amount, status: "pending"|"open"} Use case: Opening trades, automated trading strategies.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Token symbol or mint address'
        },
        side: {
          type: 'string',
          enum: ['long', 'short'],
          description: 'Position side: long (buy) or short (sell)'
        },
        amount: {
          type: 'number',
          description: 'Position size in tokens',
          minimum: 0
        },
        leverage: {
          type: 'number',
          description: 'Leverage multiplier (1-10x)',
          minimum: 1,
          maximum: 10
        },
        slippage: {
          type: 'number',
          description: 'Maximum slippage tolerance %',
          minimum: 0,
          maximum: 50
        }
      },
      required: ['symbol', 'side', 'amount']
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Position ID' },
        symbol: { type: 'string', description: 'Token symbol' },
        side: { type: 'string', description: 'Position side' },
        entryPrice: { type: 'number', description: 'Entry price' },
        amount: { type: 'number', description: 'Position size' },
        status: { type: 'string', description: 'Position status' },
        transaction: { type: 'string', description: 'Transaction signature' }
      }
    }
  },
  {
    name: 'trading_close_position',
    description: 'Close an open trading position. Calculates final P&L. Request: {id: string, closeAll?: boolean} Response: {id, closePrice, pnl, status: "closed"} Use case: Taking profits, cutting losses, position management.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Position ID to close'
        },
        closeAll: {
          type: 'boolean',
          description: 'Close all open positions (requires confirmation)'
        },
        symbol: {
          type: 'string',
          description: 'Close all positions for this symbol'
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Position ID' },
        closePrice: { type: 'number', description: 'Close price' },
        pnl: { type: 'number', description: 'Realized P&L' },
        fees: { type: 'number', description: 'Trading fees' },
        status: { type: 'string', description: 'Position status' },
        transaction: { type: 'string', description: 'Transaction signature' }
      }
    }
  },
  {
    name: 'trading_execute_trade',
    description: 'Execute an immediate market trade (buy/sell) without creating a managed position. Direct swap execution. Request: {symbol: string, side: "buy"|"sell", amount: number, slippage?: number} Response: {orderId, signature, status, executedPrice, executedAmount} Use case: Quick swaps, arbitrage, DCA strategies.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Token symbol or mint address to trade'
        },
        side: {
          type: 'string',
          enum: ['buy', 'sell'],
          description: 'Trade side: buy or sell'
        },
        amount: {
          type: 'number',
          description: 'Trade amount in tokens',
          minimum: 0
        },
        slippage: {
          type: 'number',
          description: 'Maximum slippage tolerance % (default 1%)',
          minimum: 0,
          maximum: 50
        },
        dex: {
          type: 'string',
          description: 'Preferred DEX for routing (jupiter, raydium, orca)'
        }
      },
      required: ['symbol', 'side', 'amount']
    },
    outputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID' },
        signature: { type: 'string', description: 'Transaction signature' },
        status: { type: 'string', description: 'Execution status' },
        executedPrice: { type: 'number', description: 'Actual execution price' },
        executedAmount: { type: 'number', description: 'Actual executed amount' },
        slippageActual: { type: 'number', description: 'Actual slippage %' },
        fees: { type: 'number', description: 'Total fees paid' }
      }
    }
  },
  {
    name: 'trading_chat',
    description: 'Interactive AI chat interface for trading terminal. Ask questions about markets, get trade suggestions, analyze positions. Request: {message: string, context?: object} Response: {reply: string, suggestions?: [], data?: object} Use case: Natural language trading interface, market analysis, trade recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'User message or query about trading'
        },
        context: {
          type: 'object',
          description: 'Optional context (current positions, preferences, etc)'
        }
      },
      required: ['message']
    },
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string', description: 'AI response' },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Follow-up suggestions'
        },
        data: {
          type: 'object',
          description: 'Additional structured data (markets, prices, etc)'
        },
        actions: {
          type: 'array',
          items: { type: 'object' },
          description: 'Suggested trading actions'
        }
      }
    }
  },

  // ============================================================================
  // OPENSVM CREDITS & USAGE TOOLS
  // ============================================================================
  {
    name: 'opensvm_list_keys',
    description: 'List all Anthropic API keys associated with your account. Shows key name, status, usage stats, and creation date. Request: {} Response: [{keyId, name, status, usage, created}] Use case: Key management, usage monitoring, security auditing.',
    inputSchema: {
      type: 'object',
      properties: {
        keyId: {
          type: 'string',
          description: 'Optional: Get specific key by ID'
        }
      }
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyId: { type: 'string', description: 'API key ID' },
          name: { type: 'string', description: 'Key name/label' },
          keyPrefix: { type: 'string', description: 'Key prefix (first 8 chars)' },
          status: { type: 'string', enum: ['active', 'inactive', 'revoked'], description: 'Key status' },
          usage: {
            type: 'object',
            properties: {
              requests: { type: 'number' },
              tokens: { type: 'number' },
              cost: { type: 'number' }
            }
          },
          created: { type: 'string', description: 'Creation timestamp' },
          lastUsed: { type: 'string', description: 'Last usage timestamp' }
        }
      }
    }
  },
  {
    name: 'opensvm_create_key',
    description: 'Create a new Anthropic API key for your account. Requires authentication. Request: {name: string, description?: string} Response: {keyId, apiKey, name, created} Use case: Setting up new integrations, rotating keys, creating project-specific keys.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Key name/label for identification',
          minLength: 1,
          maxLength: 100
        },
        description: {
          type: 'string',
          description: 'Optional key description',
          maxLength: 500
        },
        rateLimit: {
          type: 'number',
          description: 'Optional rate limit (requests per minute)'
        }
      },
      required: ['name']
    },
    outputSchema: {
      type: 'object',
      properties: {
        keyId: { type: 'string', description: 'Key ID' },
        apiKey: { type: 'string', description: 'Full API key (shown only once)' },
        name: { type: 'string', description: 'Key name' },
        status: { type: 'string', description: 'Key status' },
        created: { type: 'string', description: 'Creation timestamp' }
      }
    }
  },
  {
    name: 'opensvm_delete_key',
    description: 'Delete/revoke an Anthropic API key. This action is irreversible. Request: {keyId: string} Response: {success: boolean, message: string} Use case: Key rotation, security incidents, cleanup unused keys.',
    inputSchema: {
      type: 'object',
      properties: {
        keyId: {
          type: 'string',
          description: 'API key ID to delete'
        }
      },
      required: ['keyId']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Deletion success' },
        message: { type: 'string', description: 'Result message' },
        deletedAt: { type: 'string', description: 'Deletion timestamp' }
      }
    }
  },
  {
    name: 'opensvm_get_key_stats',
    description: 'Get aggregated statistics for all API keys. Shows total usage, costs, and trends. Request: {} Response: {totalKeys, activeKeys, totalUsage: {requests, tokens, cost}, trends} Use case: Usage overview, cost monitoring, capacity planning.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    outputSchema: {
      type: 'object',
      properties: {
        totalKeys: { type: 'number', description: 'Total number of keys' },
        activeKeys: { type: 'number', description: 'Number of active keys' },
        totalUsage: {
          type: 'object',
          properties: {
            requests: { type: 'number', description: 'Total requests' },
            tokens: { type: 'number', description: 'Total tokens used' },
            cost: { type: 'number', description: 'Total cost in USD' }
          }
        },
        trends: {
          type: 'object',
          properties: {
            daily: { type: 'array', description: 'Daily usage trend' },
            weekly: { type: 'array', description: 'Weekly usage trend' }
          }
        }
      }
    }
  },
  {
    name: 'opensvm_get_usage',
    description: 'Get detailed usage metrics with advanced filtering and grouping. Supports filtering by key, model, date range, cost range, and token count. Request: {period?: string, keyId?: string, model?: string, startDate?: string, endDate?: string, minCost?: number, maxCost?: number, groupBy?: string} Response: {usage: [], summary: {}, metadata: {}} Use case: Detailed usage analysis, cost attribution, billing reconciliation, usage optimization.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month', 'all'],
          description: 'Time period for aggregation'
        },
        keyId: {
          type: 'string',
          description: 'Filter by specific API key'
        },
        model: {
          type: 'string',
          description: 'Filter by Claude model (claude-3-opus, claude-3-sonnet, etc)'
        },
        startDate: {
          type: 'string',
          format: 'date-time',
          description: 'Start date for filtering (ISO 8601)'
        },
        endDate: {
          type: 'string',
          format: 'date-time',
          description: 'End date for filtering (ISO 8601)'
        },
        minCost: {
          type: 'number',
          description: 'Minimum cost filter (USD)'
        },
        maxCost: {
          type: 'number',
          description: 'Maximum cost filter (USD)'
        },
        minTokens: {
          type: 'number',
          description: 'Minimum tokens filter'
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens filter'
        },
        status: {
          type: 'string',
          enum: ['success', 'error', 'all'],
          description: 'Filter by request status'
        },
        sortBy: {
          type: 'string',
          enum: ['date', 'cost', 'tokens', 'duration'],
          description: 'Sort field'
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order'
        },
        limit: {
          type: 'number',
          description: 'Maximum records to return',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          description: 'Pagination offset'
        },
        groupBy: {
          type: 'string',
          enum: ['key', 'model', 'date', 'status'],
          description: 'Group results by field'
        },
        includeMetadata: {
          type: 'boolean',
          description: 'Include request metadata'
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        usage: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', description: 'Request timestamp' },
              keyId: { type: 'string', description: 'API key used' },
              model: { type: 'string', description: 'Claude model' },
              tokens: { type: 'number', description: 'Tokens used' },
              cost: { type: 'number', description: 'Cost in USD' },
              duration: { type: 'number', description: 'Request duration ms' },
              status: { type: 'string', description: 'Request status' }
            }
          }
        },
        summary: {
          type: 'object',
          properties: {
            totalRequests: { type: 'number' },
            totalTokens: { type: 'number' },
            totalCost: { type: 'number' },
            avgTokensPerRequest: { type: 'number' },
            avgCostPerRequest: { type: 'number' }
          }
        },
        metadata: {
          type: 'object',
          properties: {
            period: { type: 'string' },
            filters: { type: 'object' },
            totalRecords: { type: 'number' },
            hasMore: { type: 'boolean' }
          }
        }
      }
    }
  },
  {
    name: 'opensvm_get_balance',
    description: 'Get current credit balance and usage limits. Shows available credits, used credits, and billing cycle info. Request: {} Response: {balance, used, limit, cycleStart, cycleEnd, billingStatus} Use case: Budget monitoring, usage alerts, spending limits.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    outputSchema: {
      type: 'object',
      properties: {
        balance: { type: 'number', description: 'Available credit balance (USD)' },
        used: { type: 'number', description: 'Credits used this cycle (USD)' },
        limit: { type: 'number', description: 'Credit limit (USD)' },
        percentage: { type: 'number', description: 'Usage percentage' },
        cycleStart: { type: 'string', description: 'Billing cycle start date' },
        cycleEnd: { type: 'string', description: 'Billing cycle end date' },
        billingStatus: {
          type: 'string',
          enum: ['active', 'warning', 'suspended'],
          description: 'Billing account status'
        },
        estimatedCost: { type: 'number', description: 'Projected cost for cycle' }
      }
    }
  }
];

// Export tool handler implementations
export const phase1ToolHandlers = {
  // Trading Terminal Handlers
  async trading_get_markets(client: any, args: any) {
    const params: any = {};
    if (args.type) params.type = args.type;
    if (args.limit) params.limit = Math.min(args.limit, 200);
    if (args.dex) params.dex = args.dex;

    return await client.get('/api/trading/markets', { params });
  },

  async trading_get_pools(client: any, args: any) {
    const params: any = { token: args.token };
    if (args.symbol) params.symbol = args.symbol;
    if (args.dex) params.dex = args.dex;

    return await client.get('/api/trading/pools', { params });
  },

  async trading_get_market_data(client: any, args: any) {
    const params: any = { mint: args.mint };
    if (args.endpoint) params.endpoint = args.endpoint;
    if (args.baseMint) params.baseMint = args.baseMint;
    if (args.poolAddress) params.poolAddress = args.poolAddress;

    return await client.get('/api/trading/market-data', { params });
  },

  async trading_get_trades(client: any, args: any) {
    const params: any = {
      mint: args.mint || 'So11111111111111111111111111111111111111112'
    };
    if (args.limit) params.limit = Math.min(args.limit, 100);
    if (args.source) params.source = args.source;

    return await client.get('/api/trading/trades', { params });
  },

  async trading_get_positions(client: any, args: any) {
    const params: any = {};
    if (args.id) params.id = args.id;
    if (args.status) params.status = args.status;
    if (args.symbol) params.symbol = args.symbol;

    return await client.get('/api/trading/positions', { params });
  },

  async trading_create_position(client: any, args: any) {
    const data = {
      symbol: args.symbol,
      side: args.side,
      amount: args.amount,
      leverage: args.leverage || 1,
      slippage: args.slippage || 1
    };

    return await client.post('/api/trading/positions', data);
  },

  async trading_close_position(client: any, args: any) {
    const params: any = {};
    if (args.id) params.id = args.id;
    if (args.closeAll) params.closeAll = args.closeAll;
    if (args.symbol) params.symbol = args.symbol;

    return await client.delete('/api/trading/positions', { params });
  },

  async trading_execute_trade(client: any, args: any) {
    const data = {
      symbol: args.symbol,
      side: args.side,
      amount: args.amount,
      slippage: args.slippage || 1,
      dex: args.dex
    };

    return await client.post('/api/trading/execute', data);
  },

  async trading_chat(client: any, args: any) {
    const data = {
      message: args.message,
      context: args.context || {}
    };

    return await client.post('/api/trading/chat', data);
  },

  // OpenSVM Credits & Usage Handlers
  async opensvm_list_keys(client: any, args: any) {
    const params = args.keyId ? { keyId: args.keyId } : {};
    return await client.get('/api/opensvm/anthropic-keys', { params });
  },

  async opensvm_create_key(client: any, args: any) {
    const data = {
      name: args.name,
      description: args.description,
      rateLimit: args.rateLimit
    };

    return await client.post('/api/opensvm/anthropic-keys', data);
  },

  async opensvm_delete_key(client: any, args: any) {
    return await client.delete(`/api/opensvm/anthropic-keys/${args.keyId}`);
  },

  async opensvm_get_key_stats(client: any, args: any) {
    return await client.get('/api/opensvm/anthropic-keys/stats');
  },

  async opensvm_get_usage(client: any, args: any) {
    const params: any = {};
    if (args.period) params.period = args.period;
    if (args.keyId) params.keyId = args.keyId;
    if (args.model) params.model = args.model;
    if (args.startDate) params.startDate = args.startDate;
    if (args.endDate) params.endDate = args.endDate;
    if (args.minCost !== undefined) params.minCost = args.minCost;
    if (args.maxCost !== undefined) params.maxCost = args.maxCost;
    if (args.minTokens !== undefined) params.minTokens = args.minTokens;
    if (args.maxTokens !== undefined) params.maxTokens = args.maxTokens;
    if (args.status) params.status = args.status;
    if (args.sortBy) params.sortBy = args.sortBy;
    if (args.sortOrder) params.sortOrder = args.sortOrder;
    if (args.limit) params.limit = Math.min(args.limit, 1000);
    if (args.offset) params.offset = args.offset;
    if (args.groupBy) params.groupBy = args.groupBy;
    if (args.includeMetadata !== undefined) params.includeMetadata = args.includeMetadata;

    return await client.get('/api/opensvm/usage', { params });
  },

  async opensvm_get_balance(client: any, args: any) {
    return await client.get('/api/opensvm/balance');
  }
};
