export interface Parameter {
  id?: number;
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
  default_value: string | null;
}

export interface ApiConfig {
  id?: number;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url_template: string;
  headers: Record<string, string> | null;
  body_template: string | null;
  timeout_ms: number;
}

export interface BashConfig {
  id?: number;
  command_template: string;
  timeout_ms: number;
  working_directory: string | null;
  allowed_commands: string[] | null;
}

export interface CompositeStep {
  action: string;
  params: Record<string, string>;
}

export interface CompositeConfig {
  id?: number;
  steps: CompositeStep[];
  stop_on_error: boolean;
}

export interface AuthCredential {
  id: number;
  documentId: string;
  name: string;
  display_name: string;
  auth_type: "bearer" | "custom_headers";
  bearer_token?: string;
  custom_headers?: Record<string, string>;
  description: string | null;
}

export type ActionType = "api" | "bash" | "composite";

export interface Action {
  id: number;
  documentId: string;
  name: string;
  display_name: string | null;
  description: string;
  action_type: ActionType;
  tags: string[] | null;
  parameters: Parameter[];
  api_config: ApiConfig | null;
  bash_config: BashConfig | null;
  composite_config: CompositeConfig | null;
  auth_credential: AuthCredential | null;
  enabled: boolean;
}

export interface StrapiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface ActionFormData {
  name: string;
  display_name: string;
  description: string;
  action_type: ActionType;
  tags: string[];
  parameters: Parameter[];
  api_config: ApiConfig | null;
  bash_config: BashConfig | null;
  composite_config: CompositeConfig | null;
  auth_credential: string | null; // documentId
  enabled: boolean;
}

export interface ActionLog {
  id: number;
  documentId: string;
  action_name: string;
  action_type: ActionType;
  params: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  status_code: number | null;
  source: "dashboard" | "mcp" | "unknown";
  createdAt: string;
}

export interface AuthFormData {
  name: string;
  display_name: string;
  auth_type: "bearer" | "custom_headers";
  bearer_token: string;
  custom_headers: Record<string, string>;
  description: string;
}
