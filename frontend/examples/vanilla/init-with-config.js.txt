const pillar = await Pillar.init({
  productKey: 'your-product-key',
  sidebarTabs: [
    { id: 'assistant', label: 'Co-pilot', icon: 'sparkle' },
    { id: 'support', label: 'Talk to Human', icon: 'headset' },
  ],
});

pillar.on('sidebar:click', ({ tabId }) => {
  if (tabId === 'support') {
    const context = pillar.getChatContext();
    
    if (context) {
      const summary = context.messages
        .map(m => `${m.role === 'user' ? 'Customer' : 'Co-pilot'}: ${m.content}`)
        .join('\n\n');
      
      window.Intercom('showNewMessage', 
        `Escalated from Co-pilot:\n\n${summary}`
      );
    } else {
      window.Intercom('showNewMessage');
    }
    
    pillar.close();
  }
});
