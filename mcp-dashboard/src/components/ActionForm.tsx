import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Name (slug)</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="my_action"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Display Name</Label>
          <Input
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            placeholder="My Action"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="What does this action do?"
          required
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Action Type</Label>
          <Select value={form.action_type} onValueChange={(v) => updateType(v as ActionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="bash">Bash</SelectItem>
              <SelectItem value="composite">Composite</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-1">
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
          />
          <Label>Enabled</Label>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Tags</Label>
        <TagInput
          value={form.tags}
          onChange={(v) => setForm((f) => ({ ...f, tags: v }))}
        />
      </div>

      <Separator />

      <div className="space-y-1">
        <Label className="text-base font-semibold">Parameters</Label>
        <ParameterEditor
          value={form.parameters}
          onChange={(v) => setForm((f) => ({ ...f, parameters: v }))}
        />
      </div>

      <Separator />

      <div>
        <Label className="text-base font-semibold mb-3 block">
          {form.action_type === "api" && "API Configuration"}
          {form.action_type === "bash" && "Bash Configuration"}
          {form.action_type === "composite" && "Composite Configuration"}
        </Label>

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
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
