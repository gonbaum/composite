import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FormField from "@/components/FormField";
import TagInput from "@/components/TagInput";
import type { BashConfig } from "@/types";

interface Props {
  value: BashConfig;
  onChange: (v: BashConfig) => void;
}

export default function BashConfigFields({ value, onChange }: Props) {
  const update = (patch: Partial<BashConfig>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Bash commands run on the MCP server host machine. Use allowed_commands to restrict which executables can be invoked.
        </AlertDescription>
      </Alert>

      <FormField label="Command Template">
        <Textarea
          value={value.command_template}
          onChange={(e) => update({ command_template: e.target.value })}
          placeholder="du -sh {{path}}"
          rows={3}
          className="font-mono text-sm"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Timeout (ms)">
          <Input
            type="number"
            value={value.timeout_ms}
            onChange={(e) => update({ timeout_ms: parseInt(e.target.value) || 30000 })}
          />
        </FormField>
        <FormField label="Working Directory">
          <Input
            value={value.working_directory || ""}
            onChange={(e) => update({ working_directory: e.target.value || null })}
            placeholder="Optional"
          />
        </FormField>
      </div>

      <FormField label="Allowed Commands">
        <TagInput
          value={value.allowed_commands || []}
          onChange={(v) => update({ allowed_commands: v })}
        />
      </FormField>
    </div>
  );
}
