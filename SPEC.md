# Tech Spec: Strapi as MCP Tool Registry & Execution Layer

## Concept

Strapi acts as a **tool registry and webhook execution layer** for LLMs. You define "actions" in Strapi's admin panel — each action describes an outbound API call with its name, documentation, parameters, and HTTP configuration. An MCP server sits in front, reads those action definitions, and exposes them as tools to Claude. When Claude invokes a tool, the MCP server asks Strapi to execute the corresponding outbound request and returns the result.

**You add new capabilities to Claude by creating content entries in Strapi. No code changes, no redeployment.**

---

## User Workflow

### As an admin (you, in the Strapi admin panel):

1. Go to the **Actions** collection
2. Click "Create new entry"
3. Fill in:
   - **Name:** `get_weather`
   - **Description:** `Get the current weather for a city. Returns temperature, conditions, and humidity.`
   - **Method:** `GET`
   - **URL Template:** `https://wttr.in/{{city}}?format=j1`
   - **Headers:** `{}` (none needed for wttr.in)
   - **Parameters:** (a repeatable component with entries like)
     - name: `city`, type: `string`, description: `City name, e.g. "Paris"`, required: `true`
4. Save and publish

### As Claude (via MCP):

1. User asks: "What's the weather in Tokyo?"
2. Claude calls `list_actions` → gets back the `get_weather` action with its description and parameter schema
3. Claude calls `execute_action` with `{ action: "get_weather", params: { "city": "Tokyo" } }`
4. MCP server → Strapi API → Strapi resolves the URL template → fires `GET https://wttr.in/Tokyo?format=j1` → returns the weather JSON to Claude
5. Claude reads the JSON and says "It's 18°C and cloudy in Tokyo right now"

### To add a new capability later:

Just create another Action entry in Strapi. Example: a `send_slack_message` action with method POST, the Slack webhook URL, and a body template. Next time Claude calls `list_actions`, it discovers the new tool automatically. Zero code.

---

## Architecture

```
┌──────────────┐      stdio       ┌──────────────┐      HTTP       ┌──────────────┐      HTTP       ┌──────────────┐
│ Claude       │◄────────────────►│ MCP Server   │◄───────────────►│ Strapi v5    │───────────────►│ External API │
│ (Desktop/CC) │  MCP protocol    │ (thin Node)  │  REST API       │ (registry +  │  outbound      │ (wttr.in,    │
│              │                  │              │                 │   executor)  │  webhook       │  Slack, etc) │
└──────────────┘                  └──────────────┘                 └──────────────┘                └──────────────┘
```

**The MCP server is intentionally dumb.** It does two things:
1. Fetch action definitions from Strapi and expose them as MCP tools
2. Forward execution requests to Strapi and return results

**Strapi does the interesting work:**
1. Stores action definitions (the registry)
2. Resolves templates and fires outbound HTTP requests (the executor)

---

## Prerequisites

- Node.js >= 18
- A running Strapi v5 instance at `http://localhost:1337`
- An API token with full access

---

## Phase 0: Strapi Content Model Setup

### 0.1 — Content types to create

You need **one collection type** and **one component**.

#### Component: `action.parameter`

Location in Strapi: Components → create category `action` → create component `parameter`

| Field Name    | Type         | Notes                                      |
|---------------|--------------|---------------------------------------------|
| `name`        | Short text   | Required. The parameter key, e.g. `city`    |
| `type`        | Enumeration  | Values: `string`, `number`, `boolean`. Default: `string` |
| `description` | Short text   | Required. Shown to the LLM so it knows what to pass |
| `required`    | Boolean      | Default: `true`                             |
| `default_value` | Short text | Optional. Default value if the LLM doesn't provide one |

#### Collection Type: `Action`

