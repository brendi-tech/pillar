// lib/pillar/tools/index.ts
import type { SyncToolDefinitions } from '@pillar-ai/sdk';

export const tools = {
  invite_member: {
    description: 'Open the invite team member modal',
    examples: ['invite someone', 'add a user', 'how do I add teammates?'],
    type: 'trigger_tool' as const,
  },

  view_settings: {
    description: 'Navigate to the settings page',
    type: 'navigate' as const,
    path: '/settings',
    autoRun: true,
  },
} as const satisfies SyncToolDefinitions;

export default tools;
