#!/bin/bash

# MCP Server Test Script
# Tests all osvm-mcp tools and validates responses

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_ADDRESS="vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg"
TEST_TX_SIG=""  # Will be fetched dynamically
TEST_TOKEN_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
MCP_SERVER_PATH="$HOME/.osvm/mcp/osvm-mcp/build/index.js"
TEMP_DIR="/tmp/osvm-mcp-test-$$"

# Counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Create temp directory
mkdir -p "$TEMP_DIR"

# Cleanup function
cleanup() {
    echo -e "\n${BLUE}Cleaning up...${NC}"
    rm -rf "$TEMP_DIR"
    exit 0
}

trap cleanup EXIT INT TERM

# Print header
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Call MCP tool
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

# Validate JSON response
validate_json() {
    local response="$1"
    local test_name="$2"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    # Check if response is valid JSON
    if ! echo "$response" | jq empty 2>/dev/null; then
        echo -e "${RED}✗ $test_name - Invalid JSON response${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi

    # Check for error in response
    local error=$(echo "$response" | jq -r '.error // empty')
    if [ -n "$error" ]; then
        echo -e "${RED}✗ $test_name - Error: $error${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi

    # Check for result
    local result=$(echo "$response" | jq -r '.result // empty')
    if [ -z "$result" ]; then
        echo -e "${RED}✗ $test_name - No result in response${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi

    echo -e "${GREEN}✓ $test_name${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
}

# Validate specific field exists in response
validate_field() {
    local response="$1"
    local field_path="$2"
    local test_name="$3"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    local field_value=$(echo "$response" | jq -r "$field_path // empty")
    if [ -z "$field_value" ] || [ "$field_value" == "null" ]; then
        echo -e "${RED}✗ $test_name - Missing field: $field_path${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi

    echo -e "${GREEN}✓ $test_name - Field exists: $field_path = $field_value${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
}

# Get recent transaction signature
get_test_transaction() {
    echo -e "${YELLOW}Fetching test transaction signature...${NC}"
    TEST_TX_SIG=$(curl -s -X POST 'https://api.mainnet-beta.solana.com' \
        -H 'Content-Type: application/json' \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getSignaturesForAddress\",\"params\":[\"$TEST_ADDRESS\",{\"limit\":1}]}" \
        | jq -r '.result[0].signature')

    if [ -z "$TEST_TX_SIG" ] || [ "$TEST_TX_SIG" == "null" ]; then
        echo -e "${RED}Failed to fetch test transaction${NC}"
        exit 1
    fi

    echo -e "${GREEN}Using transaction: $TEST_TX_SIG${NC}"
}

# Verify MCP server exists
verify_server() {
    print_header "Verifying MCP Server"

    if [ ! -f "$MCP_SERVER_PATH" ]; then
        echo -e "${RED}MCP server not found at: $MCP_SERVER_PATH${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ MCP server found${NC}"

    # Test server starts
    if ! echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node "$MCP_SERVER_PATH" 2>/dev/null | head -1 | jq empty 2>/dev/null; then
        echo -e "${RED}MCP server failed to start${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ MCP server starts successfully${NC}"
}

# Test account tools
test_account_tools() {
    print_header "Testing Account Tools"

    # Test get_account_stats
    echo -e "\n${YELLOW}Testing get_account_stats...${NC}"
    local response=$(call_mcp_tool "get_account_stats" "{\"address\":\"$TEST_ADDRESS\"}")
    validate_json "$response" "get_account_stats returns valid JSON"

    # Parse the content
    local content=$(echo "$response" | jq -r '.result.content[0].text')
    validate_field "$content" '.totalTransactions' "get_account_stats has totalTransactions"
    validate_field "$content" '.tokenTransfers' "get_account_stats has tokenTransfers"
    validate_field "$content" '.lastUpdated' "get_account_stats has lastUpdated"

    # Test get_account_portfolio
    echo -e "\n${YELLOW}Testing get_account_portfolio...${NC}"
    response=$(call_mcp_tool "get_account_portfolio" "{\"address\":\"$TEST_ADDRESS\"}")
    validate_json "$response" "get_account_portfolio returns valid JSON"

    content=$(echo "$response" | jq -r '.result.content[0].text')
    validate_field "$content" '.data.native.balance' "get_account_portfolio has native balance"
    validate_field "$content" '.data.native.price' "get_account_portfolio has SOL price"
    validate_field "$content" '.data.tokens' "get_account_portfolio has tokens array"
    validate_field "$content" '.data.totalValue' "get_account_portfolio has totalValue"

    # Test get_solana_balance
    echo -e "\n${YELLOW}Testing get_solana_balance...${NC}"
    response=$(call_mcp_tool "get_solana_balance" "{\"address\":\"$TEST_ADDRESS\"}")
    validate_json "$response" "get_solana_balance returns valid JSON"

    content=$(echo "$response" | jq -r '.result.content[0].text')
    validate_field "$content" '.native.balance' "get_solana_balance has native.balance"
    validate_field "$content" '.native.symbol' "get_solana_balance has native.symbol"
    validate_field "$content" '.tokens' "get_solana_balance has tokens array"
    validate_field "$content" '.timestamp' "get_solana_balance has timestamp"

    # Test get_account_transactions
    echo -e "\n${YELLOW}Testing get_account_transactions...${NC}"
    response=$(call_mcp_tool "get_account_transactions" "{\"address\":\"$TEST_ADDRESS\",\"limit\":5}")
    validate_json "$response" "get_account_transactions returns valid JSON"
}

