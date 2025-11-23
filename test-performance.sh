#!/bin/bash

# Performance Test Suite for OpenSVM MCP Server v2.0.0
# Tests: Latency, Schema Verification, Response Size, Reliability

MCP_SERVER_PATH="./build/index.js"
RESULTS_FILE="performance-results.json"

# Test data
TEST_WALLET="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
TEST_TOKEN="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
TEST_SOL="So11111111111111111111111111111111111111112"
TEST_TX="5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Performance thresholds (milliseconds)
FAST_THRESHOLD=200
ACCEPTABLE_THRESHOLD=1000
SLOW_THRESHOLD=3000

# Metrics
TOTAL_TESTS=0
FAST_TESTS=0
ACCEPTABLE_TESTS=0
SLOW_TESTS=0
VERY_SLOW_TESTS=0
SCHEMA_VALID=0
SCHEMA_INVALID=0
TOTAL_BYTES=0

echo "=========================================="
echo "OpenSVM MCP Server - Performance Tests"
echo "Version 2.0.0 - Advanced Metrics"
echo "=========================================="
echo ""
echo "Metrics Collected:"
echo "  • Latency (response time)"
echo "  • Schema Validation (MCP protocol)"
echo "  • Response Size (bytes)"
echo "  • Success/Failure rate"
echo ""

# Initialize JSON results file
echo "{\"tests\": [" > "$RESULTS_FILE"

