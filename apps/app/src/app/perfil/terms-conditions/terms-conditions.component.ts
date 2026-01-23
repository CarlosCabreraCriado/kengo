import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-terms-conditions',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './terms-conditions.component.html',
  styleUrl: './terms-conditions.component.css',
})
export class TermsConditionsComponent {
  private dialogRef = inject(MatDialogRef<TermsConditionsComponent>);

  cerrar() {
    this.dialogRef.close();
  }
}
