import { Component, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="fixed top-0 right-0 left-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div
          class="navbar-pill flex items-center justify-between rounded-full border border-white/50 bg-white/80 px-4 py-2 shadow-md backdrop-blur-md transition-all duration-300"
          [class.navbar-pill-scrolled]="isScrolled()"
        >
          <!-- Logo -->
          <a href="/" class="group flex items-center gap-2 pl-2">
            <img
              src="logo-kengo-horizontal.svg"
              alt="Kengo"
              class="h-8 transition-transform group-hover:scale-105 sm:h-10"
            />
          </a>


<!-- CTA Buttons -->
          <div class="flex items-center gap-3 pr-1">
            <a
              href="https://kengoapp.com/login"
              class="btn-kengo rounded-full! !px-5 !py-2.5 !text-sm"
            >
              <span>Comenzar</span>
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </a>

          </div>
        </div>
      </div>

    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .navbar-pill-scrolled {
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      }


    `,
  ],
})
export class HeaderComponent {
  isScrolled = signal(false);

  @HostListener('window:scroll')
  onScroll() {
    this.isScrolled.set(window.scrollY > 20);
  }

}
