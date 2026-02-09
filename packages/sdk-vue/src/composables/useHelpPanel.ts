/**
 * useHelpPanel Composable
 * Panel-specific controls and state
 */

import { computed, type ComputedRef } from 'vue';
import { usePillar } from './usePillar';

export interface UseHelpPanelResult {
  /** Whether the panel is currently open */
  isOpen: ComputedRef<boolean>;
  
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
 * Composable for panel-specific controls
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useHelpPanel } from '@pillar-ai/vue';
 *
 * const { isOpen, toggle, openChat } = useHelpPanel();
 * </script>
 *
 * <template>
 *   <div>
 *     <button @click="toggle">
 *       {{ isOpen ? 'Close' : 'Help' }}
 *     </button>
 *     <button @click="openChat">
 *       Ask AI
 *     </button>
 *   </div>
 * </template>
 * ```
 */
export function useHelpPanel(): UseHelpPanelResult {
  const { isPanelOpen, open, close, toggle, openArticle, openCategory, search, navigate } = usePillar();

  const isOpen = computed(() => isPanelOpen.value);

  const openSearch = (query?: string) => {
    if (query) {
      search(query);
    } else {
      open({ view: 'search' });
    }
  };

  const openChat = () => {
    navigate('chat');
  };

  return {
    isOpen,
    open,
    close,
    toggle,
    openArticle,
    openCategory,
    openSearch,
    openChat,
  };
}
