export function MemberNotice() {
  return (
    <div className="bg-muted/50 border-border rounded-md border p-4">
      <div className="flex">
        <div className="ml-3">
          <p className="text-muted-foreground text-sm">
            You are viewing this organization as a member. Only admins can invite
            new members or manage team settings. Contact an admin if you need to
            invite someone.
          </p>
        </div>
      </div>
    </div>
  );
}
