#!/bin/bash
# Seed test actions into Strapi
# Usage: STRAPI_TOKEN=your-token ./seed.sh

STRAPI_URL="${STRAPI_URL:-http://localhost:1337}"

if [ -z "$STRAPI_TOKEN" ]; then
  echo "Error: STRAPI_TOKEN environment variable is required"
  echo "Usage: STRAPI_TOKEN=your-token ./seed.sh"
  exit 1
fi

echo "Using STRAPI_URL=$STRAPI_URL"
echo "Token length: ${#STRAPI_TOKEN} chars"
echo ""

echo "=== Seeding get_weather action (api) ==="
RESPONSE=$(curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST "${STRAPI_URL}/api/actions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \
  -d '{
    "data": {
      "name": "get_weather",
      "display_name": "Get Weather",
      "description": "Get the current weather for a city. Returns temperature in Celsius, weather condition, humidity, and wind speed.",
      "action_type": "api",
      "tags": ["weather", "utility"],
      "parameters": [
        {
          "name": "city",
          "type": "string",
          "description": "City name, e.g. Paris, Tokyo, New York",
          "required": true,
          "default_value": null
        }
      ],
      "api_config": {
        "method": "GET",
        "url_template": "https://wttr.in/{{city}}?format=j1",
        "headers": {},
        "body_template": null,
        "timeout_ms": 30000
      },
      "enabled": true
    }
  }')
HTTP_STATUS=$(echo "$RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/---HTTP_STATUS:[0-9]*---//')
echo "HTTP Status: $HTTP_STATUS"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

echo "=== Seeding get_dad_joke action (api) ==="
RESPONSE=$(curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST "${STRAPI_URL}/api/actions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \
  -d '{
    "data": {
      "name": "get_dad_joke",
      "display_name": "Get Dad Joke",
      "description": "Get a random dad joke. No parameters needed.",
      "action_type": "api",
      "tags": ["fun"],
      "parameters": [],
      "api_config": {
        "method": "GET",
        "url_template": "https://icanhazdadjoke.com/",
        "headers": {"Accept": "application/json"},
        "body_template": null,
        "timeout_ms": 30000
      },
      "enabled": true
    }
  }')
HTTP_STATUS=$(echo "$RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/---HTTP_STATUS:[0-9]*---//')
echo "HTTP Status: $HTTP_STATUS"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

echo "=== Seeding disk_usage action (bash) ==="
RESPONSE=$(curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST "${STRAPI_URL}/api/actions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}" \
  -d '{
    "data": {
      "name": "disk_usage",
      "display_name": "Disk Usage",
      "description": "Check disk usage for a given path. Returns human-readable disk usage summary.",
      "action_type": "bash",
      "tags": ["system", "utility"],
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "description": "Path to check disk usage for, e.g. / or /home",
          "required": false,
          "default_value": "."
        }
      ],
      "bash_config": {
        "command_template": "du -sh {{path}}",
        "timeout_ms": 10000,
        "working_directory": null,
        "allowed_commands": ["du"]
      },
      "enabled": true
    }
  }')
HTTP_STATUS=$(echo "$RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/---HTTP_STATUS:[0-9]*---//')
echo "HTTP Status: $HTTP_STATUS"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

echo "=== Verifying: listing all actions ==="
RESPONSE=$(curl -s -w "\n---HTTP_STATUS:%{http_code}---" "${STRAPI_URL}/api/actions?populate=*" \
  -H "Authorization: Bearer ${STRAPI_TOKEN}")
HTTP_STATUS=$(echo "$RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/---HTTP_STATUS:[0-9]*---//')
echo "HTTP Status: $HTTP_STATUS"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
