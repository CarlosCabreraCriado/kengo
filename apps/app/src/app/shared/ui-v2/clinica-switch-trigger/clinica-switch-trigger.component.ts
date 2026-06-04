import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import type { Clinica } from '../../../../types/global';
import { Ui2ClinicaSwitchMenuComponent } from '../clinica-switch-menu/clinica-switch-menu.component';

export type Ui2ClinicaSwitchTriggerPlacement = 'top' | 'bottom';

/**
 * Wrapper reutilizable del badge "Cambiar" + popup `<ui2-clinica-switch-menu>`.
 *
 * Se monta como overlay absoluto sobre cualquier card de clínica (sidenav o
 * dashboard hero): el padre solo necesita `position: relative` en su wrapper.
 * Si el usuario tiene ≤1 clínica, el host se oculta y no consume espacio.
 *
 * No conoce tema/toast/navegación — re-emite `(clinicaCambiada)` para que el
 * padre orqueste branding/toast/navegación.
 */
@Component({
  standalone: true,
  selector: 'ui2-clinica-switch-trigger',
  imports: [Ui2ClinicaSwitchMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (esMulticlinica()) {
      <button
        type="button"
        class="trigger__badge"
        [attr.aria-expanded]="menuOpen()"
        aria-haspopup="menu"
        aria-label="Cambiar de clínica"
        (click)="toggle($event)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
        <span>Cambiar</span>
      </button>

      @if (menuOpen()) {
        <div
          class="trigger__menu"
          [class.trigger__menu--top]="placement() === 'top'"
          [class.trigger__menu--bottom]="placement() === 'bottom'"
          role="menu"
        >
          <ui2-clinica-switch-menu
            (clinicaCambiada)="onClinicaCambiada($event)"
          ></ui2-clinica-switch-menu>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .trigger__badge {
        position: absolute;
        top: 8px;
        right: 8px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px 4px 6px;
        border: 0;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: var(--ink-900);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.3px;
        line-height: 1;
        cursor: pointer;
        box-shadow: var(--shadow-card);
        pointer-events: auto;
        transition:
          background 0.12s,
          transform 0.12s;
      }
      .trigger__badge:hover {
        background: white;
        transform: scale(1.04);
      }
      .trigger__badge .material-symbols-outlined {
        font-size: 12px;
        color: var(--kengo-primary);
      }

      .trigger__menu {
        position: absolute;
        left: 0;
        right: 0;
        z-index: var(--z-menu);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.6);
        box-shadow:
          var(--shadow-card-strong),
          0 10px 40px rgba(0, 0, 0, 0.12);
        animation: trigger-menu-in 0.18s ease-out;
        pointer-events: auto;
      }
      .trigger__menu--top {
        bottom: calc(100% + 8px);
      }
      .trigger__menu--bottom {
        top: calc(100% + 8px);
      }

      @keyframes trigger-menu-in {
        from {
          opacity: 0;
          transform: translateY(6px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `,
  ],
})
export class Ui2ClinicaSwitchTriggerComponent {
  /** Hacia dónde abre el popup respecto del host. */
  readonly placement = input<Ui2ClinicaSwitchTriggerPlacement>('top');

  /** Re-emite la clínica recién seleccionada para que el padre orqueste tema/toast/navegación. */
  readonly clinicaCambiada = output<Clinica>();

  private readonly session = inject(SessionService);
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly menuOpen = signal(false);
  protected readonly esMulticlinica = computed(
    () => this.session.misclinicas().length > 1,
  );

  protected toggle(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected onClinicaCambiada(clinica: Clinica): void {
    this.menuOpen.set(false);
    this.clinicaCambiada.emit(clinica);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.menuOpen()) this.menuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!this.hostEl.nativeElement.contains(target)) {
      this.menuOpen.set(false);
    }
  }
}
