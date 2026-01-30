import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';

export type DrawerPosition = 'left' | 'right' | 'bottom';

@Component({
  selector: 'ui-drawer',
  standalone: true,
  imports: [],
  template: `
    @if (isOpen) {
      <!-- Backdrop -->
      <div
        class="ui-drawer-backdrop"
        (click)="onBackdropClick()"
        [@.disabled]="true"
      ></div>

      <!-- Drawer panel -->
      <div class="ui-drawer-panel" [class]="panelClasses">
        <ng-content></ng-content>
      </div>
    }
  `,
  styles: [`
    .ui-drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 40;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .ui-drawer-panel {
      position: fixed;
      z-index: 50;
      background: white;
      box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
      overflow-y: auto;
    }

    /* Left position */
    .ui-drawer-panel.left {
      top: 0;
      left: 0;
      height: 100%;
      animation: slideInLeft 0.3s ease-out;
    }

    @keyframes slideInLeft {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }

    /* Right position */
    .ui-drawer-panel.right {
      top: 0;
      right: 0;
      height: 100%;
      animation: slideInRight 0.3s ease-out;
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    /* Bottom position */
    .ui-drawer-panel.bottom {
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 90vh;
      border-radius: 1.5rem 1.5rem 0 0;
      animation: slideInBottom 0.3s ease-out;
    }

    @keyframes slideInBottom {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    /* Size classes for left/right */
    .ui-drawer-panel.left.sm,
    .ui-drawer-panel.right.sm {
      width: 280px;
    }

    .ui-drawer-panel.left.md,
    .ui-drawer-panel.right.md {
      width: 380px;
    }

    .ui-drawer-panel.left.lg,
    .ui-drawer-panel.right.lg {
      width: 500px;
    }

    .ui-drawer-panel.left.full,
    .ui-drawer-panel.right.full {
      width: 100%;
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .ui-drawer-panel.left,
      .ui-drawer-panel.right {
        width: 100% !important;
        max-width: 100%;
      }
    }
  `]
})
export class DrawerComponent {
  @Input() isOpen = false;
  @Input() position: DrawerPosition = 'right';
  @Input() size: 'sm' | 'md' | 'lg' | 'full' = 'md';
  @Input() closeOnBackdrop = true;
  @Input() closeOnEscape = true;

  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen && this.closeOnEscape) {
      this.close();
    }
  }

  get panelClasses(): string {
    return `${this.position} ${this.size}`;
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }
}
