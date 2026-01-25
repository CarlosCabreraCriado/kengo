import { Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';

@Component({
  selector: 'app-terms-conditions',
  standalone: true,
  imports: [],
  templateUrl: './terms-conditions.component.html',
  styleUrl: './terms-conditions.component.css',
})
export class TermsConditionsComponent {
  private dialogRef = inject(DialogRef);

  cerrar() {
    this.dialogRef.close();
  }
}
