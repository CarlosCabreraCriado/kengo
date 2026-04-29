import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Hero greeting block — overline (Galvji 13px ink-700) + título KengoDisplay 34px coral + subtítulo opcional.
 * Padding lateral 20px (alineado con la página).
 */
@Component({
  selector: 'ui2-big-title',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ui2-big-title">
      @if (overline()) {
        <p class="ui2-big-title__overline">{{ overline() }}</p>
      }
      <h1 class="ui2-big-title__title" [style.color]="color()">{{ title() }}</h1>
      @if (sub()) {
        <p class="ui2-big-title__sub">{{ sub() }}</p>
      }
    </header>
  `,
  styles: [`
    :host { display: block; }
    .ui2-big-title {
      padding: 8px 20px 18px;
    }
    .ui2-big-title__overline {
      font-size: 13px;
      color: var(--ink-700);
      font-weight: 600;
      margin: 0;
      line-height: 1.2;
    }
    .ui2-big-title__title {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 34px;
      line-height: 1;
      letter-spacing: -0.5px;
      margin: 4px 0 0;
    }
    .ui2-big-title__sub {
      font-size: 13px;
      color: var(--ink-500);
      margin: 6px 0 0;
      line-height: 1.4;
    }
  `],
})
export class Ui2BigTitleComponent {
  readonly title = input.required<string>();
  readonly overline = input<string | null>(null);
  readonly sub = input<string | null>(null);
  readonly color = input<string>('var(--kengo-primary)');
}
