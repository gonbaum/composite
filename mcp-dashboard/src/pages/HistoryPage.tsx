import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Globe, Terminal, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActionLogs, getActions } from "@/lib/strapi";
import type { ActionLog } from "@/types";

const typeIcons = {
  api: Globe,
  bash: Terminal,
  composite: Layers,
} as const;

const typeColors = {
  api: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  bash: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  composite: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
} as const;

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null) {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [actionNames, setActionNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const filters: { action_name?: string; success?: boolean } = {};
      if (nameFilter !== "all") filters.action_name = nameFilter;
      if (statusFilter === "success") filters.success = true;
      if (statusFilter === "fail") filters.success = false;
      setLogs(await getActionLogs(filters));
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  }, [nameFilter, statusFilter]);

  useEffect(() => {
    getActions()
      .then((actions) => setActionNames([...new Set(actions.map((a) => a.name))].sort()))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">History</h2>
          <p className="text-sm text-muted-foreground">
            Audit log of action executions.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={nameFilter} onValueChange={setNameFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actionNames.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="fail">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground">No execution logs found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>HTTP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const expanded = expandedId === log.id;
              const Icon = typeIcons[log.action_type] || Globe;
              return (
                <>
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                  >
                    <TableCell>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{log.action_name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[log.action_type] || ""}`}>
                        <Icon className="h-3 w-3" />
                        {log.action_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDuration(log.duration_ms)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.status_code || "-"}
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow key={`${log.id}-detail`}>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                              Parameters
                            </h4>
                            <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-60">
                              {log.params ? JSON.stringify(log.params, null, 2) : "—"}
                            </pre>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                              Response
                            </h4>
                            <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-60">
                              {log.response ? JSON.stringify(log.response, null, 2) : "—"}
                            </pre>
                          </div>
                          {log.error_message && (
                            <div className="col-span-2">
                              <h4 className="text-xs font-semibold uppercase text-destructive mb-1">
                                Error
                              </h4>
                              <pre className="text-xs bg-destructive/10 text-destructive rounded p-2 overflow-auto max-h-40">
                                {log.error_message}
                              </pre>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
