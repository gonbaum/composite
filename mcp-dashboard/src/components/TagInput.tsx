import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
}

export default function TagInput({ value, onChange }: Props) {
  const [input, setInput] = useState("");

  const add = () => {
    const tag = input.trim().toLowerCase();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <X
              className="h-3 w-3 cursor-pointer"
              onClick={() => onChange(value.filter((t) => t !== tag))}
            />
          </Badge>
        ))}
      </div>
      <Input
        placeholder="Add tag and press Enter"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}
