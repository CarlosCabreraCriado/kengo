import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NotificacionFisio } from '../../../../../../../types/global';
import { SesionAgrupada } from '../../../../data-access/paciente-detail.types';
import {
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2SpinnerComponent,
} from '../../../../../../shared/ui-v2';

const TIPO_COLOR: Record<string, string> = {
  completado: '#16a34a',
  parcial: '#efc048',
  fallido: '#ef4444',
  descanso: '#9ca3af',
  sin_plan: '#9ca3af',
};

const TIPO_ICON: Record<string, string> = {
  completado: 'check_circle',
  parcial: 'change_circle',
  fallido: 'cancel',
  descanso: 'bedtime',
  sin_plan: 'remove_circle',
};

@Component({
  selector: 'app-pd-activity-timeline',
  standalone: true,
  imports: [
    DecimalPipe,
    NgTemplateOutlet,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bare()) {
      <ng-container [ngTemplateOutlet]="content"></ng-container>
    } @else {
      <ui2-card [padding]="20">
        <header class="atl-head">
          <div class="atl-head__text">
            <span class="atl-overline">Últimos {{ rangoLabel() }}</span>
            <h3 class="atl-title">{{ totalSesiones() }} {{ totalSesiones() === 1 ? 'sesión' : 'sesiones' }}</h3>
            <p class="atl-subtitle">
              {{ diasProgramados() }} días programados@if (diasSinActividad() > 0) {, {{ diasSinActividad() }} sin actividad}
            </p>
          </div>
        </header>
        <ng-container [ngTemplateOutlet]="content"></ng-container>
      </ui2-card>
    }

    <ng-template #content>
      @if (isLoading()) {
        <div class="atl-loading"><ui2-spinner /></div>
      } @else if (sesiones().length === 0) {
        <ui2-empty-state
          icon="event_busy"
          title="Sin actividad registrada"
          message="Cuando el paciente complete sesiones aparecerán aquí."
        />
      } @else {
        <ul class="atl-feed">
          @for (sesion of sesiones(); track sesion.fecha) {
            <li
              class="atl-row"
              [class.atl-row--clickable]="esClicable(sesion)"
              [class.atl-row--open]="fechaExpandida() === sesion.fecha"
              [style.--row-color]="tipoColor(sesion.tipo)"
              [attr.role]="esClicable(sesion) ? 'button' : null"
              [attr.tabindex]="esClicable(sesion) ? 0 : null"
              (click)="onClick(sesion)"
              (keyup.enter)="onClick(sesion)"
              (keyup.space)="onClick(sesion)"
            >
              <span class="atl-row__indicator" aria-hidden="true"></span>

              <div class="atl-row__main">
                <div class="atl-row__top">
                  <span class="atl-row__date">{{ sesion.fechaFormateada }}</span>
                  <span class="atl-row__badge">
                    <span class="material-symbols-outlined" aria-hidden="true">{{ tipoIcon(sesion.tipo) }}</span>
                    @switch (sesion.tipo) {
                      @case ('completado') {
                        <span>{{ sesion.totalEjercicios }} ejercicio{{ sesion.totalEjercicios !== 1 ? 's' : '' }}</span>
                      }
                      @case ('parcial') {
                        <span>{{ sesion.totalEjercicios }} de {{ sesion.ejerciciosEsperados }}</span>
                      }
                      @case ('fallido') {
                        <span>Sin actividad</span>
                      }
                      @case ('descanso') {
                        @if (sesion.ejerciciosExtras > 0) {
                          <span>Descanso · {{ sesion.ejerciciosExtras }} extra{{ sesion.ejerciciosExtras !== 1 ? 's' : '' }}</span>
                        } @else {
                          <span>Descanso</span>
                        }
                      }
                    }
                  </span>
                  @if (sesion.ejerciciosExtras > 0 && sesion.tipo !== 'descanso') {
                    <span class="atl-row__extra" title="Ejercicios extra no programados ese día">
                      +{{ sesion.ejerciciosExtras }} extra{{ sesion.ejerciciosExtras !== 1 ? 's' : '' }}
                    </span>
                  }
                  @if (sesion.tieneObservacionSesion && sesion.tipo !== 'descanso') {
                    <span class="atl-row__chat" title="Tiene comentarios" aria-label="Tiene comentarios">
                      <span class="material-symbols-outlined" aria-hidden="true">chat_bubble</span>
                    </span>
                  }
                </div>

                @if (sesion.planes.length > 0 && sesion.tipo !== 'descanso') {
                  <div class="atl-row__progress">
                    @for (plan of sesion.planes; track plan.planId) {
                      <div class="atl-plan">
                        <div class="atl-plan__bar">
                          <div
                            class="atl-plan__fill"
                            [style.width.%]="plan.esperados > 0 ? (plan.completados / plan.esperados) * 100 : 0"
                          ></div>
                        </div>
                        <span class="atl-plan__count">{{ plan.completados }}/{{ plan.esperados }}</span>
                        @if ((plan.extras ?? 0) > 0) {
                          <!-- Los extras no llenan la barra (mide prescripción) -->
                          <span class="atl-plan__extra">+{{ plan.extras }} extra</span>
                        }
                      </div>
                    }
                  </div>
                }

                @if (sesion.promedioDolorValue !== null && sesion.tipo !== 'descanso') {
                  <div class="atl-row__meta">
                    <span class="atl-row__pain" [style.color]="painColor(sesion.promedioDolorValue!)">
                      <span class="material-symbols-outlined" aria-hidden="true">monitor_heart</span>
                      <span>{{ sesion.promedioDolorValue | number: '1.0-1' }}/10</span>
                    </span>
                    @if (sesion.totalComentarios > 0) {
                      <button
                        type="button"
                        class="atl-row__cmt"
                        [class.atl-row__cmt--active]="fechaExpandida() === sesion.fecha"
                        (click)="$event.stopPropagation(); toggleComentarios.emit(sesion.fecha)"
                      >
                        <span class="material-symbols-outlined" aria-hidden="true">chat_bubble</span>
                        {{ sesion.totalComentarios }}
                      </button>
                    }
                  </div>
                }

                @if (fechaExpandida() === sesion.fecha) {
                  <div class="atl-row__comments">
                    @for (com of sesion.comentarios; track com.idRegistro) {
                      <div class="atl-comment">
                        <span class="material-symbols-outlined atl-comment__quote" aria-hidden="true">format_quote</span>
                        <span>{{ com.texto }}</span>
                        @let notif = notifPara(com.idRegistro);
                        @if (notif && !notif.revisada) {
                          <button
                            type="button"
                            class="atl-comment__read"
                            (click)="$event.stopPropagation(); marcarComentarioRevisado.emit(notif)"
                          >
                            <span class="material-symbols-outlined" aria-hidden="true">check</span>
                            Marcar como leído
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </li>
          }
        </ul>
      }
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }
      .atl-head { margin-bottom: 16px; }
      .atl-overline {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--kengo-primary);
      }
      .atl-title {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 22px;
        color: var(--ink-900);
        margin: 4px 0 2px;
        line-height: 1;
      }
      .atl-subtitle { margin: 0; font-size: 11px; color: var(--ink-500); }
      .atl-loading { display: grid; place-items: center; padding: 24px; }

      .atl-feed {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .atl-row {
        --row-color: var(--ink-300);
        position: relative;
        display: flex;
        gap: 12px;
        padding: 14px 14px 14px 18px;
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.02);
        border: 1px solid rgba(0, 0, 0, 0.04);
        transition: background 160ms;
      }
      .atl-row--clickable { cursor: pointer; }
      .atl-row--clickable:hover { background: rgba(0, 0, 0, 0.04); }
      .atl-row--open {
        background: rgba(var(--kengo-primary-rgb), 0.03);
        border-color: rgba(var(--kengo-primary-rgb), 0.18);
      }
      .atl-row__indicator {
        position: absolute;
        left: 0;
        top: 8px;
        bottom: 8px;
        width: 4px;
        border-radius: 4px;
        background: var(--row-color);
      }
      .atl-row__main { flex: 1; min-width: 0; }
      .atl-row__top {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .atl-row__date {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--ink-900);
        letter-spacing: 0.4px;
        line-height: 1;
        flex-grow: 1;
      }
      .atl-row__badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 9999px;
        background: rgba(0, 0, 0, 0.04);
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-700);
        line-height: 1;
        white-space: nowrap;
      }
      .atl-row__badge .material-symbols-outlined {
        font-size: 14px;
        color: var(--row-color);
      }
      .atl-row__chat {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 9999px;
        background: rgba(var(--kengo-primary-rgb), 0.12);
      }
      .atl-row__chat .material-symbols-outlined {
        font-size: 12px;
        color: var(--kengo-primary);
      }
      .atl-row__progress {
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .atl-plan {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .atl-plan__bar {
        flex: 1;
        height: 6px;
        background: rgba(0, 0, 0, 0.06);
        border-radius: 9999px;
        overflow: hidden;
      }
      .atl-plan__fill {
        height: 100%;
        background: linear-gradient(90deg, var(--kengo-primary-light), var(--kengo-primary));
        border-radius: inherit;
        transition: width 280ms ease;
      }
      .atl-plan__count {
        font-size: 10px;
        font-weight: 700;
        color: var(--ink-500);
        min-width: 32px;
        text-align: right;
      }
      .atl-plan__extra,
      .atl-row__extra {
        font-size: 10px;
        font-weight: 700;
        color: var(--kengo-primary);
        background: var(--kengo-primary-light);
        border-radius: 9999px;
        padding: 1px 8px;
        white-space: nowrap;
      }
      .atl-row__meta {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .atl-row__pain {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
      }
      .atl-row__pain .material-symbols-outlined { font-size: 14px; }
      .atl-row__cmt {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 9999px;
        background: rgba(0, 0, 0, 0.04);
        border: 0;
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-700);
        cursor: pointer;
      }
      .atl-row__cmt--active {
        background: rgba(var(--kengo-primary-rgb), 0.12);
        color: var(--kengo-primary);
      }
      .atl-row__cmt .material-symbols-outlined { font-size: 13px; }
      .atl-row__comments {
        margin-top: 10px;
        padding: 10px 12px;
        background: white;
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.04);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .atl-comment {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 12px;
        color: var(--ink-700);
        line-height: 1.4;
      }
      .atl-comment__quote { font-size: 14px; color: var(--ink-400); }
      .atl-comment__read {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 9999px;
        background: rgba(var(--kengo-primary-rgb), 0.08);
        color: var(--kengo-primary);
        border: 0;
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        flex-shrink: 0;
      }
      .atl-comment__read .material-symbols-outlined { font-size: 12px; }
    `,
  ],
})
export class PdActivityTimelineComponent {
  readonly sesiones = input<SesionAgrupada[]>([]);
  readonly notificacionesPorRegistro = input<Record<string, NotificacionFisio>>({});
  readonly fechaExpandida = input<string | null>(null);
  readonly totalSesiones = input<number>(0);
  readonly rangoLabel = input<string>('');
  readonly diasProgramados = input<number>(0);
  readonly diasSinActividad = input<number>(0);
  readonly isLoading = input<boolean>(false);
  readonly bare = input<boolean>(false);

  readonly verSesion = output<SesionAgrupada>();
  readonly toggleComentarios = output<string>();
  readonly marcarComentarioRevisado = output<NotificacionFisio>();

  tipoColor(tipo: string): string {
    return TIPO_COLOR[tipo] ?? TIPO_COLOR['descanso']!;
  }

  tipoIcon(tipo: string): string {
    return TIPO_ICON[tipo] ?? TIPO_ICON['descanso']!;
  }

  painColor(dolor: number): string {
    if (dolor <= 3) return '#16a34a';
    if (dolor <= 6) return '#efc048';
    return '#ef4444';
  }

  notifPara(idRegistro: string): NotificacionFisio | undefined {
    const idx = this.notificacionesPorRegistro();
    for (const key of Object.keys(idx)) {
      const n = idx[key]!;
      if (n.registroId === idRegistro) return n;
    }
    return undefined;
  }

  /** Un día de descanso solo es clicable si tiene ejercicios extra que ver. */
  esClicable(sesion: SesionAgrupada): boolean {
    return sesion.tipo !== 'descanso' || sesion.ejerciciosExtras > 0;
  }

  onClick(sesion: SesionAgrupada): void {
    if (!this.esClicable(sesion)) return;
    this.verSesion.emit(sesion);
  }
}
