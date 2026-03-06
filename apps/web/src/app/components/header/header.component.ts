import { Component, signal, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4 sm:px-6 lg:px-8">

      <!-- Pill wrapper — gradient border effect -->
      <div
        class="pill-border w-full max-w-7xl"
        [class.pill-border-scrolled]="isScrolled()"
        [style.transform]="isHidden() ? 'translateY(-140%)' : 'translateY(0)'"
        style="transition: transform 0.38s cubic-bezier(0.4,0,0.2,1)"
      >
        <div class="nav-pill flex items-center justify-between px-4 sm:px-5 h-14">

          <!-- Logo -->
          <a href="/" class="logo-link flex items-center shrink-0 group">
            <span class="titulo-kengo text-2xl sm:text-[1.6rem] text-primary leading-none">KENGO</span>
          </a>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-0.5">
            @for (link of navLinks; track link.href) {
              <a
                [href]="link.href"
                class="nav-link px-4 py-2 rounded-full text-[0.85rem] font-medium text-gray-600 transition-all duration-200 hover:text-primary hover:bg-primary/8"
                [class.nav-link-active]="activeSection() === link.id"
              >{{ link.label }}</a>
            }
          </nav>

          <!-- Actions -->
          <div class="flex items-center gap-1.5">
            <a
              href="https://app.kengoapp.com/login"
              class="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-[0.85rem] font-medium text-gray-600 transition-all duration-200 hover:text-primary hover:bg-primary/8"
            >
              Iniciar sesión
            </a>

            <!-- Gradient border CTA -->
            <a href="https://app.kengoapp.com/registro" class="cta-pill">
              <span class="cta-pill-inner">
                Registrarse
                <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </span>
            </a>

            <!-- Mobile hamburger -->
            <button
              (click)="toggleMobileMenu()"
              class="md:hidden flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 active:scale-95"
              [class.hamburger-open]="mobileMenuOpen()"
            >
              <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                @if (mobileMenuOpen()) {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                } @else {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                }
              </svg>
            </button>
          </div>

        </div>
      </div>

      <!-- Mobile dropdown menu -->
      @if (mobileMenuOpen()) {
        <div
          class="mobile-menu absolute top-full left-4 right-4 mt-2 rounded-2xl overflow-hidden"
          [class.mobile-menu-closing]="menuClosing()"
        >
          <div class="px-3 py-4 space-y-0.5">
            @for (link of navLinks; track link.href) {
              <a
                [href]="link.href"
                (click)="closeMobileMenu()"
                class="flex items-center px-4 py-3 rounded-xl text-[0.9rem] font-medium text-gray-700 transition-all hover:bg-primary/10 hover:text-primary"
              >{{ link.label }}</a>
            }
          </div>
          <div class="px-3 pb-4 pt-1 border-t border-orange-100/60 space-y-2">
            <a
              href="https://app.kengoapp.com/login"
              class="flex items-center px-4 py-3 rounded-xl text-[0.9rem] font-medium text-gray-700 transition-all hover:bg-primary/10 hover:text-primary"
            >Iniciar sesión</a>
            <a href="https://app.kengoapp.com/registro" class="cta-pill-full">
              <span class="cta-pill-inner-full">Registrarse gratis</span>
            </a>
          </div>
        </div>
      }
    </header>

    @if (mobileMenuOpen()) {
      <div
        class="fixed inset-0 z-40 md:hidden"
        [class.backdrop-closing]="menuClosing()"
        (click)="closeMobileMenu()"
        (keydown.escape)="closeMobileMenu()"
        tabindex="0" role="button" aria-label="Cerrar menu"
      ></div>
    }
  `,
  styles: [`
    :host { display: block; }

    /* ── Gradient border wrapper ── */
    .pill-border {
      padding: 1.5px;
      border-radius: 9999px;
      background: linear-gradient(
        135deg,
        rgba(255,255,255,0.9) 0%,
        rgba(231,92,62,0.25) 50%,
        rgba(239,192,72,0.3) 100%
      );
      transition: background 0.3s ease, box-shadow 0.3s ease;
      box-shadow: 0 2px 16px rgba(231,92,62,0.08), 0 1px 4px rgba(0,0,0,0.04);
    }

    .pill-border-scrolled {
      background: linear-gradient(
        135deg,
        rgba(255,255,255,1) 0%,
        rgba(231,92,62,0.35) 50%,
        rgba(239,192,72,0.45) 100%
      );
      box-shadow: 0 4px 28px rgba(231,92,62,0.12), 0 2px 8px rgba(0,0,0,0.06);
    }

    /* ── Inner pill ── */
    .nav-pill {
      background: rgba(255,250,247,0.82);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border-radius: 9999px;
    }

    /* ── Logo ── */
    .logo-link { transition: opacity 0.2s; }
    .logo-link:hover { opacity: 0.8; }

    /* ── Nav links ── */
    .nav-link-active {
      color: #e75c3e !important;
      background: rgba(231,92,62,0.09) !important;
    }

    /* ── Gradient border CTA button ── */
    .cta-pill {
      display: inline-flex;
      padding: 1.5px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #e75c3e 0%, #efc048 100%);
      transition: box-shadow 0.25s ease, transform 0.2s ease;
      box-shadow: 0 2px 10px rgba(231,92,62,0.28);
      text-decoration: none;
    }

    .cta-pill:hover {
      box-shadow: 0 4px 18px rgba(231,92,62,0.42);
      transform: translateY(-1px);
    }

    .cta-pill:active { transform: scale(0.97); }

    .cta-pill-inner {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 18px;
      border-radius: 9999px;
      background: rgba(255,250,247,0.95);
      color: #c94a2f;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      transition: background 0.2s;
    }

    .cta-pill:hover .cta-pill-inner {
      background: rgba(255,250,247,1);
    }

    /* ── Mobile hamburger ── */
    .hamburger-open {
      background: rgba(231,92,62,0.12);
      color: #e75c3e;
    }

    /* ── Mobile menu ── */
    .mobile-menu {
      background: rgba(255,250,247,0.97);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid rgba(255,255,255,0.7);
      box-shadow: 0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(231,92,62,0.06);
      animation: menuDown 0.28s cubic-bezier(0.22,1,0.36,1) forwards;
    }

    .mobile-menu-closing {
      animation: menuUp 0.22s ease-in forwards;
    }

    .cta-pill-full {
      display: block;
      padding: 1.5px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #e75c3e 0%, #efc048 100%);
      text-decoration: none;
    }

    .cta-pill-inner-full {
      display: block;
      padding: 10px 0;
      border-radius: 9999px;
      background: rgba(255,250,247,0.95);
      color: #c94a2f;
      font-size: 0.9rem;
      font-weight: 600;
      text-align: center;
    }

    .backdrop-closing { animation: fadeOut 0.22s ease-in forwards; }

    @keyframes menuDown {
      from { opacity: 0; transform: translateY(-6px) scale(0.99); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes menuUp {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(-6px); }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  isScrolled = signal(false);
  isHidden = signal(false);
  mobileMenuOpen = signal(false);
  menuClosing = signal(false);
  activeSection = signal('');

  private lastScrollY = 0;

  navLinks = [
    { id: 'beneficios', href: '#beneficios', label: 'Beneficios' },
    { id: 'como-funciona', href: '#como-funciona', label: '¿Cómo funciona?' },
    { id: 'features', href: '#features', label: 'Funcionalidades' },
  ];

  private observer: IntersectionObserver | null = null;

  ngOnInit() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeSection.set(entry.target.id);
          }
        }
      },
      { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' }
    );

    for (const link of this.navLinks) {
      const el = document.getElementById(link.id);
      if (el) this.observer.observe(el);
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  @HostListener('document:scroll')
  onScroll() {
    const currentY = document.documentElement.scrollTop || document.body.scrollTop;
    this.isScrolled.set(currentY > 20);
    if (currentY > this.lastScrollY && currentY > 80) {
      this.isHidden.set(true);
    } else {
      this.isHidden.set(false);
    }
    this.lastScrollY = currentY;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.menuClosing.set(true);
    setTimeout(() => {
      this.mobileMenuOpen.set(false);
      this.menuClosing.set(false);
    }, 280);
  }
}
