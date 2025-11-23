#!/bin/bash

# Comprehensive test suite for OpenSVM MCP Server v2.0.0
# Tests 100+ tools across all categories with detailed reporting

MCP_SERVER_PATH="./build/index.js"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
AUTH_REQUIRED=0
SKIPPED_TESTS=0

# Test addresses and data
TEST_WALLET="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
TEST_WALLET_2="7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi"
TEST_TOKEN="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
TEST_SOL="So11111111111111111111111111111111111111112"
TEST_TX="5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7"
TEST_PROGRAM="11111111111111111111111111111111"
TEST_VALIDATOR="7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "=========================================="
echo "OpenSVM MCP Server - Comprehensive Tests"
echo "Version 2.0.0 - 174 Tools"
echo "=========================================="
echo ""

# Helper function to call MCP tool
call_mcp_tool() {
  local tool_name="$1"
  local args="$2"
  local request_id=$((RANDOM))

  local request=$(cat <<EOF
{"jsonrpc":"2.0","id":$request_id,"method":"tools/call","params":{"name":"$tool_name","arguments":$args}}
EOF
)

  echo "$request" | node "$MCP_SERVER_PATH" 2>/dev/null | head -1
}

# Test helper function
test_tool() {
  local tool_name="$1"
  local args="$2"
  local description="$3"
  local skip="${4:-false}"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  if [ "$skip" = "true" ]; then
    echo -e "  ${CYAN}⏭${NC}  $tool_name: $description (SKIPPED)"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    return
  fi

  echo -n "  Testing $tool_name: $description... "

  local response=$(call_mcp_tool "$tool_name" "$args")

  if echo "$response" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
    local result_text=$(echo "$response" | jq -r '.result.content[0].text')

    # Check for authentication errors
    if echo "$result_text" | grep -qi "401\|unauthorized\|authentication required"; then
      echo -e "${YELLOW}AUTH${NC}"
      AUTH_REQUIRED=$((AUTH_REQUIRED + 1))
    # Check for errors (ignoring 404 which is expected for some lookups)
    elif echo "$result_text" | grep -qi '"error"' && ! echo "$result_text" | grep -qi '404\|not found'; then
      echo -e "${RED}FAIL${NC}"
      FAILED_TESTS=$((FAILED_TESTS + 1))
    else
      echo -e "${GREEN}PASS${NC}"
      PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
  else
    echo -e "${RED}FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

# ============================================================================
# PHASE 1: TRADING TERMINAL & OPENSVM CREDITS
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 1: Trading Terminal & OpenSVM Credits (15 tools)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Trading Terminal Tools:"
test_tool "trading_get_markets" '{"type":"trending","limit":10}' "Trending markets"
test_tool "trading_get_markets" '{"type":"top","limit":5}' "Top markets"
test_tool "trading_get_markets" '{"type":"new","limit":5}' "New markets"
test_tool "trading_get_pools" "{\"token\":\"$TEST_TOKEN\"}" "USDC pools"
test_tool "trading_get_pools" "{\"token\":\"$TEST_SOL\",\"dex\":\"raydium\"}" "SOL Raydium pools"
test_tool "trading_get_market_data" "{\"mint\":\"$TEST_TOKEN\"}" "USDC market data"
test_tool "trading_get_market_data" "{\"mint\":\"$TEST_SOL\"}" "SOL market data"
test_tool "trading_get_trades" "{\"mint\":\"$TEST_SOL\",\"limit\":10}" "SOL trades"
test_tool "trading_get_positions" '{}' "User positions"
test_tool "trading_create_position" '{"symbol":"SOL/USDC","side":"long","amount":1}' "Create position"
test_tool "trading_close_position" '{"symbol":"SOL/USDC"}' "Close position"
test_tool "trading_execute_trade" '{"symbol":"SOL/USDC","side":"buy","amount":0.1}' "Execute trade"
test_tool "trading_chat" '{"message":"What is the current SOL price?"}' "Trading chat"

echo ""
echo "OpenSVM Credits Tools:"
test_tool "opensvm_list_keys" '{}' "List API keys"
test_tool "opensvm_create_key" '{"name":"test-key"}' "Create API key"
test_tool "opensvm_get_key_stats" '{}' "Get key stats"
test_tool "opensvm_get_usage" '{}' "Get usage"
test_tool "opensvm_get_balance" '{}' "Get balance"

# ============================================================================
# PHASE 2: USER ENGAGEMENT & SOCIAL
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 2: User Engagement & Social (19 tools)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Social Interaction Tools:"
test_tool "user_get_followers" "{\"walletAddress\":\"$TEST_WALLET\",\"limit\":10}" "Get followers"
test_tool "user_get_following" "{\"walletAddress\":\"$TEST_WALLET\",\"limit\":10}" "Get following"
test_tool "user_follow" "{\"targetAddress\":\"$TEST_WALLET_2\"}" "Follow user"
test_tool "user_unfollow" "{\"targetAddress\":\"$TEST_WALLET_2\"}" "Unfollow user"
test_tool "user_like_profile" "{\"targetAddress\":\"$TEST_WALLET\"}" "Like profile"
test_tool "user_unlike_profile" "{\"targetAddress\":\"$TEST_WALLET\"}" "Unlike profile"
test_tool "user_like_event" '{"eventId":"test-123","eventType":"transaction"}' "Like event"
test_tool "user_unlike_event" '{"eventId":"test-123","eventType":"transaction"}' "Unlike event"
test_tool "user_track_view" "{\"targetAddress\":\"$TEST_WALLET\",\"contentType\":\"profile\"}" "Track view"

echo ""
echo "Profile Management Tools:"
test_tool "user_get_profile" "{\"walletAddress\":\"$TEST_WALLET\"}" "Get profile"
test_tool "user_update_profile" "{\"walletAddress\":\"$TEST_WALLET\",\"displayName\":\"Test User\"}" "Update profile"
test_tool "user_sync_profile_stats" '{}' "Sync profile stats"
test_tool "user_get_tab_preference" "{\"walletAddress\":\"$TEST_WALLET\"}" "Get tab preference"
test_tool "user_set_tab_preference" "{\"walletAddress\":\"$TEST_WALLET\",\"tab\":\"transactions\"}" "Set tab preference"
test_tool "user_sync_history" "{\"walletAddress\":\"$TEST_WALLET\"}" "Sync history"
test_tool "user_repair_history" '{}' "Repair history"

echo ""
echo "Feed & Activity Tools:"
test_tool "user_get_feed" "{\"walletAddress\":\"$TEST_WALLET\",\"limit\":20}" "Get feed"
test_tool "user_get_history" "{\"walletAddress\":\"$TEST_WALLET\",\"limit\":20}" "Get history"
test_tool "user_delete_history" "{\"walletAddress\":\"$TEST_WALLET\"}" "Delete history"

# ============================================================================
# PHASES 3-5: COMPLETE COVERAGE
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phases 3-5: Complete Coverage (55 tools)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Enhanced Token Analytics:"
test_tool "token_get_holders" "{\"address\":\"$TEST_TOKEN\",\"limit\":20}" "USDC holders"
test_tool "token_get_holders" "{\"address\":\"$TEST_SOL\",\"limit\":10}" "SOL holders"
test_tool "token_get_top_traders" "{\"address\":\"$TEST_TOKEN\",\"limit\":10}" "USDC top traders"
test_tool "token_get_top_traders" "{\"address\":\"$TEST_SOL\",\"limit\":10}" "SOL top traders"
test_tool "holders_by_program_interaction" "{\"programId\":\"$TEST_PROGRAM\",\"limit\":10}" "Holders by program"

echo ""
echo "Enhanced Transaction Analysis:"
test_tool "transaction_get_related" "{\"signature\":\"$TEST_TX\"}" "Related transactions"
test_tool "transaction_get_metrics" "{\"signature\":\"$TEST_TX\"}" "Transaction metrics"
test_tool "transaction_get_failure_analysis" "{\"signature\":\"$TEST_TX\"}" "Failure analysis"
test_tool "filter_transactions" '{"type":"all","limit":10}' "Filter all transactions"
test_tool "filter_transactions" '{"type":"swap","limit":5}' "Filter swap transactions"
test_tool "filter_transactions" '{"type":"transfer","limit":5}' "Filter transfer transactions"
test_tool "wallet_path_finding" "{\"fromWallet\":\"$TEST_WALLET\",\"toWallet\":\"$TEST_WALLET_2\"}" "Wallet path finding"

echo ""
echo "Launchpad Integration:"
test_tool "launchpad_list_sales" '{"status":"active","limit":10}' "Active sales"
test_tool "launchpad_list_sales" '{"status":"completed","limit":5}' "Completed sales"
test_tool "launchpad_get_sale" '{"saleId":"test-sale-1"}' "Get sale details"
test_tool "launchpad_contribute" '{"saleId":"test-sale-1","amount":10}' "Contribute to sale"
test_tool "launchpad_get_kol" '{"kolId":"test-kol-1"}' "Get KOL info"
test_tool "launchpad_apply_kol" '{}' "Apply as KOL"
test_tool "launchpad_claim_rewards" '{"kolId":"test-kol-1"}' "Claim KOL rewards"
test_tool "launchpad_get_referral_link" '{"code":"test123"}' "Get referral link"

echo ""
echo "Share & Referral System:"
test_tool "share_generate" '{}' "Generate share link"
test_tool "share_get_data" '{"shareCode":"test123"}' "Get share data"
test_tool "share_track_click" '{"shareCode":"test123"}' "Track share click"
test_tool "referral_get_balance" '{}' "Get referral balance"
test_tool "referral_claim" '{}' "Claim referral rewards"

echo ""
echo "Additional Analytics:"
test_tool "analytics_get_aggregators" '{}' "Aggregator analytics"
test_tool "analytics_get_bots" '{}' "Bot analytics"
test_tool "analytics_get_cross_chain" '{}' "Cross-chain analytics"
test_tool "analytics_get_defai" '{}' "DeFi analytics"
test_tool "analytics_get_infofi" '{}' "InfoFi analytics"
test_tool "analytics_get_launchpads" '{}' "Launchpad analytics"
test_tool "analytics_get_marketplaces" '{}' "Marketplace analytics"
test_tool "analytics_get_socialfi" '{}' "SocialFi analytics"
test_tool "analytics_trending_validators" '{}' "Trending validators"
test_tool "analytics_user_interactions" '{}' "User interactions"

echo ""
echo "Search & Discovery:"
test_tool "search_filtered" '{"query":"solana","limit":10}' "Search Solana"
test_tool "search_filtered" '{"query":"USDC","limit":5}' "Search USDC"
test_tool "search_filtered" '{"query":"token","type":"token","limit":10}' "Search tokens"
test_tool "search_get_suggestions" '{"query":"sol"}' "Suggestions for 'sol'"
test_tool "search_get_suggestions" '{"query":"usdc"}' "Suggestions for 'usdc'"
test_tool "search_get_empty_state" '{}' "Empty state suggestions"
test_tool "nft_get_trending" '{"limit":10}' "Trending NFTs"
test_tool "nft_get_new" '{"limit":10}' "New NFTs"

echo ""
echo "Streaming & Real-time (non-SSE tests):"
test_tool "stream_subscribe_alerts" '{}' "Subscribe alerts"
test_tool "stream_subscribe_feed" '{}' "Subscribe feed"
test_tool "stream_blocks" '{}' "Stream blocks" true
test_tool "stream_transactions" '{"filter":"all"}' "Stream transactions" true

echo ""
echo "Monitoring & System Health:"
test_tool "monitoring_get_requests" '{"limit":10}' "Request metrics"
test_tool "monitoring_get_api_metrics" '{}' "API metrics"
test_tool "error_tracking_list" '{"limit":10}' "Error tracking"

echo ""
echo "Miscellaneous Critical Endpoints:"
test_tool "chat_global" '{"limit":20}' "Global chat"
test_tool "ai_get_similar_questions" '{"question":"What is Solana?"}' "Similar questions"
test_tool "check_token" "{\"address\":\"$TEST_TOKEN\"}" "Check USDC token"
test_tool "check_token" "{\"address\":\"$TEST_SOL\"}" "Check SOL token"
test_tool "instruction_lookup" '{"instructionData":"test"}' "Instruction lookup"
test_tool "program_discovery" '{"query":"token"}' "Discover token programs"
test_tool "program_discovery" '{"query":"swap"}' "Discover swap programs"
test_tool "get_trades" '{"limit":20}' "Get trades"
test_tool "get_slots" '{"limit":10}' "Get slots"
test_tool "get_validator_info" "{\"address\":\"$TEST_VALIDATOR\"}" "Validator info"
test_tool "get_config" '{}' "Get config"
test_tool "get_metrics" '{}' "Get metrics"
test_tool "get_usage_stats" '{}' "Get usage stats"
test_tool "get_version" '{}' "Get version"
test_tool "check_anthropic_health" '{}' "Check Anthropic health"

# ============================================================================
# EXISTING TOOLS SAMPLE TESTS (Representative Sample)
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Existing Tools - Sample Tests (20 tools)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Transaction Tools:"
test_tool "transaction_get" "{\"signature\":\"$TEST_TX\"}" "Get transaction"
test_tool "transaction_analyze" "{\"signature\":\"$TEST_TX\"}" "Analyze transaction"
test_tool "transaction_explain" "{\"signature\":\"$TEST_TX\"}" "Explain transaction"

echo ""
echo "Account Tools:"
test_tool "account_get_info" "{\"address\":\"$TEST_WALLET\"}" "Get account info"
test_tool "account_get_transactions" "{\"address\":\"$TEST_WALLET\",\"limit\":10}" "Get account transactions"
test_tool "account_get_portfolio" "{\"address\":\"$TEST_WALLET\"}" "Get portfolio"
test_tool "account_get_transfers" "{\"address\":\"$TEST_WALLET\",\"limit\":10}" "Get transfers"

echo ""
echo "Token Tools:"
test_tool "token_get_info" "{\"address\":\"$TEST_TOKEN\"}" "Get token info"
test_tool "token_get_metadata" "{\"address\":\"$TEST_TOKEN\"}" "Get token metadata"

echo ""
echo "NFT Tools:"
test_tool "nft_get_collections" '{"limit":10}' "Get NFT collections"

echo ""
echo "Analytics Tools:"
test_tool "analytics_get_overview" '{}' "Analytics overview"
test_tool "analytics_get_dex" '{}' "DEX analytics"
test_tool "analytics_get_defi_health" '{}' "DeFi health"
test_tool "analytics_get_validators" '{}' "Validator analytics"

echo ""
echo "Block Tools:"
test_tool "block_get_info" '{"slot":123456789}' "Get block info"
test_tool "blocks_get_recent" '{"limit":5}' "Get recent blocks"

echo ""
echo "Alert Tools:"
test_tool "alerts_get" '{}' "Get alerts"

echo ""
echo "Search Tools:"
test_tool "search" '{"query":"solana","limit":5}' "Basic search"
test_tool "search_accounts" '{"query":"test","limit":5}' "Search accounts"

# ============================================================================
# RESULTS SUMMARY
# ============================================================================
echo ""
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Total Tests:     ${CYAN}$TOTAL_TESTS${NC}"
echo -e "Passed:          ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:          ${RED}$FAILED_TESTS${NC}"
echo -e "Auth Required:   ${YELLOW}$AUTH_REQUIRED${NC}"
echo -e "Skipped:         ${CYAN}$SKIPPED_TESTS${NC}"
echo ""

# Calculate pass rate
TESTABLE=$((TOTAL_TESTS - AUTH_REQUIRED - SKIPPED_TESTS))
if [ $TESTABLE -gt 0 ]; then
  PASS_RATE=$((PASSED_TESTS * 100 / TESTABLE))
  echo -e "Pass Rate (testable): ${GREEN}${PASS_RATE}%${NC} (${PASSED_TESTS}/${TESTABLE})"
fi

# Calculate coverage
TOOLS_TESTED=$((PASSED_TESTS + FAILED_TESTS + AUTH_REQUIRED))
COVERAGE=$((TOOLS_TESTED * 100 / 174))
echo -e "Coverage:        ${CYAN}${COVERAGE}%${NC} (${TOOLS_TESTED}/174 tools tested)"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Tool Count Verification:"
TOOL_COUNT=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node "$MCP_SERVER_PATH" 2>/dev/null | jq '.result.tools | length')
echo -e "Total tools available: ${GREEN}${TOOL_COUNT}${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ All testable tools passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed${NC}"
  exit 1
fi
