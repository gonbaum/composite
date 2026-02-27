import { useMemo } from "react";
import { Globe, Terminal, Layers, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionFormData, AuthCredential } from "@/types";

function resolveTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
}

interface ResolvedApiRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

interface ResolvedBashRequest {
  command: string;
}

interface ResolvedCompositeRequest {
  steps: { action: string; params: Record<string, string> }[];
}

function resolveApiRequest(
  form: ActionFormData,
  testParams: Record<string, string>,
  credentials: AuthCredential[],
): ResolvedApiRequest | null {
  const config = form.api_config;
  if (!config) return null;

  const url = resolveTemplate(config.url_template || "", testParams);
  const body = config.body_template ? resolveTemplate(config.body_template, testParams) : null;
  const headers: Record<string, string> = {};

  if (config.headers && typeof config.headers === "object") {
    for (const [key, value] of Object.entries(config.headers)) {
      headers[key] = resolveTemplate(String(value), testParams);
    }
  }

  if (form.auth_credential) {
    const cred = credentials.find((c) => c.documentId === form.auth_credential);
    if (cred) {
      if (cred.auth_type === "bearer" && cred.bearer_token) {
        headers["Authorization"] = "Bearer ****";
      } else if (cred.auth_type === "custom_headers" && cred.custom_headers) {
        for (const key of Object.keys(cred.custom_headers)) {
          headers[key] = "****";
        }
      }
    }
  }

  if (["POST", "PUT", "PATCH"].includes(config.method) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return { method: config.method, url, headers, body };
}

function resolveBashRequest(
  form: ActionFormData,
  testParams: Record<string, string>,
): ResolvedBashRequest | null {
  const config = form.bash_config;
  if (!config) return null;
  return { command: resolveTemplate(config.command_template || "", testParams) };
}

function resolveCompositeRequest(
  form: ActionFormData,
  testParams: Record<string, string>,
): ResolvedCompositeRequest | null {
  const config = form.composite_config;
  if (!config) return null;

  const steps = (config.steps || []).map((step) => {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(step.params || {})) {
      resolved[key] = resolveTemplate(String(value), testParams);
    }
    return { action: step.action, params: resolved };
  });

  return { steps };
}

interface Props {
  form: ActionFormData;
  testParams: Record<string, string>;
  credentials: AuthCredential[];
}

export default function RequestPreview({ form, testParams, credentials }: Props) {
  const preview = useMemo(() => {
    switch (form.action_type) {
      case "api":
        return { type: "api" as const, data: resolveApiRequest(form, testParams, credentials) };
      case "bash":
        return { type: "bash" as const, data: resolveBashRequest(form, testParams) };
      case "composite":
        return { type: "composite" as const, data: resolveCompositeRequest(form, testParams) };
    }
  }, [form, testParams, credentials]);

  const iconMap = { api: Globe, bash: Terminal, composite: Layers };
  const Icon = iconMap[form.action_type];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
          <Send className="h-4 w-4" />
          Request Preview
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Resolved request based on current config + test params
        </p>
      </CardHeader>
      <CardContent>
        {preview.type === "api" && preview.data && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-blue-500" />
              <code className="text-xs font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400">{preview.data.method}</span>{" "}
                <span className="text-muted-foreground break-all">{preview.data.url || "..."}</span>
              </code>
            </div>
            {Object.keys(preview.data.headers).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Headers</p>
                <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-32">
                  {Object.entries(preview.data.headers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n")}
                </pre>
              </div>
            )}
            {preview.data.body && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Body</p>
                <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-32">
                  {preview.data.body}
                </pre>
              </div>
            )}
          </div>
        )}

        {preview.type === "bash" && preview.data && (
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-amber-500" />
            <code className="text-xs text-muted-foreground break-all">
              <span className="text-amber-600 dark:text-amber-400">$</span>{" "}
              {preview.data.command || "..."}
            </code>
          </div>
        )}

        {preview.type === "composite" && preview.data && (
          <div className="space-y-2">
            <Icon className="h-3.5 w-3.5 text-violet-500" />
            {preview.data.steps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No steps configured</p>
            ) : (
              preview.data.steps.map((step, i) => (
                <div key={i} className="text-xs bg-muted p-2 rounded">
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    Step {i + 1}:
                  </span>{" "}
                  <span className="font-medium">{step.action}</span>
                  {Object.keys(step.params).length > 0 && (
                    <pre className="text-muted-foreground mt-1 overflow-auto">
                      {JSON.stringify(step.params, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {!preview.data && (
          <p className="text-xs text-muted-foreground">No configuration available</p>
        )}
      </CardContent>
    </Card>
  );
}
