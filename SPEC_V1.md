# SPEC 2: Action Types, Authentication, Bash Execution & Admin Plugin

## Context

This builds on top of the MVP (SPEC 1) which established:
- Strapi as a tool registry with an `Action` content type
- A thin MCP server with `list_actions` and `execute_action`
- A custom `/api/actions/execute` endpoint in Strapi that resolves templates and fires outbound requests
- A working `get_weather` test action

**This spec adds:**
1. Multiple action types (API calls, bash scripts, and a new one: composites)
2. Authentication management for API actions
3. A Strapi admin panel plugin for managing actions visually (instead of raw content type forms)

---

## Part 1: Revised Content Model

### 1.1 — Updated `Action` content type

Replace the existing Action content type with this expanded version. The key change: the `action_type` field determines what happens at execution time.

| Field Name      | Type              | Notes                                                                 |
|-----------------|-------------------|-----------------------------------------------------------------------|
| `name`          | Short text (UID)  | Required, unique. Snake_case. e.g. `get_weather`, `restart_nginx`     |
| `display_name`  | Short text        | Required. Human-readable. e.g. "Get Weather", "Restart Nginx"         |
| `description`   | Long text         | Required. Written for the LLM — explain when and how to use this.     |
| `action_type`   | Enumeration       | Values: `api`, `bash`, `composite`. Required.                         |
| `enabled`       | Boolean           | Default: `true`                                                       |
| `tags`          | JSON              | Optional. Array of strings for categorization. e.g. `["devops", "monitoring"]` |
| `parameters`    | Repeatable component (`action.parameter`) | Same as SPEC 1                              |
| `api_config`    | Component (`action.api_config`) | Required when `action_type` is `api`. Null otherwise.     |
| `bash_config`   | Component (`action.bash_config`) | Required when `action_type` is `bash`. Null otherwise.   |
| `composite_config` | Component (`action.composite_config`) | Required when `action_type` is `composite`. Null otherwise. |
| `auth`          | Relation (many-to-one) | Optional. Links to an `Auth Credential` entry. Only relevant for `api` type. |

### 1.2 — New component: `action.api_config`

This replaces the old url_template/method/headers/body_template fields, now scoped to API-type actions only.

| Field Name      | Type         | Notes                                                    |
|-----------------|--------------|----------------------------------------------------------|
| `method`        | Enumeration  | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Default: `GET`  |
| `url_template`  | Short text   | Required. Supports `{{param}}` placeholders.             |
| `headers`       | JSON         | Optional. Static headers. `{{param}}` supported in values. |
| `body_template` | Long text    | Optional. JSON string with `{{param}}` placeholders.     |
| `timeout_ms`    | Integer      | Optional. Default: 30000. Request timeout in milliseconds.|

### 1.3 — New component: `action.bash_config`

| Field Name        | Type         | Notes                                                    |
|-------------------|--------------|----------------------------------------------------------|
| `command_template` | Long text   | Required. The bash command/script. Supports `{{param}}` placeholders. E.g. `docker ps --filter name={{service_name}}` |
| `timeout_ms`      | Integer      | Optional. Default: 30000. Kill the process after this.   |
| `working_directory` | Short text | Optional. `cwd` for the child process. Defaults to MCP server root. |
| `allowed_commands` | JSON        | Optional. Whitelist array of allowed base commands. E.g. `["docker", "curl", "ls", "cat"]`. If set, the executor validates the command starts with one of these before running. If null, all commands are allowed (use with caution). |

**IMPORTANT SECURITY NOTE:** Bash execution runs on the **MCP server's host machine**, not inside Strapi. The Strapi executor endpoint sends the resolved command to the MCP server, which runs it locally. See section 2.3 for the architecture change this requires.

### 1.4 — New component: `action.composite_config`

A composite action runs multiple other actions in sequence. This lets you build simple workflows without code.

| Field Name | Type | Notes |
|---|---|---|
| `steps` | JSON | Required. Array of step objects. Each step: `{ "action": "action_name", "params": { ... } }`. Params support `{{param}}` from the composite's own parameters AND `{{step_N_result}}` to reference the JSON output of step N (0-indexed). |
| `stop_on_error` | Boolean | Default: `true`. If a step fails, stop and return the error. If false, continue and return all results. |

