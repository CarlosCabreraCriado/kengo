import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { Usuario } from '../../../../../../../types/global';
import {
  Ui2AvatarComponent,
  Ui2BackButtonComponent,
  Ui2ButtonComponent,
  Ui2PillComponent,
} from '../../../../../../shared/ui-v2';

export interface PdHeroMeta {
  /** Texto formateado tipo "Sep 2025" */
  joined?: string | null;
  /** Edad o motivo libres del paciente */
  reason?: string | null;
  fisio?: string | null;
  clinica?: string | null;
}

@Component({
  selector: 'app-pd-hero',
  standalone: true,
  imports: [
    Ui2AvatarComponent,
    Ui2BackButtonComponent,
    Ui2ButtonComponent,
    Ui2PillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="pd-hero" [class.pd-hero--mobile]="isMobile()">
      @if (!isMobile()) {
        <div class="pd-hero__back">
          <ui2-back-button (clicked)="volver.emit()" ariaLabel="Volver a pacientes" />
          <span class="pd-hero__crumb">Mis pacientes</span>
        </div>
      } @else {
        <div class="pd-hero__nav">
          <ui2-back-button (clicked)="volver.emit()" ariaLabel="Volver a pacientes" />
          <div class="pd-hero__nav-actions">
            <button
              type="button"
              class="pd-hero__nav-action"
              aria-label="Gestionar acceso"
              (click)="gestionarAcceso.emit()"
            >
              <span class="material-symbols-outlined" aria-hidden="true">key</span>
            </button>
            <button
              type="button"
              class="pd-hero__nav-action"
              [attr.aria-expanded]="menuOpen()"
              aria-label="Más acciones"
              (click)="toggleMenu($event)"
              (blur)="closeMenu()"
            >
              <span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>
              @if (menuOpen()) {
                <ul class="pd-hero__menu" role="menu" (mousedown)="$event.preventDefault()">
                  <li
                    role="menuitem"
                    tabindex="0"
                    (click)="editarPaciente.emit(); closeMenu()"
                    (keyup.enter)="editarPaciente.emit(); closeMenu()"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                    Editar paciente
                  </li>
                  @if (puedeEliminar()) {
                    <li
                      role="menuitem"
                      tabindex="0"
                      class="pd-hero__menu-item--danger"
                      (click)="eliminarPaciente.emit(); closeMenu()"
                      (keyup.enter)="eliminarPaciente.emit(); closeMenu()"
                    >
                      <span class="material-symbols-outlined" aria-hidden="true">person_remove</span>
                      Eliminar paciente
                    </li>
                  }
                </ul>
              }
            </button>
          </div>
        </div>
      }

      <div class="pd-hero__top">
        <ui2-avatar
          [src]="avatarUrl()"
          [name]="fullName()"
          [size]="isMobile() ? 'lg' : 'xl'"
          gradient="coral"
          [border]="true"
        />

        <div class="pd-hero__info">
          @if (meta()?.joined || meta()?.fisio) {
            <span class="pd-hero__overline">
              Paciente
              @if (meta()?.joined) {
                · desde {{ meta()!.joined }}
              }
            </span>
          }
          <h1 class="pd-hero__name">{{ fullName() || 'Paciente' }}</h1>
          <div class="pd-hero__pills">
            @if (lastActivityDays() !== null) {
              <ui2-pill
                [variant]="lastActivityPill().variant"
                size="sm"
                icon="schedule"
              >
                {{ lastActivityPill().label }}
              </ui2-pill>
            }
            @if (meta()?.clinica) {
              <ui2-pill variant="soft" size="sm" icon="apartment">{{ meta()!.clinica }}</ui2-pill>
            }
            @if (meta()?.fisio) {
              <ui2-pill variant="neutral" size="sm" icon="person">{{ meta()!.fisio }}</ui2-pill>
            }
            @if (paciente()?.email) {
              <ui2-pill
                variant="neutral"
                size="sm"
                icon="mail"
                class="pd-hero__pill--email"
              >
                <span class="pd-hero__pill-text">{{ paciente()!.email }}</span>
              </ui2-pill>
            }
          </div>
        </div>

        @if (!isMobile()) {
          <div class="pd-hero__actions">
            <ui2-button
              variant="secondary"
              size="md"
              iconLeft="chat"
              [loading]="enviandoMensaje()"
              (clicked)="enviarMensaje.emit()"
            >Mensaje</ui2-button>
            <ui2-button
              variant="primary"
              size="md"
              iconLeft="add"
              (clicked)="crearPlan.emit()"
            >Nuevo plan</ui2-button>
            <button
              type="button"
              class="pd-hero__more"
              aria-label="Gestionar acceso"
              (click)="gestionarAcceso.emit()"
            >
              <span class="material-symbols-outlined" aria-hidden="true">key</span>
            </button>
            <button
              type="button"
              class="pd-hero__more"
              [attr.aria-expanded]="menuOpen()"
              aria-label="Más acciones"
              (click)="toggleMenu($event)"
              (blur)="closeMenu()"
            >
              <span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>
              @if (menuOpen()) {
                <ul class="pd-hero__menu" role="menu" (mousedown)="$event.preventDefault()">
                  <li
                    role="menuitem"
                    tabindex="0"
                    (click)="editarPaciente.emit(); closeMenu()"
                    (keyup.enter)="editarPaciente.emit(); closeMenu()"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                    Editar paciente
                  </li>
                  @if (puedeEliminar()) {
                    <li
                      role="menuitem"
                      tabindex="0"
                      class="pd-hero__menu-item--danger"
                      (click)="eliminarPaciente.emit(); closeMenu()"
                      (keyup.enter)="eliminarPaciente.emit(); closeMenu()"
                    >
                      <span class="material-symbols-outlined" aria-hidden="true">person_remove</span>
                      Eliminar paciente
                    </li>
                  }
                </ul>
              }
            </button>
          </div>
        }
      </div>

      @if (isMobile()) {
        <div class="pd-hero__actions pd-hero__actions--mobile">
          <ui2-button
            variant="primary"
            size="md"
            iconLeft="add"
            [fullWidth]="true"
            (clicked)="crearPlan.emit()"
          >Nuevo plan</ui2-button>
          <ui2-button
            variant="secondary"
            size="md"
            iconLeft="chat"
            [fullWidth]="true"
            [loading]="enviandoMensaje()"
            (clicked)="enviarMensaje.emit()"
          >Mensaje</ui2-button>
        </div>
      }
    </header>
  `,
  styles: [
    `
      :host { display: block; }
      .pd-hero {
        position: relative;
        padding: 24px;
        border-radius: 24px;
        background: linear-gradient(
          135deg,
          rgba(var(--kengo-primary-rgb), 0.1),
          rgba(var(--kengo-primary-rgb), 0.02)
        );
        border: 1px solid rgba(var(--kengo-primary-rgb), 0.15);
        box-shadow: var(--shadow-card);
      }
      .pd-hero--mobile { padding: 18px 16px; border-radius: 20px; }
      .pd-hero__back {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 14px;
      }
      .pd-hero__nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .pd-hero__nav-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pd-hero__nav-action {
        position: relative;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.6);
        color: var(--ink-700);
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
        box-shadow: var(--shadow-card);
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
      }
      .pd-hero__nav-action:hover { background: rgba(255, 255, 255, 0.85); }
      .pd-hero__nav-action:active { transform: translateY(1px); }
      .pd-hero__nav-action .material-symbols-outlined {
        font-size: 22px;
        color: var(--ink-700);
      }
      .pd-hero__crumb {
        font-size: 12px;
        color: var(--ink-500);
        font-weight: 600;
      }
      .pd-hero__top {
        display: flex;
        align-items: flex-start;
        gap: 18px;
      }
      .pd-hero--mobile .pd-hero__top {
        gap: 14px;
        align-items: center;
      }
      .pd-hero__info { flex: 1; min-width: 0; }
      .pd-hero__overline {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--kengo-primary);
        line-height: 1;
      }
      .pd-hero__name {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 36px;
        line-height: 1;
        letter-spacing: -0.6px;
        color: var(--ink-900);
        text-transform: uppercase;
        margin: 6px 0 10px;
      }
      .pd-hero--mobile .pd-hero__name { font-size: 22px; margin: 4px 0 8px; }
      .pd-hero__pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        min-width: 0;
        max-width: 100%;
      }
      .pd-hero__pill--email { max-width: 100%; }
      .pd-hero__pill-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pd-hero__actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        position: relative;
      }
      .pd-hero__actions--mobile {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 14px;
      }
      .pd-hero__more {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 14px;
        border: 1px solid var(--ink-100);
        background: var(--cream-50);
        cursor: pointer;
        display: grid;
        place-items: center;
      }
      .pd-hero__more:hover { background: var(--cream-100); }
      .pd-hero__more .material-symbols-outlined { font-size: 22px; color: var(--ink-700); }
      .pd-hero__menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        min-width: 220px;
        list-style: none;
        margin: 0;
        padding: 6px;
        background: white;
        border-radius: 14px;
        box-shadow: var(--shadow-card-strong);
        border: 1px solid rgba(0, 0, 0, 0.06);
        z-index: 10;
      }
      .pd-hero__menu li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-900);
        cursor: pointer;
      }
      .pd-hero__menu li:hover { background: rgba(0, 0, 0, 0.04); }
      .pd-hero__menu .material-symbols-outlined {
        font-size: 18px;
        color: var(--ink-500);
      }
      .pd-hero__menu-item--danger { color: var(--danger); }
      .pd-hero__menu-item--danger:hover { background: rgba(239, 68, 68, 0.08); }
      .pd-hero__menu-item--danger .material-symbols-outlined { color: var(--danger); }
    `,
  ],
})
export class PdHeroComponent {
  readonly paciente = input<Usuario | null>(null);
  readonly fullName = input<string>('');
  readonly avatarUrl = input<string | null>(null);
  readonly meta = input<PdHeroMeta | null>(null);
  readonly lastActivityDays = input<number | null>(null);
  readonly enviandoMensaje = input<boolean>(false);
  readonly isMobile = input<boolean>(false);
  readonly puedeEliminar = input<boolean>(false);

  readonly editarPaciente = output<void>();
  readonly gestionarAcceso = output<void>();
  readonly eliminarPaciente = output<void>();
  readonly crearPlan = output<void>();
  readonly enviarMensaje = output<void>();
  readonly volver = output<void>();

  readonly menuOpen = signal(false);

  readonly lastActivityPill = computed<{ variant: 'success' | 'warning' | 'danger'; label: string }>(() => {
    const d = this.lastActivityDays();
    if (d == null) {
      return { variant: 'warning', label: 'Sin actividad registrada' };
    }
    if (d <= 1) return { variant: 'success', label: 'Activo hoy' };
    if (d < 7) return { variant: 'success', label: `Activo hace ${d} días` };
    if (d < 14) return { variant: 'warning', label: `Inactivo ${d} días` };
    return { variant: 'danger', label: `Inactivo ${d} días` };
  });

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    setTimeout(() => this.menuOpen.set(false), 120);
  }
}
