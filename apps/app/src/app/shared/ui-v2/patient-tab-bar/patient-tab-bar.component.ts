import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

export interface TabItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  matchPrefix: string | readonly string[];
}

const DEFAULT_TABS: TabItem[] = [
  { id: 'home',     label: 'Hoy',      icon: 'home',         route: '/inicio',              matchPrefix: '/inicio' },
  { id: 'progress', label: 'Progreso', icon: 'trending_up',  route: '/actividad-personal/estadisticas', matchPrefix: '/actividad-personal/estadisticas' },
  { id: 'fisio',    label: 'Fisio',    icon: 'chat',         route: '/mi-clinica',          matchPrefix: '/mi-clinica' },
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
    <nav class="ui2-tab-bar" aria-label="Navegación principal">
      <div class="ui2-tab-bar__bg" aria-hidden="true"></div>
      @for (it of tabs(); track it.id) {
        <a
          class="ui2-tab-bar__item"
          [class.ui2-tab-bar__item--active]="activeId() === it.id"
          [routerLink]="it.route"
          [attr.aria-current]="activeId() === it.id ? 'page' : null"
        >
          <span class="material-symbols-outlined ui2-tab-bar__icon" aria-hidden="true">{{ it.icon }}</span>
          <span class="ui2-tab-bar__label">{{ it.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: [`
    :host {
      position: fixed;
      bottom: max(16px, env(safe-area-inset-bottom));
      left: 16px;
      right: 16px;
      z-index: 30;
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
    .ui2-tab-bar__item {
      position: relative;
      z-index: 1;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 20px;
      border-radius: 24px;
      color: var(--ink-500);
      text-decoration: none;
      transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    }
    .ui2-tab-bar__item--active {
      background: var(--kengo-primary);
      color: white;
      box-shadow: 0 6px 16px -4px rgba(231, 92, 62, 0.5);
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
}
