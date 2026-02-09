/**
 * useHelpPanel Hook
 * Panel-specific controls and state
 */

import { useCallback } from 'react';
import { usePillarContext } from '../PillarProvider';

export interface UseHelpPanelResult {
  /** Whether the panel is currently open */
  isOpen: boolean;
  
  /** Open the panel */
  open: (options?: { view?: string; article?: string; search?: string }) => void;
  
  /** Close the panel */
  close: () => void;
  
  /** Toggle the panel */
  toggle: () => void;
  
  /** Open a specific article in the panel */
  openArticle: (slug: string) => void;
  
  /** Open a specific category in the panel */
  openCategory: (slug: string) => Promise<void>;
  
  /** Open search with a query */
  openSearch: (query?: string) => void;
  
  /** Open the AI chat */
  openChat: () => void;
}

/**
 * Hook for panel-specific controls
 * 
 * @example
 * ```tsx
 * function HelpButton() {
 *   const { isOpen, toggle, openChat } = useHelpPanel();
 *   
 *   return (
 *     <div>
 *       <button onClick={toggle}>
 *         {isOpen ? 'Close' : 'Help'}
 *       </button>
 *       <button onClick={openChat}>
 *         Ask AI
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useHelpPanel(): UseHelpPanelResult {
  const { isPanelOpen, open, close, toggle, openArticle, openCategory, search, navigate } = usePillarContext();

  const openSearch = useCallback(
    (query?: string) => {
      if (query) {
        search(query);
      } else {
        open({ view: 'search' });
      }
    },
    [search, open]
  );

  const openChat = useCallback(() => {
    navigate('chat');
  }, [navigate]);

  return {
    isOpen: isPanelOpen,
    open,
    close,
    toggle,
    openArticle,
    openCategory,
    openSearch,
    openChat,
  };
}

