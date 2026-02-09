/**
 * Mock Data for Remotion Stills
 * Sample data used to render SDK preview components.
 */

import type { EdgeTriggerTab } from './sdk-previews/EdgeTriggerPreview';
import type { SuggestedQuestion } from './sdk-previews/HomeViewPreview';
import type { ChatMessage } from './sdk-previews/ChatThreadPreview';

// Sample edge trigger tabs
export const mockTabs: EdgeTriggerTab[] = [
  { 
    id: 'assistant', 
    label: 'Copilot', 
    icon: 'help', 
    enabled: true, 
    order: 1 
  },
  { 
    id: 'support', 
    label: 'Support', 
    icon: 'support', 
    enabled: true, 
    order: 2 
  },
];

// Sample suggested questions for home view
export const mockQuestions: SuggestedQuestion[] = [
  { id: '1', text: 'How do I get started?' },
  { id: '2', text: 'What actions can I create?' },
  { id: '3', text: 'How do I customize the theme?' },
];

// Sample chat messages for chat thread view
export const mockMessages: ChatMessage[] = [
  { 
    role: 'user', 
    content: 'What should I focus on today?' 
  },
  { 
    role: 'assistant', 
    content: 'Based on your pipeline and upcoming deadlines:\n\n1. Acme Corp ($150K) — Contract expires tomorrow. Follow up with Sarah about the renewal.\n\n2. TechFlow demo at 2pm — Review their usage data before the call.\n\n3. 3 proposals awaiting signature — Nudge Globex, they\'ve had it for 5 days.',
    showFeedback: true,
  },
];

// Extended conversation for fuller screenshots
export const mockConversationLong: ChatMessage[] = [
  { 
    role: 'user', 
    content: 'How do I get started with Pillar?' 
  },
  { 
    role: 'assistant', 
    content: 'Getting started with Pillar is easy! Here are the steps:\n\n1. **Install the SDK** - Run `npm install @pillar-ai/react`\n\n2. **Add the Provider** - Wrap your app with `PillarProvider`\n\n3. **Configure your widget** - Set your API key and customize the appearance',
    showFeedback: true,
  },
  { 
    role: 'user', 
    content: 'Can I customize the colors?' 
  },
  { 
    role: 'assistant', 
    content: 'Yes! You can fully customize the theme colors using the theme prop. Just pass your brand colors for primary, background, and text.',
    showFeedback: true,
  },
];

// Home view configuration
export const mockHomeConfig = {
  icon: '💬',
  title: 'How can I help?',
};

// Sample context items for input with highlighted text
export const mockContextItems = [
  { id: 'ctx-1', label: '"Error: Invalid API secret..."' },
];

// Multiple context items for testing
export const mockContextItemsMultiple = [
  { id: 'ctx-1', label: '"Getting started..."' },
  { id: 'ctx-2', label: '"API configuration"' },
];

// Plan steps for CRM example - closing a deal (half completed)
export const mockPlanSteps = [
  { id: 'step-1', description: 'Search for Walmart deal', status: 'completed' as const },
  { id: 'step-2', description: 'Open opportunity record', status: 'completed' as const },
  { id: 'step-3', description: 'Update stage to Closed Won', status: 'awaiting_result' as const },
  { id: 'step-4', description: 'Open implementation handoff form', status: 'pending' as const },
  { id: 'step-5', description: 'Pre-fill deal context for handoff', status: 'pending' as const },
];

// User request for CRM plan
export const mockPlanUserMessage = 'Close the Walmart deal as won and notify implementation';
