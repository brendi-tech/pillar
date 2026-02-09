/**
 * Element Highlighting Utility
 *
 * Used by AI-suggested actions to guide users to specific UI elements
 * after navigation. Scrolls to and briefly highlights the target element.
 */

// Store pending highlight selector for after navigation
const HIGHLIGHT_KEY = 'pillar_pending_highlight';

/**
 * Set a CSS selector to highlight after the next navigation.
 * The selector will be stored and applied when `applyPendingHighlight` is called.
 */
export function setPendingHighlight(selector: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(HIGHLIGHT_KEY, selector);
}

/**
 * Clear any pending highlight without applying it.
 */
export function clearPendingHighlight(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(HIGHLIGHT_KEY);
}

/**
 * Get and clear the pending highlight selector.
 */
export function consumePendingHighlight(): string | null {
  if (typeof window === 'undefined') return null;
  const selector = sessionStorage.getItem(HIGHLIGHT_KEY);
  if (selector) {
    sessionStorage.removeItem(HIGHLIGHT_KEY);
  }
  return selector;
}

/**
 * Apply pending highlight if one exists.
 * Call this on page load/navigation to highlight the target element.
 *
 * @param delay - Optional delay in ms before highlighting (for page transitions)
 */
export function applyPendingHighlight(delay: number = 300): void {
  const selector = consumePendingHighlight();
  if (selector) {
    setTimeout(() => {
      highlightElement(selector);
    }, delay);
  }
}

/**
 * Highlight a specific element by CSS selector.
 * Scrolls to the element and applies a brief highlight animation.
 *
 * @param selector - CSS selector for the target element
 * @param options - Configuration options
 */
export function highlightElement(
  selector: string,
  options: {
    scrollBehavior?: ScrollBehavior;
    highlightDuration?: number;
    scrollBlock?: ScrollLogicalPosition;
  } = {}
): boolean {
  const {
    scrollBehavior = 'smooth',
    highlightDuration = 2000,
    scrollBlock = 'center',
  } = options;

  try {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`[Highlight] Element not found: ${selector}`);
      return false;
    }

    // Scroll to element
    element.scrollIntoView({
      behavior: scrollBehavior,
      block: scrollBlock,
    });

    // Add highlight class
    element.classList.add('pillar-highlight');

    // Remove highlight after duration
    setTimeout(() => {
      element.classList.remove('pillar-highlight');
    }, highlightDuration);

    return true;
  } catch (error) {
    console.error('[Highlight] Error highlighting element:', error);
    return false;
  }
}

/**
 * Navigate to a path and highlight an element after navigation.
 *
 * @param router - Next.js router instance
 * @param path - The path to navigate to
 * @param highlightSelector - Optional CSS selector to highlight after navigation
 */
export function navigateAndHighlight(
  router: { push: (path: string) => void },
  path: string,
  highlightSelector?: string
): void {
  if (highlightSelector) {
    setPendingHighlight(highlightSelector);
  }
  router.push(path);
}
