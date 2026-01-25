import { Component, Input, Output, EventEmitter, ElementRef, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
  danger?: boolean;
}

@Component({
  selector: 'ui-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ui-menu-container" [class.open]="isOpen()">
      <!-- Trigger -->
      <div class="ui-menu-trigger" (click)="toggle()">
        <ng-content select="[trigger]"></ng-content>
      </div>

      <!-- Menu dropdown -->
      @if (isOpen()) {
        <div class="ui-menu-dropdown" [class]="positionClasses">
          @for (item of items; track item.id) {
            @if (item.divider) {
              <div class="ui-menu-divider"></div>
            } @else {
              <button
                type="button"
                class="ui-menu-item"
                [class.disabled]="item.disabled"
                [class.danger]="item.danger"
                [disabled]="item.disabled"
                (click)="selectItem(item)"
              >
                @if (item.icon) {
                  <span class="material-symbols-outlined text-lg">{{ item.icon }}</span>
                }
                <span>{{ item.label }}</span>
              </button>
            }
          }
          <ng-content></ng-content>
        </div>
      }
    </div>
  `,
  styles: [`
    .ui-menu-container {
      position: relative;
      display: inline-block;
    }

    .ui-menu-trigger {
      cursor: pointer;
    }

    .ui-menu-dropdown {
      position: absolute;
      z-index: 50;
      min-width: 10rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.75rem;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      padding: 0.25rem;
      animation: menuFadeIn 0.15s ease-out;
    }

    @keyframes menuFadeIn {
      from {
        opacity: 0;
        transform: translateY(-0.5rem);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Position classes */
    .ui-menu-dropdown.bottom-right {
      top: 100%;
      right: 0;
      margin-top: 0.25rem;
    }

    .ui-menu-dropdown.bottom-left {
      top: 100%;
      left: 0;
      margin-top: 0.25rem;
    }

    .ui-menu-dropdown.top-right {
      bottom: 100%;
      right: 0;
      margin-bottom: 0.25rem;
    }

    .ui-menu-dropdown.top-left {
      bottom: 100%;
      left: 0;
      margin-bottom: 0.25rem;
    }

    .ui-menu-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.5rem 0.75rem;
      text-align: left;
      font-size: 0.875rem;
      color: #374151;
      border: none;
      background: transparent;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .ui-menu-item:hover:not(.disabled) {
      background-color: #f3f4f6;
    }

    .ui-menu-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ui-menu-item.danger {
      color: #dc2626;
    }

    .ui-menu-item.danger:hover:not(.disabled) {
      background-color: #fef2f2;
    }

    .ui-menu-divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 0.25rem 0;
    }
  `]
})
export class MenuComponent {
  @Input() items: MenuItem[] = [];
  @Input() position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';

  @Output() itemSelected = new EventEmitter<MenuItem>();

  isOpen = signal(false);

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  get positionClasses(): string {
    return this.position;
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  selectItem(item: MenuItem): void {
    if (!item.disabled) {
      this.itemSelected.emit(item);
      this.close();
    }
  }
}
