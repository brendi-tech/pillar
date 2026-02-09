/**
 * PillarPanelComponent
 * Renders the Pillar help panel at a custom location in the DOM
 */

import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  effect,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { PillarService } from './pillar.service';

/**
 * Renders the Pillar help panel at a custom location in the DOM.
 * Use this when you want to control where the panel is rendered instead of
 * having it automatically appended to document.body.
 *
 * **Important**: When using this component, set `panel.container: 'manual'` in your
 * Pillar configuration to prevent automatic mounting.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * function initPillar() {
 *   const pillar = inject(PillarService);
 *   return () => pillar.init({
 *     productKey: 'your-product-key',
 *     config: { panel: { container: 'manual' } }
 *   });
 * }
 *
 * // layout.component.ts
 * @Component({
 *   selector: 'app-layout',
 *   standalone: true,
 *   imports: [PillarPanelComponent],
 *   template: `
 *     <div class="layout">
 *       <app-sidebar />
 *       <pillar-panel class="help-panel-container" />
 *       <main>
 *         <router-outlet />
 *       </main>
 *     </div>
 *   `,
 * })
 * export class LayoutComponent {}
 * ```
 */
@Component({
  selector: 'pillar-panel',
  standalone: true,
  template: '<div #container data-pillar-panel-container></div>',
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PillarPanelComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true })
  private containerRef!: ElementRef<HTMLDivElement>;

  private readonly pillarService = inject(PillarService);
  private hasMounted = false;
  private effectRef: ReturnType<typeof effect> | null = null;

  /**
   * Optional class to add to the container element.
   * Use host binding for styling instead if possible.
   */
  readonly containerClass = input<string>('');

  ngAfterViewInit(): void {
    // Use effect to react to isReady signal changes
    this.effectRef = effect(() => {
      const isReady = this.pillarService.isReady();

      if (isReady && !this.hasMounted && this.containerRef?.nativeElement) {
        this.pillarService.mountPanelTo(this.containerRef.nativeElement);
        this.hasMounted = true;
      }
    });
  }

  ngOnDestroy(): void {
    // Effect is automatically cleaned up when component is destroyed
    // Panel cleanup is handled by PillarService
    this.effectRef?.destroy();
  }
}
