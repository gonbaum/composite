import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FormField from "@/components/FormField";
import KeyValueEditor from "@/components/KeyValueEditor";
import type { ApiConfig, AuthCredential } from "@/types";

interface Props {
  value: ApiConfig;
  onChange: (v: ApiConfig) => void;
  credentials: AuthCredential[];
  selectedCredential: string | null;
  onCredentialChange: (id: string | null) => void;
}

export default function ApiConfigFields({
  value,
  onChange,
  credentials,
  selectedCredential,
  onCredentialChange,
}: Props) {
  const update = (patch: Partial<ApiConfig>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Method">
          <Select
            value={value.method}
            onValueChange={(v) => update({ method: v as ApiConfig["method"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Timeout (ms)">
          <Input
            type="number"
            value={value.timeout_ms}
            onChange={(e) => update({ timeout_ms: parseInt(e.target.value) || 30000 })}
          />
        </FormField>
      </div>

      <FormField label="URL Template">
        <Input
          value={value.url_template}
          onChange={(e) => update({ url_template: e.target.value })}
          placeholder="https://api.example.com/{{param}}"
        />
      </FormField>

      <FormField label="Headers">
        <KeyValueEditor
          value={value.headers || {}}
          onChange={(h) => update({ headers: h })}
          keyPlaceholder="Header name"
          valuePlaceholder="Header value"
        />
      </FormField>

      {["POST", "PUT", "PATCH"].includes(value.method) && (
        <FormField label="Body Template">
          <Textarea
            value={value.body_template || ""}
            onChange={(e) => update({ body_template: e.target.value || null })}
            placeholder='{"key": "{{param}}"}'
            rows={4}
            className="font-mono text-sm"
          />
        </FormField>
      )}

      <FormField label="Auth Credential">
        <Select
          value={selectedCredential || "none"}
          onValueChange={(v) => onCredentialChange(v === "none" ? null : v)}
        >
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {credentials.map((c) => (
              <SelectItem key={c.documentId} value={c.documentId}>
                {c.display_name} ({c.auth_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </div>
  );
}
