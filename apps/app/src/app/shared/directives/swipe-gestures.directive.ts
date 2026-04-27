import { Directive, HostListener, input, output } from '@angular/core';

export type SwipeDirection = 'up' | 'down';

@Directive({
  selector: '[appSwipeGestures]',
  standalone: true,
})
export class SwipeGesturesDirective {
  readonly touchThreshold = input(50);
  readonly wheelThreshold = input(30);

  readonly swipe = output<SwipeDirection>();

  private touchStartY = 0;

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    const threshold = this.wheelThreshold();
    if (event.deltaY < -threshold) {
      this.swipe.emit('up');
    } else if (event.deltaY > threshold) {
      this.swipe.emit('down');
    }
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    // touchStartY - touchEndY > 0 → dedo subió → contenido baja → equivalente a wheel abajo ('down')
    const touchEndY = event.changedTouches[0].clientY;
    const deltaY = this.touchStartY - touchEndY;
    const threshold = this.touchThreshold();

    if (deltaY > threshold) {
      this.swipe.emit('down');
    } else if (deltaY < -threshold) {
      this.swipe.emit('up');
    }
  }
}
