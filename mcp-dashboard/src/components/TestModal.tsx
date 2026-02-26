import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { executeAction } from "@/lib/strapi";
import type { Action } from "@/types";

interface Props {
  action: Action | null;
  onClose: () => void;
}

export default function TestModal({ action, onClose }: Props) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = (open: boolean) => {
    if (!open) {
      onClose();
      setParams({});
      setResult(null);
      setError(null);
    }
  };

  const handleRun = async () => {
    if (!action) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await executeAction(action.name, params);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!action} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Test: {action?.display_name || action?.name}</DialogTitle>
        </DialogHeader>

        {action && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{action.description}</p>

            {(action.parameters || []).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Parameters</h4>
                {action.parameters.map((p) => (
                  <div key={p.name} className="space-y-1">
                    <Label>
                      {p.name}
                      {p.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      placeholder={p.description}
                      value={params[p.name] || ""}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [p.name]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <Button onClick={handleRun} disabled={loading}>
              {loading ? "Running..." : "Execute"}
            </Button>

            {error && (
              <pre className="bg-destructive/10 text-destructive p-3 rounded text-xs overflow-auto">
                {error}
              </pre>
            )}

            {result !== null && (
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
