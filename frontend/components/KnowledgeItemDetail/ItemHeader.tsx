"use client";

import { useState } from "react";
import { DetailHeader } from "@/components/shared";
import { WarningModal } from "@/components/WarningModal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <WarningModal
            open={showDeleteModal}
            onOpenChange={setShowDeleteModal}
            onConfirm={onDelete}
            title="Delete Knowledge Item"
            description={
              <>
                Are you sure you want to delete <strong>{item.title}</strong>?
                This will remove this content from the knowledge base and cannot
                be undone.
              </>
            }
            variant="delete"
            isLoading={isDeleting}
          />
        </div>
      }
    />
  );
}