# Test transaction tools
test_transaction_tools() {
    print_header "Testing Transaction Tools"

    # Test get_transaction
    echo -e "\n${YELLOW}Testing get_transaction...${NC}"
    local response=$(call_mcp_tool "get_transaction" "{\"signature\":\"$TEST_TX_SIG\"}")
    validate_json "$response" "get_transaction returns valid JSON"

    local content=$(echo "$response" | jq -r '.result.content[0].text')
    validate_field "$content" '.signature' "get_transaction has signature"
    validate_field "$content" '.timestamp' "get_transaction has timestamp"
    validate_field "$content" '.slot' "get_transaction has slot"
    validate_field "$content" '.success' "get_transaction has success status"
    validate_field "$content" '.details' "get_transaction has details"
}

# Test block tools
test_block_tools() {
    print_header "Testing Block Tools"

    # Get current slot
    echo -e "\n${YELLOW}Testing get_block_stats...${NC}"
    local response=$(call_mcp_tool "get_block_stats" "{}")
    validate_json "$response" "get_block_stats returns valid JSON"

    # Test get_recent_blocks
    echo -e "\n${YELLOW}Testing get_recent_blocks...${NC}"
    response=$(call_mcp_tool "get_recent_blocks" "{\"limit\":5}")
    validate_json "$response" "get_recent_blocks returns valid JSON"
}

# Test analytics tools
test_analytics_tools() {
    print_header "Testing Analytics Tools"

    # Test get_defi_overview
    echo -e "\n${YELLOW}Testing get_defi_overview...${NC}"
    local response=$(call_mcp_tool "get_defi_overview" "{}")
    validate_json "$response" "get_defi_overview returns valid JSON"

    local content=$(echo "$response" | jq -r '.result.content[0].text')
    validate_field "$content" '.data.totalTvl' "get_defi_overview has totalTvl"
    validate_field "$content" '.data.totalVolume24h' "get_defi_overview has totalVolume24h"
    validate_field "$content" '.data.topProtocols' "get_defi_overview has topProtocols"

    # Test get_validator_analytics
    echo -e "\n${YELLOW}Testing get_validator_analytics...${NC}"
    response=$(call_mcp_tool "get_validator_analytics" "{}")
    validate_json "$response" "get_validator_analytics returns valid JSON"
}

# Test token tools
test_token_tools() {
    print_header "Testing Token Tools"

    # Test get_token_info
    echo -e "\n${YELLOW}Testing get_token_info...${NC}"
    local response=$(call_mcp_tool "get_token_info" "{\"address\":\"$TEST_TOKEN_MINT\"}")
    validate_json "$response" "get_token_info returns valid JSON"

    local content=$(echo "$response" | jq -r '.result.content[0].text')
    validate_field "$content" '.metadata.symbol' "get_token_info has symbol"
    validate_field "$content" '.decimals' "get_token_info has decimals"
}

# Test search tools
test_search_tools() {
    print_header "Testing Search Tools"

    # Test universal_search
    echo -e "\n${YELLOW}Testing universal_search...${NC}"
    local response=$(call_mcp_tool "universal_search" "{\"query\":\"$TEST_ADDRESS\"}")
    validate_json "$response" "universal_search returns valid JSON"
}

# Test utility tools
test_utility_tools() {
    print_header "Testing Utility Tools"

    # Test solana_rpc_call
    echo -e "\n${YELLOW}Testing solana_rpc_call...${NC}"
    local response=$(call_mcp_tool "solana_rpc_call" "{\"method\":\"getSlot\"}")
    validate_json "$response" "solana_rpc_call returns valid JSON"

    local content=$(echo "$response" | jq -r '.result.content[0].text')
    validate_field "$content" '.result' "solana_rpc_call has result"

    # Test with parameters
    echo -e "\n${YELLOW}Testing solana_rpc_call with getVersion...${NC}"
    response=$(call_mcp_tool "solana_rpc_call" "{\"method\":\"getVersion\"}")
    validate_json "$response" "solana_rpc_call with getVersion returns valid JSON"
}

# Print summary
print_summary() {
    print_header "Test Summary"

    echo -e "\n${BLUE}Total Tests:${NC} $TESTS_TOTAL"
    echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
    echo -e "${RED}Failed:${NC} $TESTS_FAILED"

    local pass_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    echo -e "\n${BLUE}Pass Rate:${NC} $pass_rate%"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}\n"
        exit 0
    else
        echo -e "\n${RED}⚠️  Some tests failed${NC}\n"
        exit 1
    fi
}

# Main execution
main() {
    print_header "OpenSVM MCP Server Test Suite"
    echo -e "Testing MCP server at: ${BLUE}$MCP_SERVER_PATH${NC}"
    echo -e "Test address: ${BLUE}$TEST_ADDRESS${NC}\n"

    # Verify server
    verify_server

    # Get test transaction
    get_test_transaction

    # Run test suites
    test_account_tools
    test_transaction_tools
    test_block_tools
    test_analytics_tools
    test_token_tools
    test_search_tools
    test_utility_tools

    # Print summary
    print_summary
}

# Run main
main
