import { useState } from "react";
import { Plus, X, ArrowUpFromLine, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import KeyValueEditor from "@/components/KeyValueEditor";
import TestModal from "@/components/TestModal";
import type { Action, CompositeConfig, CompositeStep, Parameter } from "@/types";

interface Props {
  value: CompositeConfig;
  onChange: (v: CompositeConfig) => void;
  availableActions: Action[];
  currentParameters: Parameter[];
  onAddParameters: (params: Parameter[]) => void;
}

const emptyStep: CompositeStep = { action: "", params: {} };

interface PromoteDialogState {
  open: boolean;
  stepIdx: number;
  actionName: string;
  candidates: Parameter[];
}

export default function CompositeConfigFields({
  value,
  onChange,
  availableActions,
  currentParameters,
  onAddParameters,
}: Props) {
  const [promoteDialog, setPromoteDialog] = useState<PromoteDialogState>({
    open: false,
    stepIdx: -1,
    actionName: "",
    candidates: [],
  });
  const [selectedToPromote, setSelectedToPromote] = useState<Set<string>>(new Set());
  const [testAction, setTestAction] = useState<Action | null>(null);

  const updateStep = (idx: number, patch: Partial<CompositeStep>) => {
    const steps = value.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, steps });
  };

  const handleActionSelect = (idx: number, actionName: string) => {
    const selected = availableActions.find((a) => a.name === actionName);
    const prefilled: Record<string, string> = {};
    const newParams: Parameter[] = [];

    if (selected) {
      for (const p of selected.parameters || []) {
        prefilled[p.name] = `{{${p.name}}}`;
        // Check if this param already exists on the composite
        const alreadyExists = currentParameters.some((cp) => cp.name === p.name);
        if (!alreadyExists) {
          newParams.push({ ...p });
        }
      }
    }

    updateStep(idx, { action: actionName, params: prefilled });

    // If there are new params to promote, ask the user
    if (newParams.length > 0) {
      setSelectedToPromote(new Set(newParams.map((p) => p.name)));
      setPromoteDialog({
        open: true,
        stepIdx: idx,
        actionName,
        candidates: newParams,
      });
    }
  };

  const handlePromoteConfirm = () => {
    const toAdd = promoteDialog.candidates.filter((p) => selectedToPromote.has(p.name));
    if (toAdd.length > 0) {
      onAddParameters(toAdd);
    }

    // For params NOT promoted, clear the {{param}} placeholder to empty
    const step = value.steps[promoteDialog.stepIdx];
    if (step) {
      const updatedParams = { ...step.params };
      for (const candidate of promoteDialog.candidates) {
        if (!selectedToPromote.has(candidate.name)) {
          updatedParams[candidate.name] = "";
        }
      }
      updateStep(promoteDialog.stepIdx, { params: updatedParams });
    }

    setPromoteDialog({ open: false, stepIdx: -1, actionName: "", candidates: [] });
    setSelectedToPromote(new Set());
  };

  const handlePromoteCancel = () => {
    // Clear all {{param}} placeholders since user declined
    const step = value.steps[promoteDialog.stepIdx];
    if (step) {
      const updatedParams = { ...step.params };
      for (const candidate of promoteDialog.candidates) {
        updatedParams[candidate.name] = "";
      }
      updateStep(promoteDialog.stepIdx, { params: updatedParams });
    }

    setPromoteDialog({ open: false, stepIdx: -1, actionName: "", candidates: [] });
    setSelectedToPromote(new Set());
  };

  const togglePromoteParam = (name: string) => {
    setSelectedToPromote((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch
          checked={value.stop_on_error}
          onCheckedChange={(v) => onChange({ ...value, stop_on_error: v })}
        />
        <Label>Stop on error</Label>
      </div>

      {value.steps.map((step, i) => {
        const selected = availableActions.find((a) => a.name === step.action);
        return (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Step {i + 1}</Label>
              <div className="flex items-center gap-1">
                {selected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Test this step"
                    onClick={() => setTestAction(selected)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    onChange({ ...value, steps: value.steps.filter((_, j) => j !== i) })
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Action</Label>
              <Select
                value={step.action || undefined}
                onValueChange={(v) => handleActionSelect(i, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an action..." />
                </SelectTrigger>
                <SelectContent>
                  {availableActions.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.display_name || a.name}
                      <span className="text-muted-foreground ml-2 text-xs">({a.action_type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <p className="text-xs text-muted-foreground">{selected.description}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Params</Label>
              <KeyValueEditor
                value={step.params}
                onChange={(p) => updateStep(i, { params: p })}
                keyPlaceholder="param"
                valuePlaceholder="value or {{step_N_result}}"
              />
            </div>
          </div>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => onChange({ ...value, steps: [...value.steps, { ...emptyStep }] })}
      >
        <Plus className="mr-1 h-3 w-3" /> Add Step
      </Button>

      <TestModal action={testAction} onClose={() => setTestAction(null)} />

      {/* Promote parameters dialog */}
      <Dialog open={promoteDialog.open} onOpenChange={(open) => { if (!open) handlePromoteCancel(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <ArrowUpFromLine className="inline mr-2 h-4 w-4" />
              Promote parameters?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{promoteDialog.actionName}</strong> uses the following parameters.
            Select which ones to add to this composite action so they can be provided at runtime.
          </p>
          <div className="space-y-2 mt-2">
            {promoteDialog.candidates.map((p) => (
              <label
                key={p.name}
                className="flex items-start gap-3 p-2 border rounded-md cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selectedToPromote.has(p.name)}
                  onChange={() => togglePromoteParam(p.name)}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-sm">{p.name}</span>
                  {p.required && <span className="text-destructive ml-1 text-xs">required</span>}
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <Button type="button" onClick={handlePromoteConfirm}>
              Add selected
            </Button>
            <Button type="button" variant="outline" onClick={handlePromoteCancel}>
              Skip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
