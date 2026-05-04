import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Single activity-style ring V2.
 * - `value` entre 0 y 1.
 * - Stroke linecap redondeado.
 * - Acepta proyección de contenido en el centro.
 */
@Component({
  selector: 'ui2-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-ring" [style.width.px]="size()" [style.height.px]="size()">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.viewBox]="viewBox()"
        class="ui2-ring__svg"
      >
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          [attr.stroke]="trackColor()"
          [attr.stroke-width]="stroke()"
        />
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          [attr.stroke]="color()"
          [attr.stroke-width]="stroke()"
          [attr.stroke-linecap]="rounded() ? 'round' : 'butt'"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="dashOffset()"
        />
      </svg>
      <div class="ui2-ring__content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .ui2-ring {
      position: relative;
      display: grid;
      place-items: center;
    }
    .ui2-ring__svg {
      position: absolute;
      inset: 0;
      transform: rotate(-90deg);
    }
    .ui2-ring__content {
      position: relative;
      z-index: 1;
      text-align: center;
    }
  `],
})
export class Ui2ProgressRingComponent {
  readonly size = input<number>(220);
  readonly stroke = input<number>(18);
  readonly value = input<number>(0.6);
  readonly color = input<string>('var(--kengo-primary)');
  readonly trackColor = input<string>('rgba(var(--kengo-primary-rgb), 0.12)');
  readonly rounded = input<boolean>(true);

  readonly center = computed(() => this.size() / 2);
  readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  readonly viewBox = computed(() => `0 0 ${this.size()} ${this.size()}`);
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  readonly dashOffset = computed(() => {
    const v = Math.max(0, Math.min(1, this.value()));
    return this.circumference() * (1 - v);
  });
}
