#!/bin/bash

# Test script for Phase 1 tools (Trading & OpenSVM Credits)
# Tests all 15 new tools with various scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MCP_SERVER_PATH="./build/index.js"

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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

# Helper function to run a test
run_test() {
    local test_name=$1
    local tool_name=$2
    local args=$3
    local should_fail=${4:-false}

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${YELLOW}Test ${TOTAL_TESTS}: ${test_name}${NC}"
    echo "Tool: ${tool_name}"
    echo "Args: ${args}"

    # Run the tool
    local output
    output=$(call_mcp_tool "$tool_name" "$args")

    # Check if response is valid JSON
    if ! echo "$output" | jq empty 2>/dev/null; then
        if [ "$should_fail" = true ]; then
            echo -e "${GREEN}✓ PASS${NC} (Expected failure - invalid response)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}✗ FAIL${NC} (Invalid JSON response)"
            echo "Output: $output"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
        return
    fi

    # Check for error in response
    local error=$(echo "$output" | jq -r '.error // empty')
    local is_error=$(echo "$output" | jq -r '.result.isError // false')

    if [ "$should_fail" = true ]; then
        # Test expected to fail
        if [ -n "$error" ] || [ "$is_error" == "true" ]; then
            echo -e "${GREEN}✓ PASS${NC} (Expected failure)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}✗ FAIL${NC} (Should have failed but passed)"
            echo "Output: $output"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        # Test expected to pass
        if [ -z "$error" ] && [ "$is_error" != "true" ]; then
            echo -e "${GREEN}✓ PASS${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}✗ FAIL${NC}"
            if [ -n "$error" ]; then
                echo "Error: $(echo "$output" | jq -r '.error.message')"
            else
                echo "Tool Error: $(echo "$output" | jq -r '.result.content[0].text' | head -c 200)"
            fi
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi
}

echo "========================================="
echo "  Phase 1 Tools Test Suite"
echo "========================================="
echo ""
echo "Testing 15 new tools:"
echo "  - 9 Trading Terminal tools"
echo "  - 6 OpenSVM Credits tools"
echo ""

# ============================================================================
# TRADING TERMINAL TESTS
# ============================================================================

echo ""
echo "========================================="
echo "  Trading Terminal Tests (9 tools)"
echo "========================================="

# Test 1: trading_get_markets - basic
run_test \
    "Get top markets" \
    "trading_get_markets" \
    '{"type":"top","limit":10}'

# Test 2: trading_get_markets - with DEX filter
run_test \
    "Get Raydium markets" \
    "trading_get_markets" \
    '{"dex":"raydium","limit":5}'

# Test 3: trading_get_pools - valid token
run_test \
    "Get pools for SOL" \
    "trading_get_pools" \
    '{"token":"So11111111111111111111111111111111111111112"}'

# Test 4: trading_get_pools - missing token (should fail)
run_test \
    "Get pools without token parameter" \
    "trading_get_pools" \
    '{}' \
    true

# Test 5: trading_get_market_data - SOL
run_test \
    "Get SOL market data" \
    "trading_get_market_data" \
    '{"mint":"So11111111111111111111111111111111111111112"}'

# Test 6: trading_get_trades - SOL trades
run_test \
    "Get recent SOL trades" \
    "trading_get_trades" \
    '{"mint":"So11111111111111111111111111111111111111112","limit":20}'

# Test 7: trading_get_trades - with mock source
run_test \
    "Get trades with mock data" \
    "trading_get_trades" \
    '{"mint":"So11111111111111111111111111111111111111112","source":"mock"}'

# Test 8: trading_get_positions - all positions
run_test \
    "Get all positions" \
    "trading_get_positions" \
    '{"status":"all"}'

# Test 9: trading_get_positions - open only
run_test \
    "Get open positions" \
    "trading_get_positions" \
    '{"status":"open"}'

# Test 10: trading_create_position - missing params (should fail)
run_test \
    "Create position without required params" \
    "trading_create_position" \
    '{"symbol":"SOL"}' \
    true

# Test 11: trading_create_position - valid (requires auth, may fail without JWT)
run_test \
    "Create long position (requires auth)" \
    "trading_create_position" \
    '{"symbol":"SOL","side":"long","amount":1}'

# Test 12: trading_close_position - missing params (should fail)
run_test \
    "Close position without ID" \
    "trading_close_position" \
    '{}' \
    true

# Test 13: trading_execute_trade - missing params (should fail)
run_test \
    "Execute trade without required params" \
    "trading_execute_trade" \
    '{"symbol":"SOL"}' \
    true

# Test 14: trading_execute_trade - valid (requires auth, may fail without JWT)
run_test \
    "Execute buy trade (requires auth)" \
    "trading_execute_trade" \
    '{"symbol":"SOL","side":"buy","amount":0.1,"slippage":2}'

# Test 15: trading_chat - valid message
run_test \
    "Trading chat with valid message" \
    "trading_chat" \
    '{"message":"What are the top trending tokens today?"}'

# Test 16: trading_chat - missing message (should fail)
run_test \
    "Trading chat without message" \
    "trading_chat" \
    '{}' \
    true

# ============================================================================
# OPENSVM CREDITS & USAGE TESTS
# ============================================================================

echo ""
echo "========================================="
echo "  OpenSVM Credits Tests (6 tools)"
echo "========================================="

# Test 17: opensvm_list_keys - all keys
run_test \
    "List all API keys (requires auth)" \
    "opensvm_list_keys" \
    '{}'

# Test 18: opensvm_list_keys - specific key
run_test \
    "Get specific API key (requires auth)" \
    "opensvm_list_keys" \
    '{"keyId":"test-key-id"}'

# Test 19: opensvm_create_key - missing name (should fail)
run_test \
    "Create API key without name" \
    "opensvm_create_key" \
    '{}' \
    true

# Test 20: opensvm_create_key - valid (requires auth)
run_test \
    "Create API key with name (requires auth)" \
    "opensvm_create_key" \
    '{"name":"Test Key","description":"Test key for integration"}'

# Test 21: opensvm_delete_key - missing keyId (should fail)
run_test \
    "Delete API key without keyId" \
    "opensvm_delete_key" \
    '{}' \
    true

# Test 22: opensvm_delete_key - valid (requires auth)
run_test \
    "Delete API key (requires auth)" \
    "opensvm_delete_key" \
    '{"keyId":"test-key-id"}'

# Test 23: opensvm_get_key_stats - get statistics
run_test \
    "Get API key statistics (requires auth)" \
    "opensvm_get_key_stats" \
    '{}'

# Test 24: opensvm_get_usage - basic query
run_test \
    "Get usage metrics (requires auth)" \
    "opensvm_get_usage" \
    '{"period":"day"}'

# Test 25: opensvm_get_usage - with filters
run_test \
    "Get filtered usage (requires auth)" \
    "opensvm_get_usage" \
    '{"period":"week","model":"claude-3-opus","limit":100}'

# Test 26: opensvm_get_usage - with date range
run_test \
    "Get usage by date range (requires auth)" \
    "opensvm_get_usage" \
    '{"startDate":"2025-01-01","endDate":"2025-11-23","groupBy":"model"}'

# Test 27: opensvm_get_balance - get balance
run_test \
    "Get credit balance (requires auth)" \
    "opensvm_get_balance" \
    '{}'

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "========================================="
echo "  Test Summary"
echo "========================================="
echo ""
echo "Total Tests:  ${TOTAL_TESTS}"
echo -e "Passed:       ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed:       ${RED}${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
