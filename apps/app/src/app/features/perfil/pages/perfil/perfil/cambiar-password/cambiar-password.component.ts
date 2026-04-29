import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Ui2ButtonComponent, Ui2InputComponent } from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-change-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Ui2InputComponent, Ui2ButtonComponent],
  templateUrl: './cambiar-password.component.html',
  styleUrl: './cambiar-password.component.css',
})
export class CambiarPasswordComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    actual: [''],
    nueva: [''],
    confirmar: [''],
  });
}
