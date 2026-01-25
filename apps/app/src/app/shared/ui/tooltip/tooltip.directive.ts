import { Directive, Input, ElementRef, OnDestroy, HostListener } from '@angular/core';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

@Directive({
  selector: '[uiTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  @Input('uiTooltip') text = '';
  @Input() tooltipPosition: TooltipPosition = 'top';
  @Input() tooltipDelay = 300;

  private tooltipElement: HTMLDivElement | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.text) return;

    this.showTimeout = setTimeout(() => {
      this.show();
    }, this.tooltipDelay);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.hide();
  }

  @HostListener('click')
  onClick(): void {
    this.hide();
  }

  private show(): void {
    this.hide(); // Remove any existing tooltip

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.textContent = this.text;
    this.tooltipElement.className = 'ui-tooltip';

    // Apply styles
    Object.assign(this.tooltipElement.style, {
      position: 'fixed',
      zIndex: '9999',
      padding: '0.375rem 0.625rem',
      fontSize: '0.75rem',
      fontWeight: '500',
      color: 'white',
      backgroundColor: '#1f2937',
      borderRadius: '0.375rem',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.15s',
    });

    document.body.appendChild(this.tooltipElement);

    // Position the tooltip
    this.positionTooltip();

    // Fade in
    requestAnimationFrame(() => {
      if (this.tooltipElement) {
        this.tooltipElement.style.opacity = '1';
      }
    });
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostRect = this.elementRef.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (this.tooltipPosition) {
      case 'top':
        top = hostRect.top - tooltipRect.height - gap;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = hostRect.bottom + gap;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + gap;
        break;
    }

    // Keep within viewport
    const padding = 8;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
  }

  private hide(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }

    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
