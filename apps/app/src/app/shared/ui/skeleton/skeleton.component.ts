import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'progress' | 'card' | 'list' | 'line';

@Component({
  selector: 'ui-skeleton',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (variant()) {
      @case ('progress') {
        <div class="tarjeta-kengo rounded-2xl p-6">
          <div class="flex items-center justify-center gap-3">
            <div class="h-1.5 w-48 overflow-hidden rounded-full bg-zinc-100">
              <div class="progress-bar-indeterminate h-full w-1/3 rounded-full"></div>
            </div>
          </div>
        </div>
      }
      @case ('card') {
        <div class="tarjeta-kengo space-y-3 rounded-2xl p-5">
          <div class="flex items-center gap-3">
            <div class="h-12 w-12 shrink-0 animate-pulse rounded-full bg-zinc-200"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-2/3 animate-pulse rounded bg-zinc-200"></div>
              <div class="h-3 w-1/3 animate-pulse rounded bg-zinc-200"></div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="h-3 w-full animate-pulse rounded bg-zinc-200"></div>
            <div class="h-3 w-5/6 animate-pulse rounded bg-zinc-200"></div>
          </div>
        </div>
      }
      @case ('list') {
        <div class="space-y-3">
          @for (i of placeholderArray(); track $index) {
            <div class="tarjeta-kengo flex items-center gap-3 rounded-2xl p-4">
              <div class="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-200"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3 w-1/2 animate-pulse rounded bg-zinc-200"></div>
                <div class="h-3 w-1/3 animate-pulse rounded bg-zinc-200"></div>
              </div>
            </div>
          }
        </div>
      }
      @case ('line') {
        <div class="h-3 w-full animate-pulse rounded bg-zinc-200"></div>
      }
    }
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class SkeletonComponent {
  variant = input<SkeletonVariant>('progress');
  count = input<number>(3);

  placeholderArray = computed(() =>
    Array.from({ length: this.count() }, (_, i) => i),
  );
}
