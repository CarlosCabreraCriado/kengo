import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type Ui2DialogActionsAlign = 'start' | 'center' | 'end' | 'between';

/**
 * Variantes de superficie según el caso de uso.
 * Combinar siempre con el shortcut equivalente de DialogService
 * (openInformative, openForm, openSheet, openFullscreen, confirm).
 */
export type Ui2DialogVariant =
  | 'standard'      // Formularios y default
  | 'informative'   // Contenido legal/ayuda — sin actions, cierre por X
  | 'compact'       // Confirmaciones cortas
  | 'sheet'         // Bottom-sheet en móvil, modal centrado en desktop
  | 'fullscreen';   // Image crop, vídeo, cámara

/**
 * Surface contenedora de un diálogo V2.
 * Se usa dentro de un componente abierto vía `DialogService.openX(...)`.
 *
 * ```html
 * <ui2-dialog-host variant="standard">
 *   <ui2-dialog-header title="Título" subtitle="Sub" (closeClick)="dialogRef.close()" />
 *   <ui2-dialog-content>...</ui2-dialog-content>
 *   <ui2-dialog-actions>
 *     <ui2-button variant="secondary" (clicked)="dialogRef.close()">Cancelar</ui2-button>
 *     <ui2-button (clicked)="confirmar()">Aceptar</ui2-button>
 *   </ui2-dialog-actions>
 * </ui2-dialog-host>
 * ```
 */
@Component({
  selector: 'ui2-dialog-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="rootClass()">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host { display: block; max-height: 100%; }
    .ui2-dialog {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: white;
      box-shadow: var(--shadow-card-strong);
      border: 1px solid rgba(0, 0, 0, 0.04);
    }
    /* El max-height define el espacio en el que el ui2-dialog-content puede
       activar overflow-y: auto. Es la única fuente de verdad para la altura
       (el .cdk-overlay-pane solo controla la anchura vía panelClass). El
       padding del pane (1rem) se descuenta del viewport. */
    .ui2-dialog--standard,
    .ui2-dialog--informative,
    .ui2-dialog--sheet {
      border-radius: 22px;
      max-height: calc(100dvh - 2rem);
    }
    .ui2-dialog--compact {
      border-radius: 18px;
      border: none;
      max-height: calc(100dvh - 2rem);
    }
    .ui2-dialog--fullscreen {
      border-radius: 0;
      box-shadow: none;
      border: none;
      max-height: 100dvh;
    }
    @media (max-width: 767px) {
      .ui2-dialog--sheet {
        border-radius: 22px 22px 0 0;
        border-left: none;
        border-right: none;
        border-bottom: none;
        max-height: 92vh;
      }
    }
  `],
})
export class Ui2DialogHostComponent {
  readonly variant = input<Ui2DialogVariant>('standard');
  readonly rootClass = computed(() => `ui2-dialog ui2-dialog--${this.variant()}`);
}

@Component({
  selector: 'ui2-dialog-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ui2-dialog-header">
      <div class="ui2-dialog-header__text">
        @if (title()) {
          <h2 class="ui2-dialog-header__title">{{ title() }}</h2>
        }
        @if (subtitle()) {
          <p class="ui2-dialog-header__subtitle">{{ subtitle() }}</p>
        }
        <ng-content></ng-content>
      </div>

      @if (showClose()) {
        <button
          type="button"
          class="ui2-dialog-close"
          (click)="closeClick.emit()"
          aria-label="Cerrar"
        >
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      }
    </header>
  `,
  styles: [`
    :host { display: block; }
    .ui2-dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--ink-100);
    }
    .ui2-dialog-header__text { flex: 1; min-width: 0; }
    .ui2-dialog-header__title {
      font-family: KengoDisplay, Galvji, sans-serif;
      font-size: 20px;
      font-weight: 600;
      color: var(--ink-900);
      letter-spacing: -0.2px;
      margin: 0;
      line-height: 1.2;
    }
    .ui2-dialog-header__subtitle {
      font-size: 13px;
      color: var(--ink-500);
      margin: 4px 0 0;
      line-height: 1.35;
    }
    .ui2-dialog-close {
      display: inline-grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 9999px;
      border: 0;
      background: var(--cream-50);
      color: var(--ink-700);
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, transform 0.1s;
    }
    .ui2-dialog-close:hover { background: var(--cream-100); }
    .ui2-dialog-close:active { transform: translateY(1px); }
    .ui2-dialog-close .material-symbols-outlined { font-size: 20px; }
  `],
})
export class Ui2DialogHeaderComponent {
  readonly title = input<string | null>(null);
  readonly subtitle = input<string | null>(null);
  readonly showClose = input<boolean>(true);
  readonly closeClick = output<void>();
}

@Component({
  selector: 'ui2-dialog-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-dialog-content" [class.ui2-dialog-content--no-padding]="noPadding()">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .ui2-dialog-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 20px;
      background: white;
      color: var(--ink-900);
    }
    .ui2-dialog-content--no-padding { padding: 0; }
  `],
})
export class Ui2DialogContentComponent {
  readonly noPadding = input<boolean>(false);
}

@Component({
  selector: 'ui2-dialog-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="ui2-dialog-actions" [class]="alignClass()">
      <ng-content></ng-content>
    </footer>
  `,
  styles: [`
    :host { display: block; }
    .ui2-dialog-actions {
      display: flex;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid var(--ink-100);
      background: var(--cream-50);
    }
    .ui2-dialog-actions--start { justify-content: flex-start; }
    .ui2-dialog-actions--center { justify-content: center; }
    .ui2-dialog-actions--end { justify-content: flex-end; }
    .ui2-dialog-actions--between { justify-content: space-between; }
  `],
})
export class Ui2DialogActionsComponent {
  readonly align = input<Ui2DialogActionsAlign>('end');
  readonly alignClass = computed(() => `ui2-dialog-actions ui2-dialog-actions--${this.align()}`);
}
