#!/bin/bash
# Test the full pipeline
# Usage: STRAPI_TOKEN=your-token ./test.sh

STRAPI_URL="${STRAPI_URL:-http://localhost:1337}"

if [ -z "$STRAPI_TOKEN" ]; then
  echo "Error: STRAPI_TOKEN environment variable is required"
  exit 1
fi

echo "=== Test 1: List actions ==="
curl -s "${STRAPI_URL}/api/actions?filters[enabled][\$eq]=true&populate=parameters" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" | python3 -m json.tool
echo ""

echo "=== Test 2: Execute get_weather (London) ==="
curl -s -X POST "${STRAPI_URL}/api/actions/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \
  -d '{"action": "get_weather", "params": {"city": "London"}}' | python3 -m json.tool
echo ""

echo "=== Test 3: Execute get_dad_joke ==="
curl -s -X POST "${STRAPI_URL}/api/actions/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \
  -d '{"action": "get_dad_joke", "params": {}}' | python3 -m json.tool
echo ""

echo "=== Test 4: Error case - missing param ==="
curl -s -X POST "${STRAPI_URL}/api/actions/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \
  -d '{"action": "get_weather", "params": {}}' | python3 -m json.tool
echo ""

echo "=== Test 5: Error case - unknown action ==="
curl -s -X POST "${STRAPI_URL}/api/actions/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \
  -d '{"action": "does_not_exist", "params": {}}' | python3 -m json.tool
