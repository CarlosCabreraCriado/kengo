import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toObservable } from '@angular/core/rxjs-interop';

import { PageLoaderService } from '../../../core/services/page-loader.service';
import { Ui2SpinnerComponent } from '../spinner/spinner.component';

/**
 * Overlay global de carga de página. Cubre el área del `<main>` (no el shell)
 * mientras el `PageLoaderService` reporte `isPageLoading() === true`.
 *
 * El render se mantiene un instante extra tras la transición a `false` para
 * permitir un fade-out de 200 ms sin desmontar el spinner abruptamente.
 */
@Component({
  selector: 'ui2-page-loader-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2SpinnerComponent],
  template: `
    @if (mounted()) {
      <div
        class="ui2-page-loader-overlay"
        [class.ui2-page-loader-overlay--visible]="visible()"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <ui2-spinner size="lg" color="primary" />
      </div>
    }
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: var(--z-loader);
    }
    .ui2-page-loader-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--cream-50);
      opacity: 0;
      transition: opacity 200ms ease-out;
      pointer-events: auto;
    }
    .ui2-page-loader-overlay--visible {
      opacity: 1;
    }
  `],
})
export class Ui2PageLoaderOverlayComponent {
  private readonly pageLoader = inject(PageLoaderService);

  /** Estado de visibilidad lógico (driven por el service). */
  protected readonly visible = computed(() => this.pageLoader.isPageLoading());

  /** Se mantiene montado un poco más allá del cambio a false para permitir el fade-out. */
  protected readonly mounted = signal(false);

  constructor() {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    toObservable(this.visible)
      .pipe(takeUntilDestroyed())
      .subscribe((isVisible) => {
        if (isVisible) {
          if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
          }
          this.mounted.set(true);
        } else if (this.mounted()) {
          if (hideTimer) clearTimeout(hideTimer);
          hideTimer = setTimeout(() => {
            this.mounted.set(false);
            hideTimer = null;
          }, 220);
        }
      });
  }
}
