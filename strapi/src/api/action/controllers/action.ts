import { factories } from "@strapi/strapi";

function resolveUrlTemplate(template: string | null, params: Record<string, any>): string | null {
  if (!template) return null;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (params[key] === undefined) return match;
    return encodeURIComponent(params[key]);
  });
}

function resolveTemplate(template: string | null, params: Record<string, any>): string | null {
  if (!template) return null;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (params[key] === undefined) return match;
    return params[key];
  });
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitive = ["authorization", "x-api-key", "api-key", "token"];
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = sensitive.includes(key.toLowerCase()) ? "****" : value;
  }
  return redacted;
}

async function handleApiExecution(actionDef: any, resolvedParams: Record<string, any>) {
  const config = actionDef.api_config;
  if (!config) {
    return { action_type: "api", success: false, error: "API action missing api_config" };
  }

  const url = resolveUrlTemplate(config.url_template, resolvedParams);
  const body = resolveTemplate(config.body_template, resolvedParams);
  const headers: Record<string, string> = {};

  if (config.headers && typeof config.headers === "object") {
    for (const [key, value] of Object.entries(config.headers)) {
      headers[key] = typeof value === "string"
        ? resolveTemplate(value, resolvedParams)!
        : (value as any);
    }
  }

  // Merge auth credential if linked
  if (actionDef.auth_credential) {
    const cred = actionDef.auth_credential;
    if (cred.auth_type === "bearer" && cred.bearer_token) {
      headers["Authorization"] = `Bearer ${cred.bearer_token}`;
    } else if (cred.auth_type === "custom_headers" && cred.custom_headers) {
      for (const [key, value] of Object.entries(cred.custom_headers)) {
        headers[key] = value as string;
      }
    }
  }

  if (["POST", "PUT", "PATCH"].includes(config.method) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const resolved_request = {
    method: config.method,
    url,
    headers: redactHeaders(headers),
    body: body || null,
  };

  try {
    const fetchOptions: Record<string, any> = {
      method: config.method,
      headers,
    };

    if (["POST", "PUT", "PATCH"].includes(config.method) && body) {
      fetchOptions.body = body;
    }

    if (config.timeout_ms) {
      fetchOptions.signal = AbortSignal.timeout(config.timeout_ms);
    }

    const response = await fetch(url!, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    if (response.ok && contentType.startsWith("image/")) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString("base64");
      return {
        action_type: "api",
        success: true,
        status: response.status,
        image: { data: base64, mimeType: contentType.split(";")[0] },
        resolved_request,
      };
    }

    const responseText = await response.text();

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    if (response.ok) {
      return { action_type: "api", success: true, status: response.status, data, resolved_request };
    } else {
      return { action_type: "api", success: false, status: response.status, error: data, resolved_request };
    }
  } catch (error: any) {
    const cause = error.cause ? (error.cause.message || String(error.cause)) : null;
    const message = cause ? `${error.message}: ${cause}` : error.message;
    return { action_type: "api", success: false, error: message, resolved_request };
  }
}

function handleBashResolution(actionDef: any, resolvedParams: Record<string, any>) {
  const config = actionDef.bash_config;
  if (!config) {
    return { action_type: "bash", success: false, error: "Bash action missing bash_config" };
  }

  const command = resolveTemplate(config.command_template, resolvedParams);

  const resolved = {
    command,
    timeout_ms: config.timeout_ms || 30000,
    working_directory: config.working_directory || null,
    allowed_commands: config.allowed_commands || [],
  };

  return {
    action_type: "bash",
    resolved,
    resolved_request: { command },
  };
}

function handleCompositeResolution(actionDef: any, resolvedParams: Record<string, any>) {
  const config = actionDef.composite_config;
  if (!config) {
    return { action_type: "composite", success: false, error: "Composite action missing composite_config" };
  }

  const resolvedSteps = (config.steps || []).map((step: any) => {
    const stepParams: Record<string, any> = {};
    if (step.params) {
      for (const [key, value] of Object.entries(step.params)) {
        stepParams[key] = typeof value === "string"
          ? resolveTemplate(value, resolvedParams)
          : value;
      }
    }
    return { ...step, params: stepParams };
  });

  const resolved = {
    steps: resolvedSteps,
    stop_on_error: config.stop_on_error !== false,
  };

  return {
    action_type: "composite",
    resolved,
    resolved_request: { steps: resolvedSteps },
  };
}

export default factories.createCoreController("api::action.action", ({ strapi }) => ({
  async execute(ctx) {
    const { action: actionName, params = {}, source } = ctx.request.body as any;

    if (!actionName) {
      return ctx.badRequest("Missing required field: action");
    }

    const actions = await strapi.documents("api::action.action").findMany({
      filters: { name: actionName, enabled: true },
      populate: ["parameters", "api_config", "bash_config", "composite_config", "auth_credential"] as any,
    });

    if (!actions || actions.length === 0) {
      return ctx.notFound("Action not found or disabled");
    }

    const actionDef = actions[0] as any;

    // Validate required parameters
    const actionParams = actionDef.parameters || [];
    const resolvedParams: Record<string, any> = { ...params };
    const missingParams: string[] = [];

    for (const paramDef of actionParams) {
      if (resolvedParams[paramDef.name] === undefined) {
        if (paramDef.default_value !== null && paramDef.default_value !== undefined) {
          resolvedParams[paramDef.name] = paramDef.default_value;
        } else if (paramDef.required) {
          missingParams.push(paramDef.name);
        }
      }
    }

    if (missingParams.length > 0) {
      return ctx.badRequest(`Missing required parameters: ${missingParams.join(", ")}`);
    }

    const actionType = actionDef.action_type || "api";

    const start = Date.now();
    let result: any;

    switch (actionType) {
      case "api":
        result = await handleApiExecution(actionDef, resolvedParams);
        break;
      case "bash":
        result = handleBashResolution(actionDef, resolvedParams);
        break;
      case "composite":
        result = handleCompositeResolution(actionDef, resolvedParams);
        break;
      default:
        return ctx.badRequest(`Unknown action_type: ${actionType}`);
    }

    const duration_ms = Date.now() - start;

    // Fire-and-forget audit log
    strapi.documents("api::action-log.action-log").create({
      data: {
        action_name: actionName,
        action_type: actionType,
        params: resolvedParams,
        response: result,
        success: result.success !== false,
        error_message: result.error ? (typeof result.error === "string" ? result.error : JSON.stringify(result.error)) : null,
        duration_ms,
        status_code: result.status || null,
        source: source || "unknown",
        resolved_request: result.resolved_request || null,
      },
    }).catch(() => {});

    return result;
  },
}));
