import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Globe, Terminal, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActionTable from "@/components/ActionTable";
import TestModal from "@/components/TestModal";
import { getActions, updateAction, deleteAction } from "@/lib/strapi";
import type { Action, ActionType } from "@/types";

const typeFilters: { value: ActionType; label: string; icon: typeof Globe; className: string }[] = [
  { value: "api", label: "API", icon: Globe, className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900" },
  { value: "bash", label: "Bash", icon: Terminal, className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900" },
  { value: "composite", label: "Composite", icon: Layers, className: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-900" },
];

export default function ActionsPage() {
  const navigate = useNavigate();
  const [actions, setActions] = useState<Action[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ActionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [testAction, setTestAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setActions(await getActions());
    } catch (err) {
      console.error("Failed to load actions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = actions.filter((a) => {
    if (typeFilter && a.action_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        (a.display_name || "").toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleToggle = async (action: Action) => {
    await updateAction(action.documentId, { enabled: !action.enabled });
    load();
  };

  const handleDelete = async (action: Action) => {
    if (!confirm(`Delete "${action.display_name || action.name}"?`)) return;
    await deleteAction(action.documentId);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Actions</h2>
          <p className="text-sm text-muted-foreground">
            Manage the tools available to your MCP server.
          </p>
        </div>
        <Button onClick={() => navigate("/actions/new")}>
          <Plus className="mr-2 h-4 w-4" /> New Action
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTypeFilter(null)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              typeFilter === null
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            All
          </button>
          {typeFilters.map((t) => {
            const Icon = t.icon;
            const active = typeFilter === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTypeFilter(active ? null : t.value)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  active ? t.className : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <ActionTable
          actions={filtered}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onTest={setTestAction}
        />
      )}

      <TestModal
        action={testAction}
        onClose={() => setTestAction(null)}
      />
    </div>
  );
}
