import { Component, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header
      class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      [class.header-scrolled]="isScrolled()"
      [class.header-transparent]="!isScrolled()"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">
          <!-- Logo -->
          <a href="/" class="flex items-center gap-2 group">
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
                class="nav-link px-4 py-2 rounded-xl text-gray-700 font-medium transition-all hover:text-primary hover:bg-primary/5"
              >
                {{ link.label }}
              </a>
            }
          </nav>

          <!-- CTA Buttons -->
          <div class="flex items-center gap-3">
            <a
              href="https://app.kengoapp.com/login"
              class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-gray-700 font-medium transition-all hover:text-primary hover:bg-primary/5"
            >
              Iniciar sesion
            </a>
            <a
              href="https://app.kengoapp.com/registro"
              class="btn-kengo !px-5 !py-2.5 !text-sm !rounded-xl"
            >
              <span>Registrarse</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>

            <!-- Mobile Menu Button -->
            <button
              (click)="toggleMobileMenu()"
              class="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-white/60 border border-white/40 text-gray-700 transition-all active:scale-95"
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
        <div class="md:hidden mobile-menu">
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

    .header-transparent {
      background: transparent;
    }

    .header-scrolled {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
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

    .nav-link:hover::after {
      width: 60%;
    }

    .mobile-menu {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.5);
      animation: slideDown 0.3s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class HeaderComponent {
  isScrolled = signal(false);
  mobileMenuOpen = signal(false);

  navLinks = [
    { href: '#beneficios', label: 'Beneficios' },
    { href: '#como-funciona', label: 'Como funciona' },
    { href: '#features', label: 'Funcionalidades' },
  ];

  @HostListener('window:scroll')
  onScroll() {
    this.isScrolled.set(window.scrollY > 20);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }
}
