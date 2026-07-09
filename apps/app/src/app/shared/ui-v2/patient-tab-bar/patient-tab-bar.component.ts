import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

export interface TabItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  matchPrefix: string | readonly string[];
  /**
   * Si es true, el item se renderiza como botón inerte (sin enlace). Útil
   * cuando la navegación está bloqueada (ej. usuario sin clínica asociada).
   */
  disabled?: boolean;
}

const DEFAULT_TABS: TabItem[] = [
  { id: 'home',   label: 'Inicio',  icon: 'home',            route: '/inicio',                 matchPrefix: '/inicio' },
  { id: 'plan',   label: 'Mi plan', icon: 'fitness_center',  route: '/actividad-personal/hoy', matchPrefix: '/actividad-personal' },
  { id: 'fisio',  label: 'Fisio',   icon: 'chat',            route: '/mensajes',               matchPrefix: '/mensajes' },
  { id: 'clinic', label: 'Clínica', icon: 'apartment',       route: '/mi-clinica',             matchPrefix: '/mi-clinica' },
];

/**
 * Patient tab bar V2 — bottom floating pill (3 items).
 * Glassmorphism backdrop-blur. Active tab calculada a partir de `router.url`.
 */
@Component({
  selector: 'ui2-patient-tab-bar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav #tabBar class="ui2-tab-bar" aria-label="Navegación principal">
      <div class="ui2-tab-bar__bg" aria-hidden="true"></div>
      <div
        class="ui2-tab-bar__pill"
        [class.ui2-tab-bar__pill--animate]="pillAnimate()"
        [class.ui2-tab-bar__pill--hidden]="activeId() === null"
        [style.--pill-x.px]="pillX()"
        [style.--pill-w.px]="pillW()"
        [style.--pill-h.px]="pillH()"
        aria-hidden="true"
      ></div>
      @for (it of tabs(); track it.id) {
        @if (it.disabled) {
          <button
            #tabItem
            type="button"
            class="ui2-tab-bar__item ui2-tab-bar__item--disabled"
            disabled
            aria-disabled="true"
          >
            <span class="material-symbols-outlined ui2-tab-bar__icon" aria-hidden="true">{{ it.icon }}</span>
            <span class="ui2-tab-bar__label">{{ it.label }}</span>
          </button>
        } @else {
          <a
            #tabItem
            class="ui2-tab-bar__item"
            [class.ui2-tab-bar__item--active]="activeId() === it.id"
            [routerLink]="it.route"
            [attr.aria-current]="activeId() === it.id ? 'page' : null"
          >
            <span class="material-symbols-outlined ui2-tab-bar__icon" aria-hidden="true">{{ it.icon }}</span>
            <span class="ui2-tab-bar__label">{{ it.label }}</span>
          </a>
        }
      }
    </nav>
  `,
  styles: [`
    :host {
      position: fixed;
      bottom: max(16px, env(safe-area-inset-bottom));
      left: 16px;
      right: 16px;
      z-index: var(--z-header); /* chrome persistente: por encima del page-loader (--z-loader) */
      max-width: 720px;
      margin: 0 auto;
    }
    .ui2-tab-bar {
      position: relative;
      height: 70px;
      border-radius: 32px;
      display: flex;
      align-items: center;
      justify-content: space-around;
      box-shadow: var(--shadow-tab-bar);
      overflow: hidden;
    }
    .ui2-tab-bar__bg {
      position: absolute;
      inset: 0;
      border-radius: 32px;
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 0.5px solid rgba(255, 255, 255, 0.7);
    }
    .ui2-tab-bar__pill {
      position: absolute;
      top: 50%;
      left: 0;
      height: var(--pill-h, 54px);
      width: var(--pill-w, 0);
      transform: translate(var(--pill-x, 0px), -50%);
      border-radius: 24px;
      background: var(--kengo-primary);
      box-shadow: 0 6px 16px -4px rgba(var(--kengo-primary-rgb), 0.5);
      opacity: 1;
      pointer-events: none;
    }
    .ui2-tab-bar__pill--animate {
      transition:
        transform var(--kb-transition-duration, 260ms) var(--kb-transition-easing, cubic-bezier(0.32, 0.72, 0, 1)),
        width var(--kb-transition-duration, 260ms) var(--kb-transition-easing, cubic-bezier(0.32, 0.72, 0, 1));
    }
    .ui2-tab-bar__pill--hidden {
      opacity: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .ui2-tab-bar__pill--animate {
        transition: none;
      }
    }
    .ui2-tab-bar__item {
      position: relative;
      z-index: 1;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 14px;
      border-radius: 24px;
      color: var(--ink-500);
      text-decoration: none;
      transition: color 0.15s;
    }
    .ui2-tab-bar__item--active {
      color: white;
    }
    .ui2-tab-bar__item:active:not(.ui2-tab-bar__item--active):not(.ui2-tab-bar__item--disabled) {
      background: rgba(0, 0, 0, 0.05);
    }
    .ui2-tab-bar__item--disabled {
      background: transparent;
      color: var(--ink-300);
      cursor: not-allowed;
      border: 0;
      font: inherit;
    }
    .ui2-tab-bar__icon { font-size: 22px; }
    .ui2-tab-bar__label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
  `],
})
export class Ui2PatientTabBarComponent {
  readonly tabs = input<TabItem[]>(DEFAULT_TABS);

  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects || e.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly activeId = computed(() => {
    const url = this.currentUrl() ?? '';
    const match = this.tabs().find((t) => {
      const prefixes = Array.isArray(t.matchPrefix) ? t.matchPrefix : [t.matchPrefix as string];
      return prefixes.some((p) => url.startsWith(p));
    });
    return match?.id ?? null;
  });

  // --- Burbuja deslizante (sliding pill) ---
  private readonly destroyRef = inject(DestroyRef);
  private readonly tabBar = viewChild<ElementRef<HTMLElement>>('tabBar');
  private readonly items = viewChildren<ElementRef<HTMLElement>>('tabItem');

  /** Posición/tamaño medidos del item activo, expuestos como custom props. */
  protected readonly pillX = signal(0);
  protected readonly pillW = signal(0);
  protected readonly pillH = signal(0);
  /** Habilita la transición solo tras el primer posicionamiento. */
  protected readonly pillAnimate = signal(false);

  private resizeObserver?: ResizeObserver;
  private firstMeasureDone = false;

  constructor() {
    // Re-mide al cambiar la ruta activa o al montar/actualizar los items.
    effect(() => {
      this.activeId();
      this.items();
      this.measure();
    });

    // Re-mide en cambios de tamaño del contenedor (rotación, carga de fuente).
    effect(() => {
      const el = this.tabBar()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(el);
    });

    this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
  }

  private measure(): void {
    const idx = this.tabs().findIndex((t) => t.id === this.activeId());
    if (idx < 0) return;
    const el = this.items()[idx]?.nativeElement;
    if (!el) return;

    this.pillX.set(el.offsetLeft);
    this.pillW.set(el.offsetWidth);
    this.pillH.set(el.offsetHeight);

    // Primer posicionamiento sin animación: la pill aparece ya colocada y
    // solo desliza en los cambios posteriores.
    if (!this.firstMeasureDone) {
      this.firstMeasureDone = true;
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => this.pillAnimate.set(true));
      } else {
        this.pillAnimate.set(true);
      }
    }
  }
}
