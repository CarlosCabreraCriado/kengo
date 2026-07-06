import { Directive, ElementRef, inject, Injectable, OnDestroy } from '@angular/core';

/**
 * Punto de verdad del contenedor de scroll activo del shell.
 *
 * El documento tiene `overflow: hidden` (styles.css) y el scroll real vive en
 * los `<main class="overflow-y-auto">` de app.component.html. `window.scrollY`
 * es siempre 0, así que cualquier lógica de guardado/restauración de posición
 * (CustomRouteReuseStrategy, scroll-to-top en navegación) debe operar sobre el
 * contenedor registrado aquí, no sobre window.
 *
 * Solo hay un shell montado a la vez (mobile o desktop, paciente o fisio);
 * cada `<main>` se registra al crearse vía la directiva `appScrollContainer`
 * y se desregistra al destruirse.
 */
@Injectable({ providedIn: 'root' })
export class ScrollContainerService {
  private container: HTMLElement | null = null;

  register(el: HTMLElement): void {
    this.container = el;
  }

  unregister(el: HTMLElement): void {
    if (this.container === el) this.container = null;
  }

  get scrollTop(): number {
    return this.container?.scrollTop ?? 0;
  }

  scrollTo(top: number): void {
    this.container?.scrollTo({ top, behavior: 'instant' });
  }

  scrollToTop(): void {
    this.scrollTo(0);
  }
}

@Directive({
  selector: '[appScrollContainer]',
  standalone: true,
})
export class ScrollContainerDirective implements OnDestroy {
  private readonly service = inject(ScrollContainerService);
  private readonly el = inject(ElementRef<HTMLElement>);

  constructor() {
    this.service.register(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.service.unregister(this.el.nativeElement);
  }
}
