import type { ActionFormData } from "@/types";

/** Strip component `id` fields before sending to Strapi (avoids "not related to entity" errors) */
export function sanitizeActionPayload(data: ActionFormData): Record<string, unknown> {
  const stripId = (obj: Record<string, unknown> | null) => {
    if (!obj) return null;
    const { id, ...rest } = obj;
    return rest;
  };

  // Only include the config component that matches the action_type
  // Send null for the others to clear them
  const payload: Record<string, unknown> = {
    name: data.name,
    display_name: data.display_name,
    description: data.description,
    action_type: data.action_type,
    tags: data.tags,
    enabled: data.enabled,
    parameters: (data.parameters || []).map(({ id, ...rest }) => rest),
    api_config: data.action_type === "api" ? stripId(data.api_config as Record<string, unknown> | null) : null,
    bash_config: data.action_type === "bash" ? stripId(data.bash_config as Record<string, unknown> | null) : null,
    composite_config: data.action_type === "composite" ? stripId(data.composite_config as Record<string, unknown> | null) : null,
  };

  return payload;
}
