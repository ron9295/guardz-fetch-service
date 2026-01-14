#!/bin/bash

BASE_URL="http://localhost:3000/api/v1/scans"
KEY_A="tt"
KEY_B="tt"
LIMIT=20

echo "Testing Rate Limiting on POST $BASE_URL (Limit: $LIMIT/min)"

# Function to send request
send_request() {
    local key=$1
    local id=$2
    # We send an empty body which might fail validation, but should count for rate limiting
    # We grep http_code to see 429
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
        -H "x-api-key: $key" \
        -H "Content-Type: application/json" \
        -d '{"urls": ["http://google.com"]}')
    echo "Req $id (Key: $key): $code"
    return $code
}

echo "--- Sending 15 requests with Key A (should pass) ---"
for i in {1..10}; do
    send_request "$KEY_A" "$i"
    # assert not 429
done

echo "--- Sending 6 more requests with Key A (should hit 429) ---"
for i in {10..20}; do
    send_request "$KEY_A" "$i"
done

echo "--- Sending 1 request with Key B (should pass - separate bucket) ---"
send_request "$KEY_B" "1"

echo "Done."
