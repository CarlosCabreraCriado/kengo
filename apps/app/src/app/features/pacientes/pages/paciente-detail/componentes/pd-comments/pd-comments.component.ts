import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NotificacionFisio } from '../../../../../../../types/global';
import {
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2PillComponent,
  Ui2SpinnerComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-pd-comments',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2PillComponent,
    Ui2SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bare()) {
      <ng-container [ngTemplateOutlet]="content"></ng-container>
    } @else {
      <ui2-card [padding]="20">
        <header class="cmt-head">
          <div class="cmt-head__text">
            <span class="cmt-overline">Comentarios del paciente</span>
            <h3 class="cmt-title">{{ subtitle() }}</h3>
          </div>
          @if (comentariosPendientes() > 0) {
            <ui2-pill variant="danger" size="sm">{{ comentariosPendientes() }}</ui2-pill>
          }
        </header>
        <ng-container [ngTemplateOutlet]="content"></ng-container>
      </ui2-card>
    }

    <ng-template #content>
      @if (isLoading()) {
        <div class="cmt-loading"><ui2-spinner /></div>
      } @else if (comentarios().length === 0) {
        <ui2-empty-state
          icon="forum"
          title="Sin comentarios"
          message="Cuando el paciente añada observaciones aparecerán aquí."
        />
      } @else {
        <ul class="cmt-list">
          @for (c of comentarios(); track c.id) {
            <li
              class="cmt-card"
              [class.cmt-card--unread]="!c.revisada"
              role="button"
              tabindex="0"
              (click)="irASesion.emit(c)"
              (keyup.enter)="irASesion.emit(c)"
            >
              <div class="cmt-card__head">
                @if (!c.revisada) {
                  <span class="cmt-card__dot" aria-hidden="true"></span>
                }
                <span class="cmt-card__date">{{ formatDate(c.fechaRegistro) }}</span>
                <span class="cmt-card__spacer"></span>
                @if (c.dolorEscala !== null && c.dolorEscala !== undefined) {
                  <ui2-pill variant="custom" [color]="painColor(c.dolorEscala)" size="sm">
                    {{ c.dolorEscala }}/10
                  </ui2-pill>
                }
              </div>
              @if (c.texto) {
                <p class="cmt-card__text">
                  <span class="material-symbols-outlined cmt-card__quote" aria-hidden="true">format_quote</span>
                  {{ c.texto }}
                </p>
              }
              <div class="cmt-card__footer">
                @if (c.registroId === null) {
                  <span class="cmt-card__context cmt-card__context--session">
                    <span class="material-symbols-outlined" aria-hidden="true">event_available</span>
                    Comentario de fin de sesión
                  </span>
                } @else if (c.tituloPlan || c.nombre) {
                  <span class="cmt-card__context">{{ c.tituloPlan || c.nombre }}</span>
                }
                @if (!c.revisada) {
                  <button
                    type="button"
                    class="cmt-card__read"
                    (click)="$event.stopPropagation(); marcarRevisado.emit(c)"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">check</span>
                    Marcar como leído
                  </button>
                }
              </div>
            </li>
          }
        </ul>
        @if (comentariosPendientes() > 0) {
          <div class="cmt-actions">
            <ui2-button variant="ghost" size="sm" iconLeft="done_all" (clicked)="marcarTodosRevisados.emit()">
              Marcar todos como leídos
            </ui2-button>
          </div>
        }
      }
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }
      .cmt-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }
      .cmt-head__text { flex: 1; min-width: 0; }
      .cmt-overline {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--kengo-primary);
      }
      .cmt-title {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 18px;
        color: var(--ink-900);
        margin: 4px 0 0;
        line-height: 1.1;
      }
      .cmt-loading { display: grid; place-items: center; padding: 16px; }
      .cmt-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .cmt-card {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.025);
        border: 1px solid rgba(0, 0, 0, 0.04);
        cursor: pointer;
        transition: background 160ms;
      }
      .cmt-card:hover { background: rgba(0, 0, 0, 0.04); }
      .cmt-card--unread {
        background: rgba(var(--kengo-primary-rgb), 0.04);
        border-color: rgba(var(--kengo-primary-rgb), 0.15);
      }
      .cmt-card__head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--ink-500);
      }
      .cmt-card__dot {
        width: 6px;
        height: 6px;
        border-radius: 9999px;
        background: var(--danger);
        flex-shrink: 0;
      }
      .cmt-card__date {
        font-weight: 700;
        color: var(--ink-700);
      }
      .cmt-card__spacer { flex: 1; }
      .cmt-card__text {
        margin: 6px 0 8px;
        font-size: 12.5px;
        line-height: 1.5;
        color: var(--ink-700);
      }
      .cmt-card__quote {
        font-size: 14px;
        color: var(--ink-400);
        vertical-align: middle;
        margin-right: 4px;
      }
      .cmt-card__footer {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .cmt-card__context {
        font-size: 11px;
        color: var(--ink-500);
        font-weight: 600;
      }
      .cmt-card__context--session {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--kengo-primary);
      }
      .cmt-card__context--session .material-symbols-outlined {
        font-size: 13px;
      }
      .cmt-card__read {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 9999px;
        background: rgba(var(--kengo-primary-rgb), 0.08);
        color: var(--kengo-primary);
        border: 0;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }
      .cmt-card__read .material-symbols-outlined { font-size: 14px; }
      .cmt-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
      }
    `,
  ],
})
export class PdCommentsComponent {
  readonly comentarios = input<NotificacionFisio[]>([]);
  readonly comentariosPendientes = input<number>(0);
  readonly isLoading = input<boolean>(false);
  readonly bare = input<boolean>(false);
  readonly irASesion = output<NotificacionFisio>();
  readonly marcarRevisado = output<NotificacionFisio>();
  readonly marcarTodosRevisados = output<void>();

  readonly subtitle = computed(() => {
    const total = this.comentarios().length;
    const pendientes = this.comentariosPendientes();
    if (pendientes > 0) {
      return `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`;
    }
    return `${total} ${total === 1 ? 'observación' : 'observaciones'}`;
  });

  formatDate(iso: string): string {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  painColor(dolor: number): string {
    if (dolor <= 3) return '#16a34a';
    if (dolor <= 6) return '#efc048';
    return '#ef4444';
  }
}
