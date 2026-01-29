import { Component, Input, Output, EventEmitter, ContentChildren, QueryList, AfterContentInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-step',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isActive) {
      <div class="ui-step-content" [@.disabled]="true">
        <ng-content></ng-content>
      </div>
    }
  `,
  styles: [`
    .ui-step-content {
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(10px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `]
})
export class StepComponent {
  @Input() label = '';
  @Input() optional = false;
  @Input() completed = false;
  @Input() editable = true;

  isActive = false;
}

@Component({
  selector: 'ui-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ui-stepper" [class.vertical]="orientation === 'vertical'">
      <!-- Step indicators -->
      <div class="ui-stepper-header" [class.vertical]="orientation === 'vertical'">
        @for (step of steps; track $index; let i = $index; let isLast = $last) {
          <div class="ui-stepper-step" [class.completed]="step.completed || i < selectedIndex"
               [class.active]="i === selectedIndex"
               [class.editable]="step.editable && i < selectedIndex"
               (click)="onStepClick(i, step)">
            <div class="ui-stepper-indicator">
              @if (step.completed || i < selectedIndex) {
                <span class="material-symbols-outlined text-white text-base">check</span>
              } @else {
                <span class="text-sm font-medium">{{ i + 1 }}</span>
              }
            </div>
            <div class="ui-stepper-label">
              <span class="ui-stepper-label-text">{{ step.label }}</span>
              @if (step.optional) {
                <span class="ui-stepper-optional">Opcional</span>
              }
            </div>
          </div>
          @if (!isLast) {
            <div class="ui-stepper-connector" [class.completed]="i < selectedIndex"></div>
          }
        }
      </div>

      <!-- Step content -->
      <div class="ui-stepper-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .ui-stepper-header {
      display: flex;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }

    .ui-stepper-header.vertical {
      flex-direction: column;
      margin-bottom: 0;
      margin-right: 1.5rem;
      overflow-x: visible;
    }

    .ui-stepper-step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .ui-stepper-step.editable {
      cursor: pointer;
    }

    .ui-stepper-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background-color: #e5e7eb;
      color: #6b7280;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .ui-stepper-step.active .ui-stepper-indicator {
      background-color: var(--kengo-primary);
      color: white;
    }

    .ui-stepper-step.completed .ui-stepper-indicator {
      background-color: #10b981;
    }

    .ui-stepper-label {
      display: flex;
      flex-direction: column;
    }

    .ui-stepper-label-text {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      white-space: nowrap;
    }

    .ui-stepper-step.active .ui-stepper-label-text {
      color: var(--kengo-primary);
    }

    .ui-stepper-optional {
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .ui-stepper-connector {
      flex: 1;
      min-width: 2rem;
      height: 2px;
      background-color: #e5e7eb;
      margin: 0 0.5rem;
      align-self: center;
      margin-top: 0;
    }

    .ui-stepper-connector.completed {
      background-color: #10b981;
    }

    .ui-stepper.vertical {
      display: flex;
    }

    .ui-stepper.vertical .ui-stepper-connector {
      width: 2px;
      height: 2rem;
      min-width: 2px;
      margin: 0.25rem 0;
      margin-left: 0.9375rem;
    }

    .ui-stepper-content {
      flex: 1;
    }
  `]
})
export class StepperComponent implements AfterContentInit {
  @ContentChildren(StepComponent) stepsQuery!: QueryList<StepComponent>;

  @Input() selectedIndex = 0;
  @Input() orientation: 'horizontal' | 'vertical' = 'horizontal';
  @Input() linear = false;

  @Output() selectedIndexChange = new EventEmitter<number>();
  @Output() selectionChange = new EventEmitter<{ selectedIndex: number; previousIndex: number }>();

  steps: StepComponent[] = [];

  ngAfterContentInit(): void {
    this.steps = this.stepsQuery.toArray();
    this.updateSteps();

    this.stepsQuery.changes.subscribe(() => {
      this.steps = this.stepsQuery.toArray();
      this.updateSteps();
    });
  }

  private updateSteps(): void {
    this.steps.forEach((step, index) => {
      step.isActive = index === this.selectedIndex;
    });
  }

  onStepClick(index: number, step: StepComponent): void {
    if (this.linear && index > this.selectedIndex) {
      return; // Can't skip ahead in linear mode
    }
    if (!step.editable && index < this.selectedIndex) {
      return; // Can't go back if not editable
    }
    this.goToStep(index);
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps.length || index === this.selectedIndex) {
      return;
    }

    const previousIndex = this.selectedIndex;
    this.selectedIndex = index;
    this.updateSteps();

    this.selectedIndexChange.emit(this.selectedIndex);
    this.selectionChange.emit({ selectedIndex: this.selectedIndex, previousIndex });
  }

  next(): void {
    this.goToStep(this.selectedIndex + 1);
  }

  previous(): void {
    this.goToStep(this.selectedIndex - 1);
  }

  reset(): void {
    this.steps.forEach(step => step.completed = false);
    this.goToStep(0);
  }
}
