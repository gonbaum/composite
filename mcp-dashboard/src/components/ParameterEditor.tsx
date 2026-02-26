import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Parameter } from "@/types";

interface Props {
  value: Parameter[];
  onChange: (v: Parameter[]) => void;
}

const emptyParam: Parameter = {
  name: "",
  type: "string",
  description: "",
  required: true,
  default_value: null,
};

export default function ParameterEditor({ value, onChange }: Props) {
  const update = (idx: number, patch: Partial<Parameter>) => {
    const next = value.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.map((p, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={p.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="param_name"
              />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={p.type}
                onValueChange={(v) => update(i, { type: v as Parameter["type"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-5"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input
              value={p.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="What this parameter does"
            />
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Switch
                checked={p.required}
                onCheckedChange={(v) => update(i, { required: v })}
              />
              <Label className="text-xs">Required</Label>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Default value</Label>
              <Input
                value={p.default_value || ""}
                onChange={(e) => update(i, { default_value: e.target.value || null })}
                placeholder="Optional default"
              />
            </div>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => onChange([...value, { ...emptyParam }])}
      >
        <Plus className="mr-1 h-3 w-3" /> Add Parameter
      </Button>
    </div>
  );
}