# Helper function to call MCP tool and measure performance
test_tool_performance() {
  local tool_name="$1"
  local args="$2"
  local description="$3"
  local expected_fields="${4:-}"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  # Create request
  local request_id=$((RANDOM))
  local request=$(cat <<EOF
{"jsonrpc":"2.0","id":$request_id,"method":"tools/call","params":{"name":"$tool_name","arguments":$args}}
EOF
)

  # Measure latency
  local start_time=$(date +%s%N)
  local response=$(echo "$request" | node "$MCP_SERVER_PATH" 2>/dev/null | head -1)
  local end_time=$(date +%s%N)

  local latency_ns=$((end_time - start_time))
  local latency_ms=$((latency_ns / 1000000))

  # Calculate response size
  local response_size=${#response}
  TOTAL_BYTES=$((TOTAL_BYTES + response_size))

  # Schema validation
  local schema_valid=false
  local has_result=false
  local has_error=false
  local success=false

  if echo "$response" | jq -e '.jsonrpc == "2.0"' > /dev/null 2>&1; then
    if echo "$response" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
      schema_valid=true
      has_result=true

      local result_text=$(echo "$response" | jq -r '.result.content[0].text')

      # Check if result contains data (not an error)
      if ! echo "$result_text" | grep -qi "401\|unauthorized\|authentication required"; then
        success=true

        # If expected fields provided, verify them
        if [ -n "$expected_fields" ]; then
          for field in $expected_fields; do
            if ! echo "$result_text" | jq -e ".$field" > /dev/null 2>&1; then
              success=false
              break
            fi
          done
        fi
      fi
    elif echo "$response" | jq -e '.error' > /dev/null 2>&1; then
      schema_valid=true
      has_error=true
    fi
  fi

  # Update schema stats
  if [ "$schema_valid" = true ]; then
    SCHEMA_VALID=$((SCHEMA_VALID + 1))
  else
    SCHEMA_INVALID=$((SCHEMA_INVALID + 1))
  fi

  # Categorize by latency
  local latency_category=""
  local latency_color=""
  if [ $latency_ms -lt $FAST_THRESHOLD ]; then
    FAST_TESTS=$((FAST_TESTS + 1))
    latency_category="FAST"
    latency_color="$GREEN"
  elif [ $latency_ms -lt $ACCEPTABLE_THRESHOLD ]; then
    ACCEPTABLE_TESTS=$((ACCEPTABLE_TESTS + 1))
    latency_category="OK"
    latency_color="$CYAN"
  elif [ $latency_ms -lt $SLOW_THRESHOLD ]; then
    SLOW_TESTS=$((SLOW_TESTS + 1))
    latency_category="SLOW"
    latency_color="$YELLOW"
  else
    VERY_SLOW_TESTS=$((VERY_SLOW_TESTS + 1))
    latency_category="V.SLOW"
    latency_color="$RED"
  fi

  # Format response size
  local size_display=""
  if [ $response_size -lt 1024 ]; then
    size_display="${response_size}B"
  elif [ $response_size -lt 1048576 ]; then
    size_display="$((response_size / 1024))KB"
  else
    size_display="$((response_size / 1048576))MB"
  fi

  # Schema status
  local schema_status=""
  if [ "$schema_valid" = true ]; then
    schema_status="${GREEN}✓${NC}"
  else
    schema_status="${RED}✗${NC}"
  fi

  # Success status
  local success_status=""
  if [ "$success" = true ]; then
    success_status="${GREEN}✓${NC}"
  elif [ "$has_error" = true ] || [ "$has_result" = false ]; then
    success_status="${RED}✗${NC}"
  else
    success_status="${YELLOW}⚠${NC}"
  fi

  # Print result
  printf "%-40s ${latency_color}%6dms${NC} ${MAGENTA}%8s${NC} Schema:%s Success:%s\n" \
    "$tool_name" "$latency_ms" "$size_display" "$schema_status" "$success_status"

  # Save to JSON (append to file)
  if [ $TOTAL_TESTS -gt 1 ]; then
    echo "," >> "$RESULTS_FILE"
  fi

  cat >> "$RESULTS_FILE" <<EOF
  {
    "tool": "$tool_name",
    "description": "$description",
    "latency_ms": $latency_ms,
    "response_size_bytes": $response_size,
    "schema_valid": $schema_valid,
    "has_result": $has_result,
    "has_error": $has_error,
    "success": $success,
    "latency_category": "$latency_category"
  }
EOF
}

# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 1: Trading Terminal & OpenSVM Credits${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_tool_performance "trading_get_pools" "{\"token\":\"$TEST_TOKEN\"}" "Get USDC pools"
test_tool_performance "trading_get_pools" "{\"token\":\"$TEST_SOL\"}" "Get SOL pools"
test_tool_performance "trading_get_trades" "{\"mint\":\"$TEST_SOL\",\"limit\":10}" "Get SOL trades"
test_tool_performance "trading_get_positions" '{}' "Get positions"
test_tool_performance "trading_chat" '{"message":"What is SOL?"}' "Trading chat"
test_tool_performance "opensvm_list_keys" '{}' "List API keys"
test_tool_performance "opensvm_get_usage" '{}' "Get usage"
test_tool_performance "opensvm_get_balance" '{}' "Get balance"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phase 2: User Engagement & Social${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_tool_performance "user_get_followers" "{\"walletAddress\":\"$TEST_WALLET\",\"limit\":10}" "Get followers"
test_tool_performance "user_get_following" "{\"walletAddress\":\"$TEST_WALLET\",\"limit\":10}" "Get following"
test_tool_performance "user_get_profile" "{\"walletAddress\":\"$TEST_WALLET\"}" "Get profile"
test_tool_performance "user_update_profile" "{\"walletAddress\":\"$TEST_WALLET\",\"displayName\":\"Test\"}" "Update profile"
test_tool_performance "user_sync_profile_stats" '{}' "Sync stats"
test_tool_performance "user_get_feed" "{\"walletAddress\":\"$TEST_WALLET\",\"limit\":20}" "Get feed"
test_tool_performance "user_get_tab_preference" "{\"walletAddress\":\"$TEST_WALLET\"}" "Get tab pref"
test_tool_performance "user_track_view" "{\"targetAddress\":\"$TEST_WALLET\",\"contentType\":\"profile\"}" "Track view"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Phases 3-5: Enhanced Analytics & Features${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Token Analytics:"
test_tool_performance "token_get_holders" "{\"address\":\"$TEST_TOKEN\",\"limit\":20}" "USDC holders"
test_tool_performance "token_get_top_traders" "{\"address\":\"$TEST_TOKEN\",\"limit\":10}" "USDC traders"
test_tool_performance "holders_by_program_interaction" "{\"programId\":\"11111111111111111111111111111111\",\"limit\":10}" "Program holders"

echo ""
echo "Transaction Analysis:"
test_tool_performance "transaction_get_related" "{\"signature\":\"$TEST_TX\"}" "Related txs"
test_tool_performance "transaction_get_metrics" "{\"signature\":\"$TEST_TX\"}" "Tx metrics"
test_tool_performance "transaction_get_failure_analysis" "{\"signature\":\"$TEST_TX\"}" "Failure analysis"
test_tool_performance "filter_transactions" '{"type":"all","limit":10}' "Filter txs"
test_tool_performance "wallet_path_finding" "{\"fromWallet\":\"$TEST_WALLET\",\"toWallet\":\"7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi\"}" "Path finding"

echo ""
echo "Launchpad:"
test_tool_performance "launchpad_list_sales" '{"status":"active","limit":10}' "List sales"
test_tool_performance "launchpad_get_sale" '{"saleId":"test-1"}' "Get sale"
test_tool_performance "launchpad_contribute" '{"saleId":"test-1","amount":10}' "Contribute"
test_tool_performance "launchpad_get_referral_link" '{"code":"test123"}' "Get referral"

echo ""
echo "Share & Referrals:"
test_tool_performance "share_generate" '{}' "Generate share"
test_tool_performance "share_get_data" '{"shareCode":"test123"}' "Get share data"
test_tool_performance "referral_get_balance" '{}' "Referral balance"

echo ""
echo "Analytics:"
test_tool_performance "analytics_get_aggregators" '{}' "Aggregators"
test_tool_performance "analytics_get_bots" '{}' "Bots"
test_tool_performance "analytics_get_cross_chain" '{}' "Cross-chain"
test_tool_performance "analytics_get_defai" '{}' "DeFi"
test_tool_performance "analytics_get_infofi" '{}' "InfoFi"
test_tool_performance "analytics_get_launchpads" '{}' "Launchpads"
test_tool_performance "analytics_get_socialfi" '{}' "SocialFi"
test_tool_performance "analytics_user_interactions" '{}' "User interactions"

echo ""
echo "Search & Discovery:"
test_tool_performance "search_filtered" '{"query":"solana","limit":10}' "Search Solana"
test_tool_performance "search_get_suggestions" '{"query":"sol"}' "Suggestions"
test_tool_performance "search_get_empty_state" '{}' "Empty state"
test_tool_performance "nft_get_trending" '{"limit":10}' "Trending NFTs"
test_tool_performance "nft_get_new" '{"limit":10}' "New NFTs"

echo ""
echo "Monitoring & System:"
test_tool_performance "monitoring_get_requests" '{"limit":10}' "Request metrics"
test_tool_performance "monitoring_get_api_metrics" '{}' "API metrics"
test_tool_performance "error_tracking_list" '{"limit":10}' "Error tracking"

echo ""
echo "Miscellaneous:"
test_tool_performance "chat_global" '{"limit":20}' "Global chat"
test_tool_performance "ai_get_similar_questions" '{"question":"What is Solana?"}' "Similar questions"
test_tool_performance "check_token" "{\"address\":\"$TEST_TOKEN\"}" "Check token"
test_tool_performance "instruction_lookup" '{"instructionData":"test"}' "Instruction lookup"
test_tool_performance "program_discovery" '{"query":"token"}' "Program discovery"
test_tool_performance "get_trades" '{"limit":20}' "Get trades"
test_tool_performance "get_slots" '{"limit":10}' "Get slots"
test_tool_performance "get_validator_info" '{"address":"7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2"}' "Validator info"
test_tool_performance "get_version" '{}' "Get version"
test_tool_performance "check_anthropic_health" '{}' "Check health"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Existing Tools - Sample${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_tool_performance "transaction_get" "{\"signature\":\"$TEST_TX\"}" "Get transaction"
test_tool_performance "transaction_analyze" "{\"signature\":\"$TEST_TX\"}" "Analyze tx"
test_tool_performance "transaction_explain" "{\"signature\":\"$TEST_TX\"}" "Explain tx"
test_tool_performance "account_get_info" "{\"address\":\"$TEST_WALLET\"}" "Account info"
test_tool_performance "account_get_transactions" "{\"address\":\"$TEST_WALLET\",\"limit\":10}" "Account txs"
test_tool_performance "account_get_portfolio" "{\"address\":\"$TEST_WALLET\"}" "Portfolio"
test_tool_performance "token_get_info" "{\"address\":\"$TEST_TOKEN\"}" "Token info"
test_tool_performance "token_get_metadata" "{\"address\":\"$TEST_TOKEN\"}" "Token metadata"
test_tool_performance "nft_get_collections" '{"limit":10}' "NFT collections"
test_tool_performance "analytics_get_overview" '{}' "Analytics overview"
test_tool_performance "analytics_get_dex" '{}' "DEX analytics"
test_tool_performance "block_get_info" '{"slot":123456789}' "Block info"
test_tool_performance "blocks_get_recent" '{"limit":5}' "Recent blocks"
test_tool_performance "alerts_get" '{}' "Get alerts"
test_tool_performance "search" '{"query":"solana","limit":5}' "Basic search"

# Close JSON array
echo "" >> "$RESULTS_FILE"
echo "]}" >> "$RESULTS_FILE"

# ============================================================================
# PERFORMANCE SUMMARY
# ============================================================================

echo ""
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Performance Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Calculate averages
if [ $TOTAL_TESTS -gt 0 ]; then
  AVG_LATENCY=$(jq '[.tests[].latency_ms] | add / length | floor' "$RESULTS_FILE")
  MIN_LATENCY=$(jq '[.tests[].latency_ms] | min' "$RESULTS_FILE")
  MAX_LATENCY=$(jq '[.tests[].latency_ms] | max' "$RESULTS_FILE")
  MEDIAN_LATENCY=$(jq '[.tests[].latency_ms] | sort | if length % 2 == 0 then (.[length/2-1] + .[length/2]) / 2 else .[length/2] end | floor' "$RESULTS_FILE")

  AVG_SIZE=$(jq '[.tests[].response_size_bytes] | add / length | floor' "$RESULTS_FILE")
  MIN_SIZE=$(jq '[.tests[].response_size_bytes] | min' "$RESULTS_FILE")
  MAX_SIZE=$(jq '[.tests[].response_size_bytes] | max' "$RESULTS_FILE")
  TOTAL_MB=$((TOTAL_BYTES / 1048576))

  FAST_PERCENT=$((FAST_TESTS * 100 / TOTAL_TESTS))
  ACCEPTABLE_PERCENT=$((ACCEPTABLE_TESTS * 100 / TOTAL_TESTS))
  SLOW_PERCENT=$((SLOW_TESTS * 100 / TOTAL_TESTS))
  VERY_SLOW_PERCENT=$((VERY_SLOW_TESTS * 100 / TOTAL_TESTS))

  SCHEMA_VALID_PERCENT=$((SCHEMA_VALID * 100 / TOTAL_TESTS))
fi

echo "Latency Statistics:"
echo -e "  Total Tests:    ${CYAN}$TOTAL_TESTS${NC}"
echo -e "  Average:        ${CYAN}${AVG_LATENCY}ms${NC}"
echo -e "  Median:         ${CYAN}${MEDIAN_LATENCY}ms${NC}"
echo -e "  Min:            ${GREEN}${MIN_LATENCY}ms${NC}"
echo -e "  Max:            ${RED}${MAX_LATENCY}ms${NC}"
echo ""

echo "Latency Distribution:"
echo -e "  ${GREEN}Fast${NC} (<${FAST_THRESHOLD}ms):       $FAST_TESTS tests (${FAST_PERCENT}%)"
echo -e "  ${CYAN}Acceptable${NC} (<${ACCEPTABLE_THRESHOLD}ms): $ACCEPTABLE_TESTS tests (${ACCEPTABLE_PERCENT}%)"
echo -e "  ${YELLOW}Slow${NC} (<${SLOW_THRESHOLD}ms):      $SLOW_TESTS tests (${SLOW_PERCENT}%)"
echo -e "  ${RED}Very Slow${NC} (>${SLOW_THRESHOLD}ms):  $VERY_SLOW_TESTS tests (${VERY_SLOW_PERCENT}%)"
echo ""

echo "Response Size Statistics:"
echo -e "  Average:        ${MAGENTA}$((AVG_SIZE / 1024))KB${NC}"
echo -e "  Min:            ${GREEN}${MIN_SIZE}B${NC}"
echo -e "  Max:            ${RED}$((MAX_SIZE / 1024))KB${NC}"
echo -e "  Total Data:     ${MAGENTA}${TOTAL_MB}MB${NC}"
echo ""

echo "Schema Validation:"
echo -e "  Valid:          ${GREEN}$SCHEMA_VALID${NC} (${SCHEMA_VALID_PERCENT}%)"
echo -e "  Invalid:        ${RED}$SCHEMA_INVALID${NC} ($((100 - SCHEMA_VALID_PERCENT))%)"
echo ""

echo "Performance Rating:"
if [ $FAST_PERCENT -ge 70 ]; then
  echo -e "  ${GREEN}✓ EXCELLENT${NC} - Majority of tools are fast (<${FAST_THRESHOLD}ms)"
elif [ $((FAST_PERCENT + ACCEPTABLE_PERCENT)) -ge 85 ]; then
  echo -e "  ${CYAN}✓ GOOD${NC} - Most tools perform well (<${ACCEPTABLE_THRESHOLD}ms)"
elif [ $((FAST_PERCENT + ACCEPTABLE_PERCENT)) -ge 70 ]; then
  echo -e "  ${YELLOW}⚠ ACCEPTABLE${NC} - Performance could be improved"
else
  echo -e "  ${RED}✗ NEEDS IMPROVEMENT${NC} - Many slow tools (>${ACCEPTABLE_THRESHOLD}ms)"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Results saved to: ${CYAN}$RESULTS_FILE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
