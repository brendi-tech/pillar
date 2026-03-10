import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { OrganizationMembership, OrganizationRole } from "@/types/organization";

interface MemberRowProps {
  membership: OrganizationMembership;
  isCurrentUser: boolean;
  isAdmin: boolean;
  isRemoving: boolean;
  onRemove: (member: OrganizationMembership) => void;
  getRoleBadgeColor: (role: OrganizationRole) => string;
}

export function MemberRow({
  membership,
  isCurrentUser,
  isAdmin,
  isRemoving,
  onRemove,
  getRoleBadgeColor,
}: MemberRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {membership.user.full_name || (
          <span className="text-muted-foreground italic">No name</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {membership.user.email}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={getRoleBadgeColor(membership.role)}>
          {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDistanceToNow(new Date(membership.created_at), {
          addSuffix: true,
        })}
      </TableCell>
      {isAdmin && (
        <TableCell className="text-right">
          {!isCurrentUser && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(membership)}
              disabled={isRemoving}
              title="Remove member"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}
