import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Execute a resolved bash action locally.
 * Validates the command against the allowed_commands whitelist.
 */
export async function executeBash(resolved) {
  const { command, timeout_ms, working_directory, allowed_commands } = resolved;

  if (!command) {
    throw new Error("No command to execute");
  }

  // Extract the base command (first word)
  const baseCommand = command.trim().split(/\s+/)[0];

  // Validate against allowed_commands whitelist
  if (allowed_commands && allowed_commands.length > 0) {
    if (!allowed_commands.includes(baseCommand)) {
      throw new Error(
        `Command "${baseCommand}" not in allowed_commands: [${allowed_commands.join(", ")}]`
      );
    }
  }

  // Split command into executable and args for execFile (no shell injection)
  const parts = command.trim().split(/\s+/);
  const executable = parts[0];
  const args = parts.slice(1);

  const options = {
    timeout: timeout_ms || 30000,
    maxBuffer: 1024 * 1024, // 1MB
  };

  if (working_directory) {
    options.cwd = working_directory;
  }

  try {
    const { stdout, stderr } = await execFileAsync(executable, args, options);
    return {
      action_type: "bash",
      success: true,
      data: {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      },
    };
  } catch (error) {
    return {
      action_type: "bash",
      success: false,
      error: error.message,
      data: {
        stdout: error.stdout?.trim() || "",
        stderr: error.stderr?.trim() || "",
        code: error.code,
      },
    };
  }
}

/**
 * Execute a resolved composite action by running steps sequentially.
 * Each step calls executeFn which delegates back to Strapi's execute endpoint.
 * Supports {{step_N_result}} interpolation between steps.
 */
export async function executeComposite(resolved, executeFn) {
  const { steps, stop_on_error } = resolved;
  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Interpolate {{step_N_result}} placeholders in step params
    const interpolatedParams = {};
    for (const [key, value] of Object.entries(step.params || {})) {
      if (typeof value === "string") {
        interpolatedParams[key] = value.replace(
          /\{\{step_(\d+)_result\}\}/g,
          (match, stepIdx) => {
            const idx = parseInt(stepIdx, 10);
            if (results[idx] && results[idx].success) {
              return typeof results[idx].data === "string"
                ? results[idx].data
                : JSON.stringify(results[idx].data);
            }
            return match;
          }
        );
      } else {
        interpolatedParams[key] = value;
      }
    }

    try {
      const result = await executeFn(step.action, interpolatedParams);
      results.push(result);

      if (!result.success && stop_on_error) {
        return {
          action_type: "composite",
          success: false,
          error: `Step ${i} (${step.action}) failed`,
          data: { steps: results },
        };
      }
    } catch (error) {
      const errorResult = { success: false, error: error.message };
      results.push(errorResult);

      if (stop_on_error) {
        return {
          action_type: "composite",
          success: false,
          error: `Step ${i} (${step.action}) threw: ${error.message}`,
          data: { steps: results },
        };
      }
    }
  }

  return {
    action_type: "composite",
    success: true,
    data: { steps: results },
  };
}
