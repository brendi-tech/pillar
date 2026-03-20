import { PillarProvider } from '@pillar-ai/react';

export function App() {
  return (
    <PillarProvider
      agentSlug="your-agent-slug"
      config={{
        sidebarTabs: [
          { id: 'assistant', label: 'Co-pilot', icon: 'sparkle' },
          { id: 'support', label: 'Talk to Human', icon: 'headset' },
        ],
      }}
    >
      {/* Your app */}
    </PillarProvider>
  );
}
