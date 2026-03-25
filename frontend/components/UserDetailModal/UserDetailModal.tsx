"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Copy, Mail, Unlink, User } from "lucide-react";
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
import type { UnifiedUser, Visitor } from "@/lib/admin/visitors-api";
import { visitorsAPI } from "@/lib/admin/visitors-api";
import { v2Fetch } from "@/lib/admin/v2/api-client";
import { CHANNEL_BADGE_STYLES } from "@/types/agent";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unifiedUsersKeys } from "@/queries/visitors.queries";

interface IdentityMappingRecord {
  id: string;
  channel: string;
  channel_user_id: string;
  external_user_id: string;
  linked_at: string;
  linked_via: string;
  is_active: boolean;
}

export interface UserDetailModalProps {
  user?: UnifiedUser | null;
  /** @deprecated Use `user` instead */
  visitor?: Visitor | null;
  /** Opens modal and fetches the visitor by ID (for ConversationsPage compat) */
  visitorId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  user,
  visitor,
  visitorId,
  open,
  onOpenChange,
}: UserDetailModalProps) {
  const queryClient = useQueryClient();

  const { data: fetchedVisitor } = useQuery({
    queryKey: ["visitor-detail", visitorId],
    queryFn: () => visitorsAPI.getVisitor(visitorId!),
    enabled: open && !!visitorId && !user && !visitor,
  });

  const resolvedVisitor = visitor || fetchedVisitor;
  const displayName = user?.name || resolvedVisitor?.name || "Unknown User";
  const displayEmail = user?.email || resolvedVisitor?.email;
  const externalUserId = user?.external_user_id || resolvedVisitor?.external_user_id;

  const {
    data: mappings,
    isPending: mappingsLoading,
  } = useQuery({
    queryKey: ["identity-mappings", externalUserId],
    queryFn: async () => {
      const res = await v2Fetch<{ results: IdentityMappingRecord[] }>(
        "/identity/mappings/",
        { params: { external_user_id: externalUserId!, is_active: true } }
      );
      return res.results;
    },
    enabled: open && !!externalUserId,
  });

  const revokeMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      await v2Fetch(`/identity/mappings/${mappingId}/`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Channel link revoked");
      queryClient.invalidateQueries({ queryKey: ["identity-mappings", externalUserId] });
      queryClient.invalidateQueries({ queryKey: unifiedUsersKeys.all });
    },
    onError: () => {
      toast.error("Failed to revoke link");
    },
  });

  if (!open) return null;

  const hasUser = !!user || !!resolvedVisitor;

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

        {hasUser && (
          <ScrollArea
            className="max-h-[65vh] w-full overflow-hidden"
            viewportClassName="w-full overflow-hidden [&>div]:w-full [&>div]:overflow-hidden [&>div]:!block"
          >
            <div className="space-y-4 pr-6 w-full overflow-hidden">
              <div>
                <h4 className="text-sm font-medium mb-2">Identification</h4>
                <div className="rounded-md border p-3 space-y-1">
                  <DetailRow
                    label="User ID"
                    value={externalUserId}
                    copyable
                    mono
                  />
                  {user && (
                    <div className="flex items-start justify-between gap-4 py-2">
                      <span className="text-sm text-muted-foreground shrink-0">
                        Channels
                      </span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {user.channels.map((ch) => (
                          <Badge
                            key={ch}
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 font-medium capitalize ${CHANNEL_BADGE_STYLES[ch] ?? ""}`}
                          >
                            {ch}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Activity</h4>
                <div className="rounded-md border p-3 space-y-1">
                  {(user?.first_seen_at || resolvedVisitor?.first_seen_at) && (
                    <DetailRow
                      label="First Seen"
                      value={format(
                        new Date(
                          (user?.first_seen_at || resolvedVisitor?.first_seen_at)!
                        ),
                        "MMM d, yyyy 'at' h:mm a"
                      )}
                    />
                  )}
                  {(user?.last_seen_at || resolvedVisitor?.last_seen_at) && (
                    <DetailRow
                      label="Last Active"
                      value={formatDistanceToNow(
                        new Date(
                          (user?.last_seen_at || resolvedVisitor?.last_seen_at)!
                        ),
                        { addSuffix: true }
                      )}
                    />
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">
                  Linked Channel Accounts
                </h4>
                <div className="rounded-md border">
                  {mappingsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Spinner size="sm" />
                    </div>
                  ) : mappings && mappings.length > 0 ? (
                    <div className="divide-y">
                      {mappings.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 font-medium capitalize shrink-0 ${CHANNEL_BADGE_STYLES[m.channel] ?? ""}`}
                              >
                                {m.channel}
                              </Badge>
                              <span className="text-sm font-mono truncate">
                                {m.channel_user_id}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Linked{" "}
                              {formatDistanceToNow(new Date(m.linked_at), {
                                addSuffix: true,
                              })}{" "}
                              via {m.linked_via}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => revokeMutation.mutate(m.id)}
                            disabled={revokeMutation.isPending}
                            title="Revoke link"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground italic">
                        No linked channel accounts
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