**Example composite:**

```json
{
  "steps": [
    { "action": "get_weather", "params": { "city": "{{city}}" } },
    { "action": "send_slack_message", "params": { "message": "Weather in {{city}}: {{step_0_result}}" } }
  ],
  "stop_on_error": true
}
```

### 1.5 — New collection type: `Auth Credential`

Stores authentication configurations that can be reused across multiple API actions.

| Field Name    | Type         | Notes                                                              |
|---------------|--------------|--------------------------------------------------------------------|
| `name`        | Short text   | Required, unique. E.g. `github_token`, `slack_bot`                 |
| `display_name`| Short text   | Required. E.g. "GitHub Personal Access Token"                      |
| `auth_type`   | Enumeration  | Values: `bearer`, `custom_headers`. Required.                      |
| `bearer_token`| Text (private) | For `bearer` type. The token value. **This field must be marked as private in Strapi so it's never exposed via the public API.** |
| `custom_headers` | JSON (private) | For `custom_headers` type. Key-value object. E.g. `{"X-API-Key": "abc123", "X-Custom-Auth": "xyz"}`. **Also private.** |
| `description` | Short text   | Optional. Notes about where this credential came from, when it expires, etc. |

**Private fields:** Strapi v5 supports marking fields as "private" in the content type builder, which excludes them from API responses. The `bearer_token` and `custom_headers` fields MUST be private. They should only be accessed server-side by the execute controller, never returned to the MCP server or LLM.

**API permissions for Auth Credential:** The MCP server / public API should have NO read access to this collection. Only the Strapi server-side controller (the executor) reads credentials internally via `strapi.documents('api::auth-credential.auth-credential').findOne(...)`.

---

## Part 2: Revised Execution Architecture

### 2.1 — The split execution problem

In SPEC 1, Strapi did all the execution (resolve template → fire HTTP request). Now we have bash scripts, which **must NOT run inside Strapi** — they need to run on the MCP server's host machine. This changes the architecture slightly.

**New rule:** Strapi is the **registry and resolver**, the MCP server is the **executor**.

```
┌────────────┐        ┌─────────────┐        ┌─────────────┐        ┌──────────────┐
│ Claude     │ stdio  │ MCP Server  │ HTTP   │ Strapi      │ HTTP   │ External API │
│            │◄──────►│             │◄──────►│             │───────►│              │
│            │        │ Executes:   │        │ Resolves:   │        │              │
│            │        │ - bash      │        │ - templates │        │              │
│            │        │ - api calls │        │ - auth      │        │              │
│            │        │ - composites│        │ - params    │        │              │
└────────────┘        └─────────────┘        └─────────────┘        └──────────────┘
```

### 2.2 — Revised `/api/actions/execute` endpoint (Strapi side)

The Strapi endpoint changes role. Instead of executing the outbound request itself, it now **resolves everything and returns an execution plan** that the MCP server carries out.

**New request body (unchanged):**

```json
{
  "action": "get_weather",
  "params": { "city": "Tokyo" }
}
```

**New response — returns a resolved execution plan:**

For `api` type:

```json
{
  "action_type": "api",
  "resolved": {
    "method": "GET",
    "url": "https://wttr.in/Tokyo?format=j1",
    "headers": {
      "Authorization": "Bearer ghp_xxxx"
    },
    "body": null,
    "timeout_ms": 30000
  }
}
```

For `bash` type:

```json
{
  "action_type": "bash",
  "resolved": {
    "command": "docker ps --filter name=web-app",
    "timeout_ms": 30000,
    "working_directory": "/home/deploy",
    "allowed_commands": ["docker", "curl", "ls"]
  }
}
```

For `composite` type:

```json
{
  "action_type": "composite",
  "resolved": {
    "steps": [
      { "action": "get_weather", "params": { "city": "Tokyo" } },
      { "action": "send_slack_message", "params": { "message": "Weather update: {{step_0_result}}" } }
    ],
    "stop_on_error": true
  }
}
```

