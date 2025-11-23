/**
 * Phase 2 Tools: User Engagement & Social Features
 *
 * This file contains tool definitions and handlers for:
 * - User social features (9 tools)
 * - User profile management (7 tools)
 * - User feed and history (3 tools)
 *
 * Total: 19 new tools
 */

export const phase2ToolDefinitions = [
  // ============================================================================
  // USER SOCIAL FEATURES
  // ============================================================================
  {
    name: 'user_follow',
    description: 'Follow another user/wallet on OpenSVM social platform. Creates a follower relationship. Request: {targetAddress: string} Response: {success: boolean, followerCount: number} Use case: Building social connections, creating watchlists, tracking whale wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        targetAddress: {
          type: 'string',
          description: 'Wallet address to follow (base58, 32-44 chars)'
        }
      },
      required: ['targetAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        followerCount: { type: 'number' },
        followingCount: { type: 'number' },
        timestamp: { type: 'string' }
      }
    }
  },
  {
    name: 'user_unfollow',
    description: 'Unfollow a user/wallet. Removes follower relationship. Request: {targetAddress: string} Response: {success: boolean} Use case: Managing following list, removing inactive wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        targetAddress: {
          type: 'string',
          description: 'Wallet address to unfollow'
        }
      },
      required: ['targetAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        timestamp: { type: 'string' }
      }
    }
  },
  {
    name: 'user_get_followers',
    description: 'Get list of followers for a wallet. Shows who is following this address. Request: {targetAddress: string, limit?: number} Response: [{address, profile, followedAt}] Use case: Social analytics, influence measurement, community building.',
    inputSchema: {
      type: 'object',
      properties: {
        targetAddress: {
          type: 'string',
          description: 'Wallet address to get followers for'
        },
        limit: {
          type: 'number',
          description: 'Maximum followers to return (default 50)',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          description: 'Pagination offset'
        }
      },
      required: ['targetAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        followers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              profile: { type: 'object' },
              followedAt: { type: 'string' }
            }
          }
        },
        total: { type: 'number' },
        hasMore: { type: 'boolean' }
      }
    }
  },
  {
    name: 'user_get_following',
    description: 'Get list of wallets that a user is following. Request: {targetAddress: string, limit?: number} Response: [{address, profile, followedAt}] Use case: Understanding user interests, discovering similar wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        targetAddress: {
          type: 'string',
          description: 'Wallet address to get following list for'
        },
        limit: {
          type: 'number',
          description: 'Maximum following to return (default 50)',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          description: 'Pagination offset'
        }
      },
      required: ['targetAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        following: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              profile: { type: 'object' },
              followedAt: { type: 'string' }
            }
          }
        },
        total: { type: 'number' },
        hasMore: { type: 'boolean' }
      }
    }
  },
  {
    name: 'user_like_profile',
    description: 'Like/upvote a user profile. Shows appreciation for wallet/trader. Request: {targetAddress: string} Response: {success: boolean, likeCount: number} Use case: Social engagement, reputation building.',
    inputSchema: {
      type: 'object',
      properties: {
        targetAddress: {
          type: 'string',
          description: 'Wallet address to like'
        }
      },
      required: ['targetAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        likeCount: { type: 'number' },
        timestamp: { type: 'string' }
      }
    }
  },
  {
    name: 'user_unlike_profile',
    description: 'Remove like from a user profile. Request: {targetAddress: string} Response: {success: boolean} Use case: Managing likes, changing opinion.',
    inputSchema: {
      type: 'object',
      properties: {
        targetAddress: {
          type: 'string',
          description: 'Wallet address to unlike'
        }
      },
      required: ['targetAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        timestamp: { type: 'string' }
      }
    }
  },
  {
    name: 'user_like_event',
    description: 'Like a feed event/activity (transaction, NFT mint, etc). Request: {eventId: string, eventType: string} Response: {success: boolean, likeCount: number} Use case: Engaging with activity feed, highlighting interesting transactions.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Event/transaction ID to like'
        },
        eventType: {
          type: 'string',
          enum: ['transaction', 'nft_mint', 'token_transfer', 'defi_action'],
          description: 'Type of event'
        }
      },
      required: ['eventId']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        likeCount: { type: 'number' },
        timestamp: { type: 'string' }
      }
    }
  },
  {
    name: 'user_unlike_event',
    description: 'Remove like from a feed event. Request: {eventId: string} Response: {success: boolean} Use case: Managing feed interactions.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Event ID to unlike'
        }
      },
      required: ['eventId']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        timestamp: { type: 'string' }
      }
    }
  },
  {
    name: 'user_track_view',
    description: 'Track profile view for analytics. Records that current user viewed a profile. Request: {targetAddress: string} Response: {success: boolean} Use case: View analytics, measuring influence, tracking engagement.',
    inputSchema: {
      type: 'object',
      properties: {
        targetAddress: {
          type: 'string',
          description: 'Wallet address that was viewed'
        },
        context: {
          type: 'string',
          enum: ['profile', 'feed', 'search', 'portfolio'],
          description: 'Where the profile was viewed from'
        }
      },
      required: ['targetAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        viewCount: { type: 'number' },
        timestamp: { type: 'string' }
      }
    }
  },

  // ============================================================================
  // USER PROFILE MANAGEMENT
  // ============================================================================
  {
    name: 'user_get_profile',
    description: 'Get complete user profile including stats, bio, social links, badges, and reputation. Request: {walletAddress: string} Response: {profile, stats, social, badges, reputation} Use case: Viewing user profiles, analyzing traders, social discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to get profile for'
        }
      },
      required: ['walletAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string' },
        profile: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            displayName: { type: 'string' },
            bio: { type: 'string' },
            avatar: { type: 'string' },
            banner: { type: 'string' },
            website: { type: 'string' },
            twitter: { type: 'string' },
            discord: { type: 'string' }
          }
        },
        stats: {
          type: 'object',
          properties: {
            followers: { type: 'number' },
            following: { type: 'number' },
            likes: { type: 'number' },
            views: { type: 'number' },
            transactions: { type: 'number' },
            volume: { type: 'number' }
          }
        },
        badges: {
          type: 'array',
          items: { type: 'object' }
        },
        reputation: { type: 'number' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  },
  {
    name: 'user_update_profile',
    description: 'Update user profile information (bio, social links, avatar, etc). Requires authentication. Request: {walletAddress: string, updates: object} Response: {success: boolean, profile: object} Use case: Profile customization, branding, social presence.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address'
        },
        updates: {
          type: 'object',
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30 },
            displayName: { type: 'string', maxLength: 50 },
            bio: { type: 'string', maxLength: 500 },
            avatar: { type: 'string', format: 'uri' },
            banner: { type: 'string', format: 'uri' },
            website: { type: 'string', format: 'uri' },
            twitter: { type: 'string' },
            discord: { type: 'string' }
          },
          description: 'Fields to update (only include fields you want to change)'
        }
      },
      required: ['walletAddress', 'updates']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        profile: { type: 'object' },
        updatedAt: { type: 'string' }
      }
    }
  },
  {
    name: 'user_sync_profile_stats',
    description: 'Synchronize profile statistics (transaction count, volume, etc) from blockchain. Updates cached stats. Request: {walletAddress: string} Response: {success: boolean, stats: object} Use case: Refreshing stale data, accurate analytics.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to sync stats for'
        },
        forceRefresh: {
          type: 'boolean',
          description: 'Force refresh even if recently synced'
        }
      },
      required: ['walletAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        stats: {
          type: 'object',
          properties: {
            transactions: { type: 'number' },
            volume: { type: 'number' },
            tokens: { type: 'number' },
            nfts: { type: 'number' }
          }
        },
        lastSynced: { type: 'string' }
      }
    }
  },
  {
    name: 'user_get_tab_preference',
    description: 'Get user UI tab/layout preferences. Returns saved UI state. Request: {walletAddress: string} Response: {preferences: object} Use case: Restoring UI state, personalizing experience.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to get preferences for'
        }
      },
      required: ['walletAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        preferences: {
          type: 'object',
          properties: {
            defaultTab: { type: 'string' },
            theme: { type: 'string' },
            language: { type: 'string' },
            layout: { type: 'object' }
          }
        }
      }
    }
  },
  {
    name: 'user_set_tab_preference',
    description: 'Save user UI tab/layout preferences. Persists UI state. Request: {walletAddress: string, preferences: object} Response: {success: boolean} Use case: Saving UI customization, cross-device sync.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address'
        },
        preferences: {
          type: 'object',
          description: 'Preferences to save (any JSON object)',
          properties: {
            defaultTab: { type: 'string' },
            theme: { type: 'string' },
            language: { type: 'string' },
            layout: { type: 'object' }
          }
        }
      },
      required: ['walletAddress', 'preferences']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        timestamp: { type: 'string' }
      }
    }
  },
  {
    name: 'user_sync_history',
    description: 'Synchronize user activity history from blockchain. Indexes recent transactions and activities. Request: {walletAddress: string} Response: {success: boolean, itemsSynced: number} Use case: Building activity timeline, ensuring data freshness.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to sync history for'
        },
        fromDate: {
          type: 'string',
          format: 'date-time',
          description: 'Start date for sync (default: last sync)'
        }
      },
      required: ['walletAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        itemsSynced: { type: 'number' },
        lastSynced: { type: 'string' }
      }
    }
  },
  {
    name: 'user_repair_history',
    description: 'Repair corrupted or missing user history data. Rebuilds activity index. Request: {walletAddress: string} Response: {success: boolean, itemsRepaired: number} Use case: Fixing data issues, recovering missing activities.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to repair history for'
        },
        rebuildAll: {
          type: 'boolean',
          description: 'Rebuild entire history (slow but thorough)'
        }
      },
      required: ['walletAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        itemsRepaired: { type: 'number' },
        itemsDeleted: { type: 'number' },
        timestamp: { type: 'string' }
      }
    }
  },

  // ============================================================================
  // USER FEED & ACTIVITY
  // ============================================================================
  {
    name: 'user_get_feed',
    description: 'Get personalized activity feed for a wallet. Shows recent activities from followed wallets and own transactions. Request: {walletAddress: string, type?: string, limit?: number} Response: [{activity, wallet, timestamp}] Use case: Social feed, discovering activity, monitoring wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to get feed for'
        },
        type: {
          type: 'string',
          enum: ['all', 'transactions', 'nfts', 'defi', 'social'],
          description: 'Filter feed by activity type'
        },
        limit: {
          type: 'number',
          description: 'Maximum items to return (default 50)',
          minimum: 1,
          maximum: 200
        },
        offset: {
          type: 'number',
          description: 'Pagination offset'
        },
        realtime: {
          type: 'boolean',
          description: 'Include real-time updates (use with SSE)'
        }
      },
      required: ['walletAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        feed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              wallet: { type: 'string' },
              activity: { type: 'object' },
              timestamp: { type: 'string' },
              likes: { type: 'number' },
              comments: { type: 'number' }
            }
          }
        },
        hasMore: { type: 'boolean' },
        nextOffset: { type: 'number' }
      }
    }
  },
  {
    name: 'user_get_history',
    description: 'Get complete activity history for a wallet. Paginated list of all past activities. Request: {walletAddress: string, pageType?: string, limit?: number} Response: [{activity, timestamp}] Use case: Historical analysis, audit trail, portfolio tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Wallet address to get history for'
        },
        pageType: {
          type: 'string',
          enum: ['transactions', 'nfts', 'defi', 'tokens', 'all'],
          description: 'Type of history to retrieve'
        },
        limit: {
          type: 'number',
          description: 'Maximum items (default 50, max 1000)',
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          description: 'Pagination offset'
        }
      },
      required: ['walletAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        history: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              activity: { type: 'object' },
              timestamp: { type: 'string' }
            }
          }
        },
        total: { type: 'number' },
        hasMore: { type: 'boolean' }
      }
    }
  },
  {
    name: 'user_delete_history',
    description: 'Delete activity history for a wallet. Removes cached activity data. Request: {walletAddress: string, beforeDate?: string} Response: {success: boolean, itemsDeleted: number} Use case: Privacy, data cleanup, GDPR compliance.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Your wallet address'
        },
        beforeDate: {
          type: 'string',
          format: 'date-time',
          description: 'Delete history before this date (optional, deletes all if not specified)'
        },
        pageType: {
          type: 'string',
          enum: ['transactions', 'nfts', 'defi', 'tokens', 'all'],
          description: 'Type of history to delete (default: all)'
        }
      },
      required: ['walletAddress']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        itemsDeleted: { type: 'number' },
        timestamp: { type: 'string' }
      }
    }
  }
];

