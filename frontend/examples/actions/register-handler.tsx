import { usePillar } from '@pillar-ai/react';

function ActionHandler() {
  const { onTask } = usePillar();

  onTask('createProject', async ({ name, template }) => {
    // Your logic to create the project
    const project = await createProject({ name, template });
    return { projectId: project.id };
  });

  onTask('inviteUser', async ({ email, role }) => {
    // Your logic to invite the user
    await sendInvite({ email, role });
    return { message: 'Invite sent' };
  });

  return null;
}
