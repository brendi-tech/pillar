const context = pillar.getChatContext();

if (context && window.FreshworksWidget) {
  const summary = context.messages
    .map(m => `${m.role === 'user' ? 'Customer' : 'Co-pilot'}: ${m.content}`)
    .join('\n\n');
  
  window.FreshworksWidget('open');
  window.FreshworksWidget('prefill', 'ticketForm', {
    description: `Escalated from Co-pilot:\n\n${summary}`,
  });
}