| Field Name    | Type              | Notes                                                    |
|---------------|-------------------|----------------------------------------------------------|
| `name`        | Short text (UID)  | Required, unique. The tool name Claude sees, e.g. `get_weather`. Use snake_case. |
| `description` | Long text         | Required. This is the tool description the LLM reads to decide when/how to use it. Write it like you're explaining to a person. |
| `method`      | Enumeration       | Values: `GET`, `POST`, `PUT`, `DELETE`. Default: `GET`   |
| `url_template`| Short text        | Required. The outbound URL. Supports `{{param_name}}` placeholders for GET requests. E.g. `https://wttr.in/{{city}}?format=j1` |
| `headers`     | JSON              | Optional. Static headers to include in the outbound request. E.g. `{"Authorization": "Bearer xxx"}` |
| `body_template` | Long text       | Optional. For POST/PUT requests. A JSON string with `{{param_name}}` placeholders. E.g. `{"text": "{{message}}", "channel": "{{channel}}"}` |
| `parameters`  | Repeatable component (`action.parameter`) | The parameters this action accepts. Each one becomes a tool input field for the LLM. |
| `enabled`     | Boolean           | Default: `true`. Set to `false` to hide from the LLM without deleting. |

### 0.2 — API permissions

Go to **Settings → Users & Permissions → Roles → Public** (or use token-based auth).

For the `Action` content type, enable: `find`, `findOne`.

We only need read access from the MCP server — the MCP server never writes action definitions. Admins create those through the Strapi admin panel.

### 0.3 — Create an API token

1. Settings → API Tokens → Create new API Token
2. Name: `mcp-server`
3. Token type: **Full access** (or custom with read on Actions)
4. Save and copy the token

### 0.4 — Seed the first test action: `get_weather`

Either through the admin panel or via curl:

```bash
export STRAPI_TOKEN="your-token-here"

curl -X POST http://localhost:1337/api/actions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STRAPI_TOKEN" \
  -d '{
    "data": {
      "name": "get_weather",
      "description": "Get the current weather for a city. Returns temperature in Celsius, weather condition, humidity, and wind speed. The city parameter should be a city name like Paris, Tokyo, or New York.",
      "method": "GET",
      "url_template": "https://wttr.in/{{city}}?format=j1",
      "headers": {},
      "body_template": null,
      "parameters": [
        {
          "name": "city",
          "type": "string",
          "description": "City name, e.g. Paris, Tokyo, New York",
          "required": true,
          "default_value": null
        }
      ],
      "enabled": true
    }
  }'
```

**Verify it works manually:**

```bash
curl "https://wttr.in/Tokyo?format=j1" | head -20
```

You should get a JSON response with weather data.

---

## Phase 1: Strapi Custom Route — The Action Executor

This is the only custom code inside Strapi. We need one custom API endpoint that receives an action name + params, looks up the action definition, resolves templates, fires the outbound HTTP request, and returns the result.

### 1.1 — Create a custom API route in Strapi

Inside your Strapi project, create these files:

#### `src/api/action/routes/custom-routes.js`

```javascript
module.exports = {
  routes: [
    {
      method: "POST",
      path: "/actions/execute",
      handler: "action.execute",
      config: {
        // Adjust auth as needed. For MVP, allow with API token.
        policies: [],
      },
    },
  ],
};
```

#### `src/api/action/controllers/action.js`

This controller handles the `/api/actions/execute` endpoint.

**Request body:**

```json
{
  "action": "get_weather",
  "params": {
    "city": "Tokyo"
  }
}
```

**Logic:**

1. Receive `action` (string) and `params` (object) from the request body
2. Query the Actions collection: find the action where `name` equals the provided action name AND `enabled` is `true`. Populate the `parameters` component.
3. If not found, return 404 with `{ error: "Action not found or disabled" }`
4. **Validate params:** Check that all parameters marked `required` are present in `params`. For missing optional params, fill in `default_value` if defined. If a required param is missing, return 400 with a clear error listing the missing params.
5. **Resolve URL template:** Replace all `{{param_name}}` placeholders in `url_template` with URL-encoded param values.
6. **Resolve body template (if present):** Replace all `{{param_name}}` placeholders in `body_template` with param values. Parse the result as JSON.
7. **Resolve headers:** Parse the `headers` JSON field. Also replace `{{param_name}}` placeholders in header values (useful for dynamic auth tokens).
8. **Execute the outbound HTTP request** using Node's `fetch`:
   - Method: from the action definition
   - URL: resolved URL
   - Headers: resolved headers + `Content-Type: application/json` for POST/PUT
   - Body: resolved body (for POST/PUT only)
9. **Return the result:**
   - On success (2xx): `{ success: true, status: <http_status>, data: <parsed_response_body> }`
   - On non-2xx: `{ success: false, status: <http_status>, error: <response_body_as_string> }`
   - On network/fetch error: `{ success: false, error: <error_message> }`

