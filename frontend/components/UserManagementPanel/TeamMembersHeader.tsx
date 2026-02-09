import { Button } from "@/components/ui/button";

interface TeamMembersHeaderProps {
  membersCount: number;
  invitationsCount: number;
  isAdmin: boolean;
  onInviteClick: () => void;
}

export function TeamMembersHeader({
  membersCount,
  invitationsCount,
  isAdmin,
  onInviteClick,
}: TeamMembersHeaderProps) {
  return (
    <div className="block items-center justify-between gap-3 space-y-4 p-4 md:flex md:space-y-0">
      <div className="flex-1">
        <h3 className="text-foreground text-base leading-6 font-semibold">
          Team Members
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {membersCount} {membersCount === 1 ? "member" : "members"}
          {isAdmin && invitationsCount > 0 && ` • ${invitationsCount} pending`}
          {isAdmin && " • No per-user charges - invite your whole team!"}
        </p>
      </div>
      {isAdmin && (
        <Button type="button" onClick={onInviteClick} className="shrink-0">
          Invite Member
        </Button>
      )}
    </div>
  );
}
