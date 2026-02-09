const context = pillar.getChatContext();

if (context) {
  const summary = context.messages
    .map(m => `${m.role === 'user' ? 'Customer' : 'Co-pilot'}: ${m.content}`)
    .join('\n\n');
  
  window.Intercom('showNewMessage', 
    `Escalated from Co-pilot:\n\n${summary}`
  );
}