**Template resolution implementation:**

```javascript
function resolveTemplate(template, params) {
  if (!template) return null;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (params[key] === undefined) return match; // leave unresolved placeholders as-is
    return params[key];
  });
}
```

For URL templates specifically, param values should be URI-encoded:

```javascript
function resolveUrlTemplate(template, params) {
  if (!template) return null;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (params[key] === undefined) return match;
    return encodeURIComponent(params[key]);
  });
}
```

#### `src/api/action/routes/action.js` (default Strapi routes)

Make sure the default CRUD routes still exist (Strapi generates these). The custom route file adds the `/execute` endpoint alongside them.

### 1.2 — Enable the execute endpoint permissions

After restarting Strapi, go to **Settings → Users & Permissions** and enable the `execute` action for the role your API token uses (or for Public if testing quickly).

---

## Phase 2: MCP Server Implementation

### 2.1 — Project setup

```bash
mkdir strapi-mcp-server
cd strapi-mcp-server
npm init -y
```

**package.json:**

```json
{
  "name": "strapi-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  }
}
```

```bash
npm install @modelcontextprotocol/sdk zod
```

### 2.2 — File structure

```
strapi-mcp-server/
├── package.json
├── src/
│   ├── index.js           # Entry point
│   └── strapi-client.js   # HTTP client for Strapi
└── README.md
```

This is deliberately minimal. The MCP server is thin because Strapi does the heavy lifting.

### 2.3 — `src/strapi-client.js`

Same as before — a thin fetch wrapper that talks to Strapi's REST API. See Phase 1.5 of the previous spec. Exports a `strapiRequest(method, path, body, params)` function.

### 2.4 — `src/index.js`

The MCP server exposes exactly **two tools**:

#### Tool 1: `list_actions`

- **Description:** "List all available actions with their descriptions and parameter schemas. Call this first to discover what you can do."
- **Input:** none
- **Behavior:**
  1. GET `/api/actions?filters[enabled][$eq]=true&populate=parameters`
  2. Transform each action entry into a clean object:
     ```json
     {
       "name": "get_weather",
       "description": "Get the current weather for a city...",
       "method": "GET",
       "parameters": [
         { "name": "city", "type": "string", "description": "City name...", "required": true }
       ]
     }
     ```
  3. Strip out Strapi metadata (documentId, createdAt, etc.) — the LLM doesn't need it
- **Output:** JSON array of action summaries

#### Tool 2: `execute_action`

- **Description:** "Execute a named action with the given parameters. Use list_actions first to see available actions and their required parameters."
- **Input schema (Zod):**
  - `action` (string, required) — the action name, e.g. `"get_weather"`
  - `params` (string, required) — JSON string of parameter values, e.g. `'{"city": "Tokyo"}'`
- **Behavior:**
  1. Parse `params` from JSON string to object. If invalid JSON, return error.
  2. POST to `/api/actions/execute` with body `{ action, params }`
  3. Return the response from Strapi
- **Output:** The result from Strapi's executor (which contains the external API's response)

**That's it. Two tools.** The MCP server doesn't know about weather, Slack, GitHub, or anything else. It only knows how to list and execute actions. Strapi holds all the intelligence about what actions exist and how to execute them.

### 2.5 — Server startup (`src/index.js` scaffold)

```javascript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { strapiRequest } from "./strapi-client.js";

// Validate env
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
if (!STRAPI_TOKEN) {
  console.error("ERROR: STRAPI_TOKEN environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "strapi-actions",
  version: "1.0.0",
});

// Register list_actions tool
server.tool(
  "list_actions",
  "List all available actions with descriptions and parameter schemas. Call this first.",
  {},
  async () => {
    // ... fetch from Strapi, transform, return
  }
);

// Register execute_action tool
server.tool(
  "execute_action",
  "Execute a named action with parameters. Use list_actions first to see what's available.",
  {
    action: z.string().describe("Action name from list_actions"),
    params: z.string().describe('JSON string of parameters, e.g. {"city": "Tokyo"}'),
  },
  async ({ action, params }) => {
    // ... parse params, POST to /api/actions/execute, return result
  }
);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Strapi Actions MCP server running");
```

---

## Phase 3: Testing

### 3.1 — Manual test of the Strapi executor

