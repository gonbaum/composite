import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ActionTable from "@/components/ActionTable";
import TestModal from "@/components/TestModal";
import { getActions, updateAction, deleteAction } from "@/lib/strapi";
import type { Action, ActionType } from "@/types";

const typeFilters: ActionType[] = ["api", "bash", "composite"];

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Actions</h2>
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
          <Badge
            variant={typeFilter === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setTypeFilter(null)}
          >
            All
          </Badge>
          {typeFilters.map((t) => (
            <Badge
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            >
              {t}
            </Badge>
          ))}
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