// Export tool handler implementations
export const phase2ToolHandlers = {
  // User Social Handlers
  async user_follow(client: any, args: any) {
    return await client.post(`/api/user-social/follow/${args.targetAddress}`);
  },

  async user_unfollow(client: any, args: any) {
    return await client.delete(`/api/user-social/follow/${args.targetAddress}`);
  },

  async user_get_followers(client: any, args: any) {
    const params: any = { type: 'followers' };
    if (args.limit) params.limit = args.limit;
    if (args.offset) params.offset = args.offset;
    return await client.get(`/api/user-social/follow/${args.targetAddress}`, { params });
  },

  async user_get_following(client: any, args: any) {
    const params: any = { type: 'following' };
    if (args.limit) params.limit = args.limit;
    if (args.offset) params.offset = args.offset;
    return await client.get(`/api/user-social/follow/${args.targetAddress}`, { params });
  },

  async user_like_profile(client: any, args: any) {
    return await client.post(`/api/user-social/like/${args.targetAddress}`);
  },

  async user_unlike_profile(client: any, args: any) {
    return await client.delete(`/api/user-social/like/${args.targetAddress}`);
  },

  async user_like_event(client: any, args: any) {
    return await client.post('/api/user-social/like-event', {
      eventId: args.eventId,
      eventType: args.eventType
    });
  },

  async user_unlike_event(client: any, args: any) {
    return await client.post('/api/user-social/unlike-event', {
      eventId: args.eventId
    });
  },

  async user_track_view(client: any, args: any) {
    return await client.post('/api/user-social/view', {
      targetAddress: args.targetAddress,
      context: args.context
    });
  },

  // User Profile Handlers
  async user_get_profile(client: any, args: any) {
    return await client.get(`/api/user-profile/${args.walletAddress}`);
  },

  async user_update_profile(client: any, args: any) {
    return await client.put(`/api/user-profile/${args.walletAddress}`, args.updates);
  },

  async user_sync_profile_stats(client: any, args: any) {
    const params = args.forceRefresh ? { walletAddress: args.walletAddress, force: true } : { walletAddress: args.walletAddress };
    return await client.post('/api/user-profile/sync', params);
  },

  async user_get_tab_preference(client: any, args: any) {
    return await client.get(`/api/user-tab-preference/${args.walletAddress}`);
  },

  async user_set_tab_preference(client: any, args: any) {
    return await client.put(`/api/user-tab-preference/${args.walletAddress}`, args.preferences);
  },

  async user_sync_history(client: any, args: any) {
    const data: any = { walletAddress: args.walletAddress };
    if (args.fromDate) data.fromDate = args.fromDate;
    return await client.post('/api/user-history/sync', data);
  },

  async user_repair_history(client: any, args: any) {
    const params = { walletAddress: args.walletAddress, rebuildAll: args.rebuildAll || false };
    return await client.post('/api/user-history/repair', params);
  },

  // User Feed & Activity Handlers
  async user_get_feed(client: any, args: any) {
    const params: any = {};
    if (args.type) params.type = args.type;
    if (args.limit) params.limit = args.limit;
    if (args.offset) params.offset = args.offset;
    if (args.realtime) params.realtime = args.realtime;
    return await client.get(`/api/user-feed/${args.walletAddress}`, { params });
  },

  async user_get_history(client: any, args: any) {
    const params: any = {};
    if (args.pageType) params.pageType = args.pageType;
    if (args.limit) params.limit = args.limit;
    if (args.offset) params.offset = args.offset;
    return await client.get(`/api/user-history/${args.walletAddress}`, { params });
  },

  async user_delete_history(client: any, args: any) {
    const params: any = {};
    if (args.beforeDate) params.beforeDate = args.beforeDate;
    if (args.pageType) params.pageType = args.pageType;
    return await client.delete(`/api/user-history/${args.walletAddress}`, { params });
  }
};