**What the Strapi controller does now:**

1. Look up the action by name (same as before)
2. Validate params (same as before)
3. Resolve all templates (url, headers, body, command) with param values
4. **For API actions with an `auth` relation:** Fetch the linked Auth Credential entry server-side (using `strapi.documents()`), and merge authentication into the resolved headers:
   - `bearer` type: Add `Authorization: Bearer <token>` to headers
   - `custom_headers` type: Merge all key-value pairs into headers
5. Return the resolved plan — **do NOT execute it**

**This is the key change:** Auth credentials are resolved server-side in Strapi (where they're stored securely and marked private), but the actual HTTP call or bash execution happens in the MCP server. The credentials travel from Strapi → MCP server in the resolved plan response. This is acceptable because the MCP server runs locally on the same machine (or trusted network). If this were a remote setup, you'd want TLS between them.

### 2.3 — Revised MCP server execution logic

The MCP server's `execute_action` tool now does:

1. POST to Strapi `/api/actions/execute` with action name + params
2. Receive the resolved execution plan
3. Based on `action_type`, execute:

**For `api`:**

```javascript
async function executeApi(resolved) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolved.timeout_ms || 30000);
  
  try {
    const response = await fetch(resolved.url, {
      method: resolved.method,
      headers: resolved.headers || {},
      body: resolved.body ? JSON.stringify(resolved.body) : undefined,
      signal: controller.signal,
    });
    
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    
    return { success: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}
```

**For `bash`:**

```javascript
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function executeBash(resolved) {
  // Security: validate against allowed_commands whitelist
  if (resolved.allowed_commands && resolved.allowed_commands.length > 0) {
    const baseCommand = resolved.command.trim().split(/\s+/)[0];
    if (!resolved.allowed_commands.includes(baseCommand)) {
      return {
        success: false,
        error: `Command "${baseCommand}" not in allowed list: [${resolved.allowed_commands.join(", ")}]`
      };
    }
  }
  
  try {
    const { stdout, stderr } = await execFileAsync("bash", ["-c", resolved.command], {
      timeout: resolved.timeout_ms || 30000,
      cwd: resolved.working_directory || process.cwd(),
      maxBuffer: 1024 * 1024, // 1MB output limit
    });
    
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stderr: err.stderr?.trim() || null,
      exitCode: err.code || null,
    };
  }
}
```

**IMPORTANT:** Use `execFile` with `bash -c`, NOT `exec`. `execFile` doesn't spawn a shell implicitly, which gives us slightly more control. The `allowed_commands` whitelist is the primary safety mechanism.

**For `composite`:**

```javascript
async function executeComposite(resolved, strapiClient) {
  const results = [];
  
  for (let i = 0; i < resolved.steps.length; i++) {
    const step = resolved.steps[i];
    
    // Replace {{step_N_result}} references in params
    const resolvedParams = resolveStepReferences(step.params, results);
    
    // Recursive: call the same execute flow for each step
    const result = await executeAction(step.action, resolvedParams, strapiClient);
    results.push(result);
    
    if (!result.success && resolved.stop_on_error) {
      return {
        success: false,
        error: `Step ${i} (${step.action}) failed`,
        completed_steps: results,
      };
    }
  }
  
  return { success: true, results };
}
```

### 2.4 — Updated MCP tool descriptions

Update the `list_actions` tool to include the `action_type` and `tags` in the response so the LLM knows what kind of action it's invoking:

```json
{
  "name": "restart_nginx",
  "display_name": "Restart Nginx",
  "description": "Restart the nginx service on the server. Use when...",
  "action_type": "bash",
  "tags": ["devops", "server"],
  "parameters": [...]
}
```

The `execute_action` tool interface stays the same — the LLM doesn't need to know about the execution mechanics, just the action name and params.

---

## Part 3: Dashboard — React + Vite + shadcn/ui

### 3.1 — What is this

A standalone React app that talks to Strapi's REST API. It's the UI for creating, editing, testing, and managing MCP actions and auth credentials. It runs on its own port (e.g. `localhost:5173`) and is completely independent from Strapi's admin panel.

### 3.2 — Project setup

```bash
npm create vite@latest mcp-dashboard -- --template react-ts
cd mcp-dashboard
npm install
npx shadcn@latest init
```

When shadcn init asks:
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**

Install the shadcn components we'll need:

```bash
npx shadcn@latest add button input label textarea select switch badge table dialog tabs card alert separator dropdown-menu toast
```

Additional dependencies:

```bash
npm install react-router-dom lucide-react
```

That's it. No other libraries.

### 3.3 — File structure

```
mcp-dashboard/
├── src/
│   ├── main.tsx
│   ├── App.tsx                         # Router setup
│   ├── lib/
│   │   └── strapi.ts                   # Strapi API client
│   ├── pages/
│   │   ├── ActionsPage.tsx             # List all actions
│   │   ├── CreateActionPage.tsx        # Create/edit action form
│   │   ├── AuthPage.tsx                # Manage auth credentials
│   │   └── CreateAuthPage.tsx          # Create/edit credential
│   ├── components/
│   │   ├── Layout.tsx                  # Sidebar + main content wrapper
│   │   ├── ActionTable.tsx             # Action list table
│   │   ├── ActionForm.tsx              # The main action form (used by create + edit)
│   │   ├── ApiConfigFields.tsx         # API-specific form fields
│   │   ├── BashConfigFields.tsx        # Bash-specific form fields
│   │   ├── CompositeConfigFields.tsx   # Composite-specific form fields
│   │   ├── ParameterEditor.tsx         # Repeatable param row editor
│   │   ├── KeyValueEditor.tsx          # Reusable key-value pair editor (for headers, custom_headers)
│   │   ├── TagInput.tsx                # Tag input component
│   │   ├── TestModal.tsx               # Test action modal
│   │   └── AuthTable.tsx               # Auth credential list table
│   └── types/
│       └── index.ts                    # TypeScript types for Action, AuthCredential, etc.
├── .env                                # VITE_STRAPI_URL, VITE_STRAPI_TOKEN
└── package.json
```

### 3.4 — Environment variables

```env
VITE_STRAPI_URL=http://localhost:1337
VITE_STRAPI_TOKEN=your-strapi-api-token
```

### 3.5 — Strapi API client (`src/lib/strapi.ts`)

A thin wrapper around fetch. All dashboard API calls go through this.

```typescript
const STRAPI_URL = import.meta.env.VITE_STRAPI_URL;
const STRAPI_TOKEN = import.meta.env.VITE_STRAPI_TOKEN;

export async function strapiGet(path: string, params?: Record<string, string>) {
  const url = new URL(`/api${path}`, STRAPI_URL);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function strapiPost(path: string, data: unknown) { /* same pattern, method POST, body { data } */ }
export async function strapiPut(path: string, data: unknown) { /* same pattern, method PUT */ }
export async function strapiDelete(path: string) { /* same pattern, method DELETE */ }
export async function strapiExecute(action: string, params: Record<string, unknown>) {
  /* POST to /api/actions/execute with { action, params } — this one does NOT wrap in { data } */
}
```

### 3.6 — Router setup (`src/App.tsx`)

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ActionsPage from "./pages/ActionsPage";
import CreateActionPage from "./pages/CreateActionPage";
import AuthPage from "./pages/AuthPage";
import CreateAuthPage from "./pages/CreateAuthPage";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ActionsPage />} />
          <Route path="/actions/new" element={<CreateActionPage />} />
          <Route path="/actions/:documentId" element={<CreateActionPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/new" element={<CreateAuthPage />} />
          <Route path="/auth/:documentId" element={<CreateAuthPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

### 3.7 — Layout component

A simple sidebar + content layout. Sidebar has:

- **MCP Actions** logo/title at top
- Nav links:
  - "Actions" (icon: `Zap` from lucide) → `/`
  - "Credentials" (icon: `KeyRound` from lucide) → `/auth`
- Minimal, clean. Dark sidebar with light content area, or all light — follow shadcn defaults.

### 3.8 — ActionsPage: Action list

**Route:** `/`

**What it shows:**

Top bar:
- Page title: "Actions"
- "Create Action" button (links to `/actions/new`)
- Filter row: toggle buttons or shadcn `Badge` variants for action type (All / API / Bash / Composite). Clicking filters the table. Also a search `Input` that filters by name and description (client-side filter is fine for MVP).

Table (using shadcn `Table`):

| Column | Content | Implementation |
|---|---|---|
| Status | shadcn `Switch` — toggles `enabled` field inline via PUT | |
| Name | `display_name` in bold, `name` slug below in muted `text-sm font-mono` | |
| Type | shadcn `Badge`: `API` variant=default (blue), `BASH` variant=secondary (orange), `COMPOSITE` variant=outline (purple) | |
| Auth | Name of linked credential or `—` in muted text | |
| Tags | Row of small shadcn `Badge` variant=outline | |
| Modified | Relative time string. Use simple helper: `new Date(updatedAt).toLocaleDateString()` is fine for MVP | |
| Actions | shadcn `DropdownMenu` with: Edit, Duplicate, Test, Delete | |

**Data fetching:** On mount, `GET /api/actions?populate=*&sort=updatedAt:desc`. Store in React state. Re-fetch after mutations.

**Inline toggle:** When the `Switch` is toggled, immediately `PUT /api/actions/:documentId` with `{ enabled: !current }`. Optimistic update in state.

**Delete:** Show a shadcn `Dialog` confirmation: "Delete action `{name}`? This can't be undone." On confirm, `DELETE /api/actions/:documentId`.

**Duplicate:** Fetch the full action, strip `documentId`/`id`/`createdAt`/`updatedAt`, append `_copy` to the name, `POST` as new. Navigate to the edit page for the new entry.

### 3.9 — CreateActionPage: Action form

**Route:** `/actions/new` (create) or `/actions/:documentId` (edit)

If `documentId` is present in URL params, fetch the existing action on mount and pre-fill the form. Otherwise, start with empty defaults.

**Form structure — single page, no steps/tabs for MVP. Sections separated by shadcn `Separator`.**

**Section 1 — Basics:**

- `display_name` — shadcn `Input`. On change, auto-generate `name` slug (lowercase, replace spaces with `_`, strip non-alphanumeric). The `name` field is shown below as `font-mono text-sm text-muted-foreground` and is editable.
- `description` — shadcn `Textarea`, 3 rows. Placeholder: "Describe this action for an AI. Explain when to use it and what the output means."
- `action_type` — Three shadcn `Button` variants acting as radio: API / Bash / Composite. Selected one gets `variant="default"`, others get `variant="outline"`. **Changing this clears the config section below.**
- `tags` — `TagInput` component (see 3.13)
- `enabled` — shadcn `Switch` with label

**Section 2 — Configuration (conditional):**

Render `ApiConfigFields`, `BashConfigFields`, or `CompositeConfigFields` based on `action_type`.

**Section 3 — Parameters:**

Render `ParameterEditor` component (see 3.12).

**Bottom bar (sticky):**

- "Cancel" button (navigate back to `/`)
- "Save" button (POST or PUT to Strapi, then navigate to `/`)
- "Save & Test" button (POST or PUT, then open TestModal with the saved action)

### 3.10 — ApiConfigFields component

Shown when `action_type === "api"`.

- `method` — shadcn `Select` with options: GET, POST, PUT, PATCH, DELETE
- `url_template` — `Input` with `font-mono`, placeholder: `https://api.example.com/{{param}}`
- `headers` — `KeyValueEditor` component (see 3.14). Label: "Static Headers"
- `body_template` — `Textarea` with `font-mono`, 5 rows. Only visible when method is POST, PUT, or PATCH. Placeholder: `{"key": "{{param}}"}`
- `timeout_ms` — `Input` type=number, default 30000. Label: "Timeout (ms)"
- `auth` — shadcn `Select`. Options fetched from `GET /api/auth-credentials` on mount. Shows `display_name` as label, stores the `documentId` as value. First option: "No authentication".

### 3.11 — BashConfigFields component

Shown when `action_type === "bash"`.

- Yellow shadcn `Alert` at top: variant=warning, icon `AlertTriangle` from lucide. Text: "Bash actions execute on the MCP server host machine with the server process's permissions. Be careful with what you allow."
- `command_template` — `Textarea` with `font-mono`, 4 rows. Placeholder: `echo "Hello {{name}}"`
- `timeout_ms` — `Input` type=number, default 30000
- `working_directory` — `Input`, placeholder: `/home/user` (optional)
- `allowed_commands` — `TagInput`. Placeholder: "Add allowed commands (e.g. docker, curl). Leave empty for unrestricted."

### 3.12 — CompositeConfigFields component

Shown when `action_type === "composite"`.

- `stop_on_error` — `Switch` with label "Stop on error", default on
- **Step builder:** An ordered list. Each step is a shadcn `Card` containing:
  - Step number badge (top left)
  - Action — `Select` dropdown. Options fetched from `GET /api/actions?filters[enabled][$eq]=true` on mount. Excludes the current action being edited (no self-reference).
  - Params — `KeyValueEditor` where values can include `{{param}}` and `{{step_N_result}}` references. Show a hint text: "Use {{param_name}} for this action's params or {{step_0_result}} for previous step outputs."
  - Remove button (icon: `Trash2`)
- "Add Step" button at the bottom
- Steps should be reorderable: Up/Down arrow buttons on each card (drag-and-drop is nice-to-have, not MVP)

### 3.13 — ParameterEditor component

A repeatable row editor used in the action form.

Each parameter is a row (or a small card) with:
- `name` — `Input` with `font-mono`, small. Placeholder: "param_name"
- `type` — `Select`: string / number / boolean
- `description` — `Input`. Placeholder: "Describe this for an AI"
- `required` — `Switch`, default on
- `default_value` — `Input`, small. Placeholder: "Default". Only shown if required is off.
- Remove button per row (icon: `X` from lucide)

"Add Parameter" button at the bottom (icon: `Plus`).

New rows start with empty fields. Rows can be removed individually.

### 3.14 — KeyValueEditor component

Reusable component for headers, custom_headers, and composite step params.

Props:
- `value`: `Array<{ key: string, value: string }>`
- `onChange`: callback
- `keyPlaceholder?`: string (default "Key")
- `valuePlaceholder?`: string (default "Value")
- `valueType?`: "text" | "password" (for auth credential secrets)

Each row: two `Input` fields side by side (key + value) + remove button.
"Add" button at bottom.

Serialize to JSON object on save: `{ [key]: value, ... }`.
Deserialize from JSON object on load: `Object.entries(obj).map(([key, value]) => ({ key, value }))`.

### 3.15 — TestModal component

The most important UX feature. A shadcn `Dialog` that:

1. **Receives** an action object as prop (with its full definition including parameters)
2. **Renders** a form field for each parameter:
   - Label: `param.name`
   - Description text below: `param.description`
   - Input type based on `param.type` (text for string, number input for number, switch for boolean)
   - Pre-filled with `param.default_value` if set
3. **"Run" button** at the bottom
4. On click:
   - Show loading spinner (lucide `Loader2` with `animate-spin`)
   - POST to `/api/actions/execute` with `{ action: action.name, params: { ...formValues } }`
   - On response, show two sections:
     - **Resolved plan** — the raw JSON from Strapi (shows URL, headers with tokens masked, command, etc.)
     - **Note for bash/composite:** "Full execution requires the MCP server. This test only shows the resolved plan from Strapi."
     - For API actions, optionally also fire the resolved request directly from the browser and show the result. BUT: this will fail for requests that don't support CORS. So show the resolved plan always, and attempt browser execution as a bonus. If CORS blocks it, show a note: "Browser execution blocked by CORS. The MCP server will execute this correctly."
5. **Result display:** Use a `<pre>` block with `font-mono text-sm bg-muted p-4 rounded overflow-auto max-h-96` for JSON output. Pretty-print with `JSON.stringify(result, null, 2)`.
6. **Error display:** If the execute endpoint returns an error, show it in a red `Alert`.

### 3.16 — AuthPage: Credential list

**Route:** `/auth`

Top bar:
- Page title: "Credentials"
- "Add Credential" button (links to `/auth/new`)

Table:

| Column | Content |
|---|---|
| Name | `display_name` bold, `name` slug below in mono |
| Type | `Badge`: "Bearer" or "Custom Headers" |
| Used by | Count of actions linked — fetch via `GET /api/actions?filters[auth][documentId][$eq]=X&count=true` OR just show "—" for MVP and skip the count query |
| Description | Truncated to ~60 chars |
| Actions | Edit, Delete |

### 3.17 — CreateAuthPage: Credential form

**Route:** `/auth/new` or `/auth/:documentId`

Single-page form:

- `display_name` — `Input`
- `name` — auto-slug from display_name, shown in mono, editable
- `auth_type` — Two `Button` variants as radio: Bearer Token / Custom Headers
- **If Bearer:**
  - `bearer_token` — `Input` type="password". When editing existing: show `••••••••••` as placeholder and empty field. Only send the field if user types a new value. Label hint: "Leave empty to keep current token."
- **If Custom Headers:**
  - `KeyValueEditor` with `valueType="password"`. Same edit behavior: existing values show masked, only send if changed.
- `description` — `Input` (optional)

Bottom: "Cancel" and "Save" buttons.

### 3.18 — TypeScript types (`src/types/index.ts`)

```typescript
export type ActionType = "api" | "bash" | "composite";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ParamType = "string" | "number" | "boolean";
export type AuthType = "bearer" | "custom_headers";

export interface ActionParameter {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
  default_value?: string | null;
}

export interface ApiConfig {
  method: HttpMethod;
  url_template: string;
  headers?: Record<string, string>;
  body_template?: string | null;
  timeout_ms?: number;
}

export interface BashConfig {
  command_template: string;
  timeout_ms?: number;
  working_directory?: string | null;
  allowed_commands?: string[] | null;
}

export interface CompositeStep {
  action: string;
  params: Record<string, string>;
}

export interface CompositeConfig {
  steps: CompositeStep[];
  stop_on_error: boolean;
}

export interface Action {
  documentId?: string;
  name: string;
  display_name: string;
  description: string;
  action_type: ActionType;
  enabled: boolean;
  tags?: string[];
  parameters: ActionParameter[];
  api_config?: ApiConfig | null;
  bash_config?: BashConfig | null;
  composite_config?: CompositeConfig | null;
  auth?: { documentId: string; name: string; display_name: string } | null;
}

export interface AuthCredential {
  documentId?: string;
  name: string;
  display_name: string;
  auth_type: AuthType;
  bearer_token?: string;
  custom_headers?: Record<string, string>;
  description?: string;
}
```

### 3.19 — CORS configuration

Strapi needs to allow requests from the dashboard's origin. In the Strapi project, update `config/middlewares.js`:

```javascript
module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: ['http://localhost:5173'], // Vite dev server
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
```

---

## Part 4: Implementation Order

This is the order Claude Code should build things. Each phase is independently testable.

### Phase 1: Content Model Updates (15 min)
1. Create the `Auth Credential` collection type
2. Create the new components (`api_config`, `bash_config`, `composite_config`)
3. Update the `Action` content type with new fields
4. Set field-level privacy on auth credential secrets
5. Set API permissions
6. **Test:** Create an API action with auth via Strapi admin, verify the data shape via REST API

### Phase 2: Revised Executor (20 min)
1. Update the `/api/actions/execute` controller to return resolved plans instead of executing
2. Add auth credential resolution (server-side fetch + merge into headers)
3. Add support for all three action types in the resolver
4. **Test:** `curl` the execute endpoint, verify it returns correct resolved plans for each type

### Phase 3: Revised MCP Server (20 min)
1. Add `executeApi()`, `executeBash()`, `executeComposite()` functions
2. Update `execute_action` tool to receive plans and execute locally
3. Add bash security validation (allowed_commands whitelist)
4. **Test:** Via Claude Desktop, ask it to run a bash command like `echo hello` and an API call

### Phase 4: Dashboard — Scaffold & Action List (30 min)
1. Create Vite project, install shadcn, install components listed in 3.2
2. Set up router, layout with sidebar, Strapi API client
3. Build ActionsPage with table, type filters, search, inline enable toggle
4. Configure CORS in Strapi (section 3.19)
5. **Test:** `npm run dev`, see your actions listed at `localhost:5173`

### Phase 5: Dashboard — Create/Edit Action Form (30 min)
1. Build CreateActionPage with all sections
2. Build ApiConfigFields, BashConfigFields, CompositeConfigFields
3. Build ParameterEditor and KeyValueEditor
4. Build TagInput
5. Wire up save (POST/PUT to Strapi)
6. **Test:** Create a new `get_weather` action entirely through the dashboard

### Phase 6: Dashboard — Auth & Test Modal (20 min)
1. Build AuthPage and CreateAuthPage
2. Build TestModal with parameter form + execute + result display
3. Wire up auth credential dropdown in ApiConfigFields
4. **Test:** Create a bearer credential, link it to an action, test the action from the dashboard

---

## Test Actions to Seed

After building, create these actions to validate everything works:

### 1. `get_weather` (API, no auth)
- Method: `GET`
- URL: `https://wttr.in/{{city}}?format=j1`
- Params: `city` (string, required)

### 2. `get_github_repo` (API, with Bearer auth)
- Method: `GET`
- URL: `https://api.github.com/repos/{{owner}}/{{repo}}`
- Auth: Create a "GitHub Token" bearer credential
- Params: `owner` (string, required), `repo` (string, required)

### 3. `disk_usage` (Bash)
- Command: `df -h {{path}}`
- Allowed commands: `["df"]`
- Params: `path` (string, required, default: `/`)

### 4. `list_docker_containers` (Bash)
- Command: `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
- Allowed commands: `["docker"]`
- Params: none

### 5. `weather_and_notify` (Composite)
- Steps: `get_weather` → (future) `send_slack_message`
- Params: `city` (string, required)

---

## Success Criteria

- [ ] API action with no auth works (get_weather)
- [ ] API action with bearer auth works (get_github_repo)
- [ ] API action with custom headers works
- [ ] Bash action executes on MCP host and returns stdout/stderr
- [ ] Bash action respects allowed_commands whitelist (rejects unauthorized commands)
- [ ] Bash action respects timeout
- [ ] Composite action chains two actions and passes results between steps
- [ ] Auth credentials are never exposed via public API (private fields)
- [ ] Admin plugin shows action list with type badges and status
- [ ] Admin plugin create form shows/hides sections based on action type
- [ ] Admin plugin auth credential page allows CRUD with masked secrets
- [ ] Admin plugin test modal executes an action and shows results
- [ ] Creating a new action via the plugin makes it immediately available to Claude via MCP (no restart)

---

## Security Notes

1. **Bash execution is inherently dangerous.** The `allowed_commands` whitelist is a basic guardrail, not a security boundary. A command like `curl` in the whitelist can still do arbitrary things. This is acceptable for a local development/internal tool. Do NOT expose this to untrusted users or the public internet.

2. **Auth credentials travel from Strapi to MCP server** in the resolved plan response. This is over HTTP on localhost. If Strapi and the MCP server are on different machines, use HTTPS between them.

3. **The LLM never sees auth credentials.** The MCP server receives them in the resolved plan but only uses them for the outbound request — it does NOT include them in the MCP tool response back to Claude. Sanitize the response: strip `Authorization` headers and any credential data before returning results to the LLM.

4. **Template injection:** The `{{param}}` resolution must sanitize for bash. For bash commands, param values should be escaped to prevent command injection. Use this in the MCP server's bash executor:

```javascript
function shellEscape(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function resolveCommandTemplate(template, params) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (params[key] === undefined) return match;
    return shellEscape(params[key]);
  });
}
```

**The shell escaping MUST happen in the MCP server (the executor), not in Strapi (the resolver).** Strapi resolves templates for display/planning; the MCP server applies security measures before actual execution.
