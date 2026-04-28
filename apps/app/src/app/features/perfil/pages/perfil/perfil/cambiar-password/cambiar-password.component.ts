import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { InputComponent, ButtonComponent } from '../../../../../../shared';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent],
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
