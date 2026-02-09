"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { actionsAPI } from "@/lib/admin/actions-api";
import { cn } from "@/lib/utils";
import { actionKeys } from "@/queries/actions.queries";
import type { Action, ImplementationStatus } from "@/types/actions";
import {
  ACTION_STATUS_COLORS,
  ACTION_TYPE_LABELS,
  IMPLEMENTATION_STATUS_LABELS,
  deriveActionLabel,
  getActionTypeIcon,
} from "@/types/actions";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock,
  Copy,
  ExternalLink,
  Layout,
  MoreVertical,
  Pencil,
  PlayCircle,
  Send,
  Trash,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface ActionCardProps {
  action: Action;
}

const ICON_COMPONENTS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "arrow-right": ArrowRight,
  layout: Layout,
  "edit-3": Pencil,
  zap: Zap,
  copy: Copy,
  "external-link": ExternalLink,
  "play-circle": PlayCircle,
};

function getImplementationStatusDisplay(status: ImplementationStatus): {
  className: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "verified":
      return {
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case "failing":
      return {
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        icon: <XCircle className="h-3 w-3" />,
      };
    case "stale":
      return {
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        icon: <Clock className="h-3 w-3" />,
      };
    default:
      return {
        className:
          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        icon: <CircleHelp className="h-3 w-3" />,
      };
  }
}

export function ActionCard({ action }: ActionCardProps) {
  const queryClient = useQueryClient();
  const iconName = getActionTypeIcon(action.action_type);
  const IconComponent = ICON_COMPONENTS[iconName] || Zap;
  const implStatus = getImplementationStatusDisplay(
    action.implementation_status
  );

  const handlePublish = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await actionsAPI.publish(action.id);
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
    } catch (err) {
      console.error("Failed to publish:", err);
    }
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await actionsAPI.archive(action.id);
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
    } catch (err) {
      console.error("Failed to archive:", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this action?")) return;
    try {
      await actionsAPI.delete(action.id);
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  return (
    <Link href={`/actions/${action.id}`}>
      <Card className="group cursor-pointer transition-all hover:border-primary hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconComponent className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>
                  {deriveActionLabel(action.name)}
                </CardTitle>
                <CardDescription className="text-xs">
                  <code>{action.name}</code>
                </CardDescription>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {action.status === "draft" && (
                  <DropdownMenuItem onClick={handlePublish}>
                    <Send className="mr-2 h-4 w-4" />
                    Publish
                  </DropdownMenuItem>
                )}
                {action.status === "published" && (
                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-red-600"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {action.description}
          </p>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center gap-2 p-4">
          <Badge className={ACTION_STATUS_COLORS[action.status]}>
            {action.status}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {ACTION_TYPE_LABELS[action.action_type]}
          </Badge>
          {action.status === "published" && (
            <Badge
              className={cn(
                "flex items-center gap-1 text-xs",
                implStatus.className
              )}
            >
              {implStatus.icon}
              {IMPLEMENTATION_STATUS_LABELS[action.implementation_status]}
            </Badge>
          )}
          {action.execution_count > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {action.execution_count} executions
            </span>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
