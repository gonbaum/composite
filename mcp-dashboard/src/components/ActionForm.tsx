import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Terminal, Layers, Settings2, List, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FormField from "@/components/FormField";
import TagInput from "@/components/TagInput";
import ParameterEditor from "@/components/ParameterEditor";
import ApiConfigFields from "@/components/ApiConfigFields";
import BashConfigFields from "@/components/BashConfigFields";
import CompositeConfigFields from "@/components/CompositeConfigFields";
import { getAuthCredentials, getActions } from "@/lib/strapi";
import type { Action, ActionFormData, ActionType, ApiConfig, BashConfig, CompositeConfig, AuthCredential } from "@/types";

const defaultApiConfig: ApiConfig = {
  method: "GET",
  url_template: "",
  headers: {},
  body_template: null,
  timeout_ms: 30000,
};

const defaultBashConfig: BashConfig = {
  command_template: "",
  timeout_ms: 30000,
  working_directory: null,
  allowed_commands: [],
};

const defaultCompositeConfig: CompositeConfig = {
  steps: [],
  stop_on_error: true,
};

const typeConfig: Record<ActionType, { icon: typeof Globe; label: string; color: string }> = {
  api: { icon: Globe, label: "API Configuration", color: "text-blue-600 dark:text-blue-400" },
  bash: { icon: Terminal, label: "Bash Configuration", color: "text-amber-600 dark:text-amber-400" },
  composite: { icon: Layers, label: "Composite Configuration", color: "text-violet-600 dark:text-violet-400" },
};

function buildMcpPreview(form: ActionFormData) {
  const preview: Record<string, unknown> = {
    name: form.name || "my_action",
    display_name: form.display_name || form.name || "My Action",
    description: form.description || "...",
    action_type: form.action_type,
    tags: form.tags.length > 0 ? form.tags : undefined,
    parameters: form.parameters.map((p) => ({
      name: p.name || "param",
      type: p.type,
      description: p.description || "...",
      required: p.required,
      ...(p.default_value ? { default_value: p.default_value } : {}),
    })),
  };

  // Remove undefined keys
  for (const key of Object.keys(preview)) {
    if (preview[key] === undefined) delete preview[key];
  }

  return preview;
}

interface Props {
  initial?: ActionFormData;
  onSubmit: (data: ActionFormData) => Promise<void>;
  submitLabel?: string;
}

export default function ActionForm({ initial, onSubmit, submitLabel = "Create" }: Props) {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<AuthCredential[]>([]);
  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ActionFormData>(
    initial || {
      name: "",
      display_name: "",
      description: "",
      action_type: "api",
      tags: [],
      parameters: [],
      api_config: { ...defaultApiConfig },
      bash_config: null,
      composite_config: null,
      auth_credential: null,
      enabled: true,
    }
  );

  useEffect(() => {
    getAuthCredentials().then(setCredentials).catch(() => {});
    getActions().then(setAvailableActions).catch(() => {});
  }, []);

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const updateType = (t: ActionType) => {
    setForm((f) => ({
      ...f,
      action_type: t,
      api_config: t === "api" ? (f.api_config || { ...defaultApiConfig }) : null,
      bash_config: t === "bash" ? (f.bash_config || { ...defaultBashConfig }) : null,
      composite_config: t === "composite" ? (f.composite_config || { ...defaultCompositeConfig }) : null,
      auth_credential: t === "api" ? f.auth_credential : null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const tc = typeConfig[form.action_type];
  const TypeIcon = tc.icon;

  const mcpPreview = useMemo(() => buildMcpPreview(form), [form]);

  return (
    <div className="flex gap-6">
      {/* Left: Form */}
      <form onSubmit={handleSubmit} className="space-y-6 w-1/2 min-w-0">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</p>
        )}

        {/* General */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className={`flex items-center gap-2 text-base ${tc.color}`}>
              <Settings2 className="h-4 w-4" />
              General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Name (slug)">
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="my_action"
                  required
                />
              </FormField>
              <FormField label="Display Name">
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="My Action"
                />
              </FormField>
            </div>

            <FormField label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this action do? Be specific — this is shown to Claude."
                required
                rows={3}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Action Type">
                <Select value={form.action_type} onValueChange={(v) => updateType(v as ActionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">
                      <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-blue-500" /> API</span>
                    </SelectItem>
                    <SelectItem value="bash">
                      <span className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5 text-amber-500" /> Bash</span>
                    </SelectItem>
                    <SelectItem value="composite">
                      <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-violet-500" /> Composite</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
                <Label className="text-xs font-medium text-muted-foreground">Enabled</Label>
              </div>
            </div>

            <FormField label="Tags">
              <TagInput
                value={form.tags}
                onChange={(v) => setForm((f) => ({ ...f, tags: v }))}
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Parameters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className={`flex items-center gap-2 text-base ${tc.color}`}>
              <List className="h-4 w-4" />
              Parameters
              {form.parameters.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">({form.parameters.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ParameterEditor
              value={form.parameters}
              onChange={(v) => setForm((f) => ({ ...f, parameters: v }))}
            />
          </CardContent>
        </Card>

        {/* Type-specific Configuration */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className={`flex items-center gap-2 text-base ${tc.color}`}>
              <TypeIcon className="h-4 w-4" />
              {tc.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {form.action_type === "api" && form.api_config && (
              <ApiConfigFields
                value={form.api_config}
                onChange={(v) => setForm((f) => ({ ...f, api_config: v }))}
                credentials={credentials}
                selectedCredential={form.auth_credential}
                onCredentialChange={(v) => setForm((f) => ({ ...f, auth_credential: v }))}
              />
            )}

            {form.action_type === "bash" && form.bash_config && (
              <BashConfigFields
                value={form.bash_config}
                onChange={(v) => setForm((f) => ({ ...f, bash_config: v }))}
              />
            )}

            {form.action_type === "composite" && form.composite_config && (
              <CompositeConfigFields
                value={form.composite_config}
                onChange={(v) => setForm((f) => ({ ...f, composite_config: v }))}
                availableActions={availableActions}
                currentParameters={form.parameters}
                onAddParameters={(newParams) =>
                  setForm((f) => ({ ...f, parameters: [...f.parameters, ...newParams] }))
                }
              />
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Right: MCP Preview */}
      <div className="w-1/2 shrink-0">
        <div className="sticky top-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Eye className="h-4 w-4" />
                MCP Preview
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                What Claude sees via list_actions
              </p>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-muted-foreground bg-muted p-3 rounded overflow-auto max-h-[calc(100vh-12rem)]">
                {JSON.stringify(mcpPreview, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
