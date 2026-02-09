import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BulkInvitationResult, OrganizationRole } from "@/types/organization";
import { AlertTriangle, X } from "lucide-react";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteEmail: string;
  parsedEmails: string[];
  inviteRole: OrganizationRole;
  domainMismatchWarning: string | null;
  bulkInviteResult: BulkInvitationResult | null;
  isInviting: boolean;
  onEmailInputChange: (text: string) => void;
  onRemoveEmail: (email: string) => void;
  onRoleChange: (role: OrganizationRole) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  inviteEmail,
  parsedEmails,
  inviteRole,
  domainMismatchWarning,
  bulkInviteResult,
  isInviting,
  onEmailInputChange,
  onRemoveEmail,
  onRoleChange,
  onSubmit,
}: InviteMemberDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Team Members</DialogTitle>
          <DialogDescription>
            Invite team members by email. You can paste multiple emails at once.
            We don't charge per user - invite your whole team!
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Addresses</Label>
              <Textarea
                value={inviteEmail}
                onChange={(e) => onEmailInputChange(e.target.value)}
                placeholder="user@example.com, or paste multiple emails separated by commas or newlines"
                rows={4}
                autoFocus
              />
              <p className="text-muted-foreground text-xs">
                Paste emails separated by commas, semicolons, or new lines
              </p>

              {/* Display parsed emails as badges */}
              {parsedEmails.length > 0 && (
                <div className="bg-muted/50 border-border flex flex-wrap gap-2 rounded-md border p-3">
                  {parsedEmails.map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="flex items-center gap-2 px-3 py-1 text-sm"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => onRemoveEmail(email)}
                        className="hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {domainMismatchWarning && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>{domainMismatchWarning}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={inviteRole}
                onChange={(e) => onRoleChange(e.target.value as OrganizationRole)}
                className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <p className="text-muted-foreground mt-1 text-xs">
                Admins can manage users, settings, and billing. Members can use
                the product.
              </p>
            </div>

            {/* Show results after invite attempt */}
            {bulkInviteResult && (
              <div className="space-y-3 border-t pt-4">
                {bulkInviteResult.successful.length > 0 && (
                  <div className="rounded-md border border-green-500/20 bg-green-500/10 p-3">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      ✓ Successfully invited {bulkInviteResult.successful.length}{" "}
                      {bulkInviteResult.successful.length === 1
                        ? "member"
                        : "members"}
                    </p>
                  </div>
                )}

                {bulkInviteResult.skipped.length > 0 && (
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
                    <p className="mb-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                      ⚠ {bulkInviteResult.skipped.length}{" "}
                      {bulkInviteResult.skipped.length === 1
                        ? "email was"
                        : "emails were"}{" "}
                      skipped:
                    </p>
                    <ul className="ml-4 space-y-1 text-xs text-amber-600 dark:text-amber-400">
                      {bulkInviteResult.skipped.map((skip, idx) => (
                        <li key={idx}>
                          <strong>{skip.email}</strong>: {skip.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bulkInviteResult.errors.length > 0 && (
                  <div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
                    <p className="text-destructive mb-2 text-sm font-medium">
                      ✗ {bulkInviteResult.errors.length}{" "}
                      {bulkInviteResult.errors.length === 1
                        ? "invitation"
                        : "invitations"}{" "}
                      failed:
                    </p>
                    <ul className="text-destructive ml-4 space-y-1 text-xs">
                      {bulkInviteResult.errors.map((err, idx) => (
                        <li key={idx}>
                          <strong>{err.email}</strong>: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              {bulkInviteResult &&
              (bulkInviteResult.errors.length > 0 ||
                bulkInviteResult.skipped.length > 0)
                ? "Close"
                : "Cancel"}
            </Button>
            <Button type="submit" disabled={isInviting || parsedEmails.length === 0}>
              {isInviting
                ? "Inviting..."
                : parsedEmails.length === 0
                  ? "Invite"
                  : parsedEmails.length === 1
                    ? "Invite 1 Member"
                    : `Invite ${parsedEmails.length} Members`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
