import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Globe, Terminal, Layers, RefreshCw, Monitor, Server, Send } from "lucide-react";
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

function ResolvedRequestPanel({ log }: { log: ActionLog }) {
  const req = log.resolved_request;
  if (!req) return null;

  // API request
  if (log.action_type === "api" && req.method && req.url) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-blue-500" />
          <code className="text-xs font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">{String(req.method)}</span>{" "}
            <span className="text-muted-foreground break-all">{String(req.url)}</span>
          </code>
        </div>
        {req.headers && typeof req.headers === "object" && Object.keys(req.headers).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Headers</p>
            <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-32">
              {Object.entries(req.headers as Record<string, string>)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")}
            </pre>
          </div>
        )}
        {req.body && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Body</p>
            <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-32">
              {String(req.body)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Bash request
  if (log.action_type === "bash" && req.command) {
    return (
      <div className="flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5 text-amber-500" />
        <code className="text-xs text-muted-foreground break-all">
          <span className="text-amber-600 dark:text-amber-400">$</span> {String(req.command)}
        </code>
      </div>
    );
  }

  // Composite request
  if (log.action_type === "composite" && Array.isArray(req.steps)) {
    return (
      <div className="space-y-2">
        <Layers className="h-3.5 w-3.5 text-violet-500" />
        {(req.steps as any[]).map((step, i) => (
          <div key={i} className="text-xs bg-muted p-2 rounded">
            <span className="font-semibold text-violet-600 dark:text-violet-400">Step {i + 1}:</span>{" "}
            <span className="font-medium">{step.action}</span>
            {step.params && Object.keys(step.params).length > 0 && (
              <pre className="text-muted-foreground mt-1 overflow-auto">
                {JSON.stringify(step.params, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Fallback: raw JSON
  return (
    <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-40">
      {JSON.stringify(req, null, 2)}
    </pre>
  );
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [actionNames, setActionNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const filters: { action_name?: string; success?: boolean; source?: string } = {};
      if (nameFilter !== "all") filters.action_name = nameFilter;
      if (statusFilter === "success") filters.success = true;
      if (statusFilter === "fail") filters.success = false;
      if (sourceFilter !== "all") filters.source = sourceFilter;
      setLogs(await getActionLogs(filters));
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  }, [nameFilter, statusFilter, sourceFilter]);

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

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="dashboard">Dashboard</SelectItem>
            <SelectItem value="mcp">MCP</SelectItem>
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
              <TableHead>Source</TableHead>
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
                      {log.source === "dashboard" ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400">
                          <Monitor className="h-3 w-3" />
                          dashboard
                        </span>
                      ) : log.source === "mcp" ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          <Server className="h-3 w-3" />
                          mcp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          unknown
                        </span>
                      )}
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
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-2 gap-4">
                          {log.resolved_request && (
                            <div className="col-span-2">
                              <h4 className="text-xs font-semibold uppercase text-orange-600 dark:text-orange-400 mb-1 flex items-center gap-1">
                                <Send className="h-3 w-3" />
                                Request
                              </h4>
                              <div className="bg-muted rounded p-2">
                                <ResolvedRequestPanel log={log} />
                              </div>
                            </div>
                          )}
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
