import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/services/auth.service';
import { SessionService } from '../../../core/auth/services/session.service';
import type { RolUsuario } from '../../../../types/global';
import { Ui2AvatarComponent } from '../avatar/avatar.component';

const COLLAPSED_STORAGE_KEY = 'kengo:sidebar-collapsed';
const EXPANDED_BREAKPOINT_QUERY = '(min-width: 1024px)';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: string;
  route: string | null;
  matchPrefix?: string;
  badge?: string | null;
}

export interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
}

const DEFAULT_GROUPS: SidebarNavGroup[] = [
  {
    label: 'Mi recuperación',
    items: [
      {
        id: 'home',
        label: 'Inicio',
        icon: 'home',
        route: '/inicio',
        matchPrefix: '/inicio',
      },
      {
        id: 'plan',
        label: 'Mi plan',
        icon: 'fitness_center',
        route: '/actividad-personal/hoy',
        matchPrefix: '/actividad-personal/hoy',
      },
      {
        id: 'calendar',
        label: 'Calendario',
        icon: 'calendar_month',
        route: '/actividad-personal/calendario',
        matchPrefix: '/actividad-personal/calendario',
      },
      {
        id: 'progress',
        label: 'Progreso',
        icon: 'trending_up',
        route: '/actividad-personal/estadisticas',
        matchPrefix: '/actividad-personal/estadisticas',
      },
    ],
  },
  {
    label: 'Mi clínica',
    items: [
      {
        id: 'fisio',
        label: 'Mi fisio',
        icon: 'chat',
        route: '/mensajes',
        matchPrefix: '/mensajes',
        badge: '2',
      },
      {
        id: 'clinic',
        label: 'Clínica',
        icon: 'apartment',
        route: '/mi-clinica',
        matchPrefix: '/mi-clinica',
      },
    ],
  },
];

/**
 * Patient sidebar V2 — left rail desktop (220-260px) con logo + grupos de navegación + clinic mini-card + user row.
 * Glassmorphism cream sobre el cream-bg. Renderizado solo en breakpoint md+.
 */
