import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';

/**
 * Aviso de "Modo paciente" en el header. Solo se renderiza cuando el usuario
 * tiene capacidad de alternar modo (puesto `fisio`/`admin` en la clínica
 * activa) y está visualizando la app como paciente. Los pacientes puros nunca
 * lo ven porque `puedeAlternarModo()` devuelve false para ellos.
 *
 * El bocadillo abre por hover y por click; el click "engancha" la apertura
 * para que sobreviva al mouseleave (necesario en touch devices).
 */
@Component({
  selector: 'ui2-modo-paciente-warning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mostrarWarning()) {
      <div class="ui2-modo-warning__wrap">
        <button
          type="button"
          class="ui2-modo-warning__btn"
          [class.ui2-modo-warning__btn--open]="abierto()"
          aria-label="Estás en modo paciente. Pulsa para más información"
          [attr.aria-expanded]="abierto()"
          aria-haspopup="dialog"
          (click)="toggle($event)"
          (mouseenter)="onHoverEnter()"
          (mouseleave)="onHoverLeave()"
          (focus)="onHoverEnter()"
          (blur)="onHoverLeave()"
        >
          <span class="material-symbols-outlined" aria-hidden="true">warning</span>
        </button>

        @if (abierto()) {
          <div
            class="ui2-modo-warning__bubble"
            role="dialog"
            aria-label="Aviso de modo paciente"
          >
            <div class="ui2-modo-warning__bubble-arrow" aria-hidden="true"></div>
            <div class="ui2-modo-warning__bubble-header">
              <span class="material-symbols-outlined" aria-hidden="true">warning</span>
              <span>Modo paciente</span>
            </div>
            <p class="ui2-modo-warning__bubble-body">
              Estás visualizando la app en <strong>Modo paciente</strong>.
              Para activar las funcionalidades de fisio, haz click en la foto de perfil.
            </p>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      position: relative;
    }
    .ui2-modo-warning__wrap {
      position: relative;
      display: inline-flex;
    }
    .ui2-modo-warning__btn {
      position: relative;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(245, 158, 11, 0.35);
      background: rgba(245, 158, 11, 0.14);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      box-shadow: var(--shadow-card);
      display: grid;
      place-items: center;
      cursor: pointer;
      color: var(--warning);
      transition: background 0.12s, border-color 0.12s, transform 0.12s;
    }
    .ui2-modo-warning__btn:hover,
    .ui2-modo-warning__btn--open {
      background: rgba(245, 158, 11, 0.22);
      border-color: rgba(245, 158, 11, 0.55);
    }
    .ui2-modo-warning__btn:focus-visible {
      outline: 2px solid var(--warning);
      outline-offset: 2px;
    }
    .ui2-modo-warning__btn .material-symbols-outlined {
      font-size: 20px;
    }

    /* Desktop: botón cuadrado redondeado para casar con el bell del web-topbar */
    @media (min-width: 768px) {
      .ui2-modo-warning__btn {
        width: 40px;
        height: 40px;
        border-radius: 12px;
      }
    }

    /* Bocadillo */
    .ui2-modo-warning__bubble {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      z-index: var(--z-menu);
      min-width: 260px;
      max-width: min(320px, calc(100vw - 32px));
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: var(--shadow-card-strong), 0 10px 40px rgba(0, 0, 0, 0.12);
      animation: ui2-modo-warning-in 0.18s ease-out;
    }
    @keyframes ui2-modo-warning-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .ui2-modo-warning__bubble-arrow {
      position: absolute;
      top: -6px;
      right: 14px;
      width: 12px;
      height: 12px;
      background: rgba(255, 255, 255, 0.96);
      border-top: 1px solid rgba(255, 255, 255, 0.6);
      border-left: 1px solid rgba(255, 255, 255, 0.6);
      transform: rotate(45deg);
    }
    .ui2-modo-warning__bubble-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: var(--ink-900);
      margin-bottom: 6px;
    }
    .ui2-modo-warning__bubble-header .material-symbols-outlined {
      font-size: 18px;
      color: var(--warning);
    }
    .ui2-modo-warning__bubble-body {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      color: var(--ink-700);
    }
    .ui2-modo-warning__bubble-body strong {
      color: var(--ink-900);
      font-weight: 700;
    }
  `],
})
export class Ui2ModoPacienteWarningComponent {
  private readonly sessionService = inject(SessionService);

  readonly mostrarWarning = computed(
    () =>
      this.sessionService.puedeAlternarModo() &&
      this.sessionService.enModoPaciente(),
  );

  readonly abierto = signal(false);
  private readonly aperturaPorClick = signal(false);

  toggle(event: Event): void {
    event.stopPropagation();
    const next = !this.abierto();
    this.abierto.set(next);
    this.aperturaPorClick.set(next);
  }

  onHoverEnter(): void {
    if (this.abierto()) return;
    this.abierto.set(true);
    this.aperturaPorClick.set(false);
  }

  onHoverLeave(): void {
    if (this.aperturaPorClick()) return;
    this.abierto.set(false);
  }

  private cerrar(): void {
    this.abierto.set(false);
    this.aperturaPorClick.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.abierto()) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.ui2-modo-warning__wrap')) this.cerrar();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.abierto()) this.cerrar();
  }
}