Before touching MCP, verify the execute endpoint works directly:

```bash
curl -X POST http://localhost:1337/api/actions/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STRAPI_TOKEN" \
  -d '{"action": "get_weather", "params": {"city": "London"}}'
```

**Expected response:**

```json
{
  "success": true,
  "status": 200,
  "data": {
    "current_condition": [...],
    "nearest_area": [...],
    "weather": [...]
  }
}
```

If this doesn't work, stop and fix Strapi before proceeding.

### 3.2 — Manual test of the MCP server

```bash
STRAPI_URL=http://localhost:1337 STRAPI_TOKEN=your-token echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node src/index.js
```

Should return a JSON-RPC response listing `list_actions` and `execute_action`.

### 3.3 — Claude Desktop config

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "strapi-actions": {
      "command": "node",
      "args": ["/absolute/path/to/strapi-mcp-server/src/index.js"],
      "env": {
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_TOKEN": "your-token-here"
      }
    }
  }
}
```

Restart Claude Desktop.

### 3.4 — Claude Code config

```bash
claude mcp add strapi-actions -- node /absolute/path/to/strapi-mcp-server/src/index.js
```

Or `.mcp.json`:

```json
{
  "mcpServers": {
    "strapi-actions": {
      "command": "node",
      "args": ["src/index.js"],
      "env": {
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_TOKEN": "your-token-here"
      }
    }
  }
}
```

### 3.5 — Test prompts

1. **"What can you do?"** — Claude should call `list_actions`, discover `get_weather`, and tell you about it
2. **"What's the weather in Paris?"** — Claude should call `execute_action` with `get_weather` and `{"city": "Paris"}`
3. **"Compare the weather in Tokyo and Berlin"** — Claude should call `execute_action` twice and summarize both

---

## Phase 4: Adding a Second Action (validates the pattern)

After the weather action works, add a second one to prove the "no-code" pattern. A good candidate:

### Example: `get_dad_joke`

Create in Strapi admin panel:

- **Name:** `get_dad_joke`
- **Description:** `Get a random dad joke. No parameters needed.`
- **Method:** `GET`
- **URL Template:** `https://icanhazdadjoke.com/`
- **Headers:** `{"Accept": "application/json"}`
- **Body Template:** (empty)
- **Parameters:** (none)
- **Enabled:** `true`

Save, publish. **Don't restart anything.** Go back to Claude and ask: "Tell me a dad joke." Claude should call `list_actions`, discover the new tool, and use it. That's the magic moment — you added a capability to the LLM by filling out a form.

---

## Known Gotchas

1. **Strapi v5 `documentId`:** When querying actions internally, use `documentId` (UUID string) not numeric `id`.
2. **Repeatable components:** The `parameters` field is a repeatable component. When querying via API, you must `populate=parameters` or `populate=*` to get the nested data. Without this, parameters will be `null`.
3. **Template resolution edge cases:** If a param value contains special characters (e.g. a city name like "São Paulo"), the URL encoder must handle UTF-8 correctly. Node's `encodeURIComponent` does this fine.
4. **stdout is sacred:** All MCP server logging must go to `stderr`. One stray `console.log` breaks the protocol.
5. **Strapi custom routes:** The custom `/actions/execute` route must be registered alongside the default CRUD routes, not replacing them. Make sure the routes file name is `custom-routes.js` (not overriding `action.js` routes).
6. **Action names must be unique:** The `name` field on the Action content type should be set as unique in Strapi's content type builder. The executor queries by name, so duplicates would cause problems.
7. **Headers JSON field:** Strapi's JSON field stores raw JSON. Make sure when creating actions via the admin panel that the headers field contains valid JSON (`{}` for empty, not blank).

---

## Success Criteria

- [ ] `get_weather` action exists in Strapi and is queryable via the API
- [ ] The `/api/actions/execute` endpoint resolves templates and fires outbound requests correctly
- [ ] MCP server starts and registers `list_actions` and `execute_action` tools
- [ ] Claude Desktop discovers the tools and can list available actions
- [ ] "What's the weather in Tokyo?" works end to end
- [ ] A second action (e.g. `get_dad_joke`) can be added via admin panel with no code changes and Claude discovers it immediately
- [ ] Errors (bad action name, missing required param) return clear messages that Claude can relay to the user
