import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './cambiar-password.component.html',
  styleUrl: './cambiar-password.component.scss',
})
export class CambiarPasswordComponent {
  // Password Hide
  public hide = true;
  public hide2 = true;
  public hide3 = true;
}
