import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Trash2, Pencil, Play, Globe, Terminal, Layers } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Action } from "@/types";

const typeConfig: Record<string, { icon: typeof Globe; className: string }> = {
  api: { icon: Globe, className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-900" },
  bash: { icon: Terminal, className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900" },
  composite: { icon: Layers, className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400 border-violet-200 dark:border-violet-900" },
};

interface Props {
  actions: Action[];
  onToggle: (action: Action) => void;
  onDelete: (action: Action) => void;
  onTest: (action: Action) => void;
}

export default function ActionTable({ actions, onToggle, onDelete, onTest }: Props) {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="w-28">Type</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead className="w-20">Enabled</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
              No actions found
            </TableCell>
          </TableRow>
        )}
        {actions.map((action) => {
          const tc = typeConfig[action.action_type] || typeConfig.api;
          const TypeIcon = tc.icon;
          return (
            <TableRow key={action.documentId}>
              <TableCell>
                <div>
                  <span className="font-medium">{action.display_name || action.name}</span>
                  <p className="text-xs text-muted-foreground truncate max-w-md">
                    {action.description}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`gap-1 font-medium ${tc.className}`}>
                  <TypeIcon className="h-3 w-3" />
                  {action.action_type}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {(action.tags || []).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Switch
                  checked={action.enabled}
                  onCheckedChange={() => onToggle(action)}
                />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onTest(action)}>
                      <Play className="mr-2 h-4 w-4" /> Test
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/actions/${action.documentId}/edit`)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(action)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
