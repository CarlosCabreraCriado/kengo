import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'active' | 'inactive' | 'busy';

@Component({
  selector: 'ui-avatar',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="wrapperClasses()">
      @if (src()) {
        <img
          [src]="src()"
          [alt]="name() || 'Avatar'"
          class="h-full w-full rounded-full object-cover"
          (error)="handleImgError($event)"
        />
      } @else {
        <span [class]="initialsClasses()">{{ initials() }}</span>
      }

      @if (status(); as s) {
        <span
          [class]="statusDotClasses(s)"
          [attr.aria-label]="statusLabel(s)"
        ></span>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }
  `],
})
export class AvatarComponent {
  src = input<string | null | undefined>(undefined);
  name = input<string>('');
  size = input<AvatarSize>('md');
  status = input<AvatarStatus | undefined>(undefined);

  private readonly sizeMap: Record<AvatarSize, string> = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-xl',
  };

  initials = computed(() => computeInitials(this.name()));

  wrapperClasses = computed(
    () =>
      `relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-full ${this.sizeMap[this.size()]}`,
  );

  initialsClasses = computed(
    () =>
      `flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-kengo-primary/20 to-kengo-tertiary/20 font-semibold text-kengo-primary uppercase`,
  );

  statusDotClasses(status: AvatarStatus): string {
    const base = 'absolute bottom-0 right-0 block rounded-full ring-2 ring-white';
    const dotSize = this.size() === 'xs' || this.size() === 'sm' ? 'h-2 w-2' : 'h-3 w-3';
    const color =
      status === 'active'
        ? 'bg-emerald-500'
        : status === 'busy'
          ? 'bg-amber-500'
          : 'bg-zinc-300';
    return `${base} ${dotSize} ${color}`;
  }

  statusLabel(status: AvatarStatus): string {
    return status === 'active' ? 'Activo' : status === 'busy' ? 'Ocupado' : 'Inactivo';
  }

  handleImgError(event: Event) {
    // Hide the broken image; the fallback initials will not show because src is still set.
    // Caller should manage src lifecycle; avatar keeps its current shape.
    (event.target as HTMLImageElement).style.visibility = 'hidden';
  }
}

/**
 * Calcula iniciales a partir de un nombre completo (ej. "Juan García" → "JG").
 * Si el nombre tiene una sola palabra usa las dos primeras letras. Vacío → "??".
 */
export function computeInitials(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}