@Component({
  selector: 'ui2-patient-sidebar',
  standalone: true,
  imports: [RouterLink, Ui2AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="ui2-sidebar" [class.ui2-sidebar--collapsed]="collapsed()">
      <button
        type="button"
        class="ui2-sidebar__toggle"
        [attr.aria-label]="
          collapsed() ? 'Expandir barra lateral' : 'Colapsar barra lateral'
        "
        [attr.aria-expanded]="!collapsed()"
        (click)="toggleCollapsed()"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{
          collapsed() ? 'chevron_right' : 'chevron_left'
        }}</span>
      </button>

      <a
        class="ui2-sidebar__brand"
        routerLink="/inicio"
        aria-label="Ir al inicio"
      >
        <span class="ui2-sidebar__logo">
          <img src="assets/logo-k.svg" alt="" />
        </span>
        <span class="ui2-sidebar__brand-text">
          <span class="ui2-sidebar__brand-name">KENGO</span>
          <span class="ui2-sidebar__brand-tag">{{ brandTag() }}</span>
        </span>
      </a>

      <nav class="ui2-sidebar__nav" aria-label="Navegación principal">
        @for (group of groups(); track group.label) {
          <div class="ui2-sidebar__group">
            <span class="ui2-sidebar__group-label">{{ group.label }}</span>
            @for (item of group.items; track item.id) {
              @if (item.route) {
                <a
                  class="ui2-sidebar__item"
                  [class.ui2-sidebar__item--active]="activeId() === item.id"
                  [routerLink]="item.route"
                  [attr.title]="collapsed() ? item.label : null"
                  [attr.aria-label]="collapsed() ? item.label : null"
                  [attr.aria-current]="activeId() === item.id ? 'page' : null"
                >
                  <span
                    class="material-symbols-outlined ui2-sidebar__item-icon"
                    aria-hidden="true"
                    >{{ item.icon }}</span
                  >
                  <span class="ui2-sidebar__item-label">{{ item.label }}</span>
                  @if (item.badge) {
                    <span
                      class="ui2-sidebar__item-badge"
                      [class.ui2-sidebar__item-badge--on-active]="
                        activeId() === item.id
                      "
                      >{{ item.badge }}</span
                    >
                  }
                </a>
              } @else {
                <button
                  type="button"
                  class="ui2-sidebar__item ui2-sidebar__item--disabled"
                  disabled
                  aria-disabled="true"
                  [attr.title]="collapsed() ? item.label : null"
                  [attr.aria-label]="collapsed() ? item.label : null"
                >
                  <span
                    class="material-symbols-outlined ui2-sidebar__item-icon"
                    aria-hidden="true"
                    >{{ item.icon }}</span
                  >
                  <span class="ui2-sidebar__item-label">{{ item.label }}</span>
                </button>
              }
            }
          </div>
        }
      </nav>

      <div class="ui2-sidebar__spacer"></div>

      @if (clinicaNombre() && !collapsed()) {
        <a
          class="ui2-sidebar__clinic"
          routerLink="/mi-clinica"
          aria-label="Ir a mi clínica"
          [style.background-image]="clinicBackground()"
        >
          <span class="ui2-sidebar__clinic-overlay" aria-hidden="true"></span>
          <span class="ui2-sidebar__clinic-text">
            <span class="ui2-sidebar__clinic-eyebrow">Mi clínica</span>
            <span class="ui2-sidebar__clinic-name">{{ clinicaNombre() }}</span>
          </span>
        </a>
      }

      <div class="ui2-sidebar__user-wrap">
        <button
          type="button"
          class="ui2-sidebar__user"
          [attr.aria-expanded]="menuOpen()"
          aria-haspopup="menu"
          aria-label="Abrir menú de usuario"
          [attr.title]="collapsed() ? userName() : null"
          (click)="toggleMenu($event)"
        >
          <ui2-avatar
            [name]="userName()"
            [src]="avatarUrl()"
            size="sm"
            gradient="coral"
            [active]="isPerfilActive()"
          ></ui2-avatar>
          <span class="ui2-sidebar__user-text">
            <span class="ui2-sidebar__user-name">{{ userName() }}</span>
            @if (userSubtitle()) {
              <span class="ui2-sidebar__user-sub">{{ userSubtitle() }}</span>
            }
          </span>
          <span
            class="material-symbols-outlined ui2-sidebar__user-cog"
            aria-hidden="true"
            >settings</span
          >
        </button>

        @if (menuOpen()) {
          <div class="ui2-user-menu" role="menu">
            <button
              type="button"
              class="ui2-user-menu__item"
              role="menuitem"
              (click)="irAPerfil()"
            >
              <span class="material-symbols-outlined" aria-hidden="true"
                >person</span
              >
              <span>Mi perfil</span>
            </button>

            @if (sessionService.puedeAlternarModo()) {
              <button
                type="button"
                class="ui2-user-menu__item ui2-user-menu__item--switch"
                role="switch"
                [attr.aria-checked]="modoPaciente()"
                (click)="onToggleModo($event)"
              >
                <span class="material-symbols-outlined" aria-hidden="true"
                  >swap_horiz</span
                >
                <span class="ui2-user-menu__label">{{ modoLabel() }}</span>
                <span
                  class="ui2-user-menu__switch"
                  [class.ui2-user-menu__switch--on]="modoPaciente()"
                  aria-hidden="true"
                >
                  <span class="ui2-user-menu__thumb"></span>
                </span>
              </button>
            }

            <button
              type="button"
              class="ui2-user-menu__item ui2-user-menu__item--danger"
              role="menuitem"
              (click)="cerrarSesion()"
            >
              <span class="material-symbols-outlined" aria-hidden="true"
                >logout</span
              >
              <span>Cerrar sesión</span>
            </button>
          </div>

          <div
            class="ui2-user-menu__backdrop"
            aria-hidden="true"
            (click)="cerrarMenu()"
          ></div>
        }
      </div>
    </aside>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        position: relative;
        z-index: 200;
      }
      .ui2-sidebar {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 220px;
        padding: 22px 14px;
        gap: 18px;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-right: 1px solid rgba(0, 0, 0, 0.04);
        box-sizing: border-box;
        transition:
          width 0.22s ease,
          padding 0.22s ease;
      }
      @media (min-width: 1024px) {
        .ui2-sidebar {
          width: 260px;
        }
      }

      /* Botón flotante para alternar collapsed/expanded en el borde derecho. */
      .ui2-sidebar__toggle {
        position: absolute;
        top: 28px;
        right: -14px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: var(--shadow-card-strong);
        display: grid;
        place-items: center;
        cursor: pointer;
        z-index: 11;
        color: var(--ink-700);
        padding: 0;
        transition:
          background 0.12s,
          color 0.12s,
          transform 0.12s;
      }
      .ui2-sidebar__toggle:hover {
        background: var(--cream-100);
        color: var(--kengo-primary);
      }
      .ui2-sidebar__toggle:active {
        transform: scale(0.94);
      }
      .ui2-sidebar__toggle .material-symbols-outlined {
        font-size: 18px;
      }
      .ui2-sidebar__brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 6px;
        text-decoration: none;
        color: inherit;
      }
      .ui2-sidebar__logo {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.04);
        display: grid;
        place-items: center;
        flex-shrink: 0;
        box-shadow: var(--shadow-card);
      }
      .ui2-sidebar__logo img {
        width: 22px;
        height: 22px;
        object-fit: contain;
      }
      .ui2-sidebar__brand-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .ui2-sidebar__brand-name {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 20px;
        letter-spacing: 0.5px;
        color: var(--ink-900);
        line-height: 1;
      }
      .ui2-sidebar__brand-tag {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1px;
        color: var(--ink-500);
        text-transform: uppercase;
        margin-top: 3px;
        line-height: 1;
      }

      .ui2-sidebar__nav {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .ui2-sidebar__group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ui2-sidebar__group-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        color: var(--ink-400);
        text-transform: uppercase;
        padding: 0 14px 6px;
        line-height: 1;
      }
      .ui2-sidebar__item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 11px 14px;
        border-radius: 12px;
        color: var(--ink-700);
        text-decoration: none;
        font-size: 13px;
        font-weight: 700;
        background: transparent;
        border: 0;
        width: 100%;
        cursor: pointer;
        text-align: left;
        transition:
          background 0.12s,
          color 0.12s,
          box-shadow 0.12s;
      }
      .ui2-sidebar__item:hover {
        background: rgba(0, 0, 0, 0.03);
      }
      .ui2-sidebar__item--active {
        background: var(--kengo-primary);
        color: white;
        box-shadow: 0 6px 14px -4px rgba(var(--kengo-primary-rgb), 0.4);
      }
      .ui2-sidebar__item--active:hover {
        background: var(--kengo-primary);
      }
      .ui2-sidebar__item--disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ui2-sidebar__item--disabled:hover {
        background: transparent;
      }
      .ui2-sidebar__item-icon {
        font-size: 18px;
        flex-shrink: 0;
      }
      .ui2-sidebar__item-label {
        flex: 1;
        min-width: 0;
      }
      .ui2-sidebar__item-badge {
        display: grid;
        place-items: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 9999px;
        background: var(--kengo-primary);
        color: white;
        font-size: 10px;
        font-weight: 700;
      }
      .ui2-sidebar__item-badge--on-active {
        background: rgba(255, 255, 255, 0.25);
      }

      .ui2-sidebar__spacer {
        flex: 1;
      }

      .ui2-sidebar__clinic {
        position: relative;
        display: block;
        height: 110px;
        border-radius: 16px;
        overflow: hidden;
        text-decoration: none;
        background-color: var(--ink-700);
        background-size: cover;
        background-position: center;
        flex-shrink: 0;
      }
      .ui2-sidebar__clinic-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.7));
      }
      .ui2-sidebar__clinic-text {
        position: absolute;
        bottom: 12px;
        left: 12px;
        right: 12px;
        display: flex;
        flex-direction: column;
        color: white;
      }
      .ui2-sidebar__clinic-eyebrow {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        opacity: 0.85;
        line-height: 1;
      }
      .ui2-sidebar__clinic-name {
        font-family: KengoDisplay, kengoFont, sans-serif;
        font-size: 13px;
        line-height: 1.1;
        margin-top: 4px;
        text-transform: uppercase;
      }

      .ui2-sidebar__user-wrap {
        position: relative;
        flex-shrink: 0;
      }
      .ui2-sidebar__user {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        border-radius: 14px;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.04);
        width: 100%;
        cursor: pointer;
        box-shadow: var(--shadow-card);
        transition: background 0.12s;
      }
      .ui2-sidebar__user:hover {
        background: var(--cream-50);
      }
      .ui2-sidebar__user-text {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        text-align: left;
      }
      .ui2-sidebar__user-name {
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-900);
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ui2-sidebar__user-sub {
        font-size: 10px;
        color: var(--ink-500);
        margin-top: 2px;
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ui2-sidebar__user-cog {
        font-size: 16px;
        color: var(--ink-400);
        flex-shrink: 0;
      }

      /* Dropdown menu (clon del patient-header) */
      .ui2-user-menu {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 0;
        right: 0;
        z-index: 100;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.6);
        box-shadow:
          var(--shadow-card-strong),
          0 10px 40px rgba(0, 0, 0, 0.12);
        animation: ui2-sidebar-menu-in 0.18s ease-out;
      }
      @keyframes ui2-sidebar-menu-in {
        from {
          opacity: 0;
          transform: translateY(6px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .ui2-user-menu__item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px 14px;
        border: 0;
        background: transparent;
        text-align: left;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        color: var(--ink-700);
        cursor: pointer;
      }
      .ui2-user-menu__item:hover {
        background: var(--cream-100);
      }
      .ui2-user-menu__item .material-symbols-outlined {
        font-size: 20px;
        color: var(--ink-500);
      }
      .ui2-user-menu__item:hover .material-symbols-outlined {
        color: var(--kengo-primary);
      }
      .ui2-user-menu__item--switch {
        border-top: 1px solid rgba(0, 0, 0, 0.05);
      }
      .ui2-user-menu__item--switch:hover {
        background: var(--cream-50);
      }
      .ui2-user-menu__label {
        flex: 1;
      }
      .ui2-user-menu__item--danger {
        border-top: 1px solid rgba(0, 0, 0, 0.05);
        color: var(--danger);
      }
      .ui2-user-menu__item--danger .material-symbols-outlined {
        color: var(--danger);
      }
      .ui2-user-menu__item--danger:hover {
        background: rgba(239, 68, 68, 0.08);
      }
      .ui2-user-menu__switch {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: 40px;
        height: 24px;
        border-radius: 9999px;
        background: rgba(0, 0, 0, 0.18);
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .ui2-user-menu__switch--on {
        background: var(--kengo-primary);
      }
      .ui2-user-menu__thumb {
        position: absolute;
        left: 2px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: transform 0.15s;
      }
      .ui2-user-menu__switch--on .ui2-user-menu__thumb {
        transform: translateX(16px);
      }
      .ui2-user-menu__backdrop {
        position: fixed;
        inset: 0;
        z-index: 99;
      }

      /* ============================================================ */
      /*  Estado COLLAPSED — rail compacto 72px (solo iconos)          */
      /* ============================================================ */
      .ui2-sidebar--collapsed {
        width: 72px;
        padding: 22px 8px;
      }
      @media (min-width: 1024px) {
        .ui2-sidebar--collapsed {
          width: 72px;
        }
      }

      .ui2-sidebar--collapsed .ui2-sidebar__brand {
        justify-content: center;
        gap: 0;
        padding: 0;
      }
      .ui2-sidebar--collapsed .ui2-sidebar__brand-text {
        display: none;
      }

      .ui2-sidebar--collapsed .ui2-sidebar__group-label {
        display: none;
      }
      .ui2-sidebar--collapsed .ui2-sidebar__group {
        gap: 4px;
      }

      .ui2-sidebar--collapsed .ui2-sidebar__item {
        justify-content: center;
        gap: 0;
        padding: 11px 0;
      }
      .ui2-sidebar--collapsed .ui2-sidebar__item-label {
        display: none;
      }

      /* Badge → punto pequeño en esquina superior derecha del item */
      .ui2-sidebar--collapsed .ui2-sidebar__item {
        position: relative;
      }
      .ui2-sidebar--collapsed .ui2-sidebar__item-badge {
        position: absolute;
        top: 6px;
        right: 12px;
        min-width: 0;
        width: 8px;
        height: 8px;
        padding: 0;
        font-size: 0;
        border: 1.5px solid white;
        box-sizing: content-box;
      }

      .ui2-sidebar--collapsed .ui2-sidebar__user {
        justify-content: center;
        gap: 0;
        padding: 8px;
      }
      .ui2-sidebar--collapsed .ui2-sidebar__user-text,
      .ui2-sidebar--collapsed .ui2-sidebar__user-cog {
        display: none;
      }

      /* Dropdown del avatar abre lateralmente cuando está colapsado */
      .ui2-sidebar--collapsed .ui2-user-menu {
        bottom: auto;
        top: 0;
        left: calc(100% + 12px);
        right: auto;
        min-width: 220px;
        animation: ui2-sidebar-menu-side-in 0.18s ease-out;
      }
      @keyframes ui2-sidebar-menu-side-in {
        from {
          opacity: 0;
          transform: translateX(-6px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }
    `,
  ],
})
export class Ui2PatientSidebarComponent {
  readonly userName = input<string>('Usuario');
  readonly userSubtitle = input<string | null>(null);
  readonly avatarUrl = input<string | null>(null);
  readonly clinicaNombre = input<string | null>(null);
  readonly clinicaImagenUrl = input<string | null>(null);
  readonly groups = input<SidebarNavGroup[]>(DEFAULT_GROUPS);
  readonly brandTag = input<string>('RECUPERACIÓN');

  public readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly menuOpen = signal(false);
  readonly modoPaciente = this.sessionService.enModoPaciente;

  /**
   * Estado colapsado del sidebar. Default por breakpoint:
   *  - lg+ (≥1024px): expandido (false)
   *  - md  (768–1023px): colapsado (true)
   * La preferencia explícita del usuario (localStorage) sobrescribe el default y
   * persiste entre sesiones.
   */
  readonly collapsed = signal<boolean>(this.computeInitialCollapsed());
  private hasUserPreference = this.readStoredPreference() !== null;

  readonly modoLabel = computed(() =>
    this.modoPaciente() ? 'Modo paciente' : 'Modo fisio',
  );

  readonly clinicBackground = computed(() => {
    const url = this.clinicaImagenUrl();
    return url ? `url('${url}')` : `url('assets/portadas/clinica.webp')`;
  });

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
    let best: { id: string; length: number } | null = null;
    for (const g of this.groups()) {
      for (const item of g.items) {
        if (!item.matchPrefix || !url.startsWith(item.matchPrefix)) continue;
        if (!best || item.matchPrefix.length > best.length) {
          best = { id: item.id, length: item.matchPrefix.length };
        }
      }
    }
    return best?.id ?? null;
  });

  readonly isPerfilActive = computed(() =>
    (this.currentUrl() ?? '').startsWith('/perfil'),
  );

  constructor() {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(EXPANDED_BREAKPOINT_QUERY);
    const handler = () => {
      // Solo recalcula el default si el usuario nunca ha tocado el toggle.
      if (!this.hasUserPreference) {
        this.collapsed.set(!mq.matches);
      }
    };
    mq.addEventListener('change', handler);
    this.destroyRef.onDestroy(() => mq.removeEventListener('change', handler));
  }

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    this.hasUserPreference = true;
    try {
      window.localStorage?.setItem(
        COLLAPSED_STORAGE_KEY,
        next ? 'true' : 'false',
      );
    } catch {
      // localStorage no disponible (modo privado, SSR…) — silencioso
    }
    if (this.menuOpen()) this.menuOpen.set(false);
  }

  private computeInitialCollapsed(): boolean {
    if (typeof window === 'undefined') return false;
    const stored = this.readStoredPreference();
    if (stored !== null) return stored;
    return !window.matchMedia(EXPANDED_BREAKPOINT_QUERY).matches;
  }

  private readStoredPreference(): boolean | null {
    if (typeof window === 'undefined') return null;
    try {
      const v = window.localStorage?.getItem(COLLAPSED_STORAGE_KEY);
      if (v === 'true') return true;
      if (v === 'false') return false;
      return null;
    } catch {
      return null;
    }
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuOpen.set(false);
  }

  irAPerfil(): void {
    this.menuOpen.set(false);
    this.router.navigate(['/perfil']);
  }

  async cerrarSesion(): Promise<void> {
    this.menuOpen.set(false);
    await this.authService.logout();
  }

  onToggleModo(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.sessionService.puedeAlternarModo()) return;
    const nuevo: RolUsuario = this.modoPaciente() ? 'fisio' : 'paciente';
    this.sessionService.setRolUsuario(nuevo);
    this.menuOpen.set(false);
    this.router.navigateByUrl('/inicio');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) this.cerrarMenu();
  }
}
