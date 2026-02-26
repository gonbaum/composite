import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Trash2, Pencil, Play } from "lucide-react";
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

const typeColor: Record<string, string> = {
  api: "default",
  bash: "secondary",
  composite: "outline",
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
          <TableHead>Type</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No actions found
            </TableCell>
          </TableRow>
        )}
        {actions.map((action) => (
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
              <Badge variant={typeColor[action.action_type] as "default" | "secondary" | "outline"}>
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
        ))}
      </TableBody>
    </Table>
  );
}
