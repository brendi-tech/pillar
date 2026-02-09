import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { OrganizationInvitation, OrganizationRole } from "@/types/organization";
import { Copy, Send, Trash2 } from "lucide-react";

interface InvitationRowProps {
  invitation: OrganizationInvitation;
  isResending: boolean;
  isCanceling: boolean;
  onCopyLink: (link: string) => void;
  onResend: (id: string) => void;
  onCancel: (id: string) => void;
  getRoleBadgeColor: (role: OrganizationRole) => string;
}

export function InvitationRow({
  invitation,
  isResending,
  isCanceling,
  onCopyLink,
  onResend,
  onCancel,
  getRoleBadgeColor,
}: InvitationRowProps) {
  return (
    <TableRow key={`invitation-${invitation.id}`}>
      <TableCell className="text-muted-foreground font-medium">—</TableCell>
      <TableCell>{invitation.email}</TableCell>
      <TableCell>
        <Badge variant="outline" className={getRoleBadgeColor(invitation.role)}>
          {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          Pending
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCopyLink(invitation.invitation_link)}
            title="Copy invitation link"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onResend(invitation.id)}
            disabled={isResending}
            title="Resend invitation email"
          >
            <Send className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-8 w-8"
            onClick={() => onCancel(invitation.id)}
            disabled={isCanceling}
            title="Cancel invitation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
