const context = pillar.getChatContext();

if (context && window.zE) {
  const summary = context.messages
    .map(m => `${m.role === 'user' ? 'Customer' : 'Co-pilot'}: ${m.content}`)
    .join('\n\n');
  
  // Pre-fill the Zendesk widget
  window.zE('messenger', 'open');
  window.zE('messenger:set', 'conversationFields', [{
    id: 'description',
    value: `Escalated from Co-pilot:\n\n${summary}`,
  }]);
}
