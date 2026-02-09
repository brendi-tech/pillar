// lib/pillar/actions/index.ts
import type { SyncActionDefinitions } from '@pillar-ai/sdk';

export const actions = {
  invite_member: {
    description: 'Open the invite team member modal',
    examples: ['invite someone', 'add a user', 'how do I add teammates?'],
    type: 'trigger_action' as const,
  },

  view_settings: {
    description: 'Navigate to the settings page',
    type: 'navigate' as const,
    path: '/settings',
    autoRun: true,
  },
} as const satisfies SyncActionDefinitions;

export default actions;
