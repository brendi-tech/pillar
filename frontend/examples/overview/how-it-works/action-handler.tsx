// Example tool handler configuration
export const inviteMemberTool = {
  invite_member: {
    description: 'Invite a team member',
    type: 'trigger_tool',
    execute: (data: { email: string }) => {
      // This runs when the user triggers the tool
      openInviteModal({ email: data.email });
    },
  },
};

// Placeholder for example
declare function openInviteModal(options: { email: string }): void;
