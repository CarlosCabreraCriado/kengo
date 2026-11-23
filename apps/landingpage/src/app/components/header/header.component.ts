import { Component, ChangeDetectionStrategy, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'web-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav [class.scrolled]="isScrolled()">
      <div class="nav-in">
        <a routerLink="/" aria-label="Kengo — inicio">
          <svg
            class="logo"
            viewBox="140 232 315 130"
            fill="currentColor"
            role="img"
            aria-label="Kengo"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M173.93,235.73h16.56c.76,0,1.37.61,1.37,1.37l-24.45,88.65h.87c1.96-7.62,4.22-14.64,6.76-21.05,2.54-6.41,5.29-11.98,8.23-16.72,2.95-4.74,6.01-8.43,9.18-11.09,3.18-2.66,6.44-3.99,9.79-3.99,2.31,0,4.16.87,5.54,2.6,1.39,1.73,2.08,3.76,2.08,6.06,0,4.39-1.65,8.98-4.94,13.78-2.23,3.25-5.11,6.69-8.63,10.33-3.22,3.33-3.93,8.35-1.8,12.47l20.29,39.19c.52,1.01-.21,2.21-1.35,2.21h-15.66c-.56,0-1.07-.31-1.34-.8l-14.93-28c-3.24-6.07-2.5-13.49,1.87-18.81,1.36-1.66,2.6-3.21,3.71-4.63,2.83-3.64,5.02-6.73,6.58-9.27,1.56-2.54,2.63-4.53,3.21-5.98.58-1.44.87-2.63.87-3.55,0-2.31-.87-3.47-2.6-3.47s-3.87,1.73-6.41,5.2c-2.54,3.47-5.23,8.43-8.06,14.9-2.83,6.47-5.63,14.3-8.4,23.48-2.67,8.85-5.08,18.75-7.21,29.7-.14.71-.76,1.23-1.49,1.23h-18.47c-.84,0-1.52-.68-1.52-1.52l28.97-120.92c0-.76.61-1.37,1.37-1.37Z" />
            <path d="M212.51,335.01v-37.76c0-16.33,10.5-24.53,27.33-24.53s27.12,8.13,27.19,24.53l.07,22.18c0,.82-.66,1.49-1.48,1.49h-34c-.66,0-1.19.53-1.19,1.19v12.91c0,6.91,3.02,10.65,9.42,10.65s9.28-3.74,9.35-10.65l.06-4.58c0-.81.67-1.47,1.48-1.47h14.87c.83,0,1.49.68,1.48,1.5l-.06,4.54c-.22,16.4-10.5,24.53-27.19,24.53s-27.33-8.13-27.33-24.53ZM248.07,308.18c.66,0,1.2-.54,1.19-1.2l-.07-9.73c-.07-6.98-3.09-10.65-9.35-10.65s-9.42,3.74-9.42,10.65v9.74c0,.66.53,1.19,1.19,1.19h16.45Z" />
            <path d="M308.54,272.72c13.05,0,19.76,8.02,19.76,23.4v61.19c0,1.08-.87,1.95-1.95,1.95h-14.26c-1.08,0-1.95-.87-1.95-1.95v-60.15c0-6.42-2.55-10.21-8.75-10.21-1.49,0-2.86.2-4.12.59-3.52,1.11-5.87,4.44-5.87,8.14v61.63c0,1.08-.87,1.95-1.95,1.95h-14.19c-1.08,0-1.95-.87-1.95-1.95v-75.95c0-4.73,3.82-8.56,8.55-8.57l26.67-.07Z" />
            <path d="M396.02,333.57v-34.89c0-17.62,10.72-25.97,27.91-25.97s27.77,8.34,27.77,25.97v34.89c0,17.7-10.64,25.97-27.77,25.97s-27.91-8.27-27.91-25.97ZM423.93,345.01c6.76,0,9.93-3.81,9.93-11.44v-34.89c0-7.62-3.16-11.44-9.93-11.44s-10,3.81-10,11.44v34.89c0,7.63,3.24,11.44,10,11.44Z" />
            <path d="M359.12,359.27c-16.72,0-24.8-7.44-24.8-23.7v-39.16c0-16.2,11.11-23.59,27.84-23.59s27.83,7.38,27.83,23.59v6.54c0,.97-.88,1.76-1.98,1.76h-13.68c-1.09,0-1.98-.79-1.98-1.76v-5.9c0-7.27-3.36-10.84-10.2-10.84s-10.21,3.58-10.21,11.42v37.3c0,7.33,3.36,10.9,10.6,10.9,1.09,0,2.12-.07,3.09-.19,3.83-.5,6.66-3.45,6.66-6.91v-11.83c0-.97-.88-1.76-1.98-1.76h-6.38c-1.09,0-1.98-.79-1.98-1.76v-8.52c0-.97.88-1.76,1.98-1.76h24.08c1.09,0,1.98.79,1.98,1.76v27.9c0,9.13-8.29,16.53-18.51,16.53h-12.36Z" />
          </svg>
        </a>
        <div class="nav-links">
          @for (link of links; track link.fragment) {
            <a routerLink="/" [fragment]="link.fragment">{{ link.label }}</a>
          }
        </div>
        <div class="nav-actions">
          <a [href]="loginUrl" class="login">Entrar</a>
          <a routerLink="/" fragment="demo" class="btn btn-primary btn-demo">
            Pide una demo
          </a>
          <button
            type="button"
            class="burger"
            [attr.aria-expanded]="menuAbierto()"
            aria-controls="menu-movil"
            [attr.aria-label]="menuAbierto() ? 'Cerrar menú' : 'Abrir menú'"
            (click)="menuAbierto.set(!menuAbierto())"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              @if (menuAbierto()) {
                <path d="M6 6l12 12M18 6L6 18" />
              } @else {
                <path d="M4 7h16M4 12h16M4 17h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      @if (menuAbierto()) {
        <div class="menu-movil" id="menu-movil">
          @for (link of links; track link.fragment) {
            <a routerLink="/" [fragment]="link.fragment" (click)="cerrarMenu()">{{ link.label }}</a>
          }
          <a routerLink="/" fragment="equipo" (click)="cerrarMenu()">Quiénes somos</a>
          <a [href]="loginUrl">Entrar</a>
          <a routerLink="/" fragment="demo" class="btn btn-primary" (click)="cerrarMenu()">
            Pide una demo de 15 min
          </a>
        </div>
      }
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        padding: 16px 32px;
      }

      .nav-in {
        max-width: 1240px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 10px 12px 10px 22px;
        border-radius: 999px;
        background: rgba(255, 251, 247, 0.7);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        transition: 0.3s;
        box-shadow: 0 2px 12px rgba(150, 100, 70, 0.06);
      }

      nav.scrolled .nav-in {
        background: rgba(255, 251, 247, 0.94);
        box-shadow: 0 10px 30px rgba(150, 100, 70, 0.12);
      }

      .nav-in .logo {
        display: block;
        height: 30px;
        width: auto;
        color: var(--color-primary);
      }

      .nav-links {
        display: flex;
        gap: 30px;
        font-size: 14px;
        font-weight: 700;
      }

      .nav-links a {
        color: var(--color-ink-700);
        text-decoration: none;
      }

      .nav-links a:hover {
        color: var(--color-primary);
      }

      .nav-actions {
        display: flex;
        align-items: center;
        gap: 18px;
      }

      .login {
        font-size: 14px;
        font-weight: 700;
        color: var(--color-ink-700);
        text-decoration: none;
      }

      .login:hover {
        color: var(--color-primary);
      }

      .burger {
        display: none;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: 1px solid var(--color-ink-200);
        background: #fff;
        color: var(--color-ink);
        cursor: pointer;
        align-items: center;
        justify-content: center;
        padding: 0;
      }

      .burger svg {
        width: 20px;
        height: 20px;
      }

      .menu-movil {
        max-width: 1240px;
        margin: 10px auto 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px;
        border-radius: 24px;
        background: rgba(255, 251, 247, 0.98);
        border: 1px solid var(--color-ink-200);
        box-shadow: 0 18px 40px rgba(150, 100, 70, 0.18);
      }

      .menu-movil a:not(.btn) {
        padding: 12px 10px;
        font-size: 16px;
        font-weight: 700;
        color: var(--color-ink-strong);
        text-decoration: none;
        border-radius: 12px;
      }

      .menu-movil a:not(.btn):hover {
        background: var(--color-peach);
      }

      .menu-movil .btn {
        justify-content: center;
        margin-top: 8px;
      }

      @media (max-width: 1080px) {
        .nav-links,
        .login {
          display: none;
        }
        .burger {
          display: inline-flex;
        }
        .nav-actions {
          gap: 10px;
        }
      }

      @media (min-width: 1081px) {
        .menu-movil {
          display: none;
        }
      }

      @media (max-width: 640px) {
        nav {
          padding: 12px 16px;
        }
        .nav-in {
          padding: 8px 8px 8px 18px;
          gap: 12px;
        }
        .btn-demo {
          padding: 11px 16px;
          font-size: 14px;
        }
      }

      @media (max-width: 360px) {
        .nav-in .logo {
          height: 24px;
        }
        .btn-demo {
          padding: 10px 12px;
          font-size: 13px;
        }
      }
    `,
  ],
})
export class HeaderComponent {
  protected readonly loginUrl = `${environment.appUrl}/login`;

  protected readonly links = [
    { fragment: 'fisios', label: 'Para fisios' },
    { fragment: 'clinicas', label: 'Para clínicas' },
    { fragment: 'precios', label: 'Precios' },
  ] as const;

  protected readonly isScrolled = signal(false);
  protected readonly menuAbierto = signal(false);

  @HostListener('window:scroll')
  onScroll() {
    this.isScrolled.set(window.scrollY > 20);
  }

  @HostListener('document:keydown.escape')
  cerrarMenu() {
    this.menuAbierto.set(false);
  }
}
