import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { OrganizationMembership, OrganizationRole } from "@/types/organization";
import { Trash2 } from "lucide-react";

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
    <TableRow key={`member-${membership.id}`}>
      <TableCell className="font-medium">
        {membership.user.full_name}
      </TableCell>
      <TableCell>{membership.user.email}</TableCell>
      <TableCell>
        <Badge variant="outline" className={getRoleBadgeColor(membership.role)}>
          {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
        </Badge>
      </TableCell>
      <TableCell>
        {new Date(membership.created_at).toLocaleDateString()}
      </TableCell>
      {isAdmin && (
        <TableCell className="text-right">
          {!isCurrentUser && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-8 w-8"
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
