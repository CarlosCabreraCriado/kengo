import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface RingData {
  r: number;
  v: number;
  c: string;
  c2: number;
  offset: number;
}

/**
 * Triple concentric ring V2 (Apple Activity style).
 * `values` = [r1, r2, r3] cada uno entre 0 y 1.
 * `colors` = colores en el mismo orden.
 */
@Component({
  selector: 'ui2-activity-rings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-rings" [style.width.px]="size()" [style.height.px]="size()">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.viewBox]="viewBox()"
        class="ui2-rings__svg"
      >
        @for (ring of rings(); track $index) {
          <g>
            <circle
              [attr.cx]="center()"
              [attr.cy]="center()"
              [attr.r]="ring.r"
              fill="none"
              [attr.stroke]="ring.c"
              stroke-opacity="0.18"
              [attr.stroke-width]="strokeW()"
            />
            <circle
              [attr.cx]="center()"
              [attr.cy]="center()"
              [attr.r]="ring.r"
              fill="none"
              [attr.stroke]="ring.c"
              [attr.stroke-width]="strokeW()"
              stroke-linecap="round"
              [attr.stroke-dasharray]="ring.c2"
              [attr.stroke-dashoffset]="ring.offset"
            />
          </g>
        }
      </svg>
      <div class="ui2-rings__content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .ui2-rings {
      position: relative;
      display: grid;
      place-items: center;
    }
    .ui2-rings__svg {
      position: absolute;
      inset: 0;
      transform: rotate(-90deg);
    }
    .ui2-rings__content {
      position: relative;
      z-index: 1;
      text-align: center;
    }
  `],
})
export class Ui2ActivityRingsComponent {
  readonly size = input<number>(220);
  readonly strokeW = input<number>(18);
  readonly gap = input<number>(6);
  readonly values = input<[number, number, number]>([0.72, 0.45, 0.88]);
  readonly colors = input<[string, string, string]>(['#e75c3e', '#efc048', '#6366f1']);

  readonly center = computed(() => this.size() / 2);
  readonly viewBox = computed(() => `0 0 ${this.size()} ${this.size()}`);

  readonly rings = computed<RingData[]>(() => {
    const sw = this.strokeW();
    const gap = this.gap();
    const r1 = (this.size() - sw) / 2;
    const r2 = r1 - sw - gap;
    const r3 = r2 - sw - gap;
    const radii = [r1, r2, r3];
    const vals = this.values();
    const cols = this.colors();
    return radii.map((r, i) => {
      const v = Math.max(0, Math.min(1, vals[i]!));
      const c2 = 2 * Math.PI * r;
      return {
        r,
        v,
        c: cols[i]!,
        c2,
        offset: c2 * (1 - v),
      };
    });
  });
}
