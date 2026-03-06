import { Component, signal, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="fixed top-0 left-0 right-0 z-50 pt-4 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <div class="navbar-pill flex justify-between items-center px-4 py-2 bg-white/70 backdrop-blur-md border border-white/50 rounded-full shadow-md transition-all duration-300"
          [class.navbar-pill-scrolled]="isScrolled()"
        >
          <!-- Logo -->
          <a href="/" class="flex items-center gap-2 group pl-2">
            <div class="logo-container">
              <span class="titulo-kengo text-3xl sm:text-4xl text-primary transition-transform group-hover:scale-105">
                KENGO
              </span>
            </div>
          </a>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-1">
            @for (link of navLinks; track link.href) {
              <a
                [href]="link.href"
                class="nav-link px-4 py-2 rounded-full text-gray-700 font-medium transition-all hover:text-primary hover:bg-primary/5"
                [class.nav-link-active]="activeSection() === link.id"
              >
                {{ link.label }}
              </a>
            }
          </nav>

          <!-- CTA Buttons -->
          <div class="flex items-center gap-3 pr-1">
            <a
              href="https://app.kengoapp.com/login"
              class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-gray-700 font-medium transition-all hover:text-primary hover:bg-primary/5"
            >
              Iniciar sesion
            </a>
            <a
              href="https://app.kengoapp.com/registro"
              class="btn-kengo !px-5 !py-2.5 !text-sm rounded-full!"
            >
              <span>Registrarse</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>

            <!-- Mobile Menu Button -->
            <button
              (click)="toggleMobileMenu()"
              class="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-white/60 border border-white/40 text-gray-700 transition-all active:scale-95"
              [class.bg-primary]="mobileMenuOpen()"
              [class.text-white]="mobileMenuOpen()"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                @if (mobileMenuOpen()) {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                } @else {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Menu -->
      @if (mobileMenuOpen()) {
        <div class="md:hidden mobile-menu" [class.mobile-menu-closing]="menuClosing()">
          <div class="px-4 py-6 space-y-2">
            @for (link of navLinks; track link.href) {
              <a
                [href]="link.href"
                (click)="closeMobileMenu()"
                class="block px-4 py-3 rounded-xl text-gray-700 font-medium transition-all hover:bg-primary/10 hover:text-primary"
              >
                {{ link.label }}
              </a>
            }
            <div class="pt-4 border-t border-gray-200/50">
              <a
                href="https://app.kengoapp.com/login"
                class="block px-4 py-3 rounded-xl text-gray-700 font-medium transition-all hover:bg-primary/10 hover:text-primary"
              >
                Iniciar sesion
              </a>
              <a
                href="https://app.kengoapp.com/registro"
                class="block mt-2 btn-kengo w-full text-center"
              >
                Registrarse gratis
              </a>
            </div>
          </div>
        </div>
      }
    </header>

    <!-- Mobile menu backdrop -->
    @if (mobileMenuOpen()) {
      <div
        class="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
        [class.backdrop-closing]="menuClosing()"
        (click)="closeMobileMenu()"
        (keydown.escape)="closeMobileMenu()"
        tabindex="0"
        role="button"
        aria-label="Cerrar menu"
      ></div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    .navbar-pill-scrolled {
      background: rgba(255, 255, 255, 0.85);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .logo-container {
      position: relative;
    }

    .nav-link {
      position: relative;
    }

    .nav-link::after {
      content: '';
      position: absolute;
      bottom: 4px;
      left: 50%;
      width: 0;
      height: 2px;
      background: linear-gradient(90deg, #e75c3e, #efc048);
      border-radius: 1px;
      transition: all 0.3s ease;
      transform: translateX(-50%);
    }

    .nav-link:hover::after,
    .nav-link-active::after {
      width: 60%;
    }

    .nav-link-active {
      color: #e75c3e;
    }

    .mobile-menu {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.5);
      animation: slideDown 0.28s ease-out forwards;
    }

    .mobile-menu-closing {
      animation: slideUp 0.28s ease-in forwards;
    }

    .backdrop-closing {
      animation: fadeOut 0.28s ease-in forwards;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideUp {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-10px); }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  isScrolled = signal(false);
  mobileMenuOpen = signal(false);
  menuClosing = signal(false);
  activeSection = signal('');

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

  @HostListener('window:scroll')
  onScroll() {
    this.isScrolled.set(window.scrollY > 20);
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
