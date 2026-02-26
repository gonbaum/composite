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
    const responseText = await response.text();

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    if (response.ok) {
      return { action_type: "api", success: true, status: response.status, data };
    } else {
      return { action_type: "api", success: false, status: response.status, error: data };
    }
  } catch (error: any) {
    return { action_type: "api", success: false, error: error.message };
  }
}

function handleBashResolution(actionDef: any, resolvedParams: Record<string, any>) {
  const config = actionDef.bash_config;
  if (!config) {
    return { action_type: "bash", success: false, error: "Bash action missing bash_config" };
  }

  const command = resolveTemplate(config.command_template, resolvedParams);

  return {
    action_type: "bash",
    resolved: {
      command,
      timeout_ms: config.timeout_ms || 30000,
      working_directory: config.working_directory || null,
      allowed_commands: config.allowed_commands || [],
    },
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

  return {
    action_type: "composite",
    resolved: {
      steps: resolvedSteps,
      stop_on_error: config.stop_on_error !== false,
    },
  };
}

export default factories.createCoreController("api::action.action", ({ strapi }) => ({
  async execute(ctx) {
    const { action: actionName, params = {} } = ctx.request.body as any;

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

    switch (actionType) {
      case "api":
        return await handleApiExecution(actionDef, resolvedParams);
      case "bash":
        return handleBashResolution(actionDef, resolvedParams);
      case "composite":
        return handleCompositeResolution(actionDef, resolvedParams);
      default:
        return ctx.badRequest(`Unknown action_type: ${actionType}`);
    }
  },
}));
