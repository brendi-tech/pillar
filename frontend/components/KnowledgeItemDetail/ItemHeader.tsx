"use client";

import { DetailHeader } from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { KNOWLEDGE_ITEM_TYPE_LABELS, KnowledgeItem } from "@/types/knowledge";
import { FileText, RefreshCw, Trash2 } from "lucide-react";

interface ItemHeaderProps {
  item: KnowledgeItem;
  onToggleActive: () => void;
  onReprocess: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isReprocessing: boolean;
  isDeleting: boolean;
}

export function ItemHeader({
  item,
  onToggleActive,
  onReprocess,
  onDelete,
  isUpdating,
  isReprocessing,
  isDeleting,
}: ItemHeaderProps) {
  const isProcessing = isReprocessing || item.status === "processing";
  return (
    <DetailHeader
      icon={<FileText className="h-5 w-5 text-muted-foreground" />}
      title={item.title || "Untitled"}
      subtitle={KNOWLEDGE_ITEM_TYPE_LABELS[item.item_type]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Switch
              checked={item.is_active}
              onCheckedChange={onToggleActive}
              disabled={isUpdating}
              aria-label="Include in AI search"
            />
            <span className="hidden xs:inline">
              {item.is_active ? "In search" : "Excluded"}
            </span>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={onReprocess}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Spinner className="h-4 w-4 sm:mr-1.5" />
            ) : (
              <RefreshCw className="h-4 w-4 sm:mr-1.5" />
            )}
            <span className="hidden sm:inline">Reprocess</span>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Knowledge Item</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{item.title}
                  &quot;? This will remove this content from the knowledge base
                  and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? <Spinner size="sm" className="mr-2" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    />
  );
}
