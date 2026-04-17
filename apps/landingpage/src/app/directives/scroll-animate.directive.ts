import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: '[scrollAnimate]',
  standalone: true,
})
export class ScrollAnimateDirective implements OnInit, OnDestroy {
  @Input() animationClass = 'is-visible';
  @Input() threshold = 0.15;
  @Input() animateOnce = true;

  private observer: IntersectionObserver | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      this.renderer.addClass(this.el.nativeElement, this.animationClass);
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.renderer.addClass(this.el.nativeElement, this.animationClass);
            if (this.animateOnce) {
              this.observer?.disconnect();
            }
          } else if (!this.animateOnce) {
            this.renderer.removeClass(this.el.nativeElement, this.animationClass);
          }
        });
      },
      { threshold: this.threshold }
    );

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
