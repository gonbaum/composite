# Strapi as MCP

A system that turns **Strapi v5 into a no-code tool registry for LLMs**. Define actions (API calls, bash commands, or multi-step composites) in Strapi's admin panel or the included React dashboard — a thin MCP server exposes them as tools to Claude. Adding a new capability requires only filling out a form. No code changes, no redeployments.

## Architecture

```
Claude (Desktop / Claude Code)
    |  MCP protocol (stdio)
    v
strapi-mcp-server/          ← thin bridge: list_actions + execute_action
    |
    |  HTTP (fetch)
    v
strapi/                      ← Strapi v5: action registry + executor
    ^
    |  HTTP (proxied, authenticated)
    |
mcp-dashboard/               ← React SPA on Vercel
```

### How execution works

| Action type | Who resolves templates? | Who executes? |
|---|---|---|
| **API** | Strapi (server-side) | Strapi — fires the HTTP request, injects auth credentials, returns the response |
| **Bash** | Strapi (server-side) | MCP server — receives the resolved command, runs it locally via `execFile` |
| **Composite** | Strapi (server-side) | MCP server — runs steps sequentially, calling Strapi for each sub-action |

**Key security property:** Auth credentials (bearer tokens, custom headers) are stored in Strapi with private fields. They are resolved and injected server-side — the MCP server and Claude never see raw credentials.

## Components

### Strapi Backend (`strapi/`)

Strapi v5 with three content types:

- **Action** — name, description, type (`api`/`bash`/`composite`), parameters, type-specific config, optional auth credential
- **Auth Credential** — name, type (`bearer`/`custom_headers`), private token/headers fields
- **Action Log** — audit trail of every execution (params, response, duration, source)

Custom endpoint: `POST /api/actions/execute` — resolves templates, executes API actions, returns resolved plans for bash/composite.

### MCP Server (`strapi-mcp-server/`)

Exposes two MCP tools:

- **`list_actions`** — fetches enabled actions from Strapi, returns clean definitions (what Claude sees)
- **`execute_action`** — sends `{ action, params }` to Strapi's execute endpoint, handles bash/composite execution locally

### Dashboard (`mcp-dashboard/`)

React SPA deployed on Vercel. Password-protected — the Strapi API token never reaches the client.

- **Actions page** — list, search, filter by type, inline enable/disable toggle, test, delete
- **Create/Edit Action** — form with live MCP preview (what Claude will see) and in-page test runner
- **Credentials page** — manage auth credentials
- **History page** — filterable audit log of all executions

All dashboard requests go through a Vercel serverless proxy (`api/proxy.ts`) that validates the session cookie and injects the Strapi token server-side.

## Setup

### Prerequisites

- Node.js >= 20
- A Strapi v5 instance (local or Strapi Cloud)

### 1. Strapi

```bash
cd strapi
cp .env.example .env
npm install
npm run develop
```

Strapi runs at `http://localhost:1337`. Create an API token in the admin panel (Settings > API Tokens) with full access.

### 2. MCP Server

```bash
cd strapi-mcp-server
npm install
```

Add to your Claude Desktop / Claude Code MCP config:

```json
{
  "mcpServers": {
    "strapi-actions": {
      "command": "node",
      "args": ["/path/to/strapi-mcp-server/src/index.js"],
      "env": {
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_TOKEN": "your-strapi-api-token"
      }
    }
  }
}
```

### 3. Dashboard (local dev)

```bash
cd mcp-dashboard
cp .env.example .env
# Edit .env with your VITE_STRAPI_URL and VITE_STRAPI_TOKEN
npm install
npm run dev
```

Dashboard runs at `http://localhost:5173`. In dev mode, auth is bypassed — the Vite proxy forwards requests directly to Strapi.

### 4. Dashboard (Vercel production)

Deploy the `mcp-dashboard/` directory to Vercel with root directory set to `mcp-dashboard`.

Required environment variables on Vercel:

| Variable | Description |
|---|---|
| `STRAPI_URL` | Your Strapi Cloud URL (e.g. `https://xxx.strapiapp.com`) |
| `STRAPI_TOKEN` | Strapi API token with full access |
| `DASHBOARD_PASSWORD` | Shared password for dashboard login |

Also add your Vercel deployment URL to Strapi's CORS config (`strapi/config/middlewares.ts` reads `DASHBOARD_URL` env var).

### 5. Seed data

```bash
# Local
STRAPI_TOKEN=your-token node scripts/seed.mjs

# Production
node scripts/seed.mjs --url https://your-instance.strapiapp.com --token your-token

# Clean and re-seed
node scripts/seed.mjs --url ... --token ... --clean
```

Creates 5 demo actions: get_weather, get_dad_joke, get_cat_fact, get_random_image, disk_usage.

## Project Structure

```
strapi-as-mcp/
├── strapi/                    # Strapi v5 backend
│   └── src/api/
│       ├── action/            # Action content type + execute endpoint
│       ├── auth-credential/   # Auth credential content type
│       └── action-log/        # Audit log content type
├── strapi-mcp-server/         # MCP server (Node.js)
│   └── src/
│       ├── index.js           # MCP tools: list_actions, execute_action
│       ├── strapi-client.js   # Strapi API client
│       └── executors.js       # Bash + composite execution
├── mcp-dashboard/             # React dashboard (Vite + Vercel)
│   ├── api/                   # Vercel serverless functions
│   │   ├── login.ts           # POST /api/login
│   │   ├── logout.ts          # POST /api/logout
│   │   └── proxy.ts           # Authenticated Strapi proxy
│   ├── src/
│   │   ├── pages/             # React pages
│   │   ├── components/        # UI components (shadcn/ui)
│   │   └── lib/strapi.ts      # API client (calls /api/strapi/*)
│   └── vercel.json            # Rewrites config
└── scripts/
    └── seed.mjs               # Seed script for demo actions
```
