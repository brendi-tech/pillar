// lib/pillar/actions/index.ts
import type { SyncActionDefinitions } from '@pillar-ai/sdk';

export const actions = {
  create_project: {
    description: 'Create a new project with the given name',
    type: 'trigger_action' as const,
    dataSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
        template: { type: 'string', description: 'Template to use' },
      },
      required: ['name'],
    },
  },
  invite_user: {
    description: 'Invite a user to the workspace',
    type: 'trigger_action' as const,
    dataSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'User email address' },
        role: { type: 'string', description: 'Role: admin, member, or viewer' },
      },
      required: ['email', 'role'],
    },
  },
} as const satisfies SyncActionDefinitions;

export default actions;
