"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Copy, Mail, MessageSquare, User } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { Visitor } from "@/lib/admin/visitors-api";
import { visitorDetailQuery } from "@/queries/visitors.queries";
import type { VisitorSummary } from "@/types/admin";
import { useQuery } from "@tanstack/react-query";

export interface UserDetailModalProps {
  /** Full visitor data - if provided, no fetch is needed */
  visitor?: Visitor | null;
  /** Visitor summary - triggers a fetch for full data */
  visitorSummary?: VisitorSummary | null;
  /** Visitor ID - triggers a fetch for full data */
  visitorId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "resolved":
      return "default";
    case "escalated":
      return "destructive";
    case "active":
      return "secondary";
    case "abandoned":
      return "outline";
    default:
      return "secondary";
  }
}

interface DetailRowProps {
  label: string;
  value: string | null | undefined;
  copyable?: boolean;
  mono?: boolean;
}

function DetailRow({ label, value, copyable, mono }: DetailRowProps) {
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2 max-w-[60%]">
        <span
          className={`text-sm text-right truncate ${mono ? "font-mono text-xs" : ""}`}
          title={value || undefined}
        >
          {value || <span className="text-muted-foreground italic">-</span>}
        </span>
        {copyable && value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function UserDetailModal({
  visitor: visitorProp,
  visitorSummary,
  visitorId,
  open,
  onOpenChange,
}: UserDetailModalProps) {
  const idToFetch = visitorId || visitorSummary?.id;
  const needsFetch = !visitorProp && !!idToFetch;

  const {
    data: fetchedVisitor,
    isPending,
    isError,
  } = useQuery({
    ...visitorDetailQuery(idToFetch || ""),
    enabled: needsFetch && open,
  });

  const visitor = visitorProp || fetchedVisitor;
  const displayName = visitor?.name || visitorSummary?.name || "Unknown User";
  const displayEmail = visitor?.email || visitorSummary?.email;

  if (!open) return null;

  const hasMetadata =
    visitor?.metadata && Object.keys(visitor.metadata).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden pr-0">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{displayName}</DialogTitle>
              <DialogDescription className="flex items-center gap-1">
                {displayEmail ? (
                  <>
                    <Mail className="h-3 w-3" />
                    {displayEmail}
                  </>
                ) : (
                  "No email provided"
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {needsFetch && isPending && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {needsFetch && isError && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <p>Failed to load user details</p>
          </div>
        )}

        {visitor && (
          <ScrollArea
            className="max-h-[65vh] w-full overflow-hidden"
            viewportClassName="w-full overflow-hidden [&>div]:w-full [&>div]:overflow-hidden [&>div]:!block"
          >
            <div className="space-y-4 pr-6 w-full overflow-hidden">
              <div>
                <h4 className="text-sm font-medium mb-2">Identification</h4>
                <div className="rounded-md border p-3 space-y-1">
                  <DetailRow
                    label="Visitor ID"
                    value={visitor.visitor_id}
                    copyable
                    mono
                  />
                  <DetailRow
                    label="External User ID"
                    value={visitor.external_user_id}
                    copyable
                    mono
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Activity</h4>
                <div className="rounded-md border p-3 space-y-1">
                  <DetailRow
                    label="First Seen"
                    value={format(
                      new Date(visitor.first_seen_at),
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  />
                  <DetailRow
                    label="Last Seen"
                    value={format(
                      new Date(visitor.last_seen_at),
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Metadata</h4>
                  {hasMetadata && (
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(visitor.metadata).length} field
                      {Object.keys(visitor.metadata).length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <div className="rounded-md border p-3">
                  {hasMetadata ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(visitor.metadata, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No additional metadata
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Recent Conversations</h4>
                </div>
                <div className="rounded-md border">
                  {visitor.recent_conversations.length > 0 ? (
                    <div className="divide-y">
                      {visitor.recent_conversations.map((conversation) => (
                        <div key={conversation.id} className="p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate max-w-[calc(100%-80px)]">
                              {conversation.first_user_message ||
                                conversation.title ||
                                "Untitled conversation"}
                            </p>
                            <Badge
                              variant={getStatusBadgeVariant(
                                conversation.status
                              )}
                              className="text-xs shrink-0"
                            >
                              {conversation.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {conversation.message_count} messages
                            </span>
                            <span>
                              {formatDistanceToNow(
                                new Date(conversation.started_at),
                                {
                                  addSuffix: true,
                                }
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground italic">
                        No conversations yet
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
