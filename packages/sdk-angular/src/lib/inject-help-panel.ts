/**
 * injectHelpPanel Function
 * Angular injection helper for panel-specific controls
 */

import { inject, computed } from '@angular/core';
import { PillarService } from './pillar.service';
import type { InjectHelpPanelResult } from './types';

/**
 * Angular injection function for panel-specific controls.
 * Provides a simplified API focused on panel operations.
 *
 * Must be called within an injection context (constructor, field initializer, or inject()).
 *
 * @example
 * ```typescript
 * @Component({
 *   selector: 'app-help-menu',
 *   standalone: true,
 *   template: `
 *     <div>
 *       <button (click)="toggle()">
 *         {{ isOpen() ? 'Close' : 'Help' }}
 *       </button>
 *       <button (click)="openChat()">Ask AI</button>
 *     </div>
 *   `,
 * })
 * export class HelpMenuComponent {
 *   private panel = injectHelpPanel();
 *   isOpen = this.panel.isOpen;
 *   toggle = this.panel.toggle;
 *   openChat = this.panel.openChat;
 * }
 * ```
 */
export function injectHelpPanel(): InjectHelpPanelResult {
  const service = inject(PillarService);

  const openSearch = (query?: string): void => {
    if (query) {
      service.search(query);
    } else {
      service.open({ view: 'search' });
    }
  };

  const openChat = (): void => {
    service.navigate('chat');
  };

  return {
    isOpen: computed(() => service.isPanelOpen()),
    open: service.open.bind(service),
    close: service.close.bind(service),
    toggle: service.toggle.bind(service),
    openArticle: service.openArticle.bind(service),
    openCategory: service.openCategory.bind(service),
    openSearch,
    openChat,
  };
}
