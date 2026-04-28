import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BackButtonComponent } from '../back-button/back-button.component';

/**
 * Header estándar para páginas de listado: botón back + título + subtítulo,
 * con slots opcionales para acciones (escritorio) y búsqueda/filtros (debajo).
 *
 * Uso:
 *
 *  <ui-list-header
 *    title="Mis pacientes"
 *    [subtitle]="totalLabel()"
 *    backRoute="/inicio"
 *  >
 *    <ng-container actions>...botones de acción...</ng-container>
 *    <ng-container search>...ui-search-box + filtros...</ng-container>
 *  </ui-list-header>
 */
@Component({
  selector: 'ui-list-header',
  standalone: true,
  imports: [BackButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ui-list-header">
      <div class="ui-list-header__top">
        <div class="ui-list-header__title-group">
          @if (showBack) {
            <ui-back-button
              [route]="backRoute"
              [ariaLabel]="backLabel"
            ></ui-back-button>
          }
          <div class="ui-list-header__text">
            <h1 class="ui-list-header__title titulo-kengo">{{ title }}</h1>
            @if (subtitle) {
              <p class="ui-list-header__subtitle">{{ subtitle }}</p>
            }
          </div>
        </div>

        <div class="ui-list-header__actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      </div>

      <div class="ui-list-header__search">
        <ng-content select="[search]"></ng-content>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
    }

    .ui-list-header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .ui-list-header__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .ui-list-header__title-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      flex: 1;
    }

    .ui-list-header__text {
      min-width: 0;
    }

    .ui-list-header__title {
      font-size: 1.5rem;
      color: var(--kengo-primary);
      margin: 0;
      line-height: 1.2;
    }

    .ui-list-header__subtitle {
      font-size: 0.75rem;
      font-weight: 500;
      color: #71717a;
      margin: 0.125rem 0 0;
      letter-spacing: 0.02em;
    }

    .ui-list-header__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .ui-list-header__actions:empty {
      display: none;
    }

    .ui-list-header__search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .ui-list-header__search:empty {
      display: none;
    }
  `],
})
export class ListHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() showBack = true;
  @Input() backRoute?: string;
  @Input() backLabel = 'Volver al inicio';
}
