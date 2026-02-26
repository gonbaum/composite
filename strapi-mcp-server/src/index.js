import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { strapiRequest } from "./strapi-client.js";
import { executeBash, executeComposite } from "./executors.js";

const server = new McpServer({
  name: "strapi-actions",
  version: "1.0.0",
});

/**
 * Execute an action via Strapi and handle the response.
 * API actions are executed by Strapi directly.
 * Bash/composite actions return a plan that we execute locally.
 */
async function executeAction(actionName, params) {
  const result = await strapiRequest("POST", "/api/actions/execute", {
    action: actionName,
    params,
  });

  // API actions: Strapi already executed, pass through
  if (result.action_type === "api" || result.success !== undefined) {
    return result;
  }

  // Bash actions: execute locally
  if (result.action_type === "bash" && result.resolved) {
    return await executeBash(result.resolved);
  }

  // Composite actions: orchestrate steps locally
  if (result.action_type === "composite" && result.resolved) {
    return await executeComposite(result.resolved, executeAction);
  }

  return result;
}

// Tool 1: list_actions
server.tool(
  "list_actions",
  "List all available actions with descriptions and parameter schemas. Call this first to discover what you can do.",
  {},
  async () => {
    try {
      const response = await strapiRequest(
        "GET",
        "/api/actions?filters[enabled][$eq]=true&populate[parameters]=true&populate[api_config]=true&populate[bash_config]=true&populate[composite_config]=true"
      );

      const actions = (response.data || []).map((entry) => ({
        name: entry.name,
        display_name: entry.display_name || entry.name,
        description: entry.description,
        action_type: entry.action_type || "api",
        tags: entry.tags || [],
        parameters: (entry.parameters || []).map((p) => ({
          name: p.name,
          type: p.type,
          description: p.description,
          required: p.required,
          default_value: p.default_value,
        })),
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(actions, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching actions: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 2: execute_action
server.tool(
  "execute_action",
  "Execute a named action with parameters. Use list_actions first to see available actions and their required parameters.",
  {
    action: z.string().describe("Action name from list_actions"),
    params: z
      .string()
      .describe('JSON string of parameters, e.g. \'{"city": "Tokyo"}\''),
  },
  async ({ action, params: paramsStr }) => {
    let params;
    try {
      params = JSON.parse(paramsStr);
    } catch {
      return {
        content: [
          {
            type: "text",
            text: `Invalid JSON in params: ${paramsStr}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await executeAction(action, params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing action: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Strapi Actions MCP server running");
