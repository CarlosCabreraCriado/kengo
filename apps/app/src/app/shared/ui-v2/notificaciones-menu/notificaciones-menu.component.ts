import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import type { NotificacionApp } from '../../../../types/global';
import { Ui2AvatarComponent } from '../avatar/avatar.component';
import { Ui2SpinnerComponent } from '../spinner/spinner.component';

/**
 * Notificaciones menu V2 — dropdown flotante con la lista de alertas del fisio.
 * Consume directamente NotificacionesService (signal-based, real-time vía Convex).
 * Espera ser renderizado dentro de un wrapper `position: relative` (junto al botón
 * que dispara su apertura).
 */
@Component({
  selector: 'ui2-notificaciones-menu',
  standalone: true,
  imports: [Ui2AvatarComponent, Ui2SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="ui2-notif-menu" role="dialog" aria-label="Notificaciones">
        <header class="ui2-notif-menu__head">
          <div class="ui2-notif-menu__title-wrap">
            <span class="ui2-notif-menu__title">Notificaciones</span>
            @if (pendientes() > 0) {
              <span class="ui2-notif-menu__count">{{ pendientes() }} sin leer</span>
            }
          </div>
          @if (hayPendientes()) {
            <button
              type="button"
              class="ui2-notif-menu__mark-all"
              (click)="onMarcarTodas($event)"
            >
              Marcar todas
            </button>
          }
        </header>

        <div class="ui2-notif-menu__body">
          @if (cargando() && notificaciones().length === 0) {
            <div class="ui2-notif-menu__loading">
              <ui2-spinner size="md" color="primary" />
            </div>
          } @else if (notificaciones().length === 0) {
            <div class="ui2-notif-menu__empty">
              <span class="material-symbols-outlined" aria-hidden="true">
                notifications_off
              </span>
              <p class="ui2-notif-menu__empty-title">Sin notificaciones</p>
              <p class="ui2-notif-menu__empty-msg">
                Cuando tus pacientes generen alertas aparecerán aquí.
              </p>
            </div>
          } @else {
            <ul class="ui2-notif-menu__list" role="list">
              @for (n of notificaciones(); track n.id) {
                <li>
                  <button
                    type="button"
                    class="ui2-notif-item"
                    [class.ui2-notif-item--read]="n.leida"
                    (click)="onSelect(n)"
                  >
                    @if (!n.leida) {
                      <span class="ui2-notif-item__dot" aria-hidden="true"></span>
                    }
                    <ui2-avatar
                      [name]="n.emisorNombre"
                      [src]="n.emisorAvatar"
                      size="xs"
                      gradient="coral"
                    />
                    <div class="ui2-notif-item__body">
                      <div class="ui2-notif-item__row">
                        <span class="ui2-notif-item__name">{{ n.emisorNombre }}</span>
                        <span class="ui2-notif-item__time">{{ formatearFecha(n.fecha) }}</span>
                      </div>
                      <span class="ui2-notif-item__title">{{ n.titulo }}</span>
                      @if (n.texto) {
                        <span class="ui2-notif-item__text">{{ n.texto }}</span>
                      }
                    </div>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        @if (notificaciones().length > 0) {
          <footer class="ui2-notif-menu__foot">
            <button
              type="button"
              class="ui2-notif-menu__see-all"
              (click)="onVerTodas()"
            >
              Ver todas
              <span class="material-symbols-outlined" aria-hidden="true">
                arrow_forward
              </span>
            </button>
          </footer>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .ui2-notif-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: var(--z-menu);
      width: 360px;
      max-width: calc(100vw - 32px);
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: var(--shadow-card-strong), 0 10px 40px rgba(0, 0, 0, 0.12);
      animation: ui2-notif-menu-in 0.18s ease-out;
    }
    @keyframes ui2-notif-menu-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .ui2-notif-menu__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px 10px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    .ui2-notif-menu__title-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .ui2-notif-menu__title {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 17px;
      color: var(--ink-900);
      letter-spacing: -0.2px;
      line-height: 1;
    }
    .ui2-notif-menu__count {
      font-size: 12px;
      font-weight: 600;
      color: var(--kengo-primary);
    }
    .ui2-notif-menu__mark-all {
      flex-shrink: 0;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      color: var(--ink-700);
      background: transparent;
      border: 0;
      padding: 6px 10px;
      border-radius: 9999px;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .ui2-notif-menu__mark-all:hover {
      background: var(--cream-100);
      color: var(--kengo-primary);
    }

    .ui2-notif-menu__body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .ui2-notif-menu__loading {
      display: grid;
      place-items: center;
      padding: 32px 16px;
    }

    .ui2-notif-menu__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 32px 24px;
      text-align: center;
    }
    .ui2-notif-menu__empty .material-symbols-outlined {
      font-size: 36px;
      color: var(--ink-300);
      margin-bottom: 4px;
    }
    .ui2-notif-menu__empty-title {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 18px;
      color: var(--ink-700);
      margin: 0;
      line-height: 1;
    }
    .ui2-notif-menu__empty-msg {
      font-size: 13px;
      color: var(--ink-500);
      line-height: 1.4;
      margin: 0;
      max-width: 28ch;
    }

    .ui2-notif-menu__list {
      list-style: none;
      margin: 0;
      padding: 4px 0;
      display: flex;
      flex-direction: column;
    }

    .ui2-notif-item {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      width: 100%;
      padding: 10px 16px 10px 22px;
      border: 0;
      background: transparent;
      text-align: left;
      font: inherit;
      cursor: pointer;
      transition: background 0.12s;
    }
    .ui2-notif-item:hover { background: var(--cream-100); }
    .ui2-notif-item--read { opacity: 0.6; }
    .ui2-notif-item__dot {
      position: absolute;
      left: 10px;
      top: 18px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--kengo-primary);
    }
    .ui2-notif-item__body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .ui2-notif-item__row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      justify-content: space-between;
    }
    .ui2-notif-item__name {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .ui2-notif-item__time {
      font-size: 11px;
      font-weight: 600;
      color: var(--ink-500);
      flex-shrink: 0;
    }
    .ui2-notif-item__title {
      font-size: 13px;
      font-weight: 600;
      color: var(--ink-700);
      line-height: 1.3;
    }
    .ui2-notif-item__text {
      font-size: 12px;
      color: var(--ink-500);
      line-height: 1.35;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .ui2-notif-menu__foot {
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      padding: 6px;
    }
    .ui2-notif-menu__see-all {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 10px 12px;
      border: 0;
      background: transparent;
      border-radius: 12px;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      color: var(--kengo-primary);
      cursor: pointer;
      transition: background 0.12s;
    }
    .ui2-notif-menu__see-all:hover { background: var(--cream-100); }
    .ui2-notif-menu__see-all .material-symbols-outlined { font-size: 16px; }
  `],
})
export class Ui2NotificacionesMenuComponent {
  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  readonly notificacionesService = inject(NotificacionesService);
  private readonly router = inject(Router);

  readonly notificaciones = this.notificacionesService.notificaciones;
  readonly pendientes = this.notificacionesService.pendientes;
  readonly hayPendientes = this.notificacionesService.hayPendientes;
  readonly cargando = this.notificacionesService.cargando;

  readonly contadorBadge = computed(() => {
    const n = this.pendientes();
    if (n <= 0) return '';
    return n > 9 ? '9+' : String(n);
  });

  emitClose(): void {
    this.closed.emit();
  }

  onSelect(n: NotificacionApp): void {
    this.notificacionesService.marcarRevisada(n);
    this.emitClose();
    this.router.navigateByUrl(n.rutaDestino);
  }

  onMarcarTodas(event: MouseEvent): void {
    event.stopPropagation();
    this.notificacionesService.marcarTodasRevisadas();
  }

  onVerTodas(): void {
    this.emitClose();
    this.router.navigateByUrl('/inicio');
  }

  formatearFecha(fecha: string): string {
    const ahora = Date.now();
    const t = new Date(fecha).getTime();
    if (Number.isNaN(t)) return '';
    const diff = ahora - t;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins} min`;
    const horas = Math.floor(mins / 60);
    if (horas < 24) return `${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias === 1) return 'ayer';
    if (dias < 7) return `${dias} d`;
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.emitClose();
  }
}
