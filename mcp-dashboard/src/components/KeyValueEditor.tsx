import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export default function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: Props) {
  const entries = Object.entries(value);

  const update = (oldKey: string, newKey: string, newVal: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (k === oldKey) {
        next[newKey] = newVal;
      } else {
        next[k] = v;
      }
    }
    onChange(next);
  };

  const add = () => onChange({ ...value, "": "" });

  const remove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder={keyPlaceholder}
            value={k}
            onChange={(e) => update(k, e.target.value, v)}
            className="flex-1"
          />
          <Input
            placeholder={valuePlaceholder}
            value={v}
            onChange={(e) => update(k, k, e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(k)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} type="button">
        <Plus className="mr-1 h-3 w-3" /> Add
      </Button>
    </div>
  );
}
