#!/bin/bash

# Bybit Webhook Testing Script
# Usage: ./test-webhook.sh [WORKER_URL]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKER_URL="${1:-https://your-worker-name.your-subdomain.workers.dev}"
WEBHOOK_TOKEN="k9P$Xz83!vW@b12N#rTe"

echo -e "${BLUE}=== Bybit Webhook Testing Suite ===${NC}"
echo -e "Worker URL: ${WORKER_URL}"
echo -e "Press CTRL+C to stop at any time\n"

# Function to make HTTP request and format response
test_request() {
    local test_name="$1"
    local endpoint="$2"
    local method="$3"
    local data="$4"
    
    echo -e "${YELLOW}Testing: ${test_name}${NC}"
    echo "Endpoint: ${endpoint}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nSTATUS:%{http_code}" "${WORKER_URL}${endpoint}")
    else
        response=$(curl -s -w "\nSTATUS:%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${WORKER_URL}${endpoint}")
    fi
    
    status_code=$(echo "$response" | tail -n1 | cut -d: -f2)
    response_body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "200" ]; then
        echo -e "${GREEN}✅ SUCCESS (Status: $status_code)${NC}"
    else
        echo -e "${RED}❌ FAILED (Status: $status_code)${NC}"
    fi
    
    echo "Response:"
    echo "$response_body" | python3 -m json.tool 2>/dev/null || echo "$response_body"
    echo -e "\n---\n"
    
    sleep 2  # Brief pause between tests
}

# Test 1: Health Check
test_request "Health Check" "/status" "GET" ""

# Test 2: Valid Buy Signal
buy_payload=$(cat <<EOF
{
    "token": "$WEBHOOK_TOKEN",
    "trendComposite": 4,
    "symbol": "BTCUSDT",
    "action": "buy",
    "timestamp": "$(date +%s)000",
    "price": "45000"
}
EOF
)
test_request "Buy Signal (TC > 3)" "/bybit" "POST" "$buy_payload"

# Test 3: Valid Sell Signal
sell_payload=$(cat <<EOF
{
    "token": "$WEBHOOK_TOKEN",
    "trendComposite": -4,
    "symbol": "ETHUSDT",
    "action": "sell",
    "timestamp": "$(date +%s)000",
    "price": "3000"
}
EOF
)
test_request "Sell Signal (TC < -3)" "/bybit" "POST" "$sell_payload"

# Test 4: Close Positions Signal
close_payload=$(cat <<EOF
{
    "token": "$WEBHOOK_TOKEN",
    "trendComposite": 0,
    "symbol": "BTCUSDT",
    "action": "close",
    "timestamp": "$(date +%s)000",
    "price": "45000"
}
EOF
)
test_request "Close All Positions" "/bybit" "POST" "$close_payload"

# Test 5: Hold Signal (weak signal)
hold_payload=$(cat <<EOF
{
    "token": "$WEBHOOK_TOKEN",
    "trendComposite": 2,
    "symbol": "BTCUSDT",
    "action": "hold",
    "timestamp": "$(date +%s)000",
    "price": "45000"
}
EOF
)
test_request "Hold Signal (Weak TC)" "/bybit" "POST" "$hold_payload"

# Test 6: Invalid Token
invalid_token_payload=$(cat <<EOF
{
    "token": "invalid-token",
    "trendComposite": 4,
    "symbol": "BTCUSDT",
    "action": "buy",
    "timestamp": "$(date +%s)000",
    "price": "45000"
}
EOF
)
test_request "Invalid Token (Should Fail)" "/bybit" "POST" "$invalid_token_payload"

# Test 7: Invalid JSON
echo -e "${YELLOW}Testing: Invalid JSON (Should Fail)${NC}"
echo "Endpoint: /bybit"
response=$(curl -s -w "\nSTATUS:%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{invalid json" \
    "${WORKER_URL}/bybit")
status_code=$(echo "$response" | tail -n1 | cut -d: -f2)
if [ "$status_code" = "400" ]; then
    echo -e "${GREEN}✅ SUCCESS (Status: $status_code) - Correctly rejected invalid JSON${NC}"
else
    echo -e "${RED}❌ FAILED (Status: $status_code) - Should have returned 400${NC}"
fi
echo -e "\n---\n"

# Test 8: Unsupported Symbol
unsupported_symbol_payload=$(cat <<EOF
{
    "token": "$WEBHOOK_TOKEN",
    "trendComposite": 4,
    "symbol": "FAKECOIN",
    "action": "buy",
    "timestamp": "$(date +%s)000",
    "price": "100"
}
EOF
)
test_request "Unsupported Symbol" "/bybit" "POST" "$unsupported_symbol_payload"

# Test 9: Missing Required Fields
incomplete_payload=$(cat <<EOF
{
    "token": "$WEBHOOK_TOKEN",
    "trendComposite": 4
}
EOF
)
test_request "Incomplete Payload" "/bybit" "POST" "$incomplete_payload"

# Test 10: CORS Preflight
echo -e "${YELLOW}Testing: CORS Preflight${NC}"
echo "Endpoint: /bybit"
response=$(curl -s -w "\nSTATUS:%{http_code}" -X OPTIONS "${WORKER_URL}/bybit")
status_code=$(echo "$response" | tail -n1 | cut -d: -f2)
if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ SUCCESS (Status: $status_code)${NC}"
else
    echo -e "${RED}❌ FAILED (Status: $status_code)${NC}"
fi
echo -e "\n---\n"

echo -e "${BLUE}=== Testing Complete ===${NC}"
echo -e "Review the results above. All tests with ✅ are working correctly."
echo -e "Tests with ❌ may indicate issues that need investigation."
echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "1. If health check passed, your worker is deployed correctly"
echo -e "2. If buy/sell tests passed, trading functionality is working"
echo -e "3. Check Bybit testnet interface to confirm orders were placed"
echo -e "4. Set up TradingView alerts using the webhook URL: ${WORKER_URL}/bybit"