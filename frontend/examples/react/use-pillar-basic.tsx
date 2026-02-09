import { usePillar } from '@pillar-ai/react';
import { useEffect, useCallback } from 'react';

function SupportHandler() {
  const { on, getChatContext, close } = usePillar();

  const handleEscalation = useCallback(() => {
    const context = getChatContext();
    
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
    
    close();
  }, [getChatContext, close]);

  useEffect(() => {
    const unsubscribe = on('sidebar:click', ({ tabId }) => {
      if (tabId === 'support') {
        handleEscalation();
      }
    });
    return unsubscribe;
  }, [on, handleEscalation]);

  return null;
}
