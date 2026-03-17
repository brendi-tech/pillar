"use client";

import { useState } from "react";
import type { MetadataItem } from "@/components/shared";
import { MetadataStrip } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ConversationDetailDrawer } from "@/components/ConversationDetailDrawer";
import {
  KNOWLEDGE_ITEM_STATUS_COLORS,
  KNOWLEDGE_ITEM_TYPE_LABELS,
} from "@/types/knowledge";
import type { KnowledgeItem } from "@/types/knowledge";
import { format, parseISO, isValid } from "date-fns";
import { ExternalLink, MessageSquare } from "lucide-react";

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const colorMap: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    green: "default",
    blue: "secondary",
    red: "destructive",
    yellow: "outline",
  };
  const color =
    KNOWLEDGE_ITEM_STATUS_COLORS[
      status as keyof typeof KNOWLEDGE_ITEM_STATUS_COLORS
    ] || "gray";
  return colorMap[color] || "secondary";
}

/**
 * Format a date string to a human-readable format.
 * Handles ISO strings and Date objects.
 */
function formatDate(dateValue: string | Date): string {
  try {
    const date = typeof dateValue === "string" ? parseISO(dateValue) : dateValue;
    if (!isValid(date)) return String(dateValue);
    return format(date, "MMM d, yyyy 'at' h:mm a");
  } catch {
    return String(dateValue);
  }
}

/**
 * Check if a string looks like an ISO date string.
 */
function isISODateString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  return isoPattern.test(value);
}

// Metadata keys that are promoted to specific display slots
const PROMOTED_METADATA_KEYS = new Set([
  "file_path",
  "original_filename",
  "file_size_bytes",
  "file_type",
  "uploaded_at",
  "word_count",
  "scraped_at",
]);

// Metadata keys that are handled specially (clickable, etc.)
const SPECIAL_METADATA_KEYS = new Set([
  "source_conversation_id",
]);

// =============================================================================
// Component
// =============================================================================

interface ItemMetadataSectionProps {
  item: KnowledgeItem;
}

/**
 * Displays metadata information for a knowledge item in a responsive grid.
 * Handles status, type, chunks, word count, dates, URLs, and dynamic metadata fields.
 */
export function ItemMetadataSection({ item }: ItemMetadataSectionProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const metadataItems: MetadataItem[] = [];

  // Status badge
  const statusLabel = !item.is_active
    ? "Excluded"
    : item.status === "indexed"
      ? "Searchable"
      : item.status === "processing"
        ? "Processing"
        : item.status === "failed"
          ? "Failed"
          : "Processing";

  metadataItems.push({
    label: "Status",
    value: (
      <Badge
        variant={
          !item.is_active ? "secondary" : getStatusBadgeVariant(item.status)
        }
      >
        {item.status === "processing" && item.is_active && (
          <Spinner size="xs" className="mr-1" />
        )}
        {statusLabel}
      </Badge>
    ),
    allowWrap: true,
  });

  // Item type
  metadataItems.push({
    label: "Type",
    value: KNOWLEDGE_ITEM_TYPE_LABELS[item.item_type],
  });

  // Chunk count (only for indexed items)
  if (item.status === "indexed") {
    metadataItems.push({
      label: "Chunks",
      value: (
        <span className="font-semibold tabular-nums">{item.chunk_count}</span>
      ),
      allowWrap: true,
    });
  }

  // Word count
  const wordCount = item.metadata?.word_count;
  if (wordCount != null) {
    metadataItems.push({
      label: "Word Count",
      value: (
        <span className="tabular-nums">
          {Number(wordCount).toLocaleString()}
        </span>
      ),
      allowWrap: true,
    });
  }

  // Scraped date
  const scrapedAt = item.metadata?.scraped_at;
  if (scrapedAt) {
    metadataItems.push({
      label: "Scraped",
      value: formatDate(String(scrapedAt)),
    });
  }

  // Source conversation (clickable to open drawer)
  const sourceConversationId = item.metadata?.source_conversation_id;
  if (sourceConversationId && typeof sourceConversationId === "string") {
    metadataItems.push({
      label: "Source Conversation",
      value: (
        <button
          type="button"
          onClick={() => setSelectedConversationId(sourceConversationId)}
          className="inline-flex items-center gap-1.5 text-primary hover:underline underline-offset-2"
        >
          <MessageSquare className="h-3 w-3" />
          <span>View Conversation</span>
        </button>
      ),
      allowWrap: true,
    });
  }

  // Dynamic metadata fields (not in promoted keys or special keys)
  if (item.metadata) {
    const remainingEntries = Object.entries(item.metadata).filter(
      ([key]) => !PROMOTED_METADATA_KEYS.has(key) && !SPECIAL_METADATA_KEYS.has(key)
    );
    
    for (const [key, value] of remainingEntries) {
      if (value == null || value === "") continue;

      let formattedValue: string;
      if (isISODateString(value)) {
        formattedValue = formatDate(String(value));
      } else if (typeof value === "object") {
        formattedValue = JSON.stringify(value);
      } else {
        formattedValue = String(value);
      }

      metadataItems.push({
        label: key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        value: formattedValue,
      });
    }
  }

  return (
    <>
      <div className="space-y-2">
        {item.url && (
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">
                Source URL
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline min-w-0"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.url}</span>
              </a>
            </div>
          </div>
        )}
        <MetadataStrip items={metadataItems} columns={4} />
      </div>

      <ConversationDetailDrawer
        conversationId={selectedConversationId}
        open={selectedConversationId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedConversationId(null);
        }}
      />
    </>
  );
}
